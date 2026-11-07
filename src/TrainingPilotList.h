#pragma once
#include <string>
#include <cstdio>
#include <cstdlib>
namespace TrainingPilotList {
enum Item {Altitude=9800,PilotAltitude,IAS,PilotSpeed,Heading,PilotNavigation,NextFix,Owner,SFI};
struct Display{std::string text;int tone=0;}; // 0 normal, 1 target blue, 2 student match green, 3 error
inline std::string Level(int feet){char s[16];std::snprintf(s,sizeof(s),"%03d",(feet+50)/100);return s;}
inline std::string Hdg(int heading){char s[16];std::snprintf(s,sizeof(s),"%03d",heading%360?heading%360:360);return s;}
template<class Tag> Display Value(int item,const Tag &a){
 if(item==Altitude)return {Level(a.altitude)};if(item==IAS)return {std::to_string(a.ias)};if(item==Heading)return {Hdg(a.heading)};
 if(item==NextFix)return {a.nextFix};if(item==Owner)return {a.owner};if(item==SFI)return {a.scratchpad.size()>=2&&a.scratchpad[0]==' '?a.scratchpad.substr(1,1):"-"};
 int field=-1;std::string text;
 if(item==PilotAltitude){field=a.altMode=="APP"?6:0;text=field==6?(a.values[6]=="CLEAR"?"APR":"CXL"):Level(std::atoi(a.values[0].c_str()));}
 if(item==PilotSpeed){field=a.speedMode=="MACH"?7:1;if(field==7){char s[16];std::snprintf(s,sizeof(s),"M%.2f",std::atof(a.values[7].c_str()));text=s;}else text=a.values[1];}
 if(item==PilotNavigation){field=a.navMode=="DCT"?4:2;text=field==4?a.values[4]:a.values[2]=="PRESENT"?"PRES":Hdg(std::atoi(a.values[2].c_str()));}
 if(field<0||a.values[field]=="-")return {"-"};
 if(a.states[field]=="error")return {text+"!",3};if(a.states[field]=="pending")return {text+"~",1};if(a.matches[field])return {text+"+",2};return {text,1};
}
}
