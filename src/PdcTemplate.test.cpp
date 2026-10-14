#include "PdcTemplate.h"
#include <cassert>
#include <iostream>
int main() {
    const std::unordered_map<std::string,std::string> values={{"callsign","ACA123"},{"squawk","1234"},{"identifier","ABC"},{"route","{squawk}"}};
    assert(RenderPdcTemplate("{callsign} SQUAWK {squawk}\nID {identifier}",values) == "ACA123 SQUAWK 1234\nID ABC");
    assert(RenderPdcTemplate("{route}",values) == "{squawk}");
    assert(RenderPdcTemplate("{unknown}",values).empty());
    assert(RenderPdcTemplate("{callsign",values).empty());
    assert(RenderPdcTemplate("bad}",values).empty());
    assert(RenderPdcTemplate("{callsign}/{callsign}",values) == "ACA123/ACA123");
    std::cout << "PASS: native variable rendering, repeated variables, multiline messages and invalid-variable fallback.\n";
}
