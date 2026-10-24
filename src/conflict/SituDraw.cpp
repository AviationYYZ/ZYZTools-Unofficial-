#include "SituDraw.h"
#include <cstring>
namespace draw {
using DrawTextFn=int(WINAPI*)(HDC,LPCSTR,int,LPRECT,UINT);
static DrawTextFn original=::DrawTextA;
static void** slot=nullptr;
static HMODULE heldModule=nullptr;
static Lookup lookup;
void setLookup(Lookup fn){lookup=std::move(fn);}
bool installed(){return slot!=nullptr;}
int WINAPI render(HDC dc,LPCSTR text,int count,LPRECT rect,UINT flags){
 if(!text||!rect||!lookup)return original(dc,text,count,rect,flags);
 // Match only a complete aircraft callsign, optionally SiTu's wake suffix.
 int n=count<0?int(strnlen_s(text,32)):count;
 if(n<2||n>16)return original(dc,text,count,rect,flags);
 std::string id(text,n);while(!id.empty()&&id.back()==' ')id.pop_back();
 auto stage=lookup(id);
 if(stage==ca::Stage::None&&!id.empty()&&(id.back()=='+'||id.back()=='-'||id.back()=='$'||id.back()=='/')){id.pop_back();stage=lookup(id);}
 if(stage==ca::Stage::None)return original(dc,text,count,rect,flags);
 int save=SaveDC(dc);HFONT large=nullptr;
 if(stage==ca::Stage::Urgent){
  LOGFONTA f{};auto font=GetCurrentObject(dc,OBJ_FONT);
  if(GetObjectA(font,sizeof(f),&f)){f.lfHeight=int(f.lfHeight*1.4);f.lfWeight=FW_BOLD;large=CreateFontIndirectA(&f);if(large)SelectObject(dc,large);}
  SetTextColor(dc,(GetTickCount64()/500)%2?RGB(255,255,255):RGB(255,80,100));
 }
 // Move the top up when enlarged, preserving the spacing to the altitude line.
 RECT local=*rect;
 if(stage==ca::Stage::Urgent){TEXTMETRICA tm{};GetTextMetricsA(dc,&tm);local.top-=std::max(0L,tm.tmHeight-14);}
 int result=original(dc,text,count,&local,flags);
 if(flags&DT_CALCRECT){rect->right=local.right;rect->bottom=local.bottom;}
 else {
  COLORREF color=stage>=ca::Stage::Red?RGB(255,40,50):RGB(255,220,0);
  HPEN pen=CreatePen(PS_SOLID,2,color);HBRUSH brush=CreateSolidBrush(color);
  SelectObject(dc,pen);SelectObject(dc,brush);
  int x=local.left-13,y=local.top+5;
  if(stage==ca::Stage::Early){
   TEXTMETRICA normal{},enlarged{};GetTextMetricsA(dc,&normal);
   LOGFONTA f{};auto font=GetCurrentObject(dc,OBJ_FONT);
   if(GetObjectA(font,sizeof(f),&f)){
    f.lfHeight=LONG(std::lround(f.lfHeight*1.3));
    f.lfWidth=LONG(std::lround(f.lfWidth*1.3));f.lfWeight=FW_BOLD;
    large=CreateFontIndirectA(&f);if(large)SelectObject(dc,large);
   }
   GetTextMetricsA(dc,&enlarged);SIZE extent{};GetTextExtentPoint32A(dc,"!",1,&extent);
   // Keep the marker on the callsign baseline, with a four-pixel gap.
   int top=local.top+normal.tmAscent-enlarged.tmAscent;
   RECT mark{local.left-4-extent.cx,top,local.left-4,top+enlarged.tmHeight};
   SetTextColor(dc,color);original(dc,"!",1,&mark,DT_LEFT|DT_NOCLIP);
  }
  else if(stage==ca::Stage::Yellow)Ellipse(dc,x,y,x+8,y+8);
  else Rectangle(dc,x,y,x+8,y+8);
  RestoreDC(dc,save);if(large)DeleteObject(large);DeleteObject(pen);DeleteObject(brush);return result;
 }
 RestoreDC(dc,save);if(large)DeleteObject(large);return result;
}
bool install(HMODULE module){
 if(slot)return true;if(!module)return false;
 auto base=reinterpret_cast<unsigned char*>(module);
 auto dos=reinterpret_cast<IMAGE_DOS_HEADER*>(base);if(dos->e_magic!=IMAGE_DOS_SIGNATURE)return false;
 auto nt=reinterpret_cast<IMAGE_NT_HEADERS*>(base+dos->e_lfanew);if(nt->Signature!=IMAGE_NT_SIGNATURE)return false;
 auto dir=nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT];if(!dir.VirtualAddress)return false;
 auto imports=reinterpret_cast<IMAGE_IMPORT_DESCRIPTOR*>(base+dir.VirtualAddress);
 for(auto d=imports;d->Name;++d){
  if(_stricmp(reinterpret_cast<char*>(base+d->Name),"USER32.dll")||!d->OriginalFirstThunk)continue;
  auto names=reinterpret_cast<IMAGE_THUNK_DATA*>(base+d->OriginalFirstThunk),functions=reinterpret_cast<IMAGE_THUNK_DATA*>(base+d->FirstThunk);
  for(;names->u1.AddressOfData;++names,++functions){
   if(IMAGE_SNAP_BY_ORDINAL(names->u1.Ordinal))continue;
   auto name=reinterpret_cast<IMAGE_IMPORT_BY_NAME*>(base+names->u1.AddressOfData);
   if(std::strcmp(reinterpret_cast<char*>(name->Name),"DrawTextA"))continue;
   auto candidate=reinterpret_cast<void**>(&functions->u1.Function);DWORD old;
   if(!VirtualProtect(candidate,sizeof(void*),PAGE_READWRITE,&old))return false;
   original=reinterpret_cast<DrawTextFn>(*candidate);
   InterlockedExchangePointer(candidate,reinterpret_cast<void*>(&render));
   DWORD ignored;VirtualProtect(candidate,sizeof(void*),old,&ignored);slot=candidate;
   GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,reinterpret_cast<LPCSTR>(module),&heldModule);
   return true;
  }
 }return false;
}
void uninstall(){
 lookup={};
 if(slot){DWORD old;if(VirtualProtect(slot,sizeof(void*),PAGE_READWRITE,&old)){
  if(*slot==reinterpret_cast<void*>(&render))InterlockedExchangePointer(slot,reinterpret_cast<void*>(original));
  else {HMODULE pinned;GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_PIN,reinterpret_cast<LPCSTR>(&render),&pinned);}
  DWORD ignored;VirtualProtect(slot,sizeof(void*),old,&ignored);
 }else{HMODULE pinned;GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_PIN,reinterpret_cast<LPCSTR>(&render),&pinned);}
 slot=nullptr;}
 if(heldModule){FreeLibrary(heldModule);heldModule=nullptr;}
}
}
