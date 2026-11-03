#pragma once
#include <windows.h>
#include <string>
namespace TrainingPilotTagDraw {
inline const char* Field(int i){static const char* names[]={"ALT","IAS","HDG","RATE","DCT","SQ","APP"};return i>=0&&i<7?names[i]:"";}
inline RECT Cell(int left,int top,int i){const bool second=i>=3;const int column=second?i-3:i,width=second?87:116;return {left+column*width,top+(second?44:22),left+(column+1)*width-3,top+(second?64:42)};}
template<class Tag> void Draw(HDC dc,int left,int top,const Tag &tag){
 SetTextColor(dc,RGB(210,220,225));RECT header{left,top,left+348,top+20};const auto title=tag.callsign+" "+tag.type+"  PILOT / "+(tag.owner=="-"?"unowned":tag.owner);DrawTextA(dc,title.c_str(),-1,&header,DT_SINGLELINE|DT_END_ELLIPSIS);
 for(int i=0;i<7;++i){RECT r=Cell(left,top,i);std::string label=Field(i);if(tag.values[i]!="-"){if(i==3)label="R"+tag.values[i];else if(i==4)label="D"+tag.values[i];else if(i==5)label="SQ"+tag.values[i];else if(i==6)label=tag.values[i]=="CLEAR"?"APP CLR":tag.values[i]=="CANCEL"?"APP CXL":tag.values[i];else label=std::string(Field(i))+" "+tag.values[i];}if(tag.states[i]=="pending")label+=" ~";RECT text=r;text.right-=14;SetTextColor(dc,RGB(65,145,255));DrawTextA(dc,label.c_str(),-1,&text,DT_SINGLELINE|DT_END_ELLIPSIS);
  if(tag.matches[i]){SetDCPenColor(dc,RGB(70,230,115));MoveToEx(dc,r.right-12,r.top+9,nullptr);LineTo(dc,r.right-8,r.top+13);LineTo(dc,r.right-2,r.top+3);}else if(tag.states[i]=="error"){SetTextColor(dc,RGB(255,110,90));RECT error=r;error.left=r.right-12;DrawTextA(dc,"!",-1,&error,DT_SINGLELINE);}
 }
}
}
