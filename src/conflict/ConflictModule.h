#pragma once
#include <windows.h>
#include <mmsystem.h>
#include "../../SDK/EuroScopePlugIn.h"
#include "Engine.h"
#include "SituDraw.h"
#include "Sequencing.h"
#include <fstream>
#include <sstream>
#include <set>
#include <regex>
#include <filesystem>
using namespace EuroScopePlugIn;
namespace fs=std::filesystem;
namespace zyzca {
constexpr int CallsignItem=7101,MarkerItem=7102;
std::string safe(const char*s){return s?s:"";}
bool correlatedPair(CFlightPlan fp,CRadarTarget rt){
 if(!fp.IsValid()||!rt.IsValid())return false;
 auto linked=fp.GetCorrelatedRadarTarget();auto back=rt.GetCorrelatedFlightPlan();
 if(!linked.IsValid()||!back.IsValid())return false;
 auto id=safe(rt.GetSystemID()),callsign=safe(fp.GetCallsign());
 return !id.empty()&&!callsign.empty()&&id==safe(linked.GetSystemID())&&callsign==safe(back.GetCallsign());
}
double now(){return GetTickCount64()/1000.;}
std::vector<std::string> split(std::string s,char delimiter){std::vector<std::string> v;std::istringstream in(s);while(std::getline(in,s,delimiter))v.push_back(s);return v;}
class ConflictModule {
 CPlugIn& host;
public:
 inline static ConflictModule* plugin=nullptr;
 std::string status="Disabled";
 bool sequencing=false,ownedOnly=true;
 std::string leader,follower,mergeFix;
 double lastRecommendations=-100;
 std::vector<ca::Recommendation> recommendations;
 std::vector<ca::Recommendation> aiRecommendations;
 std::string aiRequestId,aiStatus="No AI request.";
 double lastAIScan=-100;
 std::string recommendationStatus;
 FILETIME settingsTime{};

public:
 ca::Config config;ca::VectorTracker vectors;
 std::map<std::string,ca::Alert>alerts,early;
 std::vector<ca::Aircraft> aircraft;std::vector<ca::Runway>runways;
 std::set<CRadarScreen*> screens;fs::path dir;
 std::map<std::string,double> restrictions;std::map<std::string,char> wakeTypes;
 double lastEarly=-100,lastScan=-100,lastLoud=-100;
 bool enabled=false,muted=false,dirty=true,hookEnabled=true,hookReported=false;
 bool lightOpen=false,loudOpen=false;UINT_PTR refreshTimer=0;
 HANDLE adapterLock=nullptr;
 ConflictModule(CPlugIn& owner,const fs::path& directory):host(owner),dir(directory){
  plugin=this;
  host.RegisterTagItemType("CA Callsign",CallsignItem);host.RegisterTagItemType("CA Indicator",MarkerItem);
  loadConfig();
  draw::setLookup([this](const std::string&id){return displayStage(id);});
  refreshTimer=SetTimer(nullptr,0,500,[](HWND,UINT,UINT_PTR,DWORD){if(plugin&&std::any_of(plugin->alerts.begin(),plugin->alerts.end(),[](const auto&v){return v.second.stage==ca::Stage::Urgent;}))for(auto*s:plugin->screens)s->RequestRefresh();});
 }
 ~ConflictModule(){
  if(refreshTimer)KillTimer(nullptr,refreshTimer);draw::uninstall();stopAudio();
  if(adapterLock){ReleaseMutex(adapterLock);CloseHandle(adapterLock);}
  draw::setLookup({});plugin=nullptr;
 }

