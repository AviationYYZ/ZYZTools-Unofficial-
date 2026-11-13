#pragma once
#include <windows.h>
#include <string>
#include <regex>

namespace TrainingHoldDialog {
struct State {
    std::string callsign,command;
    bool dme=false;
};
enum { Mode=100, Submit, ExitFix, CancelHold, Notice, Label=120, Field=140 };
inline void Layout(HWND dialog, bool dme) {
    SetDlgItemTextA(dialog,Label,dme?"VOR/DME station":"Waypoint");
    for(int i=4;i<8;++i)for(int base:{Label,Field})
        ShowWindow(GetDlgItem(dialog,base+i),(dme?i>=5:i==4)?SW_SHOW:SW_HIDE);
    SetDlgItemTextA(dialog,Notice,dme?"Enter the holding fix DME first, then the outbound turn DME.":"Enter the inbound course in magnetic degrees.");
}
inline INT_PTR CALLBACK Proc(HWND dialog,UINT message,WPARAM w,LPARAM l){
    auto* s=reinterpret_cast<State*>(GetWindowLongPtr(dialog,DWLP_USER));
    if(message==WM_INITDIALOG){
        s=reinterpret_cast<State*>(l);SetWindowLongPtr(dialog,DWLP_USER,l);
        SetWindowTextA(dialog,("ZYZTools | Hold - "+s->callsign).c_str());
        auto add=[&](const char* cls,const char* title,DWORD style,int x,int y,int width,int height,int id,DWORD ex=0){
            RECT r{x,y,x+width,y+height};MapDialogRect(dialog,&r);
            auto h=CreateWindowExA(ex,cls,title,WS_CHILD|WS_VISIBLE|style,r.left,r.top,r.right-r.left,r.bottom-r.top,dialog,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)),nullptr,nullptr);
            auto font=SendMessage(dialog,WM_GETFONT,0,0);
            SendMessage(h,WM_SETFONT,font?font:reinterpret_cast<WPARAM>(GetStockObject(DEFAULT_GUI_FONT)),FALSE);return h;
        };
        add("STATIC","Hold type",0,10,11,96,12,0);
        auto mode=add("COMBOBOX","",WS_TABSTOP|CBS_DROPDOWNLIST,110,8,150,60,Mode);
        SendMessageA(mode,CB_ADDSTRING,0,reinterpret_cast<LPARAM>("Timed hold"));
        SendMessageA(mode,CB_ADDSTRING,0,reinterpret_cast<LPARAM>("VOR/DME hold"));SendMessage(mode,CB_SETCURSEL,0,0);
        const char* labels[]={"Waypoint","Quadrant","Inbound course (magnetic)","Turns (L/R)","Leg time (minutes)","Radial (magnetic)","Fix DME","Outbound DME"};
        const char* defaults[]={"","N","180","R","1","","",""};
        for(int i=0;i<8;++i){
            const int y=28+18*(i>=5?i-1:i);
            add("STATIC",labels[i],0,10,y+3,99,12,Label+i);
            auto edit=add("EDIT",defaults[i],WS_TABSTOP|ES_AUTOHSCROLL,110,y,150,15,Field+i,WS_EX_CLIENTEDGE);
            SendMessage(edit,EM_SETLIMITTEXT,16,0);
        }
        add("STATIC","",0,10,155,250,25,Notice);
        add("BUTTON","Issue hold",WS_TABSTOP|BS_DEFPUSHBUTTON,10,185,56,16,Submit);
        add("BUTTON","Exit at fix",WS_TABSTOP,70,185,55,16,ExitFix);
        add("BUTTON","Cancel active hold",WS_TABSTOP,129,185,76,16,CancelHold);
        add("BUTTON","Close",WS_TABSTOP,210,185,50,16,IDCANCEL);
        Layout(dialog,false);SetFocus(GetDlgItem(dialog,Field));return FALSE;
    }
    if(!s)return FALSE;
    if(message==WM_CLOSE){EndDialog(dialog,IDCANCEL);return TRUE;}
    if(message!=WM_COMMAND)return FALSE;
    const int id=LOWORD(w);
    if(id==IDCANCEL){EndDialog(dialog,IDCANCEL);return TRUE;}
    if(id==Mode&&HIWORD(w)==CBN_SELCHANGE){
        s->dme=SendDlgItemMessage(dialog,Mode,CB_GETCURSEL,0,0)==1;Layout(dialog,s->dme);return TRUE;
    }
    if(id==ExitFix||id==CancelHold){s->command=id==ExitFix?"HOLD EXIT":"HOLD CANCEL";EndDialog(dialog,IDOK);return TRUE;}
    if(id!=Submit&&id!=IDOK)return FALSE;
    const std::regex formats[]={std::regex("[A-Z0-9_-]{1,16}"),std::regex("N|NE|E|SE|S|SW|W|NW"),std::regex("[0-9]{1,3}"),std::regex("[LR]"),std::regex("[0-9](\\.[0-9]{1,2})?"),std::regex("[0-9]{1,3}"),std::regex("[0-9]{1,3}(\\.[0-9]{1,2})?"),std::regex("[0-9]{1,3}(\\.[0-9]{1,2})?")};
    std::string command=s->dme?"HOLD DME":"HOLD TIME";
    for(int i=0;i<8;++i)if(i<4||(s->dme?i>=5:i==4)){
        char value[18]{};GetDlgItemTextA(dialog,Field+i,value,sizeof value);CharUpperBuffA(value,lstrlenA(value));
        if(!std::regex_match(value,formats[i])){
            SetDlgItemTextA(dialog,Notice,"Check the highlighted field. Use N/NE/E/SE/S/SW/W/NW for quadrant.");
            auto edit=GetDlgItem(dialog,Field+i);SetFocus(edit);SendMessage(edit,EM_SETSEL,0,-1);return TRUE;
        }
        command+=" ";command+=value;
    }
    s->command=command;EndDialog(dialog,IDOK);return TRUE;
}
inline std::string Open(HWND owner,const std::string& callsign){
    // Variable-length template ends with three zero WORDs: menu, class, title.
    #pragma pack(push, 2)
    struct Template {DLGTEMPLATE header;WORD menu,cls,title;};
    #pragma pack(pop)
    alignas(DWORD) Template t{};
    t.header.style=WS_POPUP|WS_CAPTION|WS_SYSMENU|DS_MODALFRAME|DS_CENTER;
    t.header.cx=270;t.header.cy=211;
    State state{callsign};
    DialogBoxIndirectParamA(GetModuleHandle(nullptr),&t.header,owner,Proc,reinterpret_cast<LPARAM>(&state));
    return state.command;
}
}
