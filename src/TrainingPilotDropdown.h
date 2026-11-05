#pragma once
#include <windows.h>
#include <commctrl.h>
#include <functional>
#include <algorithm>
#include <string>
#include <vector>
// Own popup only: no hooks, subclassing of EuroScope/Situ, or network access.
class TrainingPilotDropdown {
 HWND window=nullptr,combo=nullptr;HFONT font=nullptr;HBRUSH background=CreateSolidBrush(RGB(45,45,45));HINSTANCE instance=nullptr;std::string className;std::vector<std::string> values;std::function<void(std::string)> selected;
 static LRESULT CALLBACK Proc(HWND hwnd,UINT message,WPARAM w,LPARAM l){
  auto self=reinterpret_cast<TrainingPilotDropdown*>(GetWindowLongPtr(hwnd,GWLP_USERDATA));
  if(message==WM_NCCREATE){self=static_cast<TrainingPilotDropdown*>(reinterpret_cast<CREATESTRUCT*>(l)->lpCreateParams);SetWindowLongPtr(hwnd,GWLP_USERDATA,reinterpret_cast<LONG_PTR>(self));}
  if(self&&(message==WM_CTLCOLORLISTBOX||message==WM_CTLCOLOREDIT||message==WM_CTLCOLORSTATIC)){SetTextColor(reinterpret_cast<HDC>(w),RGB(225,225,225));SetBkColor(reinterpret_cast<HDC>(w),RGB(45,45,45));return reinterpret_cast<LRESULT>(self->background);}
  if(self&&message==WM_DRAWITEM){const auto item=reinterpret_cast<DRAWITEMSTRUCT*>(l);if(item->CtlID==1){const auto dc=item->hDC;const bool picked=(item->itemState&ODS_SELECTED)!=0;SetDCBrushColor(dc,picked?RGB(72,72,72):RGB(45,45,45));FillRect(dc,&item->rcItem,static_cast<HBRUSH>(GetStockObject(DC_BRUSH)));SetBkMode(dc,TRANSPARENT);SetTextColor(dc,RGB(225,225,225));SelectObject(dc,self->font);RECT r=item->rcItem;r.left+=4;if(item->itemID<self->values.size())DrawTextA(dc,self->values[item->itemID].c_str(),-1,&r,DT_SINGLELINE|DT_VCENTER|DT_END_ELLIPSIS);return TRUE;}}
  if(self&&message==WM_COMMAND&&LOWORD(w)==1){const int code=HIWORD(w);if(code==CBN_SELENDOK){const auto index=SendMessage(self->combo,CB_GETCURSEL,0,0);if(index>=0&&static_cast<size_t>(index)<self->values.size()){auto callback=self->selected;const auto value=self->values[index];self->Close();if(callback)callback(value);}return 0;}if(code==CBN_SELENDCANCEL||code==CBN_CLOSEUP){PostMessage(hwnd,WM_CLOSE,0,0);return 0;}}
  if(message==WM_ACTIVATE&&LOWORD(w)==WA_INACTIVE){PostMessage(hwnd,WM_CLOSE,0,0);return 0;}
  if(message==WM_CLOSE){DestroyWindow(hwnd);return 0;}
  if(self&&message==WM_NCDESTROY){if(self->window==hwnd){self->window=nullptr;self->combo=nullptr;self->selected={};}SetWindowLongPtr(hwnd,GWLP_USERDATA,0);}
  return DefWindowProc(hwnd,message,w,l);
 }
public:
 ~TrainingPilotDropdown(){Close();if(font)DeleteObject(font);if(background)DeleteObject(background);if(instance&&!className.empty())UnregisterClassA(className.c_str(),instance);}
 void Close(){const auto old=window;window=nullptr;combo=nullptr;selected={};if(old&&IsWindow(old))DestroyWindow(old);}
 HWND Handle() const{return window;}
 bool Open(const std::vector<std::string>& options,const std::string &current,std::function<void(std::string)> callback,HWND localOwner=nullptr,bool show=true){
  Close();if(options.empty()||options.size()>2100)return false;HWND owner=localOwner?localOwner:GetForegroundWindow();DWORD pid=0;GetWindowThreadProcessId(owner,&pid);if(pid!=GetCurrentProcessId())return false;
  if(!instance){GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCSTR>(&Proc),&instance);className=std::string("ZYZToolsPilotDropdown-")+ZYZTOOLS_CHANNEL;WNDCLASSA cls{};cls.lpfnWndProc=Proc;cls.hInstance=instance;cls.lpszClassName=className.c_str();cls.hCursor=LoadCursor(nullptr,IDC_ARROW);if(!RegisterClassA(&cls)&&GetLastError()!=ERROR_CLASS_ALREADY_EXISTS)return false;}
  if(!font)font=CreateFontA(14,0,0,0,500,FALSE,FALSE,FALSE,DEFAULT_CHARSET,OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,DEFAULT_QUALITY,FIXED_PITCH,"EuroScope");
  int width=144;HDC dc=GetDC(owner);auto old=SelectObject(dc,font);for(const auto &v:options){SIZE size{};GetTextExtentPoint32A(dc,v.c_str(),static_cast<int>(v.size()),&size);width=std::max(width,std::min(300,static_cast<int>(size.cx)+32));}SelectObject(dc,old);ReleaseDC(owner,dc);values=options;selected=std::move(callback);POINT pt;GetCursorPos(&pt);MONITORINFO monitor{sizeof(MONITORINFO)};GetMonitorInfo(MonitorFromPoint(pt,MONITOR_DEFAULTTONEAREST),&monitor);const int x=std::max(static_cast<int>(monitor.rcWork.left),std::min(static_cast<int>(pt.x),static_cast<int>(monitor.rcWork.right)-width-4));
  window=CreateWindowExA(WS_EX_TOOLWINDOW,className.c_str(),"Pilot selection",WS_POPUP|WS_BORDER,x,pt.y+6,width+2,23,owner,nullptr,instance,this);if(!window)return false;
  combo=CreateWindowExA(0,"COMBOBOX","",WS_CHILD|WS_VISIBLE|WS_VSCROLL|CBS_DROPDOWNLIST|CBS_NOINTEGRALHEIGHT|CBS_OWNERDRAWFIXED|CBS_HASSTRINGS,0,0,width,144,window,reinterpret_cast<HMENU>(1),instance,nullptr);if(!combo){Close();return false;}SendMessage(combo,WM_SETFONT,reinterpret_cast<WPARAM>(font),FALSE);SendMessage(combo,CB_SETITEMHEIGHT,0,16);SendMessage(combo,CB_SETITEMHEIGHT,static_cast<WPARAM>(-1),18);SendMessage(combo,CB_SETMINVISIBLE,8,0);int index=0;
  for(size_t i=0;i<values.size();++i){SendMessageA(combo,CB_ADDSTRING,0,reinterpret_cast<LPARAM>(values[i].c_str()));if(values[i]==current)index=static_cast<int>(i);}SendMessage(combo,CB_SETCURSEL,index,0);if(show){ShowWindow(window,SW_SHOWNORMAL);SetForegroundWindow(window);SetFocus(combo);SendMessage(combo,CB_SHOWDROPDOWN,TRUE,0);SendMessage(combo,CB_SETTOPINDEX,0,0);}return true;
 }
};
