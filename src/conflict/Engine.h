#pragma once
#include <algorithm>
#include <cmath>
#include <map>
#include <string>
#include <vector>
#include <limits>

namespace ca {
constexpr double pi=3.14159265358979323846;
struct Vec { double x=0,y=0; Vec operator+(Vec b)const{return{x+b.x,y+b.y};} Vec operator-(Vec b)const{return{x-b.x,y-b.y};} Vec operator*(double s)const{return{x*s,y*s};} };
inline double dot(Vec a,Vec b){return a.x*b.x+a.y*b.y;}
inline double norm(Vec a){return std::sqrt(dot(a,a));}
inline double angle(double a,double b){return std::remainder(a-b,360.);}
inline Vec unit(double h){return{std::sin(h*pi/180),std::cos(h*pi/180)};}
inline double bearing(Vec a){return std::atan2(a.x,a.y)*180/pi;}
// Azimuthal equidistant projection, centred on Toronto. Units are nautical miles.
inline Vec project(double lat,double lon){
 double p=lat*pi/180,l=(lon+79.63)*pi/180,p0=43.68*pi/180;
 double c=std::acos(std::clamp(std::sin(p0)*std::sin(p)+std::cos(p0)*std::cos(p)*std::cos(l),-1.,1.));
 double k=c<1e-10?1:c/std::sin(c);
 return{3440.065*k*std::cos(p)*std::sin(l),3440.065*k*(std::cos(p0)*std::sin(p)-std::sin(p0)*std::cos(p)*std::cos(l))};
}
inline double projectedHeading(double lat,double lon,double heading){
 double p=lat*pi/180,l=lon*pi/180,h=heading*pi/180,d=1/3440.065;
 double q=std::asin(std::sin(p)*std::cos(d)+std::cos(p)*std::sin(d)*std::cos(h));
 double r=l+std::atan2(std::sin(h)*std::sin(d)*std::cos(p),std::cos(d)-std::sin(p)*std::sin(q));
 return bearing(project(q*180/pi,r*180/pi)-project(lat,lon));
}
inline std::pair<double,double> unproject(Vec p){const double rho=norm(p),lat0=43.68*pi/180,lon0=-79.63*pi/180;if(rho<1e-10)return {43.68,-79.63};const double c=rho/3440.065,lat=std::asin(std::cos(c)*std::sin(lat0)+p.y*std::sin(c)*std::cos(lat0)/rho),lon=lon0+std::atan2(p.x*std::sin(c),rho*std::cos(lat0)*std::cos(c)-p.y*std::sin(lat0)*std::sin(c));return {lat*180/pi,lon*180/pi};}
enum class Stage { None, Early, Yellow, Red, Urgent };
struct Waypoint { std::string name; Vec p; double maxIas=0; };
struct Runway { std::string airport,name; Vec threshold; double heading=0; bool active=true; };
struct Aircraft {
 std::string id,type,destination,runway,direct;
 Vec p; double altitude=0,gs=0,heading=0,vs=0,age=0;
 int cleared=0; double assignedIas=0,assignedMach=0,assignedRate=0;
 double assignedHeading=-1,bank=0;int turnDirection=0;bool navigationKnown=false;
 double climbRate=1500,descentRate=1500,estimatedIas=0;
 bool ifr=true,correlated=false,arrival=false,vectored=false,owned=false,approachCleared=false;
 char wake='M'; std::vector<Waypoint> route,filedRoute;
};
struct State { Vec p; double altitude=0,heading=0; };
struct Trajectory { std::vector<State> points; std::vector<std::pair<std::string,double>> etas; };
struct Config {
 double lateral=3,vertical=1000,yellow=45,red=30,urgent=15,horizon=300,stale=30;
 double vectorEnter=25,vectorExit=10,vectorHold=8,rejoinHold=5,finalWidth=.35,finalLength=20;
 std::map<std::string,double> wake={{"JJ",4},{"JH",6},{"JM",7},{"JL",8},{"HH",4},{"HM",5},{"HL",6},{"ML",4}};
 std::vector<std::string> arrivals={"CYYZ","CYTZ","CYHM","CYKF","CYOO","CYXU","CYQG","CYSB","CYYB","CYAM"};
 std::vector<std::string> parallel={"CYYZ/05/06L","CYYZ/05/06R","CYYZ/06L/06R","CYYZ/23/24L","CYYZ/23/24R","CYYZ/24L/24R","CYYZ/15L/15R","CYYZ/33L/33R"};
};
struct Alert { Stage stage=Stage::None; double seconds=1e9; std::string other,reason; Vec point; bool hasPoint=false; };
inline std::string conflictLocation(const Alert&a,const std::vector<Waypoint>&fixes){if(!a.hasPoint)return "";double nearest=3+1e-9;std::string name;for(const auto&w:fixes){double d=norm(w.p-a.point);if(d<nearest){nearest=d;name=w.name;}}return name;}
struct VectorMemory { bool vectored=false; double divergent=-1,aligned=-1,lastSeen=0; std::string direct,rejoinedFix; };
class VectorTracker {
 std::map<std::string,VectorMemory> memory;
public:
 bool update(Aircraft&,double now,const Config&);
 void prune(double now);
};
Trajectory predict(const Aircraft&,double seconds,bool intent);
double firstLoss(const Aircraft&,const Aircraft&,const Trajectory&,const Trajectory&,const Config&,const std::vector<Runway>&,std::string& reason);
std::map<std::string,Alert> scan(const std::vector<Aircraft>&,const Config&,const std::vector<Runway>&,bool early);
Stage stageFor(double seconds,const Config&);
bool eligible(const Aircraft&,const Config&);
}
