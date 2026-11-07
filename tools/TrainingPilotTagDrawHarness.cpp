#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <objidl.h>
#include <gdiplus.h>
#include <string>
#include "../src/TrainingPilotTagDraw.h"
#pragma comment(lib,"gdiplus.lib")
#pragma comment(lib,"gdi32.lib")
#pragma comment(lib,"user32.lib")
struct Tag{std::string callsign="ACA4321",type="A320",owner="STUDENT_APP",values[8]={"8000","210","330","2250","LINNG","2101","CLEAR","-"},states[8]={"done","done","done","done","done","done","done","-"};bool matches[8]={true,true,false,true,false,true,false,false};int altitude=12000,groundSpeed=340,ias=270,heading=290,verticalSpeed=-2250,clearedAltitude=8000,cruiseAltitude=36000;std::string nextFix="LINNG",destination="CYYZ",squawk="2101",scratchpad="-",altMode="ALT",speedMode="IAS",navMode="HDG";};
int wmain(int argc,wchar_t**argv){if(argc!=2)return 2;ULONG_PTR token;Gdiplus::GdiplusStartupInput start;if(Gdiplus::GdiplusStartup(&token,&start,nullptr)!=Gdiplus::Ok)return 3;HDC dc=CreateCompatibleDC(nullptr);BITMAPINFO info{};info.bmiHeader.biSize=sizeof(BITMAPINFOHEADER);info.bmiHeader.biWidth=450;info.bmiHeader.biHeight=-290;info.bmiHeader.biPlanes=1;info.bmiHeader.biBitCount=32;info.bmiHeader.biCompression=BI_RGB;void*bits;HBITMAP bitmap=CreateDIBSection(dc,&info,DIB_RGB_COLORS,&bits,nullptr,0);SelectObject(dc,bitmap);RECT area{0,0,450,290};HBRUSH bg=CreateSolidBrush(RGB(12,18,23));FillRect(dc,&area,bg);DeleteObject(bg);SetBkMode(dc,TRANSPARENT);SelectObject(dc,GetStockObject(DC_PEN));HFONT font=CreateFontA(TrainingPilotTagDraw::FontHeight,0,0,0,500,FALSE,FALSE,FALSE,DEFAULT_CHARSET,OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,FIXED_PITCH,"EuroScope");SelectObject(dc,font);Tag first;TrainingPilotTagDraw::Draw(dc,42,22,first);Tag second;second.callsign="WJA876";second.values[0]="6000";second.states[0]="pending";second.matches[0]=false;second.states[4]="error";TrainingPilotTagDraw::Draw(dc,42,112,second,3);Tag third;third.callsign="POE518";third.owner="-";for(int i=0;i<7;i++){third.values[i]="-";third.matches[i]=false;}TrainingPilotTagDraw::Draw(dc,42,202,third);int result=4;{Gdiplus::Bitmap output(bitmap,nullptr);const CLSID png={0x557cf406,0x1a04,0x11d3,{0x9a,0x73,0x00,0x00,0xf8,0x1e,0xf3,0x2e}};result=output.Save(argv[1],&png,nullptr)==Gdiplus::Ok?0:4;}DeleteDC(dc);DeleteObject(font);DeleteObject(bitmap);Gdiplus::GdiplusShutdown(token);return result;}
