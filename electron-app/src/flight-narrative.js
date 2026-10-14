const feedback=require('./pilot-feedback');
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const delta=(a,b)=>((b-a+540)%360)-180;
const utc=t=>new Date(t*1000).toISOString().replace('T',' ').replace('.000Z','Z');
const PHASES=['all','ground','takeoff','climb','cruise','descent','approach','landing','go-around'];
function place(s){return Object.fromEntries(['altitude','groundSpeed','track','reportedHeading','directToWaypoint','directToDistanceNm','routeNextWaypoint','nearestWaypoint','nearestWaypointDistanceNm'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));}
function filedWaypoints(route){return String(route||'').toUpperCase().split(/\s+/).map(t=>t.split('/')[0]).filter(t=>/^[A-Z]{2,7}$/.test(t)&&!['DCT','CYYZ'].includes(t)).slice(0,30);}
function range(samples,start,end){
  if(!samples.length)throw new Error('No movement history available.');
  const from=feedback.incidentTime(start)??samples[0].ts,to=feedback.incidentTime(end)??samples.at(-1).ts;
  if(from>to)throw new Error('The end time must be after the start time.');
  const selected=samples.filter(s=>s.ts>=from&&s.ts<=to);
  if(!selected.length)throw new Error('No samples fall within that UTC time range.');
  return {samples:selected,from,to};
}
function actions(samples){
  const points=samples.filter(s=>s.event==='radar'&&valid(s.altitude)&&valid(s.groundSpeed));
  const all=[];
  const definitions=[['altitude',0,'climb','descend','level'],['groundSpeed',0,'accelerate','decelerate','steady speed'],['track',0,'right turn','left turn','steady track'],['reportedHeading',0,'right heading change','left heading change','steady heading']];
  for(const [field,tolerance,positive,negative,steady]of definitions){
    let active=null;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],gap=b.ts-a.ts;
      if(gap<=0)continue;
      if(gap>30||!valid(a[field])||!valid(b[field])){active=null;continue;}
      const d=['track','reportedHeading'].includes(field)?delta(a[field],b[field]):b[field]-a[field];
      const kind=d>tolerance?positive:d< -tolerance?negative:steady;
      if(active&&active.kind===kind&&active.end===a.ts){active.end=b.ts;active.to=b[field];active.change+=d;active.atEnd=place(b);}
      else{active={field,kind,start:a.ts,end:b.ts,from:a[field],to:b[field],change:d,atStart:place(a),atEnd:place(b)};all.push(active);}
    }
  }
  for(let i=1;i<points.length;i++)if(points[i].ts-points[i-1].ts>30)all.push({field:'coverage',kind:'gap',start:points[i-1].ts,end:points[i].ts});
  for(let i=1;i<samples.length;i++)for(const field of ['arrivalRunway','departureRunway','clearedAltitude','assignedSpeed','assignedHeading','directToWaypoint','routeNextWaypoint'])if(samples[i][field]!==undefined&&samples[i-1][field]!==undefined&&samples[i][field]!==samples[i-1][field])all.push({field,kind:'assigned field change',start:samples[i].ts,end:samples[i].ts,from:samples[i-1][field],to:samples[i][field],atStart:place(samples[i])});
  return all.sort((a,b)=>a.start-b.start||a.end-b.end).map((a,i)=>({...a,id:'A'+(i+1)}));
}
function sentence(a,begin){
  const offset=Math.max(0,a.start-begin),when=offset<30?'At the beginning of the selected period':`About ${Math.round(offset/60*10)/10} minutes into the selected period`;
  const duration=Math.max(0,a.end-a.start);const span=duration>=60?`over ${(duration/60).toFixed(1)} minutes`:`over ${duration} seconds`;
  const n=x=>valid(x)?Math.round(x*10)/10:String(x);
  if(a.kind==='gap')return `${when}, the recorded positions have a ${duration}-second gap, so the intervening movement cannot be described reliably.`;
  if(a.field==='altitude')return `${when}, the aircraft ${a.kind==='climb'?'climbed':a.kind==='descend'?'descended':'remained approximately level'}, with recorded altitude changing from ${n(a.from)} to ${n(a.to)} feet ${span}.`;
  if(a.field==='groundSpeed')return `${when}, it ${a.kind==='accelerate'?'accelerated':a.kind==='decelerate'?'decelerated':'maintained roughly the same ground speed'}, from ${n(a.from)} to ${n(a.to)} knots ${span}.`;
  if(a.field==='track'||a.field==='reportedHeading')return `${when}, its ${a.field==='track'?'ground track':'reported magnetic heading'} ${a.kind.startsWith('steady')?'stayed broadly steady':a.change>0?'shifted to the right':'shifted to the left'}, from ${n(a.from)} to ${n(a.to)} degrees ${span}.`;
  return `${when}, the recorded ${a.field} field changed from ${n(a.from)} to ${n(a.to)}; this does not establish what was transmitted to the pilot.`;
}
function analyze(samples,input,malformed=0){
  const selected=range(samples,input.startTime,input.endTime),data=selected.samples,events=actions(data),first=data[0];
  const phase=PHASES.includes(input.phase)?input.phase:'all';
  const question=String(input.question||'').trim().slice(0,4000);
  const waypoints=filedWaypoints(first.route);
  const spatial=[];const seen=new Set();
  for(const s of data){const key=[s.directToWaypoint,s.routeNextWaypoint,s.nearestWaypoint].join('|');if(seen.has(key))continue;seen.add(key);
    if(s.directToWaypoint)spatial.push({ts:s.ts,kind:'recorded direct-to field',name:s.directToWaypoint,distanceNm:s.directToDistanceNm});
    if(s.routeNextWaypoint)spatial.push({ts:s.ts,kind:'calculated next route point, not a clearance',name:s.routeNextWaypoint});
    if(s.nearestWaypoint)spatial.push({ts:s.ts,kind:'nearest recorded route waypoint',name:s.nearestWaypoint,distanceNm:s.nearestWaypointDistanceNm});
  }
  const limitations='This describes recorded movement, not pilot intent or compliance. Speeds are groundspeeds. Ground track is not heading; heading is included only when recorded. Consecutive changes in the same direction are grouped, and gaps over 30 seconds are not interpolated.'+(first.source==='euroscope_log_import'?' Imported-log altitude datum and UTC clock should be verified.':'');
  const header=`# Flight narrative — ${first.callsign}\nSelected range: ${utc(selected.from)} to ${utc(selected.to)}.${phase!=='all'?`\nPhase selected by you: ${phase} (time range unchanged).`:''}\n\n`;
  const prose=events.length?events.map(a=>sentence(a,data[0].ts)).join('\n\n'):'No successive usable movement samples are available in this range. No aircraft actions can be reconstructed.';
  const locationText=spatial.length?spatial.map(p=>`${p.kind==='recorded direct-to field'?'EuroScope recorded a direct-to assignment to':p.kind==='nearest recorded route waypoint'?'The nearest recorded route waypoint was':'The calculated next route point was'} ${p.name}${valid(p.distanceNm)?`, ${p.distanceNm.toFixed(1)} NM away`:''}.`).join(' '):waypoints.length?`The filed route included ${waypoints.join(', ')}. Current direct-to and waypoint distances were not recorded, so the aircraft's active direct-to cannot be established from route names alone.`:'No waypoint context was recorded.';
  const result={narrative:true,header,limitations,samples:data,actions:events,spatial,routeWaypoints:waypoints,locationText,peers:[],stats:feedback.summary(data),malformed,input:{startTime:utc(selected.from),endTime:utc(selected.to),phase,question}};
  result.questionAnswer=question?answer(result,question):'';
  result.report=header+prose+'\n\n'+locationText+(question?'\n\n## Your question\n'+question+'\n\n'+result.questionAnswer:'')+'\n\n'+limitations;
  return result;
}
function answer(report,question){
  const q=question.toLowerCase();
  if(/why|reason|intent/.test(q))return 'The recorded movement does not establish why the pilot acted. It can show when and how the aircraft changed, but not intent or an unrecorded instruction.';
  let matches=report.actions;
  if(/turn|heading|track/.test(q))matches=matches.filter(a=>['track','reportedHeading'].includes(a.field)&&!a.kind.startsWith('steady'));
  else if(/climb|descen|altitude|feet|level/.test(q))matches=matches.filter(a=>a.field==='altitude');
  else if(/speed|accelerat|slow/.test(q))matches=matches.filter(a=>a.field==='groundSpeed'&&a.kind!=='steady speed');
  else if(/direct|waypoint|fix|where/.test(q))return report.locationText;
  else return 'The factual narrative above contains the recorded movement. Enable local AI for an answer to this more specific question; missing instructions or intent still cannot be inferred.';
  if(!matches.length)return 'No matching recorded change was found in the selected time range. This does not establish what happened outside that range.';
  return matches.slice(0,20).map(a=>`From ${utc(a.start)} to ${utc(a.end)}, the recorded ${a.field==='groundSpeed'?'ground speed':a.field==='reportedHeading'?'magnetic heading':a.field==='track'?'ground track':'altitude'} changed from ${Number(a.from).toFixed(1)} to ${Number(a.to).toFixed(1)}${a.atStart?.groundSpeed!==undefined?`; ground speed at the start was ${a.atStart.groundSpeed} knots`:''}${a.atStart?.nearestWaypoint?`, near the recorded route waypoint ${a.atStart.nearestWaypoint}`:''}.`).join(' ')+(matches.length>20?` Showing the first 20 of ${matches.length} intervals; select a shorter range for a focused answer.`:'');
}
async function generate(folder,id,input){const data=await feedback.read(folder,id);return analyze(data.samples,input,data.malformed);}
module.exports={range,actions,sentence,analyze,generate,answer,PHASES,filedWaypoints};
