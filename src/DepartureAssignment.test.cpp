#include "DepartureAssignment.h"
#include <cassert>
int main() {
    const std::vector<std::string> north = {"ANCOL", "MIXUT"};
    const std::vector<std::string> south = {"DEDKI", "BETES"};
    using DepartureAssignment::Sid;
    using DepartureAssignment::Runway;
    for (const auto& mode : {"west", "east", "off", "west", "east"}) {
        assert(Runway(mode, "DEDKI", north, south) == (std::string(mode) == "west" ? "24R" : std::string(mode) == "east" ? "06L" : ""));
        assert(Runway(mode, "ANCOL", north, south) == (std::string(mode) == "west" ? "23" : std::string(mode) == "east" ? "05" : ""));
    }
    assert(Runway("east", "UNKNOWN", north, south).empty());
    assert(Runway("east", "ANCOL", north, north).empty());
    assert(DepartureAssignment::WithRunway("N0450F350 DCT BETES2/23 DCT", "24R") == "N0450F350 DCT BETES2/24R DCT");
    assert(DepartureAssignment::WithRunway("DEDKI5/23 DCT", "24R") == "DEDKI5/24R DCT");
    assert(DepartureAssignment::WithRunway("N0450F350 DCT", "23").empty());
    assert(Sid("DEDKI5/24R DCT ANCOL", "", north, south) == "DEDKI");
    assert(Sid("N0450F350 CYYZ/23 DCT BETES2 DCT", "", north, south) == "BETES");
    assert(Sid("CYYZ DCT MIXUT3", "", north, south) == "MIXUT");
    assert(Sid("dedki5nugop/24R DCT", "ANCOL1", north, south) == "DEDKI");
    assert(Sid("DCT UNKNOWN DCT ANCOL", "", north, south).empty());
    assert(Sid("", "ANCOL3", north, south) == "ANCOL");
    assert(Sid("", "", north, south).empty());
    assert(Sid("N0450F350 DCT BETES", "CYYZ", north, south) == "BETES");
}
