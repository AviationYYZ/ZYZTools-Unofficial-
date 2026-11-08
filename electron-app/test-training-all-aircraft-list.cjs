const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('radar roster can display all authenticated callsigns independently of the native list',()=>{
 const cpp=fs.readFileSync(path.join(__dirname,'../src/ZYZToolsPlugin.cpp'),'utf8');
 const draw=cpp.slice(cpp.indexOf('void DrawAircraftRoster('),cpp.indexOf('void DrawPilotControls('));
 assert(cpp.includes('DrawAircraftRoster(hDC)'));
 assert(draw.includes('PilotRosterContext().empty()'));
 assert(draw.includes('PilotRoster()'));
 assert(draw.includes('cell(8,96,5,cs);'));
 assert(draw.includes('std::min(40,'));
 assert(!draw.includes('FlightPlanSelect'));
 assert(draw.includes('page*capacity'));
 assert(cpp.includes('ObjectType==SCREEN_OBJECT_ROSTER_CELL'));
});
test('native list has explicit private-only reopening from Advanced and command bar',()=>{
 const cpp=fs.readFileSync(path.join(__dirname,'../src/ZYZToolsPlugin.cpp'),'utf8');
 const start=cpp.indexOf('if(trainingCommand==".AIRCRAFT")'),end=cpp.indexOf('const bool explicitTraining',start),open=cpp.slice(start,end);
 assert(start>=0);assert(open.includes('PilotRosterContext().empty()'));assert(open.includes('ShowFpList(true)'));
 assert(cpp.includes('m_pilotMenuValues.insert(m_pilotMenuValues.begin(),"Show All Aircraft list")'));
 assert(cpp.includes('if(value=="Show All Aircraft list"){RefreshPilotAircraftList();'));
});
test('native all-aircraft list is independently populated from authenticated active simulator targets',()=>{const cpp=fs.readFileSync(path.join(__dirname,'../src/ZYZToolsPlugin.cpp'),'utf8');assert(cpp.includes('RegisterFpList(ZYZTOOLS_PLUGIN_NAME " - All Aircraft")'));assert(cpp.includes('m_pilotAircraftList.GetColumnNumber()==0'));const first=cpp.indexOf('void RefreshPilotAircraftList(bool'),last=cpp.indexOf('\n    }',first),refresh=cpp.slice(first,last);assert(refresh.includes('m_trainingCommands.PilotRoster()'));assert(refresh.includes('m_trainingCommands.PilotRosterContext()'));assert(!refresh.includes('PilotTags()'));assert(refresh.includes('AddFpToTheList(fp)'));assert(refresh.includes('RecoverFlightPlans'));assert(refresh.includes('RemoveFpFromTheList'));assert(refresh.includes('ShowFpList(false)'));assert(refresh.includes('ShowFpList(true)'));assert(!/GetTrackingControllerIsMe|GetSector|GetPositionId|COPN|COPX|GetFacility/.test(refresh));assert(cpp.includes('RefreshPilotAircraftList();'));assert(cpp.includes('m_pilotListMembers.erase(FlightPlan.GetCallsign())'));assert(!cpp.includes('DeleteAllColumns('));assert(cpp.includes('column("P ALT"'));assert(cpp.includes('column("P SPD"'));assert(cpp.includes('column("P NAV"'));});
