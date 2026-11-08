#pragma once
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <sstream>
#include <string>
#include <vector>

namespace RadarTools {
constexpr double rad=3.14159265358979323846/180.0;
inline std::string Number(double n,int digits=1){char b[48];std::snprintf(b,sizeof(b),"%.*f",digits,n);return b;}
struct Calculator {const char *name,*units,*example;int size;};
inline constexpr Calculator Calculators[]={
 {"Descent rate","Current ft, target ft, distance NM, groundspeed kt","11000, 4000, 25, 230",4},
 {"Descent distance","Feet to lose, descent ft/min, groundspeed kt","7000, 1800, 230",3},
 {"Spacing to time","Distance NM, groundspeed kt","10, 210",2},
 {"Time to distance","Minutes, groundspeed kt","3, 210",2},
 {"Wind components","Runway course, wind from, wind kt (same reference)","237, 270, 25",3},
 {"Rate to spacing","Aircraft per hour, groundspeed kt","40, 180",2},
 {"Speed for spacing","Distance NM, target time minutes","8, 2.5",2},
 {"Vertical trend","Current gap ft, closing rate ft/min, minutes","2000, 500, 2",3}
};
inline std::string Calculate(int i,std::string input){
 if(i<0||i>=static_cast<int>(sizeof(Calculators)/sizeof(*Calculators)))return "Choose a calculator.";
 std::replace(input.begin(),input.end(),',',' ');std::istringstream in(input);std::vector<double> v;double x;
 while(in>>x){if(!std::isfinite(x)||x<0||x>100000)return "Enter non-negative numbers.";v.push_back(x);}
 if(!in.eof()||v.size()!=static_cast<size_t>(Calculators[i].size))return "Enter the values in the order shown.";
 switch(i){
 case 0: if(v[0]<v[1]||!v[2]||!v[3])break;return Number((v[0]-v[1])*v[3]/(v[2]*60),0)+" ft/min | "+Number(v[2]/v[3]*60)+" min";
 case 1: if(!v[1]||!v[2])break;return Number(v[0]/v[1]*v[2]/60)+" NM | "+Number(v[0]/v[1])+" min";
 case 2: if(!v[1])break;return Number(v[0]/v[1]*60,2)+" min | "+Number(v[0]/v[1]*3600,0)+" sec";
 case 3: return Number(v[0]*v[1]/60)+" NM";
 case 4: {if(v[0]>360||v[1]>360)break;const double a=(v[1]-v[0])*rad,h=v[2]*std::cos(a),c=v[2]*std::sin(a);return Number(std::abs(h))+(h>=0?" kt headwind | ":" kt tailwind | ")+Number(std::abs(c))+" kt crosswind "+(c>=0?"from right":"from left");}
 case 5: if(!v[0]||!v[1])break;return Number(v[1]/v[0])+" NM | "+Number(3600/v[0],0)+" sec";
 case 6: if(!v[1])break;return Number(v[0]/v[1]*60,0)+" kt groundspeed";
 case 7: {const double gap=v[0]-v[1]*v[2];return gap<0?"Altitude crossing within interval":Number(gap,0)+" ft remaining (constant rates)";}
 }
 return "Check the input ranges and nonzero denominators.";
}
struct Pair {double closure=0,minutes=0,nm=0;};
inline double TrueBearing(double latA,double lonA,double latB,double lonB){
 const double a=latA*rad,b=latB*rad,d=(lonB-lonA)*rad;
 return std::fmod(std::atan2(std::sin(d)*std::cos(b),std::cos(a)*std::sin(b)-std::sin(a)*std::cos(b)*std::cos(d))/rad+360,360);
}
inline Pair Spacing(double nm,double bearing,double trackA,double gsA,double trackB,double gsB){
 const double x=nm*std::sin(bearing*rad),y=nm*std::cos(bearing*rad);
 const double u=(gsB*std::sin(trackB*rad)-gsA*std::sin(trackA*rad))/60,v=(gsB*std::cos(trackB*rad)-gsA*std::cos(trackA*rad))/60;
 const double dot=x*u+y*v,speed=u*u+v*v,t=speed>1e-8?std::clamp(-dot/speed,0.0,10.0):0;
 return {nm>1e-6?-dot*60/nm:0,t,std::hypot(x+u*t,y+v*t)};
}
inline bool RadiusEntry(bool &outside,double distance,double radius){
 if(distance>radius+.2){outside=true;return false;}
 if(distance<=radius&&outside){outside=false;return true;}
 return false;
}
}
