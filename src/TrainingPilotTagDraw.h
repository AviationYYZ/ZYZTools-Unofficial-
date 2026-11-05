#pragma once
#include <windows.h>
#include <string>
#include <cstdio>
#include <cmath>
#include <algorithm>
#include <cstdlib>
// Fresh renderer using CSiT's normal font, palette and row ordering. Situ's
// DLL/configuration is never edited; only explicit pilot targets are blue.
namespace TrainingPilotTagDraw {
constexpr int Width=168,Height=33,HeaderHeight=11,FontHeight=14;
constexpr COLORREF Normal=RGB(202,205,169),Blue=RGB(65,145,255),Orange=RGB(242,120,57);
inline const char* Field(int i){static const char* names[]={"ALT","IAS","HDG","RATE","DCT","SQ","APP","MACH"};return i>=0&&i<8?names[i]:"";}
inline RECT Cell(int left,int top,int field){if(field==0||field==6)return {left,top+11,left+84,top+22};if(field==1||field==7)return {left+84,top+11,left+Width,top+22};if(field==5)return {left,top,left+Width,top+11};if(field==8)return {left,top+22,left+42,top+33};return {left+42,top+22,left+Width,top+33};}
inline std::string Level(int altitude){char s[12];std::snprintf(s,sizeof(s),"%03d",static_cast<int>(std::floor((altitude+50)/100.0)));return s;}
inline std::string Heading(int heading){char s[12];std::snprintf(s,sizeof(s),"H%03d",heading%360?heading%360:360);return s;}
inline int Text(HDC dc,RECT r,const std::string &s,COLORREF color){SetTextColor(dc,color);DrawTextA(dc,s.c_str(),-1,&r,DT_SINGLELINE|DT_END_ELLIPSIS);SIZE size{};GetTextExtentPoint32A(dc,s.c_str(),static_cast<int>(s.size()),&size);return std::min(static_cast<int>(r.right),static_cast<int>(r.left+size.cx));}
inline void Value(HDC dc,RECT r,const std::string &actual,const std::string &target,bool ordered,bool match,const std::string &state){
 int x=r.left;if(!actual.empty()){RECT a=r;x=Text(dc,a,actual,Normal)+6;}if(!target.empty()){RECT t=r;t.left=x;t.right-=10;x=Text(dc,t,target,ordered?Blue:Orange)+2;}
 const int icon=std::min(static_cast<int>(r.right)-9,x);if(match){SetDCPenColor(dc,RGB(70,230,115));MoveToEx(dc,icon,r.top+6,nullptr);LineTo(dc,icon+3,r.top+9);LineTo(dc,icon+8,r.top+1);}else if(ordered&&(state=="pending"||state=="error")){RECT status{icon,r.top,icon+9,r.bottom};Text(dc,status,state=="error"?"!":"~",state=="error"?RGB(255,110,90):Blue);}
}
template<class Tag> void Draw(HDC dc,int left,int top,const Tag &tag,int conflictStage=0,const std::string&conflictPoint=""){
 const COLORREF alert=conflictStage>=4?((GetTickCount64()/500)%2?RGB(255,255,255):RGB(255,80,100)):conflictStage>=3?RGB(255,40,50):RGB(255,220,0);
 RECT header{left,top,left+100,top+11};std::string title=(conflictStage==1?"! ":"")+tag.callsign;if(tag.scratchpad.size()>=2&&tag.scratchpad[0]==' ')title+=" "+tag.scratchpad.substr(1,1);Text(dc,header,title,conflictStage?alert:Normal);
 if(conflictStage){RECT ca{left+104,top,left+Width,top+11};Text(dc,ca,conflictPoint.empty()?"CA":"CA "+conflictPoint,alert);}
 std::string actual=Level(tag.altitude);if(std::abs(tag.verticalSpeed)>400)actual+=tag.verticalSpeed>0?"^":"|";
 const int altitudeField=tag.altMode=="APP"?6:0;const bool alt=tag.values[altitudeField]!="-";std::string cleared=alt?(altitudeField==6?(tag.values[6]=="CLEAR"?"APR":"CXL"):Level(std::atoi(tag.values[0].c_str()))):"";
 Value(dc,Cell(left,top,0),actual,cleared,alt,tag.matches[altitudeField],tag.states[altitudeField]);
 const int speedField=tag.speedMode=="MACH"?7:1;const bool speed=tag.values[speedField]!="-";std::string speedTarget;if(speed){if(speedField==7){char mach[16];std::snprintf(mach,sizeof(mach),"%.2f",std::atof(tag.values[7].c_str()));speedTarget="M"+std::string(mach).substr(1);}else speedTarget="A"+tag.values[1];}
 Value(dc,Cell(left,top,1),std::to_string(tag.groundSpeed/10),speedTarget,speed,tag.matches[speedField],tag.states[speedField]);
 Text(dc,Cell(left,top,8),tag.type,Normal);
 const int navField=tag.navMode=="DCT"?4:2;const bool nav=tag.values[navField]!="-";const RECT navCell=Cell(left,top,2);
 if(nav)Value(dc,navCell,tag.destination,navField==4?tag.values[4]:tag.values[2]=="PRESENT"?"PRES":Heading(std::atoi(tag.values[2].c_str())),true,tag.matches[navField],tag.states[navField]);else Text(dc,navCell,tag.destination,tag.destination=="CYYZ"?RGB(255,255,255):Normal);
}
}