 static std::string escape(const std::string& value){
  std::string out;for(unsigned char c:value){if(c=='"'||c=='\\'){out+='\\';out+=char(c);}else if(c=='\n')out+="\\n";else if(c>=32)out+=char(c);}return out;
 }
 void writeSnapshot(){
  std::ofstream out(dir/"ZYZToolsConflictStatus.json.tmp",std::ios::binary|std::ios::trunc);if(!out)return;
  out<<"{\"ts\":"<<std::time(nullptr)<<",\"enabled\":"<<(enabled?"true":"false")<<",\"status\":\""<<escape(status)<<"\",\"aircraft\":[";
  bool first=true;
  for(const auto&a:aircraft){
   if(!first)out<<",";first=false;
   out<<"{\"callsign\":\""<<escape(a.id)<<"\",\"owned\":"<<(a.owned?"true":"false")<<",\"eligible\":"<<(ca::eligible(a,config)?"true":"false")
      <<",\"altitude\":"<<a.altitude<<",\"speed\":"<<a.gs<<",\"direct\":\""<<escape(a.direct)<<"\",\"x\":"<<a.p.x<<",\"y\":"<<a.p.y
      <<",\"heading\":"<<a.heading<<",\"verticalSpeed\":"<<a.vs<<",\"age\":"<<a.age<<",\"clearedAltitude\":"<<a.cleared
      <<",\"assignedIas\":"<<a.assignedIas<<",\"estimatedIas\":"<<a.estimatedIas<<",\"wake\":\""<<a.wake<<"\",\"vectored\":"<<(a.vectored?"true":"false")<<",\"route\":[";
   bool firstFix=true;for(size_t i=0;i<a.route.size()&&i<64;++i){const auto&w=a.route[i];if(!firstFix)out<<",";firstFix=false;
    out<<"{\"name\":\""<<escape(w.name)<<"\",\"x\":"<<w.p.x<<",\"y\":"<<w.p.y<<",\"maxIas\":"<<w.maxIas<<"}";}
   out<<"]}";
  }
  out<<"],\"alerts\":[";first=true;
  for(const auto&[id,v]:alerts){if(!first)out<<",";first=false;out<<"{\"callsign\":\""<<escape(id)<<"\",\"other\":\""<<escape(v.other)<<"\",\"stage\":"<<int(v.stage)<<",\"seconds\":"<<v.seconds<<",\"reason\":\""<<escape(v.reason)<<"\"}";}
  out<<"],\"recommendationStatus\":\""<<escape(recommendationStatus)<<"\",\"recommendations\":[";first=true;
  for(const auto&r:recommendations){if(!first)out<<",";first=false;out<<"{\"text\":\""<<escape(r.text)<<"\",\"leaderEta\":"<<r.leaderEta<<",\"followerEta\":"<<r.followerEta<<",\"savingNm\":"<<r.savingNm<<"}";}
  out<<"],\"aiRequestId\":\""<<escape(aiRequestId)<<"\",\"aiStatus\":\""<<escape(aiStatus)<<"\",\"aiRecommendations\":[";
  first=true;for(const auto&r:aiRecommendations){if(!first)out<<",";first=false;out<<"{\"text\":\""<<escape(r.text)<<"\",\"leaderEta\":"<<r.leaderEta<<",\"followerEta\":"<<r.followerEta<<"}";}
  out<<"]}";out.close();if(out)MoveFileExW((dir/"ZYZToolsConflictStatus.json.tmp").c_str(),(dir/"ZYZToolsConflictStatus.json").c_str(),MOVEFILE_REPLACE_EXISTING);
 }
 void processAI(){
  const auto file=(dir/"ZYZToolsAIRequest.ini").string();
  auto value=[&](const std::string&section,const char*key){char text[256];GetPrivateProfileStringA(section.c_str(),key,"",text,sizeof(text),file.c_str());return std::string(text);};
  const auto id=value("Request","Id");
  if(id.empty()){aiRequestId.clear();aiRecommendations.clear();aiStatus="No pending AI request.";return;}
  if(id==aiRequestId&&now()-lastAIScan<5)return;
  aiRequestId=id;lastAIScan=now();aiRecommendations.clear();
  if(id.size()!=36||std::any_of(id.begin(),id.end(),[](unsigned char c){return !std::isalnum(c)&&c!='-';})){aiStatus="Invalid AI request identifier.";return;}
  if(std::abs(double(std::time(nullptr)-_atoi64(value("Request","Generated").c_str())))>60){aiStatus="AI proposal expired. Request a fresh analysis.";return;}
  if(!enabled||!sequencing||value("Request","Leader")!=leader||value("Request","Follower")!=follower){aiStatus="Settings/order changed; AI proposal discarded.";return;}
  const auto lead=std::find_if(aircraft.begin(),aircraft.end(),[&](const auto&a){return a.id==leader;});
  const auto trail=std::find_if(aircraft.begin(),aircraft.end(),[&](const auto&a){return a.id==follower;});
  if(lead==aircraft.end()||trail==aircraft.end()||(ownedOnly&&(!lead->owned||!trail->owned))){aiStatus="Selected aircraft unavailable or no longer owned.";return;}
  const int count=GetPrivateProfileIntA("Request","Count",0,file.c_str());
  if(count<1||count>3){aiStatus="Invalid AI candidate count.";return;}
  std::ostringstream rejected;
  for(int i=0;i<count;++i){
   const auto section="Proposal"+std::to_string(i);ca::AIProposal p;
   p.leaderDirect=value(section,"leader_direct");p.rejoinFix=value(section,"rejoin_fix");p.mergeFix=value(section,"merge_fix");
   p.leaderIas=static_cast<int>(GetPrivateProfileIntA(section.c_str(),"leader_ias",0,file.c_str()));
   p.followerIas=static_cast<int>(GetPrivateProfileIntA(section.c_str(),"follower_ias",0,file.c_str()));
   p.followerOffset=static_cast<int>(GetPrivateProfileIntA(section.c_str(),"follower_offset",0,file.c_str()));
   p.delaySeconds=static_cast<int>(GetPrivateProfileIntA(section.c_str(),"delay_seconds",0,file.c_str()));
   std::string why;ca::Recommendation recommendation;
   if(!mergeFix.empty()&&p.mergeFix!=mergeFix)why="Does not honor the selected merge fix.";
   else if(ca::validateAIProposal(*lead,*trail,aircraft,config,runways,p,recommendation,why)){aiRecommendations.push_back(recommendation);continue;}
   rejected<<"Candidate "<<i+1<<": "<<why<<" ";
  }
  aiStatus=std::to_string(aiRecommendations.size())+"/"+std::to_string(count)+" AI candidates pass current native checks. "+rejected.str();
 }

