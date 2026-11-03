#include "../src/TrainingPrediction.h"
#include <cassert>
#include <iostream>
#include <limits>
int main(){using namespace TrainingPrediction;Point p;
 assert(Project(0,0,0,120,3,p));assert(std::abs(p.lat-.0999326)<.00001);assert(std::abs(p.lon)<.000001);
 assert(Project(0,0,90,120,3,p));assert(std::abs(p.lon-.0999326)<.00001);assert(std::abs(p.lat)<.000001);
 assert(Project(0,179.99,90,600,10,p));assert(p.lon<0&&p.lon>=-180);
 assert(Project(88.9,-179,340,400,10,p));assert(std::isfinite(p.lat)&&std::isfinite(p.lon));
 assert(!Project(0,0,0,0,3,p));assert(!Project(0,0,0,120,0,p));assert(!Project(0,0,0,120,11,p));assert(!Project(0,0,360,120,3,p));assert(!Project(0,0,0,1201,3,p));assert(!Project(std::numeric_limits<double>::quiet_NaN(),0,0,120,3,p));
 // The same report always projects identically: cadence and timestamps are not inputs.
 Point q;assert(Project(43.7,-79.6,57,210,3,p));for(int hz:{1,2,5}){assert(Project(43.7,-79.6,57,210,3,q));assert(p.lat==q.lat&&p.lon==q.lon);}
 std::cout<<"PASS: reported-motion projection, distance, bearing, dateline, near-pole bounds, invalid inputs and cadence independence.\n";
}
