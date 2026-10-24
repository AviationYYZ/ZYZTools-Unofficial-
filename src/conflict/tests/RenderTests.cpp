#include "SituDraw.h"
#include <iostream>
#include <fstream>
static void require(bool b,const char*m){if(!b)throw std::runtime_error(m);}
int main(){try{
 HDC dc=CreateCompatibleDC(nullptr);BITMAPINFO info{};info.bmiHeader.biSize=sizeof(BITMAPINFOHEADER);info.bmiHeader.biWidth=700;info.bmiHeader.biHeight=-240;info.bmiHeader.biPlanes=1;info.bmiHeader.biBitCount=32;info.bmiHeader.biCompression=BI_RGB;
 void*bits;auto bitmap=CreateDIBSection(dc,&info,DIB_RGB_COLORS,&bits,nullptr,0);auto oldBitmap=SelectObject(dc,bitmap);PatBlt(dc,0,0,700,240,BLACKNESS);SetBkMode(dc,TRANSPARENT);SetTextColor(dc,RGB(230,220,130));
 auto font=CreateFontA(-16,0,0,0,FW_NORMAL,0,0,0,ANSI_CHARSET,0,0,0,0,"Consolas");auto oldFont=SelectObject(dc,font);
 ca::Stage stage=ca::Stage::None;draw::setLookup([&](const std::string&s){return s=="ACA123"?stage:ca::Stage::None;});
 RECT normal{40,30,300,60};DrawTextA(dc,"ACA123+",-1,&normal,DT_CALCRECT);int width=normal.right-normal.left;
 require(draw::install(GetModuleHandleW(nullptr)),"could not attach to test executable DrawTextA import");
 const char*labels[]={"Clear","5 minutes: early prediction","45 seconds: yellow circle","30 seconds: red square","15 seconds: larger flashing callsign"};
 for(int i=0;i<5;++i){stage=static_cast<ca::Stage>(i);RECT label{240,20+i*42,690,60+i*42};DrawTextA(dc,labels[i],-1,&label,DT_LEFT);RECT box{40,20+i*42,220,60+i*42};DrawTextA(dc,"ACA123+",-1,&box,DT_CALCRECT);if(i==4)require(box.right-box.left>width,"urgent callsign did not grow");DrawTextA(dc,"ACA123+",-1,&box,DT_LEFT);}
 require(GetCurrentObject(dc,OBJ_FONT)==font,"font state leaked");require(GetTextColor(dc)==RGB(230,220,130),"colour state leaked");
 stage=ca::Stage::None;RECT cleared{40,30,300,60};DrawTextA(dc,"ACA123+",-1,&cleared,DT_CALCRECT);require(cleared.right-cleared.left==width,"clear did not restore size");
 draw::uninstall();require(!draw::installed(),"uninstall failed");
 RECT after{40,30,300,60};DrawTextA(dc,"ACA123+",-1,&after,DT_CALCRECT);require(after.right-after.left==width,"import not restored");
 BITMAPFILEHEADER file{};file.bfType=0x4d42;file.bfOffBits=sizeof(file)+sizeof(BITMAPINFOHEADER);file.bfSize=file.bfOffBits+700*240*4;
 std::ofstream out("alert-preview.bmp",std::ios::binary);out.write(reinterpret_cast<char*>(&file),sizeof(file));out.write(reinterpret_cast<char*>(&info.bmiHeader),sizeof(BITMAPINFOHEADER));out.write(reinterpret_cast<char*>(bits),700*240*4);out.close();
 SelectObject(dc,oldFont);DeleteObject(font);SelectObject(dc,oldBitmap);DeleteObject(bitmap);DeleteDC(dc);
 std::cout<<"PASS import attach, native drawing, urgent sizing, GDI state restoration, cleared sizing, import detach\n";return 0;
 }catch(std::exception&e){std::cerr<<e.what()<<"\n";return 1;}}
