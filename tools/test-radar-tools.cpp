#include "../src/RadarTools.h"
#include "../src/TrainingPrediction.h"
#include <cassert>
int main(){
    assert(RadarTools::Calculate(0,"11000, 4000, 25, 230").find("1073 ft/min")==0);
    assert(RadarTools::Calculate(6,"8, 2")=="240 kt groundspeed");
    assert(RadarTools::Calculate(7,"2000, 800, 3")=="Altitude crossing within interval");
    assert(RadarTools::Calculate(6,"8, 0").find("Check")==0);
    const auto headOn=RadarTools::Spacing(10,90,90,180,270,180);
    assert(std::abs(RadarTools::TrueBearing(0,179,0,-179)-90)<1e-6);
    assert(std::abs(headOn.closure-360)<1e-6&&std::abs(headOn.minutes-10.0/6)<1e-6&&headOn.nm<1e-6);
    const auto parallel=RadarTools::Spacing(8,90,0,200,0,200);
    assert(parallel.minutes==0&&parallel.nm==8);
    bool outside=false;
    assert(!RadarTools::RadiusEntry(outside,5.3,5)&&outside);
    assert(RadarTools::RadiusEntry(outside,4.9,5)&&!outside);
    assert(!RadarTools::RadiusEntry(outside,5.1,5)&&!outside);
    assert(!RadarTools::RadiusEntry(outside,4.9,5)&&!outside);
    TrainingPrediction::Point half;
    assert(TrainingPrediction::Project(0,0,90,240,.5,half));
    assert(std::abs(half.lon-2.0/3440.065/RadarTools::rad)<1e-8);
    assert(!TrainingPrediction::Project(0,0,90,240,.25,half));
}
