#include "../src/conflict/Engine.h"
#include <fstream>
#include <iostream>
#include <set>
int main(int argc,char**argv){
 if(argc!=2)return 2;std::ifstream in(argv[1]);if(!in)return 3;
 std::set<int> detected,advance;int pair;double time;int rows=0;
 while(in>>pair>>time){
  ca::Aircraft a[2];for(auto &p:a){double lat,lon,h;in>>p.id>>lat>>lon>>p.altitude>>p.gs>>h>>p.vs>>p.cleared;p.p=ca::project(lat,lon);p.heading=ca::projectedHeading(lat,lon,h);p.correlated=true;p.arrival=true;p.wake='M';}
  if(!in)return 4;++rows;
  for(bool early:{false,true}){
   auto result=ca::scan({a[0],a[1]},ca::Config{},{},early);if(!result.empty()){detected.insert(pair);if(ca::norm(a[0].p-a[1].p)>3)advance.insert(pair);}
   for(int partner:{0,1}){auto b0=a[0],b1=a[1];(partner?b1:b0).approachCleared=true;if(!ca::scan({b0,b1},ca::Config{},{},early).empty())return 5;
    for(int clearance:{1,2}){b0=a[0];b1=a[1];(partner?b1:b0).cleared=clearance;if(!ca::scan({b0,b1},ca::Config{},{},early).empty())return 6;}
   }
  }
 }
 std::cout<<"Native replay: "<<rows<<" samples, "<<detected.size()<<"/5 pairs alert, "<<advance.size()<<"/5 warn before 3NM loss; either aircraft's instructor approach or Situ ILS/visual status suppresses both scans.\n";
 return detected.size()==5&&advance.size()==5?0:7;
}
