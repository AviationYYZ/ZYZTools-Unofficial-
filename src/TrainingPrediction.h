#pragma once
#include <cmath>
// Constant reported true-track/groundspeed projection. No sample-time derivative,
// route/turn forecast, wind model or aircraft control. Training display only.
namespace TrainingPrediction {
struct Point {double lat=0,lon=0;};
inline bool Project(double lat,double lon,double heading,double gs,int minutes,Point &out){
 if(!std::isfinite(lat)||!std::isfinite(lon)||!std::isfinite(heading)||!std::isfinite(gs)||std::abs(lat)>89||std::abs(lon)>180||heading<0||heading>=360||gs<=0||gs>1200||minutes<1||minutes>10)return false;
 constexpr double rad=3.14159265358979323846/180.0;
 const double d=gs*minutes/60.0/3440.065,p=lat*rad,l=lon*rad,h=heading*rad;
 const double s=std::sin(p)*std::cos(d)+std::cos(p)*std::sin(d)*std::cos(h);
 const double q=std::asin(s>1?1:s<-1?-1:s),r=l+std::atan2(std::sin(h)*std::sin(d)*std::cos(p),std::cos(d)-std::sin(p)*std::sin(q));
 out={q/rad,std::fmod(r/rad+540.0,360.0)-180.0};return std::isfinite(out.lat)&&std::isfinite(out.lon);
}
}
