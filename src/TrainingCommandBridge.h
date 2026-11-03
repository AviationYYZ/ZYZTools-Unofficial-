#pragma once
// Included after the plugin's JSON helpers. Local requests are bounded and never
// contact an external host; the desktop app performs authenticated sim actions.
class CTrainingCommandBridge
{
public:
    struct PilotTag {std::string callsign,type,owner;std::string values[7],states[7];bool matches[7]{};};
private:
    std::vector<PilotTag> pilotTags;
    ULONGLONG pilotTagsVerified=0;
    std::string pilotTagsContext;
    std::string pending, pendingNonce, lastSelection, lastController;
    ULONGLONG deadline = 0, changed = 0;
    DWORD lastPort = 0;
    unsigned sequence = 0;
    int predictionMinutes=0; ULONGLONG predictionVerified=0; std::string predictionCallsigns;
    bool pilotControls=false;
    struct TagOverlay {std::string callsign,id,nonce;int type=0;ULONGLONG until=0;};
    std::vector<TagOverlay> tagOverlays;
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
    static bool Binding(std::string &nonce, std::string &session,int *minutes=nullptr,std::string *callsigns=nullptr) {
        std::ifstream f(BindingFile(), std::ios::binary); if (!f) return false;
        const std::string json((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
        if (json.size() > 4096) return false;
        std::string channel; int sent = 0;
        if (!JsonStringValue(json,"nonce",nonce) || nonce.size()!=64 || !std::all_of(nonce.begin(),nonce.end(),[](unsigned char c){return std::isxdigit(c);}) ||
            !JsonStringValue(json,"sessionId",session) || session.size()>100 || session.empty() ||
            !JsonStringValue(json,"channel",channel) || channel!=ZYZTOOLS_CHANNEL || !JsonIntValue(json,"sent_at",sent)) return false;
        if(minutes){int value=0;JsonIntValue(json,"prediction_minutes",value);*minutes=(value==1||value==2||value==3||value==5||value==10)?value:0;}
        if(callsigns){std::string value;JsonStringValue(json,"prediction_callsigns",value);*callsigns=value.size()<=1400&&std::all_of(value.begin(),value.end(),[](unsigned char c){return std::isalnum(c)||c==',';})?value:"";}
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
            char buffer[2048]; DWORD read=0; while (WinHttpReadData(request,buffer,sizeof(buffer),&read) && read) { result.append(buffer,read); if (result.size()>262144) {result.clear();break;} }
        }
        if (request) WinHttpCloseHandle(request); if (connect) WinHttpCloseHandle(connect); WinHttpCloseHandle(session); return result;
    }
    static std::string Payload(const std::string &cs,const std::string &controller,DWORD port,const std::string &session) {
        return "\"callsign\":\""+JsonEscape(cs)+"\",\"controller\":\""+JsonEscape(controller)+"\",\"port\":"+std::to_string(port)+",\"pid\":"+std::to_string(GetCurrentProcessId())+",\"sent_at\":"+std::to_string(std::time(nullptr))+",\"sessionId\":\""+JsonEscape(session)+"\"";
    }
public:
    struct TagRestore {std::string callsign,value,message;int type=0;};
    std::string TagEdit(const std::string &callsign,const std::string &controller,int type,const std::string &value) {
        std::string nonce,session;if(controller.empty()||!Callsign(callsign)||!Binding(nonce,session))return "";
        std::ifstream file(BindingFile(),std::ios::binary);const std::string json((std::istreambuf_iterator<char>(file)),std::istreambuf_iterator<char>());int enabled=0;
        if(json.size()>4096||!JsonIntValue(json,"tag_controls",enabled)||enabled!=1)return "";
        std::string active;JsonStringValue(json,"prediction_callsigns",active);if(active.find(","+callsign+",")==std::string::npos)return "";
        const DWORD port=TrainingSocketPort();if(!port)return "";
        const std::string id="tag-"+std::to_string(GetCurrentProcessId())+"-"+std::to_string(GetTickCount64())+"-"+std::to_string(++sequence);
        const auto response=Request(L"POST",L"/tag-edit",nonce,"{"+Payload(callsign,controller,port,session)+",\"id\":\""+id+"\",\"dataType\":"+std::to_string(type)+",\"value\":\""+JsonEscape(value)+"\"}");std::string state,message;
        if(JsonStringValue(response,"state",state)&&state=="ignored")return "";
        if(state=="overlay") {tagOverlays.erase(std::remove_if(tagOverlays.begin(),tagOverlays.end(),[&](const TagOverlay &o){return o.callsign==callsign&&o.type==type;}),tagOverlays.end());if(tagOverlays.size()<64)tagOverlays.push_back({callsign,id,nonce,type,GetTickCount64()+3000});return "";}
        if(JsonStringValue(response,"message",message))return message;return "Tag control was not acknowledged. Check the instructor app before retrying.";
    }
    std::vector<TagRestore> TagRestores(const std::string &controller) {
        std::vector<TagRestore> result;if(tagOverlays.empty())return result;std::string nonce,session;
        if(controller.empty()||!Binding(nonce,session)||!TrainingSocketPort()){tagOverlays.clear();return result;}
        for(auto it=tagOverlays.begin();it!=tagOverlays.end();) {
            if(it->nonce!=nonce){it=tagOverlays.erase(it);continue;}if(GetTickCount64()<it->until){++it;continue;}
            const auto response=Request(L"GET",L"/tag-state?id="+std::wstring(it->id.begin(),it->id.end()),nonce);std::string state,value,message;
            if(JsonStringValue(response,"state",state)&&state=="restore"&&JsonStringValue(response,"value",value)){JsonStringValue(response,"message",message);result.push_back({it->callsign,value,message,it->type});}
            it=tagOverlays.erase(it);
        }return result;
    }
    static bool Shortcut(const std::string &line,std::string &command) {
        if(line.empty() || line[0]!='.')return false;
        const auto end=line.find_first_of(" ,");const auto verb=line.substr(1,end==std::string::npos?std::string::npos:end-1);
        static const std::vector<std::string> allowed={"ALT","RATE","SPD","IAS","HDG","LHDG","RHDG","DCT","APP","PAUSE","IDENT","SQ","MODE","SPEED","ROUTE","DELETE"};
        if(std::find(allowed.begin(),allowed.end(),verb)==allowed.end())return false;
        command=line.substr(1);return true;
    }
    bool TrainingContext() const {std::string nonce,session;return Binding(nonce,session)&&TrainingSocketPort()!=0;}
    bool PilotAircraft(const std::string &cs) const {return pilotControls&&GetTickCount64()-predictionVerified<2500&&predictionCallsigns.find(","+cs+",")!=std::string::npos;}
    std::string PilotContext(const std::string &cs) const {std::string nonce,session;return Callsign(cs)&&PilotAircraft(cs)&&Binding(nonce,session)&&TrainingSocketPort()?nonce+"|"+session:"";}
    const std::vector<PilotTag>& PilotTags() const {static const std::vector<PilotTag> empty;return GetTickCount64()-pilotTagsVerified<2500?pilotTags:empty;}
    std::string PilotLayoutContext() const {return GetTickCount64()-pilotTagsVerified<2500?pilotTagsContext:"";}
    std::vector<std::string> PilotMenu(const std::string &cs,const std::string &field){std::vector<std::string> result;std::string nonce,session;if(PilotContext(cs).empty()||!Binding(nonce,session))return result;const auto route=L"/pilot-menu?port="+std::to_wstring(TrainingSocketPort())+L"&callsign="+std::wstring(cs.begin(),cs.end())+L"&field="+std::wstring(field.begin(),field.end());const auto response=Request(L"GET",route,nonce);std::string received;if(JsonStringValue(response,"sessionId",received)&&received==session)JsonStringArrayValue(response,"choices",result);return result;}
    int PredictionMinutes(const std::string &callsign) const {return GetTickCount64()-predictionVerified<2500&&predictionCallsigns.find(","+callsign+",")!=std::string::npos?predictionMinutes:0;}
    std::string Tick(const std::string &selected,const std::string &controller) {
        std::string nonce,session,message;
        if (!pending.empty()) {
            if (GetTickCount64()>deadline) {pending.clear();message="Training command timed out. Check the instructor dashboard before retrying.";}
            else if (!Binding(nonce,session) || nonce!=pendingNonce) {pending.clear();message="Instructor connection/scenario changed; command status unavailable. Check the dashboard.";}
            else {const auto response=Request(L"GET",L"/result?id="+std::wstring(pending.begin(),pending.end()),nonce); std::string state;
                if (JsonStringValue(response,"state",state) && state!="pending") {JsonStringValue(response,"message",message);pending.clear();}
            }
        }
        int minutes=0;std::string callsigns;const DWORD port=!controller.empty() && Binding(nonce,session,&minutes,&callsigns)?TrainingSocketPort():0;
        predictionMinutes=port?minutes:0;predictionCallsigns=port?callsigns:"";predictionVerified=port?GetTickCount64():0;
        pilotControls=false;if(port){std::ifstream f(BindingFile(),std::ios::binary);const std::string json((std::istreambuf_iterator<char>(f)),std::istreambuf_iterator<char>());int enabled=0;pilotControls=json.size()<=4096&&JsonIntValue(json,"pilot_controls",enabled)&&enabled==1;}
        pilotTags.clear();pilotTagsVerified=0;
        if(port&&pilotControls){const auto response=Request(L"GET",L"/pilot-state?port="+std::to_wstring(port),nonce);std::vector<std::string> rows;std::string received;if(JsonStringValue(response,"sessionId",received)&&received==session&&JsonStringArrayValue(response,"tags",rows)&&rows.size()<=100){for(const auto &row:rows){std::vector<std::string> parts;std::istringstream stream(row);std::string part;while(std::getline(stream,part,'|'))parts.push_back(part);if(parts.size()!=24||!Callsign(parts[0]))continue;PilotTag tag;tag.callsign=parts[0];tag.type=parts[1];tag.owner=parts[2];for(int i=0;i<7;++i){tag.values[i]=parts[3+i*3];tag.matches[i]=parts[4+i*3]=="1";tag.states[i]=parts[5+i*3];}pilotTags.push_back(tag);}pilotTagsContext=nonce+"|"+session;pilotTagsVerified=GetTickCount64();}}
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
