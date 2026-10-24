#include "Engine.h"
namespace ca {
bool eligible(const Aircraft&a,const Config&c){
 // EuroScope cleared-altitude values: 1 = ILS, 2 = visual approach.
 // Apply to every scan and cached-alert eligibility, independent of geometry.
 return a.ifr&&a.correlated&&a.cleared!=1&&a.cleared!=2&&a.altitude>=2000
  &&a.age<=c.stale&&a.age>=0&&a.gs>=40
  &&std::isfinite(a.p.x)&&std::isfinite(a.p.y)&&std::isfinite(a.altitude);
}
bool VectorTracker::update(Aircraft&a,double now,const Config&c){
 auto&m=memory[a.id]; m.lastSeen=now;
 if(a.route.empty()){m.vectored=true;m.divergent=-1;m.aligned=-1;m.direct=a.direct;return true;}
 bool newDirect=!a.direct.empty()&&a.direct!=m.direct;
 if(newDirect)m.rejoinedFix.clear();
 if(!m.rejoinedFix.empty()){
  auto fix=std::find_if(a.route.begin(),a.route.end(),[&](const Waypoint&w){return w.name==m.rejoinedFix;});
  if(fix!=a.route.end())a.route.erase(a.route.begin(),fix);else m.rejoinedFix.clear();
 }
 double best=180;std::string bestFix;
 // Rejoining any remaining fix must be ahead and reasonably aligned. We never
 // let a stale direct-to field permanently override observed divergence.
 for(auto&w:a.route) if(norm(w.p-a.p)>.5){double error=std::abs(angle(bearing(w.p-a.p),a.heading));if(error<best){best=error;bestFix=w.name;}}
 double next=norm(a.route.front().p-a.p)<.5?0:std::abs(angle(bearing(a.route.front().p-a.p),a.heading));
 if(newDirect){m.vectored=false;m.divergent=-1;m.aligned=-1;}
 m.direct=a.direct;
 if(m.vectored){
  if(best<=c.vectorExit){if(m.aligned<0)m.aligned=now;if(now-m.aligned>=c.rejoinHold){m.vectored=false;m.divergent=-1;m.rejoinedFix=bestFix;auto fix=std::find_if(a.route.begin(),a.route.end(),[&](const Waypoint&w){return w.name==bestFix;});a.route.erase(a.route.begin(),fix);}}
  else m.aligned=-1;
 }else{
  if(next>=c.vectorEnter){if(m.divergent<0)m.divergent=now;if(now-m.divergent>=c.vectorHold){m.vectored=true;m.aligned=-1;m.rejoinedFix.clear();}}
  else m.divergent=-1;
 }
 return m.vectored;
}
void VectorTracker::prune(double now){for(auto i=memory.begin();i!=memory.end();)if(now-i->second.lastSeen>60)i=memory.erase(i);else++i;}
static double tasFactor(double alt){return std::sqrt(1/std::pow(std::max(.2,1-6.87535e-6*std::clamp(alt,0.,36000.)),4.2561));}
Trajectory predict(const Aircraft&a,double seconds,bool intent){
 Trajectory out; State s{a.p,a.altitude,a.heading};double gs=a.gs;size_t next=0;
 double wind=a.estimatedIas>0?std::clamp(a.gs-a.estimatedIas*tasFactor(a.altitude),-100.,100.):0;
 double rate=std::clamp(a.vs,-6000.,6000.);
 double target=a.cleared>2?a.cleared:a.altitude;
 // A measured departure from the assigned level must not be hidden by an
 // assumed return to it. Determine this from the received report, not its age.
 bool movingAway=a.cleared>2&&((a.altitude<target&&rate<0)||(a.altitude>target&&rate>0));
 auto advanceAltitude=[&](double dt){
  double z=s.altitude+rate*dt/60;
  // Apply the level-off both while aging reports and during future prediction.
  // At the cleared level, VS can still describe the preceding climb/descent.
  // Once a new report is beyond that level, preserve its observed movement.
  if(a.cleared>2&&(s.altitude==target||
     (s.altitude<target&&z>=target)||(s.altitude>target&&z<=target))){z=target;rate=0;}
  s.altitude=std::max(0.,z);
 };
 // Extrapolate each target's age to a common current epoch before predicting.
 s.p=s.p+unit(s.heading)*(gs*a.age/3600);advanceAltitude(a.age);
 for(int t=0;t<=int(std::ceil(seconds));++t){
  out.points.push_back(s); if(t>=seconds)break;
  if(intent){
   double desired=gs;
   if(a.assignedIas>0) desired=a.assignedIas*tasFactor(s.altitude)+wind;
   else if(a.assignedMach>0)desired=a.assignedMach*661.47*std::sqrt(std::max(.75,1-6.87535e-6*s.altitude))+wind;
   if(!a.vectored&&next<a.route.size()&&a.route[next].maxIas>0)desired=std::min(desired,a.route[next].maxIas*tasFactor(s.altitude)+wind);
   gs+=std::clamp(desired-gs,-1.0,1.0);gs=std::clamp(gs,40.,700.);
   if(a.cleared>2&&!movingAway&&std::abs(target-s.altitude)>100&&t>=10){
    double desiredRate=(target>s.altitude?std::abs(a.climbRate):-std::abs(a.descentRate));
    if(a.assignedRate!=0)desiredRate=std::copysign(std::abs(a.assignedRate),target-s.altitude);
    rate+=std::clamp(desiredRate-rate,-150.,150.);
   }
   if(!a.vectored&&next<a.route.size()){
    Vec delta=a.route[next].p-s.p;
    if(norm(delta)<std::max(.15,gs*2/3600)){
     out.etas.push_back({a.route[next].name,double(t)+norm(delta)/gs*3600});++next;
    }
    if(next<a.route.size())s.heading+=std::clamp(angle(bearing(a.route[next].p-s.p),s.heading),-3.,3.);
   }
  }
  s.p=s.p+unit(s.heading)*(gs/3600);
  advanceAltitude(1);
 }
 return out;
}
static bool following(const State&lead,const State&trail){
 Vec d=lead.p-trail.p,u=unit(lead.heading);
 return dot(d,u)>.05&&std::abs(d.x*u.y-d.y*u.x)<1.0;
}
static const Runway* established(const Aircraft&a,const State&s,const Config&c,const std::vector<Runway>&r){
 if((a.cleared!=1&&a.cleared!=2)||a.vs>300||s.altitude>6500||a.runway.empty())return nullptr;
 for(auto&rw:r)if(rw.active&&rw.airport==a.destination&&rw.name==a.runway){
  Vec d=rw.threshold-s.p,u=unit(rw.heading);double along=dot(d,u),cross=std::abs(d.x*u.y-d.y*u.x);
  if(along>0&&along<=c.finalLength&&cross<c.finalWidth&&std::abs(angle(s.heading,rw.heading))<12)return &rw;
 }return nullptr;
}
static bool parallel(const Aircraft&a,const Aircraft&b,const State&sa,const State&sb,const Config&c,const std::vector<Runway>&r){
 auto ra=established(a,sa,c,r),rb=established(b,sb,c,r);
 if(!ra||!rb||ra->airport!=rb->airport||ra->name==rb->name||std::abs(angle(ra->heading,rb->heading))>10)return false;
 auto x=ra->airport+"/"+ra->name+"/"+rb->name,y=ra->airport+"/"+rb->name+"/"+ra->name;
 return std::find(c.parallel.begin(),c.parallel.end(),x)!=c.parallel.end()||std::find(c.parallel.begin(),c.parallel.end(),y)!=c.parallel.end();
}
// Intersect open lateral cylinder and vertical slab continuously in each segment.
// This detects a brief loss between samples and does not flag exact tangency.
static double cylinder(State a,State a1,State b,State b1,double lateral,double vertical){
 Vec p=a.p-b.p,v=(a1.p-a.p)-(b1.p-b.p);double lo=0,hi=1;
 double A=dot(v,v),B=2*dot(p,v),C=dot(p,p)-lateral*lateral;
 if(A<1e-15){if(C>=-1e-10)return -1;}else{
  double D=B*B-4*A*C;if(D<=1e-12)return -1;
  lo=std::max(lo,(-B-std::sqrt(D))/(2*A));hi=std::min(hi,(-B+std::sqrt(D))/(2*A));
 }
 double z=a.altitude-b.altitude,dz=(a1.altitude-a.altitude)-(b1.altitude-b.altitude);
 if(std::abs(dz)<1e-10){if(std::abs(z)>=vertical-1e-8)return -1;}else{
  double x=(-vertical-z)/dz,y=(vertical-z)/dz;lo=std::max(lo,std::min(x,y));hi=std::min(hi,std::max(x,y));
 }
 return hi-lo>1e-9?std::max(0.,lo):-1;
}
static State interpolate(State a,State b,double t){return{a.p+(b.p-a.p)*t,a.altitude+(b.altitude-a.altitude)*t,a.heading+angle(b.heading,a.heading)*t};}
double firstLoss(const Aircraft&a,const Aircraft&b,const Trajectory&ta,const Trajectory&tb,const Config&c,const std::vector<Runway>&r,std::string&reason){
 size_t n=std::min(ta.points.size(),tb.points.size());
 for(size_t i=0;i+1<n;++i){
  auto sa=ta.points[i],sb=tb.points[i],ea=ta.points[i+1],eb=tb.points[i+1];
  double first=1e9;std::string why;
  auto consider=[&](double d,double v,const std::string&label,bool wakeCheck,bool aLeads){
   double at=cylinder(sa,ea,sb,eb,d,v);if(at<0)return;
   auto qa=interpolate(sa,ea,std::min(1.,at+1e-6)),qb=interpolate(sb,eb,std::min(1.,at+1e-6));
   if((a.cleared==2&&following(qb,qa)&&std::abs(angle(qa.heading,qb.heading))<30)||(b.cleared==2&&following(qa,qb)&&std::abs(angle(qa.heading,qb.heading))<30))return;
   // Exempt only aircraft already established now and still established at the event.
   if(parallel(a,b,ta.points.front(),tb.points.front(),c,r)&&parallel(a,b,qa,qb,c,r))return;
   if(wakeCheck){auto lead=aLeads?qa:qb,trail=aLeads?qb:qa;if(!following(lead,trail)||trail.altitude>lead.altitude+100)return;}
   if(at<first){first=at;why=label;}
  };
  consider(c.lateral,c.vertical,"IFR",false,true);
  auto wa=c.wake.find(std::string()+a.wake+b.wake),wb=c.wake.find(std::string()+b.wake+a.wake);
  if(wa!=c.wake.end()&&wa->second>c.lateral)consider(wa->second,c.vertical,"WAKE "+a.id+" leads",true,true);
  if(wb!=c.wake.end()&&wb->second>c.lateral)consider(wb->second,c.vertical,"WAKE "+b.id+" leads",true,false);
  if(first<1e8){reason=why;return i+first;}
 }
 return 1e9;
}
Stage stageFor(double t,const Config&c){if(t<=c.urgent+1e-7)return Stage::Urgent;if(t<=c.red+1e-7)return Stage::Red;if(t<=c.yellow+1e-7)return Stage::Yellow;if(t<=c.horizon)return Stage::Early;return Stage::None;}
std::map<std::string,Alert> scan(const std::vector<Aircraft>&all,const Config&c,const std::vector<Runway>&r,bool early){
 std::vector<const Aircraft*> a;std::vector<Trajectory> paths;
 for(auto&x:all)if(eligible(x,c)){a.push_back(&x);paths.push_back(predict(x,(early?c.horizon:c.yellow)+1,early));}
 struct Bounds{double x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;};
 std::vector<Bounds> bounds;
 for(auto&path:paths){Bounds b;for(auto&s:path.points){b.x0=std::min(b.x0,s.p.x);b.x1=std::max(b.x1,s.p.x);b.y0=std::min(b.y0,s.p.y);b.y1=std::max(b.y1,s.p.y);b.z0=std::min(b.z0,s.altitude);b.z1=std::max(b.z1,s.altitude);}bounds.push_back(b);}
 double maxWake=c.lateral;for(auto&kv:c.wake)maxWake=std::max(maxWake,kv.second);
 std::map<std::string,Alert> result;
 for(size_t i=0;i<a.size();++i)for(size_t j=i+1;j<a.size();++j){
  if(early&&!a[i]->arrival&&!a[j]->arrival)continue;
  // Conservative reach bound uses max possible 700 kt for intent paths.
  double h=early?c.horizon:c.yellow;
  double reach=(early?1400.:a[i]->gs+a[j]->gs)*(h+c.stale)/3600+maxWake;
  if(norm(a[i]->p-a[j]->p)>reach)continue;
  auto bi=bounds[i],bj=bounds[j];
  if(bi.x0-bj.x1>=maxWake||bj.x0-bi.x1>=maxWake||bi.y0-bj.y1>=maxWake||bj.y0-bi.y1>=maxWake||bi.z0-bj.z1>=c.vertical||bj.z0-bi.z1>=c.vertical)continue;
  std::string reason;double t=firstLoss(*a[i],*a[j],paths[i],paths[j],c,r,reason);
  if(t>h+1e-7)continue;
  Stage stage=early?Stage::Early:stageFor(t,c);
  for(auto pair:{std::make_pair(a[i],a[j]),std::make_pair(a[j],a[i])}){
   auto&v=result[pair.first->id];if(stage>v.stage||(stage==v.stage&&t<v.seconds))v={stage,t,pair.second->id,reason};
  }
 }return result;
}
}
