#include "ArrivalAssignment.h"
#include <cassert>
#include <iostream>
int main() {
    using namespace ArrivalAssignment;
    const char* flows[] = {"west", "east", "north", "south"};
    const char* expected[4][4] = {{"23","24L","24R","23"},{"05","06L","06R","05"},{"","33L","33R",""},{"","15L","15R",""}};
    const char codes[] = {'N','L','R','Y'};
    for (int f = 0; f < 4; ++f) for (int c = 0; c < 4; ++c) {
        const std::string sp = std::string(" ") + codes[c] + " remarks";
        assert(Runway(true, flows[f], sp) == expected[f][c]);
        assert(Runway(false, flows[f], sp).empty());
        assert(Runway(true, flows[f], std::string(1, codes[c])) == expected[f][c]);
    }
    for (const auto& s : {"", "NCD", "123L", "RREQ L", "remarks L", "LN", " LON", " X"}) assert(Runway(true,"west",s).empty());
    assert(Runway(true,"east"," l") == "06L");
    assert(Runway(true,"invalid"," L").empty());
    assert(WithRunway("CYYZ/05 SID DCT FIX STAR/CYYZ", "23", "STAR") == "CYYZ/05 SID DCT FIX STAR/23");
    assert(WithRunway("ORIGIN/24R SID FIX STAR CYYZ/24R", "06L", "STAR") == "ORIGIN/24R SID FIX STAR CYYZ/06L");
    assert(WithRunway("ORIGIN SID FIX STAR/24R", "15L", "STAR") == "ORIGIN SID FIX STAR/15L");
    assert(WithRunway("ORIGIN SID FIX", "33R", "") == "ORIGIN SID FIX CYYZ/33R");
    const auto route = WithRunway("FIX STAR", "05", "STAR");
    assert(WithRunway(route, "05", "STAR") == route);
    assert(WithRunway("", "23", "").empty());
    assert(WithRunway("FIX", "", "").empty());
    std::cout << "PASS: every SFI/flow mapping, disabled/N-A handling, VATCANSitu scratchpad parsing, arrival-only route amendment and idempotence.\n";
}
