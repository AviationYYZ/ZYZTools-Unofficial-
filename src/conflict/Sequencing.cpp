#include "Sequencing.h"
#include <sstream>
#include <iomanip>
namespace ca {
namespace {
Trajectory delayed(const Aircraft&original,const Aircraft&candidate,double horizon){
 auto path=predict(original,10,false);
 Aircraft next=candidate;const auto state=path.points.back();
 next.p=state.p;next.altitude=state.altitude;next.heading=state.heading;next.age=0;
 auto rest=predict(next,horizon-10,true);
 path.points.insert(path.points.end(),rest.points.begin()+1,rest.points.end());
 for(auto eta:rest.etas){eta.second+=10;path.etas.push_back(eta);}
 return path;
}
double eta(const Trajectory&path,Vec fix){
 double best=1e9,time=-1;
 for(size_t i=0;i+1<path.points.size();++i){
  const auto p=path.points[i].p,d=path.points[i+1].p-p;const double length=dot(d,d);
  const double fraction=length>1e-12?std::clamp(dot(fix-p,d)/length,0.,1.):0;
  const double distance=norm(p+d*fraction-fix);
  if(distance<best-1e-6){best=distance;time=i+fraction;}
 }
 return best<=.6?time:-1;
}
double routeLength(const Aircraft&a,size_t through){
 double total=0;auto p=a.p;
 for(size_t i=0;i<=through&&i<a.route.size();++i){total+=norm(a.route[i].p-p);p=a.route[i].p;}return total;
}
struct Bounds{
 double x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;
 explicit Bounds(const Trajectory&t){for(const auto&s:t.points){x0=std::min(x0,s.p.x);x1=std::max(x1,s.p.x);y0=std::min(y0,s.p.y);y1=std::max(y1,s.p.y);z0=std::min(z0,s.altitude);z1=std::max(z1,s.altitude);}}
 bool overlaps(const Bounds&b,double lateral,double vertical)const{return x0-b.x1<lateral&&b.x0-x1<lateral&&y0-b.y1<lateral&&b.y0-y1<lateral&&z0-b.z1<vertical&&b.z0-z1<vertical;}
};
}
std::vector<Recommendation> recommend(const Aircraft&lead,const Aircraft&trail,const std::vector<Aircraft>&all,
 const Config&c,const std::vector<Runway>&runways,const std::string&requested,std::string&status){
 std::vector<Recommendation> result;
 status="No candidate evaluated.";
 if(lead.id==trail.id){status="Choose two different aircraft.";return result;}
 if(!eligible(lead,c)||!eligible(trail,c)||!lead.arrival||!trail.arrival||lead.destination!=trail.destination){
  status="Sequencing requires two fresh, correlated IFR arrivals to the same airport, at/above 2000 ft and not approach-cleared.";return result;
 }
 if(all.size()>1000){status="More than 1000 targets: analysis paused rather than omitting aircraft.";return result;}
 const double horizon=std::max(c.horizon,600.);
 const auto originalLead=predict(lead,horizon,true),originalTrail=predict(trail,horizon,true);
 size_t li=lead.route.size(),ti=trail.route.size();
 for(size_t i=0;i<lead.route.size();++i){
  if(!requested.empty()&&lead.route[i].name!=requested)continue;
  if(norm(lead.route[i].p-lead.p)<1)continue;
  for(size_t j=0;j<trail.route.size();++j)if(norm(lead.route[i].p-trail.route[j].p)<.25){li=i;ti=j;break;}
  if(li<lead.route.size())break;
 }
 if(li==lead.route.size())for(size_t i=0;i<lead.route.size();++i){
  if(!requested.empty()&&lead.route[i].name!=requested)continue;
  if(norm(lead.route[i].p-lead.p)>=1&&eta(originalTrail,lead.route[i].p)>10){li=i;break;}
 }
 if(li==lead.route.size()){status="No usable merge geometry: no common route location or known leader fix crossed by the follower. Select a forward merge fix from the first aircraft's route. No fix is invented.";return result;}
 const auto merge=lead.route[li].name;
 std::vector<Trajectory> otherPaths,otherObserved;
 std::vector<Bounds> otherBounds,observedBounds;
 for(const auto&a:all){otherPaths.push_back(predict(a,horizon,true));otherObserved.push_back(predict(a,c.yellow+1,false));}
 for(size_t i=0;i<all.size();++i){otherBounds.emplace_back(otherPaths[i]);observedBounds.emplace_back(otherObserved[i]);}
 std::string reason;
 const double baselineLoss=firstLoss(lead,trail,originalLead,originalTrail,c,runways,reason);
 const double oldLeadEta=eta(originalLead,lead.route[li].p),oldTrailEta=eta(originalTrail,lead.route[li].p);
 const double immediate=firstLoss(lead,trail,predict(lead,2,false),predict(trail,2,false),c,runways,reason);
 if(immediate<1){status="Current loss of separation: immediate controller intervention is required; no sequencing shortcut is recommended.";return result;}
 double requiredNm=c.lateral;
 auto wake=c.wake.find(std::string()+lead.wake+trail.wake);if(wake!=c.wake.end())requiredNm=std::max(requiredNm,wake->second);
 double maxWake=c.lateral;for(const auto&w:c.wake)maxWake=std::max(maxWake,w.second);
 struct Option{Aircraft a,b;std::string instruction;double saving=0;};
 std::vector<Option> options;
 // Keep the route unless a later, existing forward waypoint shortens it. Never invent a downwind or a vector heading.
 for(size_t skip=0;skip<=li;++skip){
  Aircraft a=lead;double saving=0;std::string instruction="Maintain "+lead.id+"'s current route";
  if(skip||lead.vectored){
   const auto fix=lead.route[skip];const auto delta=fix.p-lead.p;
   if(norm(delta)<1||std::abs(angle(bearing(delta),lead.heading))>100)continue;
   saving=routeLength(lead,skip)-norm(delta);if(!lead.vectored&&saving<.25)continue;
   a.route.erase(a.route.begin(),a.route.begin()+skip);a.direct=fix.name;a.vectored=false;
   instruction="Consider "+lead.id+" direct "+fix.name+" (skip "+std::to_string(skip)+" route fix"+(skip==1?"":"es")+")";
  }
  options.push_back({a,trail,instruction,saving});
  // Only propose IAS reductions when an observed/performance IAS reference is available.
  const double current=trail.assignedIas>0?trail.assignedIas:trail.estimatedIas;
  if(current>=180&&current<=300){
   for(int reduction:{10,20,30,40}){
    double target=std::floor((current-reduction)/10)*10;if(target<170)continue;
    Aircraft b=trail;b.assignedIas=target;b.assignedMach=0;
    options.push_back({a,b,instruction+"; consider "+trail.id+" "+std::to_string(int(target))+" kt IAS (confirm aircraft performance)",saving});
   }
  }
 }
 // Bounded delaying doglegs rejoin an existing follower fix. These are
 // model-track advisories, never automatic magnetic heading clearances.
 if(!trail.route.empty()){
  const size_t rejoin=ti<trail.route.size()?ti:0;
  const auto baseOptions=options;int leadVariants=0;
  for(const auto&base:baseOptions){
   if(base.b.assignedIas!=trail.assignedIas||leadVariants++>=3)continue;
   for(int offset:{-35,35,-55,55})for(int seconds:{45,75,120}){
    const double track=std::fmod(trail.heading+offset+360.,360.);
    Aircraft b=trail;const auto present=predict(trail,10,false).points.back().p;
    b.route.erase(b.route.begin(),b.route.begin()+rejoin);
    b.route.insert(b.route.begin(),{"__MODEL_DELAY__",present+unit(track)*(trail.gs*seconds/3600.),0});
    b.vectored=false;b.direct.clear();
    options.push_back({base.a,b,base.instruction+"; consider a delaying vector for "+trail.id+" toward approximately "+std::to_string(int(std::round(track)))+" degrees MODEL ground track for about "+std::to_string(seconds)+"s, then direct "+trail.route[rejoin].name+" (verify magnetic heading, wind and airspace)",base.saving});
   }
  }
 }
 int missing=0,order=0,pairLoss=0,otherLoss=0;double bestGap=-1e9;std::string blocker;
 for(const auto&option:options){
  const auto a=delayed(lead,option.a,horizon),b=delayed(trail,option.b,horizon);
  const double ae=eta(a,lead.route[li].p),be=eta(b,lead.route[li].p);
  const double needed=requiredNm/std::max(40.,option.b.gs)*3600+10;
  if(ae<0||be<0){++missing;continue;}
  bestGap=std::max(bestGap,be-ae);
  if(be-ae<needed){++order;continue;}
  if(firstLoss(option.a,option.b,a,b,c,runways,reason)<=horizon){++pairLoss;continue;}
  const Bounds ab(a),bb(b);
  bool clear=true;
  for(size_t i=0;i<all.size()&&clear;++i){
   const auto&other=all[i];if(other.id==lead.id||other.id==trail.id||!eligible(other,c))continue;
   for(const auto&pair:{std::make_pair(&option.a,&a),std::make_pair(&option.b,&b)}){
    const auto&bounds=pair.first==&option.a?ab:bb;
    if((bounds.overlaps(otherBounds[i],maxWake,c.vertical)&&firstLoss(*pair.first,other,*pair.second,otherPaths[i],c,runways,reason)<=horizon) ||
       (bounds.overlaps(observedBounds[i],maxWake,c.vertical)&&firstLoss(*pair.first,other,*pair.second,otherObserved[i],c,runways,reason)<=c.yellow)){clear=false;blocker=other.id;break;}
   }
  }
  if(!clear){++otherLoss;continue;}
  if(option.instruction=="Maintain "+lead.id+"'s current route"&&baselineLoss>horizon&&oldLeadEta>=0&&oldTrailEta>oldLeadEta){
   status="Requested order is already model-clear at "+merge+"; no route/speed change is needed.";return {};
  }
  std::ostringstream text;
  text<<option.instruction<<". "<<lead.id<<" reaches "<<merge<<" in about "<<int(ae)<<"s; "<<trail.id<<" in "<<int(be)<<"s (gap "<<int(be-ae)<<"s). ";
  if(option.saving>.1)text<<std::fixed<<std::setprecision(1)<<option.saving<<" NM shorter for "<<lead.id<<". ";
  text<<"No predicted separation/wake loss against eligible observed traffic over "<<int(horizon/60)<<" minutes, assuming 10s response delay and up to 3 deg/s turns. Model ground track is not a magnetic clearance. Advisory only: check terrain, restricted airspace, approach geometry, wind, aircraft limits and coordination before issuing anything.";
  result.push_back({text.str(),ae,be,option.saving});
  if(result.size()==3)break;
 }
 if(!result.empty())status="Options to place "+lead.id+" ahead of "+trail.id+" at "+merge+". Recomputed every 5 seconds; not a clearance.";
 else {
  std::ostringstream why;
  why<<"Evaluated "<<options.size()<<" candidates near "<<merge<<" (10-minute model): "<<missing<<" did not reach the merge; "<<order<<" failed requested order/spacing; "<<pairLoss<<" still conflicted with the selected pair; "<<otherLoss<<" conflicted with other traffic";
  if(!blocker.empty())why<<" (including "<<blocker<<")";
  if(bestGap>-1e8)why<<". Best order gap "<<int(bestGap)<<"s";
  why<<". Try swapping order or selecting a downstream merge fix. No unchecked maneuver is offered.";
  status=why.str();
 }
 return result;
}
bool validateAIProposal(const Aircraft&lead,const Aircraft&trail,const std::vector<Aircraft>&all,
 const Config&c,const std::vector<Runway>&runways,const AIProposal&p,Recommendation&out,std::string&reason){
 if(lead.id==trail.id||!eligible(lead,c)||!eligible(trail,c)||!lead.arrival||!trail.arrival||lead.destination!=trail.destination){
  reason="Selected pair is outside the native arrival model.";return false;
 }
 if(all.size()>1000){reason="Too many targets for complete validation.";return false;}
 Aircraft a=lead,b=trail;std::ostringstream action;action<<"AI proposal locally checked: ";
 if(!p.leaderDirect.empty()){
  const auto fix=std::find_if(a.route.begin(),a.route.end(),[&](const auto&w){return w.name==p.leaderDirect;});
  if(fix==a.route.end()||norm(fix->p-a.p)<1||std::abs(angle(bearing(fix->p-a.p),a.heading))>100){reason="Leader direct fix is unknown, behind, or too close.";return false;}
  a.route.erase(a.route.begin(),fix);a.direct=p.leaderDirect;a.vectored=false;
  action<<lead.id<<" direct "<<p.leaderDirect<<"; ";
 }
 auto speed=[&](Aircraft&aircraft,int target)->bool{
  if(target==0)return true;
  const double current=aircraft.assignedIas>0?aircraft.assignedIas:aircraft.estimatedIas;
  if(current<=0||target<170||target>300||target<current-40||target>current+30)return false;
  aircraft.assignedIas=target;aircraft.assignedMach=0;return true;
 };
 if(!speed(a,p.leaderIas)||!speed(b,p.followerIas)){reason="Proposed IAS is outside the bounded speed/reference limits.";return false;}
 if(p.leaderIas)action<<lead.id<<" "<<p.leaderIas<<" kt IAS; ";
 if(p.followerIas)action<<trail.id<<" "<<p.followerIas<<" kt IAS; ";
 if(std::abs(p.followerOffset)>60||p.delaySeconds<0||p.delaySeconds>120||
    ((p.followerOffset==0)!=(p.delaySeconds==0))||(p.delaySeconds>0&&p.delaySeconds<20)){
  reason="Vector offset/duration exceeds supported bounds.";return false;
 }
 if(p.followerOffset){
  auto fix=std::find_if(b.route.begin(),b.route.end(),[&](const auto&w){return w.name==p.rejoinFix;});
  if(fix==b.route.end()){reason="Follower rejoin fix is not in its current route.";return false;}
  const double track=std::fmod(trail.heading+p.followerOffset+360.,360.);
  const auto present=predict(trail,10,false).points.back().p;
  b.route.erase(b.route.begin(),fix);
  b.route.insert(b.route.begin(),{"__AI_DELAY__",present+unit(track)*(trail.gs*p.delaySeconds/3600.),0});
  b.vectored=false;b.direct.clear();
  action<<trail.id<<" delaying vector toward approximately "<<int(std::round(track))<<" degrees MODEL ground track for about "<<p.delaySeconds<<"s, then direct "<<p.rejoinFix<<"; ";
 }
 const auto merge=std::find_if(lead.route.begin(),lead.route.end(),[&](const auto&w){return w.name==p.mergeFix;});
 if(merge==lead.route.end()){reason="Merge fix is not in the leader's known forward route.";return false;}
 const double horizon=std::max(c.horizon,600.);
 const auto ta=delayed(lead,a,horizon),tb=delayed(trail,b,horizon);
 const double ae=eta(ta,merge->p),be=eta(tb,merge->p);
 double spacing=c.lateral;const auto wake=c.wake.find(std::string()+lead.wake+trail.wake);
 if(wake!=c.wake.end())spacing=std::max(spacing,wake->second);
 if(ae<0||be<0||be-ae<spacing/std::max(40.,trail.gs)*3600+10){reason="Requested order or merge spacing is not achieved within ten minutes.";return false;}
 std::string lossReason;
 if(firstLoss(a,b,ta,tb,c,runways,lossReason)<=horizon){reason="Selected aircraft still conflict under the proposed maneuver ("+lossReason+").";return false;}
 const Bounds ab(ta),bb(tb);double maxWake=c.lateral;for(const auto&w:c.wake)maxWake=std::max(maxWake,w.second);
 for(const auto&other:all){
  if(other.id==lead.id||other.id==trail.id||!eligible(other,c))continue;
  const auto intent=predict(other,horizon,true),observed=predict(other,c.yellow+1,false);
  const Bounds ib(intent),ob(observed);
  for(const auto&pair:{std::make_pair(&a,&ta),std::make_pair(&b,&tb)}){
   const auto&bounds=pair.first==&a?ab:bb;
   if((bounds.overlaps(ib,maxWake,c.vertical)&&firstLoss(*pair.first,other,*pair.second,intent,c,runways,lossReason)<=horizon)||
      (bounds.overlaps(ob,maxWake,c.vertical)&&firstLoss(*pair.first,other,*pair.second,observed,c,runways,lossReason)<=c.yellow)){
    reason="Creates or retains a conflict with "+other.id+" ("+lossReason+").";return false;
   }
  }
 }
 action<<lead.id<<" passes near "<<p.mergeFix<<" in about "<<int(ae)<<"s; "<<trail.id<<" in "<<int(be)<<"s (gap "<<int(be-ae)<<"s). ";
 action<<"No modeled loss against all eligible targets over ten minutes. Advisory only: verify magnetic heading/wind, terrain, restrictions, performance and coordination. Nothing has been assigned.";
 out={action.str(),ae,be,0};reason="Passed current native model checks.";return true;
}
}
