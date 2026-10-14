const fs = require('node:fs/promises');
const path = require('node:path');
const ID = /^(\d+_\d+)_([A-Z0-9]{1,12})\.jsonl$/;
const utc = ts => new Date(ts * 1000).toISOString().replace('T', ' ').replace('.000Z', 'Z');
const text = (s, limit = 16000) => String(s ?? '').slice(0, limit);
const numeric = x => typeof x === 'number' && Number.isFinite(x);
const positioned = s => numeric(s.lat) && numeric(s.lon) && numeric(s.altitude) && Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180;
function incidentTime(value) {
  if (!String(value || '').trim()) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}Z$/.test(s)) throw new Error('Incident time must be YYYY-MM-DD HH:MM:SSZ (UTC), or blank.');
  const timestamp = Date.parse(s.replace(' ', 'T'));
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0,19) !== s.replace(' ', 'T').slice(0,19)) throw new Error('Invalid UTC incident time.');
  return timestamp / 1000;
}
async function list(folder) {
  let entries;
  try { entries = await fs.readdir(folder, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const files = await Promise.all(entries.filter(e => e.isFile() && ID.test(e.name)).map(async e => {
    const m = e.name.match(ID); const stat = await fs.stat(path.join(folder, e.name));
    return { id: e.name, session: m[1], callsign: m[2], started: utc(Number(m[1].split('_')[0])), bytes: stat.size, updated: stat.mtimeMs };
  }));
  return files.sort((a,b) => b.updated - a.updated);
}
async function read(folder, id) {
  const match = String(id).match(ID); if (!match) throw new Error('Select a recorded aircraft.');
  const file = path.join(folder, id); const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid movement history file.');
  if (stat.size > 64 * 1024 * 1024) throw new Error('Movement file exceeds the 64 MB report limit. Use a shorter session.');
  const content = await fs.readFile(file, 'utf8'); const lines = content.split('\n'); const samples = [];
  let malformed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let s;
    try { s = JSON.parse(lines[i]); } catch { if (i === lines.length - 1) continue; malformed++; continue; }
    if (!numeric(s.ts) || s.ts <= 0 || s.ts >= 8640000000000 || s.session !== match[1] || s.callsign !== match[2] || (s.origin !== 'CYYZ' && s.destination !== 'CYYZ')) { malformed++; continue; }
    samples.push(s);
  }
  samples.sort((a,b) => a.ts - b.ts);
  return { samples, malformed };
}
function distance(a,b) {
  const rad = x => x * Math.PI / 180;
  const h = Math.sin(rad(b.lat-a.lat)/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;
  return 3440.065 * 2 * Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
function nearest(samples, ts) {
  let lo=0,hi=samples.length;
  while(lo<hi) { const mid=(lo+hi)>>1; if(samples[mid].ts<ts) lo=mid+1; else hi=mid; }
  const candidates=[samples[lo],samples[lo-1]].filter(Boolean);
  return candidates.sort((a,b)=>Math.abs(a.ts-ts)-Math.abs(b.ts-ts))[0];
}
function headingDelta(a,b) { return ((b-a+540)%360)-180; }
function summary(samples) {
  const p=samples.filter(positioned); const radar=p.filter(s=>s.event==='radar');
  let longestGap=0, distanceNm=0;
  for(let i=1;i<radar.length;i++) {
    const dt=radar[i].ts-radar[i-1].ts; longestGap=Math.max(longestGap,dt);
    if(dt>0 && dt<=30) distanceNm+=distance(radar[i-1],radar[i]);
  }
  const values=field=>p.map(s=>s[field]).filter(numeric);
  const range=field=>{const v=values(field);return v.length ? v.reduce((r,x)=>[Math.min(r[0],x),Math.max(r[1],x)],[Infinity,-Infinity]) : null;};
  return { positioned:p.length, radar:radar.length, longestGap, distanceNm, altitude:range('altitude'), speed:range('groundSpeed') };
}
function snapshot(s) {
  return positioned(s) ? `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}; pressure altitude ${s.altitude} ft; GS ${numeric(s.groundSpeed)?s.groundSpeed:'unknown'} kt; ground track ${numeric(s.track)?s.track.toFixed(1):'unknown'}°; reported magnetic heading ${numeric(s.reportedHeading)?s.reportedHeading:'unknown'}°; vertical speed ${numeric(s.verticalSpeed)?s.verticalSpeed:'unknown'} ft/min; position age ${numeric(s.positionAgeSeconds)?s.positionAgeSeconds:'unknown'}s` : 'No valid correlated radar position in this snapshot';
}
function analyze(samples, input, peers = [], malformed = 0) {
  if(!samples.length) throw new Error('No usable movement history. Recording begins after the updated plugin connects to the network.');
  const concern=text(input.concern).trim(); if(!concern) throw new Error('Describe what the pilot did wrong; the report will not guess.');
  const incident=incidentTime(input.incidentTime); const instructions=text(input.instructions).trim(); const controllerNotes=text(input.controllerNotes).trim();
  const first=samples[0],last=samples.at(-1),stats=summary(samples);
  const focus=incident===null?samples:samples.filter(s=>Math.abs(s.ts-incident)<=300);
  const report=[]; const add=(...s)=>report.push(...s);
  add(`# ZYZTools pilot and controller feedback — ${first.callsign}`, '', 'LOCAL EVIDENCE REVIEW — not an official disciplinary finding or an AI judgment.', '',
    '## User-reported issue (not independently verified)', concern, '',
    '## User-provided instructions / radio context (not independently verified)', instructions||'Not supplied. Spoken instructions, readbacks, acknowledgments and radio timing cannot be reconstructed from movement alone.', '',
    '## Controller self-review notes (user-provided)', controllerNotes||'Not supplied.', '',
    '## Recording and flight context', `Flight: ${first.origin} → ${first.destination}. Session controller: ${text(first.controller,100)||'unknown'}.`,
    `Aircraft information: ${text(first.aircraftInfo,250)||'unknown'}. Filed altitude (raw EuroScope field): ${first.filedAltitude??'unknown'}.`,
    `Session ID: ${first.session}. Recorded interval: ${utc(first.ts)} to ${utc(last.ts)} (${((last.ts-first.ts)/60).toFixed(1)} minutes).`,
    `${samples.length} state snapshots; ${stats.radar} radar samples; ${stats.positioned} snapshots include a valid position.`,
    `Longest interval between radar samples: ${stats.longestGap} seconds. ${malformed} malformed records excluded.`,
    `Incident time: ${incident===null?'Not supplied — full available history reviewed.':utc(incident)+'; focused review ±5 minutes.'}`, '',
    '## Observed movement summary',
    stats.altitude?`Pressure altitude range: ${stats.altitude[0]}–${stats.altitude[1]} ft.`:'No altitude evidence available.',
    stats.speed?`Ground speed range: ${stats.speed[0]}–${stats.speed[1]} kt.`:'No ground-speed evidence available.',
    `Approximate distance covered across radar intervals of 30 seconds or less: ${stats.distanceNm.toFixed(2)} NM. Gaps are excluded.`,
    `First observed state: ${utc(first.ts)} — ${snapshot(first)}.`, `Last observed state: ${utc(last.ts)} — ${snapshot(last)}.`, '',
    '## Pilot review — evidence versus allegation',
    'The concern above is your account of the incident. No violation, intent or pilot responsibility is inferred from turns, speed or altitude alone.',
    'Use the time-stamped evidence below alongside the actual clearance and readback. A ground-track change is not proof of an incorrect heading; ground speed is not indicated airspeed.',
    focus.length?`The incident review includes ${focus.length} snapshots. The complete timeline is included in the appendix.`:'No recorded samples fall within five minutes of the stated incident time. Do not draw a conclusion about that period.', '');
  if(incident!==null && (incident<first.ts||incident>last.ts)) add('WARNING: the stated incident time lies outside the recording.');
  const focusRadar=focus.filter(s=>s.event==='radar'&&positioned(s));
  add('', '## Time-linked pilot movement evidence');
  if(focusRadar.length) {
    const a=focusRadar[0],b=focusRadar.at(-1);
    add(`${utc(a.ts)} → ${utc(b.ts)}: net pressure-altitude change ${b.altitude-a.altitude} ft; ${numeric(a.groundSpeed)&&numeric(b.groundSpeed)?'ground-speed change '+(b.groundSpeed-a.groundSpeed)+' kt':'speed change unavailable'}.`);
    if(incident!==null) {
      const near=nearest(focusRadar,incident);
      add(`Closest radar sample to the user-stated incident: ${utc(near.ts)} (${Math.abs(near.ts-incident)}s offset). ${snapshot(near)}.`,
        `Assigned fields at that snapshot: altitude ${near.clearedAltitude??'unknown'}; heading ${near.assignedHeading??'unknown'}; IAS ${near.assignedSpeed??'unknown'}; Mach ${near.assignedMach??'unknown'}; arrival runway ${near.arrivalRunway||'unknown'}; departure runway ${near.departureRunway||'unknown'}. These fields do not prove what was transmitted or acknowledged.`);
    }
    for(let i=1;i<focusRadar.length;i++) {
      const p=focusRadar[i-1],s=focusRadar[i],dt=s.ts-p.ts;
      if(dt<=0||dt>30) continue;
      const alt=s.altitude-p.altitude, speed=numeric(s.groundSpeed)&&numeric(p.groundSpeed)?s.groundSpeed-p.groundSpeed:null;
      const turn=numeric(p.track)&&numeric(s.track)?headingDelta(p.track,s.track):null;
      if(Math.abs(alt)>=200 || (turn!==null&&Math.abs(turn)>=20) || (speed!==null&&Math.abs(speed)>=15))
        add(`${utc(p.ts)} → ${utc(s.ts)} (${dt}s): altitude ${alt>=0?'+':''}${alt} ft${speed!==null?`; GS ${speed>=0?'+':''}${speed} kt`:''}${turn!==null?`; ground-track change ${turn.toFixed(1)}°`:''}. Descriptive changes only; not a finding of incorrect flying.`);
    }
  } else add('No radar samples available in the review window.');
  const changes=[]; const fields=['clearedAltitude','assignedHeading','assignedSpeed','assignedMach','assignedSquawk','arrivalRunway','departureRunway','clearanceFlag','trackingController','groundState','route','scratchpad'];
  for(let i=1;i<samples.length;i++) {
    const s=samples[i],p=samples[i-1];
    const changed=fields.filter(f=>s[f]!==p[f]);
    if(changed.length && (incident===null||Math.abs(s.ts-incident)<=300)) changes.push({s,p,changed,index:i+1});
  }
  add('## Controller self-review — time-linked coaching prompts',
    'These are opportunities to review, not claims that you handled the aircraft incorrectly. Assigned-data changes may have been made by another controller or a plugin; the recorder does not identify who issued a spoken instruction.');
  if(!instructions) add('- Supply the actual instructions and approximate UTC times before assessing whether your wording, timing or follow-up could have been better.');
  if(!controllerNotes) add('- Describe your intended plan and what you were monitoring, so the movement can be interpreted in that context.');
  if(stats.longestGap>15) add(`- Data coverage: there is a radar-sample gap of ${stats.longestGap} seconds. Check your recollection or replay before judging response timing across that gap.`);
  for(const change of changes) {
    const {s,p,changed,index}=change;
    add(`- ${utc(s.ts)} [S${index}]: ${changed.map(f=>`${f}: ${text(p[f],250)} → ${text(s[f],250)}`).join('; ')}. ${snapshot(s)}.`);
    if(changed.some(f=>['clearedAltitude','assignedHeading','assignedSpeed'].includes(f))) add('  Review opportunity: compare this field-change time with when you actually transmitted the instruction. Consider a single unambiguous instruction, a verified readback and a deliberate follow-up scan. This evidence does not show that any of those steps were missed.');
    if(changed.includes('arrivalRunway')||changed.includes('departureRunway')) add('  Review opportunity: verify that the intended runway and any amended clearance were communicated and acknowledged. A runway-field change alone does not demonstrate pilot awareness.');
    if(changed.includes('trackingController')) add('  Review opportunity: check handoff timing and whether any unresolved instruction was coordinated. This field does not establish who was speaking on frequency.');
  }
  if(!changes.length) add('- No assigned-data changes were recorded in the review window. That does not mean no instructions were issued.');
  const radar=focus.filter(s=>s.event==='radar'&&positioned(s)&&(!numeric(s.positionAgeSeconds)||s.positionAgeSeconds<=15));
  for(let i=1;i<radar.length;i++) {
    const a=radar[i-1],b=radar[i],dt=b.ts-a.ts;
    if(dt<=0||dt>30) continue;
    if(Math.abs(b.altitude-a.altitude)>=200 || (numeric(a.track)&&numeric(b.track)&&Math.abs(headingDelta(a.track,b.track))>=20)) {
      add(`- ${utc(a.ts)} → ${utc(b.ts)}: observed altitude change ${b.altitude-a.altitude} ft over ${dt}s${numeric(a.track)&&numeric(b.track)?`, ground-track change ${headingDelta(a.track,b.track).toFixed(1)}°`:''}. Review opportunity: compare the change with your intended sequence and consider when a concise clarification or confirmation would have been useful. This is a movement observation, not a non-compliance finding.`);
    }
  }
  add('', '## Recorded YYZ traffic context (not a separation assessment)');
  const traffic=[];
  for(const peer of peers) {
    const p=peer.samples.filter(s=>s.event==='radar'&&positioned(s)&&(!numeric(s.positionAgeSeconds)||s.positionAgeSeconds<=15)); let best=null;
    for(const s of radar) { const other=nearest(p,s.ts); if(!other||Math.abs(other.ts-s.ts)>10) continue;
      const nm=distance(s,other); if(!best||nm<best.nm) best={callsign:other.callsign,nm,vertical:Math.abs(s.altitude-other.altitude),ts:s.ts,otherTs:other.ts}; }
    if(best) traffic.push(best);
  }
  traffic.sort((a,b)=>a.nm-b.nm);
  for(const t of traffic.slice(0,10)) add(`- ${utc(t.ts)}: ${t.callsign}, closest observed horizontal distance ${t.nm.toFixed(2)} NM, pressure-altitude difference ${t.vertical} ft, samples ${Math.abs(t.ts-t.otherTs)}s apart.`);
  if(!traffic.length) add('No temporally matched recorded YYZ traffic positions in the review window.');
  add(`Reviewed ${peers.length} other aircraft histories from this session. Up to ten closest recorded aircraft are shown.`,
    'Nearby traffic is context only: radar samples are not necessarily simultaneous, non-YYZ flights are not recorded, and no separation standard or conflict finding is applied.', '',
    '## Conclusions and next steps',
    'Pilot: review the user-reported issue against the complete recorded timeline and the actual clearance/readback. The recorder cannot independently prove what went wrong or determine blame.',
    'Controller: use the time-linked prompts to review clarity, readback verification, monitoring, coordination and follow-up. Without radio evidence, specific missed interventions cannot be established.', '',
    '## Evidence limits',
    '- Local snapshots begin only after this plugin version is running and connected; there is no retrospective VATSIM history.',
    '- Radar samples are rate-limited to about five seconds per aircraft. Assignment/flight-plan snapshots capture the current radar state, which may be older than their capture time.',
    '- Pressure altitude, groundspeed and ground track are not interchangeable with cleared altitude, IAS or magnetic heading. Special EuroScope assignment values are preserved as raw fields, not interpreted as instructions.',
    '- No radio audio, text-message transcript, weather, visibility, full airspace picture, ATC procedures, runway geometry or readback is analyzed.',
    '- Your written context is not automatically converted into measured evidence. Missing samples and unknowns remain unknown.', '',
    '## Complete recorded timeline (UTC)',
    'Every usable selected-aircraft snapshot is included. S numbers identify rows; raw evidence is available through Export evidence JSON.');
  for(let i=0;i<samples.length;i++) {
    const s=samples[i],p=samples[i-1]; const changed=p?fields.filter(f=>s[f]!==p[f]):fields;
    add(`[S${i+1}] ${utc(s.ts)} | ${s.event} | ${snapshot(s)} | ${changed.map(f=>`${f}=${text(s[f],2000)}`).join('; ')||'assigned state unchanged'}`);
  }
  let reportText=report.join('\n');
  if(first.source==='euroscope_log_import') {
    reportText=reportText.replace(/pressure altitude/gi,'FSD reported altitude (datum unverified)').replace(/pressure-altitude/gi,'reported-altitude');
    reportText=reportText.replace('- Local snapshots begin only after this plugin version is running and connected; there is no retrospective VATSIM history.','- This history was imported from a EuroScope text log. Log date and clock were treated as UTC; verify them against the original recording.');
    reportText=reportText.replace('- Radar samples are rate-limited to about five seconds per aircraft. Assignment/flight-plan snapshots capture the current radar state, which may be older than their capture time.','- Imported sampling follows the original log. Flight plans may have been backfilled before their first message, and ground track is derived from consecutive positions. Authentication, remarks, chat and assignment messages were deliberately not imported.');
    reportText='IMPORTED EUROSCOPE LOG: no spoken instructions or assigned controller values are available from this importer. '+samples.filter(s=>s.flightPlanBackfilled).length+' positions use later flight-plan context.\n\n'+reportText;
  }
  return { report: reportText, samples, peers, trafficContext:traffic.slice(0,10), input: { concern, instructions, controllerNotes, incidentTime:input.incidentTime||'' }, malformed, stats };
}
async function generate(folder, id, input) {
  const selected=await read(folder,id); const files=await list(folder); const session=id.match(ID)[1]; const peers=[];
  let total=selected.samples.length;
  for(const file of files.filter(f=>f.session===session&&f.id!==id)) {
    const peer=await read(folder,file.id); total+=peer.samples.length;
    if(total>250000) throw new Error('This session exceeds 250,000 snapshots. A report was not generated rather than silently dropping evidence.');
    peers.push({ id:file.id, ...peer });
  }
  return analyze(selected.samples,input,peers,selected.malformed);
}
module.exports={ list,read,generate,analyze,incidentTime,distance,summary };
