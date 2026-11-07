#include "Sequencing.h"
#include <iostream>
#include <stdexcept>
using namespace ca;
void require(bool value,const char*message){if(!value)throw std::runtime_error(message);}
Aircraft aircraft(std::string id,Vec p,double heading){
 Aircraft a;a.id=id;a.p=p;a.heading=heading;a.gs=240;a.altitude=7000;a.cleared=7000;
 a.estimatedIas=200;a.arrival=true;a.correlated=true;a.destination="CYYZ";a.owned=true;return a;
}
int main(){try{
 Config c;std::string status;
 auto south=aircraft("SOUTH",{0,-12},0),east=aircraft("EAST",{18,0},270);
 south.route={{"DOGLEG",{6,-9},0},{"DOWNWIND",{6,0},0},{"MERGE",{0,0},0},{"FINAL",{0,10},0}};
 east.route={{"MERGE",{0,0},0},{"FINAL",{0,10},0}};
 auto options=recommend(south,east,{south,east},c,{},"",status);
 require(!options.empty(),"expected a shortcut putting the southern aircraft first");
 require(options.front().leaderEta<options.front().followerEta,"wrong requested sequence");
 bool direct=false;for(const auto&r:options)if(r.text.find("direct MERGE")!=std::string::npos)direct=true;
 require(direct,"expected existing merge waypoint shortcut");
 require(south.route.size()==4&&east.assignedIas==0,"solver mutated live aircraft input");
 require(recommend(south,south,{south},c,{},"",status).empty(),"same aircraft accepted");
 auto invalid=east;invalid.correlated=false;require(recommend(south,invalid,{south,invalid},c,{},"",status).empty(),"uncorrelated pair accepted");
 invalid=east;invalid.age=100;require(recommend(south,invalid,{south,invalid},c,{},"",status).empty(),"stale pair accepted");
 invalid=east;invalid.cleared=1;require(recommend(south,invalid,{south,invalid},c,{},"",status).empty(),"approach-cleared pair accepted");
 invalid=east;invalid.altitude=1999;require(recommend(south,invalid,{south,invalid},c,{},"",status).empty(),"low pair accepted");
 require(recommend(south,east,{south,east},c,{},"NONEXISTENT",status).empty(),"invented geometry accepted");
 invalid=east;invalid.route.clear();require(recommend(south,invalid,{south,invalid},c,{},"",status).empty(),"missing route accepted");
 invalid=east;invalid.p=south.p;require(recommend(south,invalid,{south,invalid},c,{},"",status).empty(),"current loss accepted");
 auto blocker=aircraft("BLOCKER",{0,2},180);
 blocker.route.clear();blocker.vectored=true;
 require(recommend(south,east,{south,east,blocker},c,{},"MERGE",status).empty(),"shortcut creates conflict with third aircraft");
 auto renamed=east;renamed.route[0].name="OTHER_NAME";
 require(!recommend(south,renamed,{south,renamed},c,{},"",status).empty(),"same merge location with a different name rejected");
 auto distantSouth=south,distantEast=east;distantSouth.p={0,-24};distantEast.p={30,0};
 require(!recommend(distantSouth,distantEast,{distantSouth,distantEast},c,{},"MERGE",status).empty(),"merge beyond five minutes rejected");
 auto vectored=south;vectored.vectored=true;vectored.route.erase(vectored.route.begin(),vectored.route.begin()+2);
 require(!recommend(vectored,east,{vectored,east},c,{},"MERGE",status).empty(),"direct first-fix vector rejoin rejected");
 auto delayedLeader=south,delayedFollower=east;
 delayedLeader.route.erase(delayedLeader.route.begin(),delayedLeader.route.begin()+2);delayedFollower.p={12,0};
 const auto delays=recommend(delayedLeader,delayedFollower,{delayedLeader,delayedFollower},c,{},"MERGE",status);
 bool hasDelay=false;for(const auto&r:delays)if(r.text.find("delaying vector")!=std::string::npos)hasDelay=true;
 require(hasDelay,"expected a modeled delaying vector when speed-only is insufficient");
 std::vector<Aircraft> crowded(121,south);crowded.push_back(east);
 require(!recommend(south,east,crowded,c,{},"",status).empty(),"121-target snapshot incorrectly rejected");
 crowded.resize(1001,south);require(recommend(south,east,crowded,c,{},"",status).empty(),"capacity limit ignored");
 AIProposal proposal;proposal.leaderDirect="MERGE";proposal.mergeFix="MERGE";Recommendation checked;
 require(validateAIProposal(south,east,{south,east},c,{},proposal,checked,status),"valid AI shortcut rejected");
 require(checked.text.find("locally checked")!=std::string::npos,"AI check label missing");
 auto bad=proposal;bad.leaderDirect="INVENTED";require(!validateAIProposal(south,east,{south,east},c,{},bad,checked,status),"invented AI direct accepted");
 bad=proposal;bad.followerIas=400;require(!validateAIProposal(south,east,{south,east},c,{},bad,checked,status),"unsafe AI speed accepted");
 bad=proposal;bad.followerOffset=90;bad.delaySeconds=60;require(!validateAIProposal(south,east,{south,east},c,{},bad,checked,status),"unbounded AI vector accepted");
 require(!validateAIProposal(south,east,{south,east,blocker},c,{},proposal,checked,status),"AI shortcut conflicting with third aircraft accepted");
 bad=proposal;bad.mergeFix="INVENTED";require(!validateAIProposal(south,east,{south,east},c,{},bad,checked,status),"invented AI merge accepted");
 std::cout<<"PASS: southern shortcut / eastern follower, requested order, no mutation, third-party conflict rejection, missing geometry, stale/correlation/approach/altitude exclusions and capacity limit.\n";
 return 0;
 }catch(const std::exception&e){std::cerr<<e.what()<<"\n";return 1;}}
