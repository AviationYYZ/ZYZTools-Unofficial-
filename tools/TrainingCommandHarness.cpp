#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <iphlpapi.h>
#include <windows.h>
#include <winhttp.h>
#include <string>
#include <vector>
#include <algorithm>
#include <cctype>
#include <ctime>
#include <fstream>
#include <regex>
#include <iostream>
#define ZYZTOOLS_TEST_BUILD
#define ZYZTOOLS_CHANNEL "test"
#pragma comment(lib,"Ws2_32.lib")
#pragma comment(lib,"Iphlpapi.lib")
#pragma comment(lib,"Winhttp.lib")
bool JsonStringValue(const std::string &j,const char *k,std::string &v){std::smatch m;if(!std::regex_search(j,m,std::regex(std::string("\"")+k+"\"\\s*:\\s*\"([^\"]*)\"")))return false;v=m[1].str();return true;}
bool JsonIntValue(const std::string &j,const char *k,int &v){std::smatch m;if(!std::regex_search(j,m,std::regex(std::string("\"")+k+"\"\\s*:\\s*(\\d+)")))return false;v=std::stoi(m[1].str());return true;}
std::string JsonEscape(const std::string &s){std::string r;for(char c:s){if(c=='"'||c=='\\')r+='\\';r+=c;}return r;}
#include "../src/TrainingCommandBridge.h"
int main(int argc,char **argv){
 CTrainingCommandBridge bridge;
 if(argc>1&&std::string(argv[1])=="offline"){const auto r=bridge.Command("TEST101","INSTR_APP","HDG 270");std::cout<<r<<std::endl;return r.find("Connect my EuroScope")!=std::string::npos?0:2;}
 WSADATA data{};if(WSAStartup(MAKEWORD(2,2),&data))return 3;SOCKET s=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP);sockaddr_in a{};a.sin_family=AF_INET;a.sin_port=htons(6809);a.sin_addr.s_addr=htonl(0x7f000001);
 if(connect(s,reinterpret_cast<sockaddr*>(&a),sizeof(a)))return 4;
 const char login[]="#AAINSTR_APP:SERVER:Dummy:0000000:dummy:1:100\r\n";send(s,login,sizeof(login)-1,0);Sleep(700);
 const auto queued=bridge.Command("TEST101","INSTR_APP","HDG 270");std::cout<<queued<<std::endl;if(queued.find("queued")==std::string::npos){closesocket(s);WSACleanup();return 5;}
 bool done=false;for(int i=0;i<20&&!done;i++){Sleep(150);const auto r=bridge.Tick("TEST101","INSTR_APP");if(!r.empty()){std::cout<<r<<std::endl;done=r.find("applied")!=std::string::npos;}}
 closesocket(s);WSACleanup();return done?0:6;
}