 void message(const std::string&s){host.DisplayUserMessage("CZYZ CA","",s.c_str(),true,true,false,false,false);}
 bool currentlyCorrelated(const std::string&id){
  auto fp=host.FlightPlanSelect(id.c_str());if(!fp.IsValid())return false;
  auto rt=fp.GetCorrelatedRadarTarget();if(!correlatedPair(fp,rt))return false;
  auto pos=rt.GetPosition();return pos.IsValid()&&!pos.IsFPTrackPosition();
 }
 ca::Stage displayStage(const std::string&id){
  auto i=alerts.find(id);
  if(!enabled||i==alerts.end()||!currentlyCorrelated(id)||!currentlyCorrelated(i->second.other))return ca::Stage::None;
  return i->second.stage;
 }
 void log(const std::string&s){std::ofstream f(dir/"CZYZConflictAlert.log",std::ios::app);f<<now()<<" "<<s<<"\n";}
 void loadConfig(){
  config=ca::Config{};auto path=(dir/"CZYZConflictAlert.ini").string();
  auto number=[&](const char*k,double d){char b[64];auto val=std::to_string(d);GetPrivateProfileStringA("Detection",k,val.c_str(),b,64,path.c_str());try{return std::stod(b);}catch(...){return d;}};
  // The requested stage thresholds and minimum separation are fixed in v1.
  config.stale=std::clamp(number("StaleSeconds",30),10.,120.);
  config.vectorEnter=std::clamp(number("VectorDivergenceDegrees",25),15.,60.);
  config.vectorHold=std::clamp(number("VectorConfirmSeconds",8),2.,30.);
  config.rejoinHold=std::clamp(number("RejoinConfirmSeconds",5),1.,20.);
  hookEnabled=GetPrivateProfileIntA("Display","SituAdapter",1,path.c_str())!=0;
  muted=GetPrivateProfileIntA("Audio","Muted",0,path.c_str())!=0;
  char b[4096];GetPrivateProfileStringA("Detection","ArrivalAirports","CYYZ,CYTZ,CYHM,CYKF,CYOO,CYXU,CYQG,CYSB,CYYB,CYAM",b,sizeof(b),path.c_str());config.arrivals=split(b,',');
  restrictions.clear();wakeTypes.clear();
  std::ifstream limits(dir/"speed_restrictions.csv");std::string line;
  while(std::getline(limits,line)){if(line.empty()||line[0]=='#')continue;auto p=split(line,',');try{if(p.size()==3){double v=std::stod(p[2]);if(v>=60&&v<=400)restrictions[p[0]+"/"+p[1]]=v;}}catch(...){log("Ignored invalid speed restriction: "+line);}}
  std::ifstream wt(dir/"aircraft_wake.csv");while(std::getline(wt,line)){auto p=split(line,',');if(p.size()==2&&p[1].size()==1&&std::string("JHML").find(p[1][0])!=std::string::npos)wakeTypes[p[0]]=p[1][0];}
  std::ifstream matrix(dir/"wake_separation.csv");while(std::getline(matrix,line)){auto p=split(line,',');try{if(p.size()==3&&p[0].size()==1&&p[1].size()==1&&std::string("JHML").find(p[0])!=std::string::npos&&std::string("JHML").find(p[1])!=std::string::npos){double d=std::stod(p[2]);if(d>=3&&d<=15)config.wake[p[0]+p[1]]=d;}}catch(...){log("Ignored invalid wake row: "+line);}}
  std::ifstream pairs(dir/"parallel_approaches.txt");if(pairs){config.parallel.clear();while(std::getline(pairs,line)){if(!line.empty()&&line.back()=='\r')line.pop_back();if(!line.empty()&&line[0]!='#')config.parallel.push_back(line);}}
  auto control=(dir/"ZYZToolsConflict.ini").string();
  enabled=GetPrivateProfileIntA("Settings","Enabled",0,control.c_str())!=0;
  sequencing=GetPrivateProfileIntA("Settings","Sequencing",0,control.c_str())!=0;
  ownedOnly=GetPrivateProfileIntA("Settings","OwnedOnly",1,control.c_str())!=0;
  hookEnabled=GetPrivateProfileIntA("Settings","SituAdapter",1,control.c_str())!=0;
  muted=GetPrivateProfileIntA("Settings","Muted",0,control.c_str())!=0;
  char selected[128];
  GetPrivateProfileStringA("Settings","Leader","",selected,sizeof(selected),control.c_str());leader=selected;
  GetPrivateProfileStringA("Settings","Follower","",selected,sizeof(selected),control.c_str());follower=selected;
  GetPrivateProfileStringA("Settings","MergeFix","",selected,sizeof(selected),control.c_str());mergeFix=selected;
  GetPrivateProfileStringA("Settings","ArrivalAirports","CYYZ,CYTZ,CYHM,CYKF,CYOO,CYXU,CYQG,CYSB,CYYB,CYAM",b,sizeof(b),control.c_str());config.arrivals=split(b,',');
  if(!hookEnabled||!enabled)draw::uninstall();
  if(muted||!enabled)stopAudio();
  lastRecommendations=-100;
  lastAIScan=-100;
  dirty=true;
 }
 void readRunways(){
  host.SelectActiveSectorfile();
  runways.clear();
  for(auto r=host.SectorFileElementSelectFirst(SECTOR_ELEMENT_RUNWAY);r.IsValid();r=host.SectorFileElementSelectNext(r,SECTOR_ELEMENT_RUNWAY)){
   CPosition p,q;if(!r.GetPosition(&p,0)||!r.GetPosition(&q,1))continue;
   auto a=ca::project(p.m_Latitude,p.m_Longitude),b=ca::project(q.m_Latitude,q.m_Longitude);if(ca::norm(b-a)<.1)continue;
   // Derive true headings from coordinates, not sector magnetic heading fields.
   runways.push_back({safe(r.GetAirportName()),safe(r.GetRunwayName(0)),a,ca::bearing(b-a),r.IsElementActive(false,0)});
   runways.push_back({safe(r.GetAirportName()),safe(r.GetRunwayName(1)),b,ca::bearing(a-b),r.IsElementActive(false,1)});
  }
 }
 void collect(){
  aircraft.clear();double t=now();
  for(auto rt=host.RadarTargetSelectFirst();rt.IsValid();rt=host.RadarTargetSelectNext(rt)){
   auto fp=rt.GetCorrelatedFlightPlan();auto pos=rt.GetPosition();if(!correlatedPair(fp,rt)||!pos.IsValid()||pos.IsFPTrackPosition())continue;
   auto data=fp.GetFlightPlanData();auto assigned=fp.GetControllerAssignedData();ca::Aircraft a;
   a.owned=fp.GetTrackingControllerIsMe();
   a.correlated=true; // Set only after the SDK confirms the link in both directions.
   a.id=safe(fp.GetCallsign());a.ifr=safe(data.GetPlanType())=="I";a.type=safe(data.GetAircraftFPType());
   auto p=pos.GetPosition();a.p=ca::project(p.m_Latitude,p.m_Longitude);a.altitude=pos.GetPressureAltitude();
   a.gs=rt.GetGS();a.heading=ca::projectedHeading(p.m_Latitude,p.m_Longitude,rt.GetTrackHeading());a.age=pos.GetReceivedTime();a.vs=rt.GetVerticalSpeed();
   // Prefer a measured multi-report altitude trend to the SDK's noisy single delta.
   auto old=rt.GetPreviousPosition(pos);
   for(int i=0;i<8&&old.IsValid();++i){double dt=old.GetReceivedTime()-pos.GetReceivedTime();if(dt>=8&&dt<=45){a.vs=(a.altitude-old.GetPressureAltitude())*60/dt;break;}old=rt.GetPreviousPosition(old);}
   a.vs=std::clamp(a.vs,-6000.,6000.);a.cleared=assigned.GetClearedAltitude();
   a.assignedIas=assigned.GetAssignedSpeed();int mach=assigned.GetAssignedMach();a.assignedMach=mach>100?mach/1000.:mach/100.;
   a.assignedRate=assigned.GetAssignedRate();a.destination=safe(data.GetDestination());a.runway=safe(data.GetArrivalRwy());a.direct=safe(assigned.GetDirectToPointName());
   a.arrival=std::find(config.arrivals.begin(),config.arrivals.end(),a.destination)!=config.arrivals.end();
   a.wake=data.GetAircraftWtc();if(a.type=="A388")a.wake='J';auto wt=wakeTypes.find(a.type);if(wt!=wakeTypes.end())a.wake=wt->second;
   if(std::string("JHML").find(a.wake)==std::string::npos)a.wake='H';
   int climb=data.PerformanceGetClimbRate(int(a.altitude)),descent=data.PerformanceGetDescentRate(int(a.altitude));
   a.climbRate=climb>0?std::clamp(climb,300,5000):1500;a.descentRate=descent>0?std::clamp(descent,300,5000):1500;
   // Performance IAS is used only to estimate wind offset, never substituted for measured GS.
   a.estimatedIas=data.PerformanceGetIas(int(a.altitude),a.vs>200?1:a.vs<-200?-1:0);
   auto route=fp.GetExtractedRoute();int n=route.GetPointsNumber(),start=route.GetPointsCalculatedIndex();
   if(start>=0)++start;else start=0;
   int direct=route.GetPointsAssignedIndex();if(!a.direct.empty()&&direct>=0&&direct<n&&route.GetPointDistanceInMinutes(direct)>=0)start=direct;
   std::map<std::string,double> filedLimits;
   static const std::regex speed("([A-Z0-9]+)/(?:N([0-9]{4})|K([0-9]{4}))");
   std::string filed=safe(data.GetRoute());for(std::sregex_iterator i(filed.begin(),filed.end(),speed),end;i!=end;++i){auto m=*i;filedLimits[m[1].str()]=m[2].matched?std::stod(m[2].str()):std::stod(m[3].str())/1.852;}
   for(int i=std::clamp(start,0,n);i<n;++i){auto pnt=route.GetPointPosition(i);if(std::abs(pnt.m_Latitude)>90||std::abs(pnt.m_Longitude)>180||(pnt.m_Latitude==0&&pnt.m_Longitude==0))break;
    ca::Waypoint w{safe(route.GetPointName(i)),ca::project(pnt.m_Latitude,pnt.m_Longitude),0};
    auto limit=restrictions.find(a.destination+"/"+w.name);if(limit!=restrictions.end())w.maxIas=limit->second;
    // Filed N/K route speeds are TAS, not IAS. Convert before using the IAS limiter.
    auto f=filedLimits.find(w.name);if(f!=filedLimits.end()){double factor=std::sqrt(1/std::pow(std::max(.2,1-6.87535e-6*std::clamp(a.altitude,0.,36000.)),4.2561));double ias=f->second/factor;w.maxIas=w.maxIas>0?std::min(w.maxIas,ias):ias;}
    a.route.push_back(w);
   }
   a.vectored=vectors.update(a,t,config);
   aircraft.push_back(std::move(a));
  }vectors.prune(t);
 }
 std::wstring audioAlias(bool loud)const{
#ifdef ZYZTOOLS_TEST_BUILD
  return loud?L"zyz_test_ca_loud":L"zyz_test_ca_light";
#else
  return loud?L"zyz_ca_loud":L"zyz_ca_light";
#endif
 }
 void closeSound(bool loud){auto command=L"close "+audioAlias(loud);mciSendStringW(command.c_str(),nullptr,0,nullptr);(loud?loudOpen:lightOpen)=false;}
 void stopAudio(){if(lightOpen)closeSound(false);if(loudOpen)closeSound(true);}
 void play(bool loud){
  if(muted)return;
  auto file=dir/(loud?"urgent_alert.wav":"caution_chime.wav");if(!fs::exists(file)){log("Missing audio: "+file.filename().string());return;}
  if(loud&&lightOpen)closeSound(false);
  bool&open=loud?loudOpen:lightOpen;std::wstring alias=audioAlias(loud);
  if(!open){auto command=L"open \""+file.wstring()+L"\" type waveaudio alias "+alias;auto err=mciSendStringW(command.c_str(),nullptr,0,nullptr);if(err){log("Audio open failed: "+std::to_string(err));return;}open=true;}
  auto command=L"play "+alias+L" from 0";auto err=mciSendStringW(command.c_str(),nullptr,0,nullptr);if(err)log("Audio play failed: "+std::to_string(err));
 }
 void OnTimer(int){
  WIN32_FILE_ATTRIBUTE_DATA file{};const auto control=(dir/"ZYZToolsConflict.ini").wstring();
  if(GetFileAttributesExW(control.c_str(),GetFileExInfoStandard,&file)&&CompareFileTime(&file.ftLastWriteTime,&settingsTime)!=0){settingsTime=file.ftLastWriteTime;loadConfig();}
  if(GetModuleHandleW(L"CZYZConflictAlert.dll")){alerts.clear();early.clear();recommendations.clear();aiRecommendations.clear();aiStatus="AI validation paused while the standalone plugin is loaded.";recommendationStatus="Analysis paused while the standalone plugin is loaded.";stopAudio();draw::uninstall();status="Unload the standalone CZYZConflictAlert DLL to enable the united module.";writeSnapshot();return;}

  if(enabled)draw::setLookup([this](const std::string&id){return displayStage(id);});
  if((!enabled||!hookEnabled)&&adapterLock){ReleaseMutex(adapterLock);CloseHandle(adapterLock);adapterLock=nullptr;}
  if(enabled&&hookEnabled&&!draw::installed()){
   if(!adapterLock){auto lock=CreateMutexW(nullptr,TRUE,L"Local\\ZYZTools.Conflict.SituAdapter");if(lock&&GetLastError()!=ERROR_ALREADY_EXISTS)adapterLock=lock;else if(lock)CloseHandle(lock);}
   auto m=GetModuleHandleW(L"VATCANSitu.dll");
   if(adapterLock&&m&&draw::install(m)){log("SiTu DrawTextA adapter attached");message("SiTu tag adapter attached. Use .ca status for diagnostics.");}
   else if(m&&!hookReported){message("SiTu tag adapter unavailable or used by another ZYZTools copy; native CA list items still work.");hookReported=true;}
  }
  if(!enabled){alerts.clear();early.clear();aircraft.clear();recommendations.clear();aiRecommendations.clear();aiStatus="Conflict module disabled.";recommendationStatus="Enable conflict alerts and sequencing to analyze a pair.";status="Disabled";writeSnapshot();return;}
  double t=now();if(t-lastScan<.9)return;lastScan=t;
  try{
   collect();auto previous=alerts;
   if(dirty||t-lastEarly>=10){readRunways();early=ca::scan(aircraft,config,runways,true);lastEarly=t;dirty=false;}
   alerts=ca::scan(aircraft,config,runways,false);
   std::set<std::string>valid;for(auto&a:aircraft)if(ca::eligible(a,config))valid.insert(a.id);
   for(auto i=early.begin();i!=early.end();)if(!valid.count(i->first)||!valid.count(i->second.other))i=early.erase(i);else ++i;
   for(auto&[id,v]:early)if(valid.count(id)&&valid.count(v.other)&&!alerts.count(id))alerts[id]=v;
   bool urgent=false,newRed=false,newUrgent=false;
   for(auto&[id,v]:alerts){auto old=previous.find(id);auto before=old==previous.end()?ca::Stage::None:old->second.stage;
    urgent|=v.stage==ca::Stage::Urgent;newUrgent|=v.stage==ca::Stage::Urgent&&before<ca::Stage::Urgent;newRed|=v.stage==ca::Stage::Red&&before<ca::Stage::Red;
    if(before!=v.stage)log(id+" stage="+std::to_string(int(v.stage))+" other="+v.other+" t="+std::to_string(v.seconds)+" "+v.reason);
   }
   for(auto&[id,v]:previous)if(!alerts.count(id))log(id+" clear");
   if(urgent&&(newUrgent||t-lastLoud>=5)){play(true);lastLoud=t;}else if(!urgent&&newRed)play(false);
   if(!urgent&&loudOpen)closeSound(true);
   if(alerts.empty())stopAudio();
   status=std::string("Active; SiTu adapter ")+(draw::installed()?"attached":"unavailable")+"; "+std::to_string(aircraft.size())+" targets";
   if(t-lastRecommendations>=5){
    recommendations.clear();recommendationStatus="Enable sequencing and select the aircraft to place first and second.";
    if(sequencing){
     auto lead=std::find_if(aircraft.begin(),aircraft.end(),[&](const auto&a){return a.id==leader;});
     auto trail=std::find_if(aircraft.begin(),aircraft.end(),[&](const auto&a){return a.id==follower;});
     if(lead==aircraft.end()||trail==aircraft.end())recommendationStatus="Select two current correlated aircraft.";
     else if(ownedOnly&&(!lead->owned||!trail->owned))recommendationStatus="Both selected aircraft must be tracked by you (or disable owned-only analysis).";
     else recommendations=ca::recommend(*lead,*trail,aircraft,config,runways,mergeFix,recommendationStatus);
    }
    lastRecommendations=t;
   }
   processAI();
   writeSnapshot();
  }catch(const std::exception&e){alerts.clear();early.clear();stopAudio();log(std::string("Scan failed: ")+e.what());status=std::string("Scan failed: ")+e.what();recommendations.clear();aiRecommendations.clear();aiStatus="Native scan failed; AI validation unavailable.";writeSnapshot();}
 }
 void OnFlightPlanFlightPlanDataUpdate(CFlightPlan){dirty=true;}
 void OnFlightPlanControllerAssignedDataUpdate(CFlightPlan,int){dirty=true;}
 void OnFlightPlanDisconnect(CFlightPlan fp){auto id=safe(fp.GetCallsign());alerts.erase(id);early.erase(id);dirty=true;}
 void OnAirportRunwayActivityChanged(){dirty=true;}
 void OnGetTagItem(CFlightPlan fp,CRadarTarget rt,int code,int,char text[16],int*color,COLORREF*rgb,double*size){
  if(code!=CallsignItem&&code!=MarkerItem)return;text[0]=0;*color=TAG_COLOR_DEFAULT;
  if(!fp.IsValid())return;std::string id=safe(fp.GetCallsign());
  if(code==CallsignItem)strncpy_s(text,16,id.c_str(),_TRUNCATE);
  if(!rt.IsValid())rt=fp.GetCorrelatedRadarTarget();if(!correlatedPair(fp,rt))return;
  auto s=displayStage(id);if(s==ca::Stage::None)return;*color=TAG_COLOR_RGB_DEFINED;
  if(code==CallsignItem&&s==ca::Stage::Early)strncpy_s(text,16,("! "+id).c_str(),_TRUNCATE);
  *rgb=s>=ca::Stage::Red?RGB(255,40,50):RGB(255,220,0);
  if(s==ca::Stage::Urgent){*rgb=(GetTickCount64()/500)%2?RGB(255,255,255):RGB(255,80,100);*size=*size>0?*size*1.4:16;}
  if(code==MarkerItem){strcpy_s(text,16,s==ca::Stage::Early?"!":s==ca::Stage::Yellow?"o":"#");if(s==ca::Stage::Early)*size=*size>0?*size*1.3:15.6;}
 }
 bool OnCompileCommand(const char*command){
  std::string cmd=safe(command);if(cmd!=".ca"&&cmd.rfind(".ca ",0)!=0)return false;
  if(cmd==".ca off"){enabled=false;alerts.clear();early.clear();stopAudio();message("Conflict alerts disabled.");}
  else if(cmd==".ca on"){enabled=true;dirty=true;message("Conflict alerts enabled.");}
  else if(cmd==".ca mute"){muted=true;stopAudio();message("Conflict audio muted.");}
  else if(cmd==".ca unmute"){muted=false;message("Conflict audio enabled.");}
  else if(cmd==".ca reload"){loadConfig();if(!hookEnabled)draw::uninstall();draw::setLookup([this](const std::string&id){return displayStage(id);});message("Configuration reloaded.");}
  else if(cmd==".ca test caution")play(false);
  else if(cmd==".ca test urgent")play(true);
  else if(cmd==".ca status"){message(std::string("Enabled=")+(enabled?"yes":"no")+"; SiTu adapter="+(draw::installed()?"attached":"unavailable")+"; targets="+std::to_string(aircraft.size())+"; alerts="+std::to_string(alerts.size())+"; runway ends="+std::to_string(runways.size())+"; muted="+(muted?"yes":"no"));}
  else if(cmd.rfind(".ca inspect ",0)==0){auto id=cmd.substr(12);bool found=false;for(auto&a:aircraft)if(a.id==id){found=true;auto p=ca::predict(a,300,true);std::ostringstream out;out<<id<<" vector="<<a.vectored<<" GS="<<a.gs<<" VS="<<a.vs<<" cleared="<<a.cleared<<" next:";for(auto&[name,eta]:p.etas)out<<" "<<name<<"+"<<int(eta)<<"s";auto v=alerts.find(id);if(v!=alerts.end())out<<" conflict "<<v->second.other<<" +"<<int(v->second.seconds)<<"s "<<v->second.reason;message(out.str());}if(!found)message("No correlated target: "+id);}
  else message("Commands: .ca status | on | off | mute | unmute | reload | inspect CALLSIGN | test caution | test urgent");
  return true;
 }
};
}
