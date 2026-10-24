#include "Engine.h"
#include <iostream>
#include <functional>
#include <stdexcept>
#include <chrono>
using namespace ca;
static void require(bool b,const char*m){if(!b)throw std::runtime_error(m);}
static Aircraft plane(std::string id,Vec p,double heading=90){Aircraft a;a.id=id;a.p=p;a.heading=heading;a.altitude=10000;a.gs=180;a.wake='M';a.correlated=true;return a;}
static Alert check(Aircraft a,Aircraft b,bool early=false,std::vector<Runway>r={}){auto v=scan({a,b},Config{},r,early);return v.count(a.id)?v[a.id]:Alert{};}
int main(){int passed=0,failed=0;auto test=[&](const char*name,std::function<void()>f){try{f();std::cout<<"PASS "<<name<<"\n";++passed;}catch(std::exception&e){std::cout<<"FAIL "<<name<<": "<<e.what()<<"\n";++failed;}};
 test("45 second yellow",[]{auto a=plane("A",{0,0}),b=plane("B",{7.5,0},270);auto v=check(a,b);require(v.stage==Stage::Yellow&&std::abs(v.seconds-45)<.01,"wrong entry");});
 test("30 second red",[]{require(check(plane("A",{0,0}),plane("B",{6,0},270)).stage==Stage::Red,"wrong stage");});
 test("15 second urgent",[]{require(check(plane("A",{0,0}),plane("B",{4.5,0},270)).stage==Stage::Urgent,"wrong stage");});
 test("outside 45 seconds",[]{require(check(plane("A",{0,0}),plane("B",{7.6,0},270)).stage==Stage::None,"too early");});
 test("existing loss",[]{require(check(plane("A",{0,0}),plane("B",{2,0})).stage==Stage::Urgent,"no present loss");});
 test("exact lateral separation equal velocity",[]{require(check(plane("A",{0,0}),plane("B",{3,0})).stage==Stage::None,"equality is not loss");});
 test("exact vertical separation",[]{auto a=plane("A",{0,0}),b=plane("B",{1,0});b.altitude=11000;require(check(a,b).stage==Stage::None,"equality is not loss");});
 test("vertical convergence",[]{auto a=plane("A",{0,0}),b=plane("B",{1,0});b.altitude=11500;b.vs=-1000;auto v=check(a,b);require(v.stage==Stage::Red&&std::abs(v.seconds-30)<.01,"vertical ETA");});
 test("level off at safe clearance",[]{auto a=plane("A",{0,0}),b=plane("B",{1,0});b.altitude=11500;b.vs=-1000;b.cleared=11000;require(check(a,b).stage==Stage::None,"ignored level off");});
 test("diverging traffic",[]{require(check(plane("A",{0,0},270),plane("B",{4,0},90)).stage==Stage::None,"diverging warning");});
 test("VFR first aircraft",[]{auto a=plane("A",{0,0}),b=plane("B",{1,0});a.ifr=false;require(check(a,b).stage==Stage::None,"VFR warning");});
 test("VFR second aircraft",[]{auto a=plane("A",{0,0}),b=plane("B",{1,0});b.ifr=false;require(check(a,b).stage==Stage::None,"VFR warning");});
 test("unverified correlation defaults to excluded",[]{Aircraft a;a.id="A";a.altitude=10000;a.gs=180;auto b=plane("B",{1,0});a.arrival=true;for(bool early:{false,true})require(scan({a,b},Config{},{},early).empty(),"unverified target scanned");});
 test("uncorrelated either partner omitted in every scan",[]{
  for(bool early:{false,true})for(bool first:{false,true}){
   auto a=plane("A",{0,0}),b=plane("B",{1,0});a.arrival=true;
   require(scan({a,b},Config{},{},early).size()==2,"setup missing");
   (first?a:b).correlated=false;
   require(scan({a,b},Config{},{},early).empty(),"uncorrelated pair alerted");
   (first?a:b).correlated=true;
   require(scan({a,b},Config{},{},early).size()==2,"recorrelation failed");
  }
 });
 test("uncorrelated aircraft cannot trigger wake or hide eligible pairs",[]{
  for(bool early:{false,true}){
   auto a=plane("H",{4.5,0}),b=plane("B",{0,0}),c=plane("C",{1,0});a.wake='H';a.arrival=b.arrival=c.arrival=true;
   require(scan({a,b},Config{},{},early).size()==2,"wake setup missing");a.correlated=false;
   require(scan({a,b},Config{},{},early).empty(),"uncorrelated wake alerted");
   auto r=scan({a,b,c},Config{},{},early);require(r.size()==2&&r.at("B").other=="C"&&r.at("C").other=="B","eligible conflict lost");
  }
 });
 test("stale target omitted",[]{auto a=plane("A",{0,0}),b=plane("B",{1,0});b.age=31;require(check(a,b).stage==Stage::None,"stale warning");});
 test("ground traffic omitted",[]{auto a=plane("A",{0,0}),b=plane("B",{1,0});b.gs=20;require(check(a,b).stage==Stage::None,"ground warning");});
 test("visual trailing aircraft exemption",[]{auto a=plane("A",{0,0}),b=plane("B",{2,0});a.cleared=2;require(check(a,b).stage==Stage::None,"visual trailer");});
 test("visual leader omitted",[]{auto a=plane("A",{0,0}),b=plane("B",{2,0});b.cleared=2;require(check(a,b).stage==Stage::None,"visual leader not omitted");});
 test("crossing visual omitted",[]{auto a=plane("A",{0,0},0),b=plane("B",{1,0});a.cleared=2;require(check(a,b).stage==Stage::None,"crossing visual not omitted");});
 test("ILS sentinel not one foot",[]{auto a=plane("A",{0,0});a.cleared=1;a.vs=-600;auto p=predict(a,30,false);require(p.points.back().altitude>9600,"sentinel treated as height");});
 test("heavy medium wake five miles",[]{auto a=plane("A",{4.5,0}),b=plane("B",{0,0});a.wake='H';require(check(a,b).stage==Stage::Urgent,"wake missing");});
 test("Canadian light behind medium four miles",[]{auto a=plane("A",{3.5,0}),b=plane("B",{0,0});b.wake='L';require(check(a,b).stage==Stage::Urgent,"wake missing");a.p.x=4.5;require(check(a,b).stage==Stage::None,"incorrect five mile minimum");});
 test("super light eight miles",[]{auto a=plane("A",{7.5,0}),b=plane("B",{0,0});a.wake='J';b.wake='L';require(check(a,b).stage==Stage::Urgent,"super wake missing");});
 test("wake direction matters",[]{auto a=plane("A",{4.5,0}),b=plane("B",{0,0});b.wake='H';require(check(a,b).stage==Stage::None,"leader/follower reversed");});
 test("wake is not enlarged circle all around heavy",[]{auto a=plane("A",{0,4.5}),b=plane("B",{0,0});a.wake='H';require(check(a,b).stage==Stage::None,"lateral aircraft wake warning");});
 test("wake overhead follower omitted",[]{auto a=plane("A",{4.5,0}),b=plane("B",{0,0});a.wake='H';b.altitude=10600;require(check(a,b).stage==Stage::None,"wake above lead");});
 test("parallel finals exemption",[]{auto a=plane("A",{-10,0}),b=plane("B",{-10,1});a.altitude=b.altitude=3000;a.cleared=b.cleared=1;a.destination=b.destination="CYYZ";a.runway="05";b.runway="06L";require(check(a,b,false,{{"CYYZ","05",{0,0},90,true},{"CYYZ","06L",{0,1},90,true}}).stage==Stage::None,"parallel warnings");});
 test("same runway without approach clearance remains protected",[]{auto a=plane("A",{-10,0}),b=plane("B",{-8,0});a.altitude=b.altitude=3000;a.cleared=b.cleared=3000;a.destination=b.destination="CYYZ";a.runway=b.runway="05";require(check(a,b,false,{{"CYYZ","05",{0,0},90,true}}).stage==Stage::Urgent,"same runway exempted");});
 test("runway assignment alone does not exempt",[]{auto a=plane("A",{-10,0}),b=plane("B",{-10,1},180);a.altitude=b.altitude=3000;a.cleared=b.cleared=3000;a.destination=b.destination="CYYZ";a.runway="05";b.runway="06L";require(check(a,b,false,{{"CYYZ","05",{0,0},90,true},{"CYYZ","06L",{0,1},90,true}}).stage==Stage::Urgent,"intercept suppressed");});
 test("unapproved runway pair does not exempt",[]{auto a=plane("A",{-10,0}),b=plane("B",{-10,1});a.altitude=b.altitude=3000;a.cleared=b.cleared=3000;a.destination=b.destination="TEST";a.runway="01";b.runway="02";require(check(a,b,false,{{"TEST","01",{0,0},90,true},{"TEST","02",{0,1},90,true}}).stage==Stage::Urgent,"unapproved suppressed");});
 test("early arrival conflict with overflight",[]{auto a=plane("A",{0,0}),b=plane("B",{20,0},270);a.arrival=true;auto v=check(a,b,true);require(v.stage==Stage::Early&&std::abs(v.seconds-170)<1,"early ETA");});
 test("early excludes unrelated overflight pairs",[]{require(check(plane("A",{0,0}),plane("B",{20,0},270),true).stage==Stage::None,"nonarrivals early");});
 test("route diversion resolves early conflict",[]{auto a=plane("A",{0,0}),b=plane("B",{20,0},270);a.arrival=true;a.route={{"NORTH",{0,30},0}};require(check(a,b,true).stage==Stage::None,"ignored route turn");});
 test("vectored aircraft ignores filed turn",[]{auto a=plane("A",{0,0}),b=plane("B",{20,0},270);a.arrival=true;a.vectored=true;a.route={{"NORTH",{0,30},0}};require(check(a,b,true).stage==Stage::Early,"vectored followed route");});
 test("assigned altitude resolves early conflict",[]{auto a=plane("A",{0,0}),b=plane("B",{20,0},270);a.arrival=true;a.cleared=13000;require(check(a,b,true).stage==Stage::None,"ignored clearance");});
 test("speed restriction changes waypoint ETA",[]{auto a=plane("A",{0,0});a.gs=300;a.estimatedIas=250;a.route={{"FIX",{15,0},0}};auto p=predict(a,300,true);a.route[0].maxIas=140;auto q=predict(a,300,true);require(p.etas.size()==1&&q.etas.size()==1&&q.etas[0].second>p.etas[0].second+30,"speed ignored");});
 test("waypoints use travel time, not matching names",[]{auto a=plane("A",{0,0});a.route={{"ONE",{5,0},0},{"TWO",{10,0},0}};auto p=predict(a,300,true);require(p.etas.size()==2&&p.etas[1].second>p.etas[0].second+90,"bad waypoint ETAs");});
 test("vector hysteresis and rejoin",[]{VectorTracker v;Config c;auto a=plane("A",{0,0});a.route={{"EAST",{50,0},0}};require(!v.update(a,0,c),"initial vector");a.heading=0;require(!v.update(a,1,c),"instant vector");require(v.update(a,10,c),"no vector");a.heading=90;require(v.update(a,11,c),"instant rejoin");require(!v.update(a,17,c),"no rejoin");});
 test("fresh direct cancels vector; stale direct cannot mask divergence",[]{VectorTracker v;Config c;auto a=plane("A",{0,0},0);a.route={{"EAST",{50,0},0}};v.update(a,0,c);require(v.update(a,10,c),"no vector");a.direct="EAST";require(!v.update(a,11,c),"direct did not reset");require(v.update(a,21,c),"stale direct masks vector");});
 test("continuous between-sample loss",[]{Aircraft a,b;Trajectory x,y;x.points={{{-5,0},10000,90},{{5,0},10000,90}};y.points={{{0,0},10000,0},{{0,0},10000,0}};std::string reason;auto t=firstLoss(a,b,x,y,Config{},{},reason);require(std::abs(t-.2)<1e-6,"missed short loss");});
 test("horizontal and vertical losses must overlap",[]{Aircraft a,b;Trajectory x,y;x.points={{{-5,0},13000,90},{{5,0},10000,90}};y.points={{{0,0},10000,0},{{0,0},10000,0}};std::string reason;auto t=firstLoss(a,b,x,y,Config{},{},reason);require(t>.66&&t<.67,"slab intersection wrong");});
 test("tangent is not loss",[]{Aircraft a,b;Trajectory x,y;x.points={{{-5,3},10000,90},{{5,3},10000,90}};y.points={{{0,0},10000,0},{{0,0},10000,0}};std::string reason;require(firstLoss(a,b,x,y,Config{},{},reason)>1e8,"tangent alerted");});
 test("new scans clear resolved conflict",[]{auto a=plane("A",{0,0}),b=plane("B",{2,0});require(check(a,b).stage==Stage::Urgent,"setup");b.altitude=12000;require(check(a,b).stage==Stage::None,"sticky warning");});
 test("multi aircraft highest severity aggregation",[]{auto a=plane("A",{0,0}),b=plane("B",{2,0}),c=plane("C",{7.5,0},270);auto r=scan({a,b,c},Config{},{},false);require(r["A"].stage==Stage::Urgent,"highest severity lost");});
 test("age aligned prediction",[]{auto a=plane("A",{0,0}),b=plane("B",{6,0},270);a.age=10;auto v=check(a,b);require(std::abs(v.seconds-25)<.01,"ages not aligned");});
 test("observed climb beyond cleared altitude not frozen",[]{auto a=plane("A",{0,0});a.altitude=10100;a.cleared=10000;a.vs=1200;require(predict(a,10,false).points.back().altitude>10250,"measured overshoot frozen");});
 test("FL330 descent cleared FL320 above FL310 stays separated",[]{
  auto low=plane("LOW",{0,0}),high=plane("HIGH",{1,0});low.altitude=31000;low.cleared=31000;high.altitude=33000;high.cleared=32000;high.vs=-2000;high.arrival=true;
  for(bool early:{false,true})require(scan({low,high},Config{},{},early).empty(),"compliant FL320 descent alerted");
 });
 test("report age cannot extrapolate through an assigned level",[]{
  for(bool early:{false,true})for(bool climb:{false,true}){
   auto a=plane("A",{0,0}),b=plane("B",{1,0});a.arrival=true;a.altitude=climb?31000:33000;a.cleared=32000;a.vs=climb?6000:-6000;a.age=15;b.altitude=climb?33000:31000;b.cleared=int(b.altitude);
   auto path=predict(a,early?300:45,early);
   for(auto&s:path.points)require(std::abs(s.altitude-32000)<1e-6,"age invented a clearance bust");
   require(scan({a,b},Config{},{},early).empty(),"aged compliant aircraft alerted");
  }
 });
 test("at cleared altitude holds despite lagging vertical speed",[]{
  for(bool early:{false,true})for(double vs:{-2000.,2000.}){
   auto a=plane("A",{0,0});a.altitude=a.cleared=32000;a.vs=vs;a.age=8;
   for(auto&s:predict(a,early?300:45,early).points)require(std::abs(s.altitude-32000)<1e-6,"lagging VS projected through level");
  }
 });
 test("actual descent below FL320 alerts against FL310",[]{
  auto low=plane("LOW",{0,0}),high=plane("HIGH",{1,0});low.altitude=low.cleared=31000;high.altitude=31900;high.cleared=32000;high.vs=-1200;high.arrival=true;
  require(check(low,high).stage==Stage::Urgent,"actual separation loss suppressed");
  require(check(low,high,true).stage==Stage::Early,"early scan suppressed actual loss");
  require(predict(high,60,true).points.back().altitude<31000,"intent invented recovery from observed bust");
 });
 test("observed clearance bust triggers red for loss thirty seconds ahead",[]{
  auto a=plane("A",{0,0}),b=plane("B",{6,0},270);a.altitude=31000;b.altitude=31900;b.cleared=32000;b.vs=-600;
  auto v=check(a,b);require(v.stage==Stage::Red&&std::abs(v.seconds-30)<.01,"clearance masked predicted conflict");
 });
 test("unsafe or missing clearance still alerts during descent",[]{
  auto a=plane("A",{0,0}),b=plane("B",{1,0});a.altitude=31000;b.altitude=33000;b.vs=-2000;
  for(int cleared:{0,31000}){b.cleared=cleared;require(check(a,b).stage==Stage::Red,"unsafe descent suppressed");}
 });
 test("new safe clearance clears an existing descent prediction",[]{
  auto a=plane("A",{0,0}),b=plane("B",{1,0});a.altitude=31000;b.altitude=33000;b.vs=-2000;b.arrival=true;
  for(bool early:{false,true}){b.cleared=31000;require(!scan({a,b},Config{},{},early).empty(),"unsafe setup missing");b.cleared=32000;require(scan({a,b},Config{},{},early).empty(),"new clearance ignored");}
 });
 test("rejoin later fix remains stable across fresh route snapshots",[]{VectorTracker v;Config c;auto a=plane("A",{0,0},180);std::vector<Waypoint> route={{"NORTH",{0,20},0},{"EAST",{20,0},0}};a.route=route;v.update(a,0,c);require(v.update(a,10,c),"not vectoring");a.heading=90;v.update(a,11,c);require(!v.update(a,17,c)&&a.route.front().name=="EAST","did not rejoin later fix");a.route=route;require(!v.update(a,30,c)&&a.route.front().name=="EAST","lost rejoin memory");a.route=route;require(!v.update(a,40,c),"rejoined target flipped to vectors");});
 test("500 target timing",[]{std::vector<Aircraft>a;for(int i=0;i<500;++i){auto p=plane(std::to_string(i),{double(i%25)*12,double(i/25)*12},i%2?270:90);p.arrival=true;a.push_back(p);}auto start=std::chrono::steady_clock::now();auto r=scan(a,Config{},{},true);double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();std::cout<<"BENCH 500 targets early scan "<<ms<<" ms\n";require(ms<10000,"unusable timing");});

 test("approach clearance excludes either partner in both scans",[]{
  for(bool early:{false,true})for(int cleared:{1,2})for(bool first:{false,true}){
   auto a=plane("A",{0,0}),b=plane("B",{2,0},270);a.arrival=true;
   require(scan({a,b},Config{},{},early).size()==2,"setup conflict missing");
   (first?a:b).cleared=cleared;
   require(scan({a,b},Config{},{},early).empty(),"approach pair still alerted");
   (first?a:b).cleared=10000;
   require(scan({a,b},Config{},{},early).size()==2,"numeric clearance failed to restore detection");
  }
 });
 test("below 2000 excludes either partner and exact boundary remains active",[]{
  for(bool early:{false,true})for(bool first:{false,true}){
   auto a=plane("A",{0,0}),b=plane("B",{2,0},270);a.arrival=true;
   a.altitude=b.altitude=2000;
   require(scan({a,b},Config{},{},early).size()==2,"exact 2000 incorrectly excluded");
   (first?a:b).altitude=1999;
   require(scan({a,b},Config{},{},early).empty(),"below 2000 still alerted");
   (first?a:b).altitude=2001;
   require(scan({a,b},Config{},{},early).size()==2,"above threshold failed to restore detection");
  }
 });
 test("ignored target cannot hide a separate eligible conflict",[]{
  for(bool early:{false,true}){
   auto a=plane("A",{0,0}),b=plane("B",{1,0}),c=plane("C",{2,0});a.arrival=b.arrival=c.arrival=true;a.cleared=1;
   auto r=scan({a,b,c},Config{},{},early);
   require(r.size()==2&&!r.count("A")&&r.at("B").other=="C"&&r.at("C").other=="B","eligible pair lost");
  }
 });
 test("approach exclusion also suppresses wake alerts",[]{
  auto a=plane("H",{4.5,0}),b=plane("M",{0,0});a.wake='H';a.arrival=true;
  for(bool early:{false,true}){require(scan({a,b},Config{},{},early).size()==2,"wake setup missing");a.cleared=1;require(scan({a,b},Config{},{},early).empty(),"wake approach pair still alerted");a.cleared=0;}
 });
 std::cout<<passed<<" passed, "<<failed<<" failed\n";return failed?1:0;
}
