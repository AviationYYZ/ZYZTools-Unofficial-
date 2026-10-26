#pragma once
// Included after the plugin's JSON helpers. Local requests are bounded and never
// contact an external host; the desktop app performs authenticated sim actions.
class CTrainingCommandBridge
{
    std::string pending, pendingNonce, lastSelection, lastController;
    ULONGLONG deadline = 0, changed = 0;
    DWORD lastPort = 0;
    unsigned sequence = 0;
    static bool Callsign(const std::string &s) { return s.size() >= 2 && s.size() <= 12 && std::all_of(s.begin(), s.end(), [](unsigned char c) { return std::isalnum(c); }); }
    static int BridgePort() {
#ifdef ZYZTOOLS_TEST_BUILD
        return 6815;
#else
        return 6816;
#endif
    }
    static std::string BindingFile() {
        char root[MAX_PATH]{}; if (!GetEnvironmentVariableA("APPDATA", root, MAX_PATH)) return "";
#ifdef ZYZTOOLS_TEST_BUILD
        return std::string(root) + "\\ZYZTools-test\\TrainingCommands\\Binding.json";
#else
        return std::string(root) + "\\ZYZTools\\TrainingCommands\\Binding.json";
#endif
    }
    static bool Binding(std::string &nonce, std::string &session) {
        std::ifstream f(BindingFile(), std::ios::binary); if (!f) return false;
        const std::string json((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
        if (json.size() > 4096) return false;
        std::string channel; int sent = 0;
        if (!JsonStringValue(json,"nonce",nonce) || nonce.size()!=64 || !std::all_of(nonce.begin(),nonce.end(),[](unsigned char c){return std::isxdigit(c);}) ||
            !JsonStringValue(json,"sessionId",session) || session.size()>100 || session.empty() ||
            !JsonStringValue(json,"channel",channel) || channel!=ZYZTOOLS_CHANNEL || !JsonIntValue(json,"sent_at",sent)) return false;
        const auto age=std::time(nullptr)-sent; return age>=0 && age<=5;
    }
    static DWORD TrainingSocketPort() {
        DWORD size=0; GetExtendedTcpTable(nullptr,&size,FALSE,AF_INET,TCP_TABLE_OWNER_PID_CONNECTIONS,0);
        if (!size || size>8*1024*1024) return 0; std::vector<unsigned char> bytes(size);
        if (GetExtendedTcpTable(bytes.data(),&size,FALSE,AF_INET,TCP_TABLE_OWNER_PID_CONNECTIONS,0)!=NO_ERROR) return 0;
        const auto table=reinterpret_cast<MIB_TCPTABLE_OWNER_PID*>(bytes.data());
#ifdef ZYZTOOLS_TEST_BUILD
        const DWORD address=htonl(0x7f000001);
#else
        const DWORD address=htonl(0x7f000002);
#endif
        for (DWORD i=0;i<table->dwNumEntries;i++) { const auto &r=table->table[i];
            if (r.dwOwningPid==GetCurrentProcessId() && r.dwState==MIB_TCP_STATE_ESTAB && r.dwRemoteAddr==address && ntohs(static_cast<u_short>(r.dwRemotePort))==6809)
                return ntohs(static_cast<u_short>(r.dwLocalPort));
        } return 0;
    }
    static std::string Request(const wchar_t *method,const std::wstring &route,const std::string &nonce,const std::string &body="") {
        HINTERNET session=WinHttpOpen(L"ZYZTools local training",WINHTTP_ACCESS_TYPE_NO_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,0); if (!session) return "";
        WinHttpSetTimeouts(session,100,100,150,150);
        HINTERNET connect=WinHttpConnect(session,L"127.0.0.1",static_cast<INTERNET_PORT>(BridgePort()),0);
        HINTERNET request=connect?WinHttpOpenRequest(connect,method,route.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,0):nullptr;
        std::string result; const std::wstring headers=L"Content-Type: application/json\r\nAuthorization: Bearer "+std::wstring(nonce.begin(),nonce.end())+L"\r\n";
        if (request && WinHttpSendRequest(request,headers.c_str(),static_cast<DWORD>(headers.size()),body.empty()?WINHTTP_NO_REQUEST_DATA:const_cast<char*>(body.data()),static_cast<DWORD>(body.size()),static_cast<DWORD>(body.size()),0) && WinHttpReceiveResponse(request,nullptr)) {
            char buffer[2048]; DWORD read=0; while (WinHttpReadData(request,buffer,sizeof(buffer),&read) && read) { result.append(buffer,read); if (result.size()>4096) {result.clear();break;} }
        }
        if (request) WinHttpCloseHandle(request); if (connect) WinHttpCloseHandle(connect); WinHttpCloseHandle(session); return result;
    }
    static std::string Payload(const std::string &cs,const std::string &controller,DWORD port,const std::string &session) {
        return "\"callsign\":\""+JsonEscape(cs)+"\",\"controller\":\""+JsonEscape(controller)+"\",\"port\":"+std::to_string(port)+",\"pid\":"+std::to_string(GetCurrentProcessId())+",\"sent_at\":"+std::to_string(std::time(nullptr))+",\"sessionId\":\""+JsonEscape(session)+"\"";
    }
public:
    static bool Shortcut(const std::string &line,std::string &command) {
        if(line.empty() || line[0]!='.')return false;
        const auto end=line.find_first_of(" ,");const auto verb=line.substr(1,end==std::string::npos?std::string::npos:end-1);
        static const std::vector<std::string> allowed={"ALT","RATE","SPD","IAS","HDG","LHDG","RHDG","DCT","APP","PAUSE","IDENT","SQ","MODE","SPEED","ROUTE","DELETE"};
        if(std::find(allowed.begin(),allowed.end(),verb)==allowed.end())return false;
        command=line.substr(1);return true;
    }
    bool TrainingContext() const {std::string nonce,session;return Binding(nonce,session)&&TrainingSocketPort()!=0;}
    std::string Tick(const std::string &selected,const std::string &controller) {
        std::string nonce,session,message;
        if (!pending.empty()) {
            if (GetTickCount64()>deadline) {pending.clear();message="Training command timed out. Check the instructor dashboard before retrying.";}
            else if (!Binding(nonce,session) || nonce!=pendingNonce) {pending.clear();message="Instructor connection/scenario changed; command status unavailable. Check the dashboard.";}
            else {const auto response=Request(L"GET",L"/result?id="+std::wstring(pending.begin(),pending.end()),nonce); std::string state;
                if (JsonStringValue(response,"state",state) && state!="pending") {JsonStringValue(response,"message",message);pending.clear();}
            }
        }
        const DWORD port=!controller.empty() && Binding(nonce,session)?TrainingSocketPort():0;
        if (port) {
            const std::string cs=Callsign(selected)?selected:"";
            if(cs!=lastSelection || controller!=lastController || port!=lastPort){changed=GetTickCount64();lastSelection=cs;lastController=controller;lastPort=port;}
            Request(L"POST",L"/selection",nonce,"{"+Payload(cs,controller,port,session)+",\"changed_at\":"+std::to_string(changed)+"}");
        }
        return message;
    }
    std::string Command(const std::string &selected,const std::string &controller,const std::string &command) {
        if(!pending.empty()) return "Previous training command is still awaiting acknowledgement.";
        std::string nonce,session; const DWORD port=TrainingSocketPort();
        if (!port || controller.empty() || !Binding(nonce,session)) return "Use Connect my EuroScope in Instructor first. Commands require this EuroScope's local training connection.";
        if(!Callsign(selected))return "Click an aircraft to select it (ASEL), then enter .ALT 5000, .HDG 240, etc.";
        if(command.empty() || command.size()>512) return "Enter up to 8 commands: .HDG 330, ALT 3000. Use .sim help.";
        const std::string id=std::to_string(GetCurrentProcessId())+"-"+std::to_string(GetTickCount64())+"-"+std::to_string(++sequence);
        const auto response=Request(L"POST",L"/command",nonce,"{"+Payload(selected,controller,port,session)+",\"id\":\""+id+"\",\"command\":\""+JsonEscape(command)+"\"}");
        std::string state,message; if(JsonStringValue(response,"state",state) && state=="pending") {pending=id;pendingNonce=nonce;deadline=GetTickCount64()+30000;return selected+": training command queued.";}
        if(JsonStringValue(response,"message",message))return message;return "Instructor app did not acknowledge the command. It was not automatically retried.";
    }
};
