#pragma once
#include "Engine.h"
namespace ca {
struct Recommendation {
 std::string text;
 double leaderEta=0,followerEta=0,savingNm=0;
};
struct AIProposal {
 std::string leaderDirect,rejoinFix,mergeFix;
 int leaderIas=0,followerIas=0,followerOffset=0,delaySeconds=0;
};
bool validateAIProposal(const Aircraft&leader,const Aircraft&follower,const std::vector<Aircraft>&all,
 const Config&,const std::vector<Runway>&,const AIProposal&,Recommendation&,std::string&reason);
std::vector<Recommendation> recommend(const Aircraft&leader,const Aircraft&follower,const std::vector<Aircraft>&all,
 const Config&,const std::vector<Runway>&,const std::string&mergeFix,std::string&status);
}
