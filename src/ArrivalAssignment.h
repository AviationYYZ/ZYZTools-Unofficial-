#pragma once
#include <string>
#include <sstream>
#include <vector>
#include <cctype>
namespace ArrivalAssignment {
inline char Sfi(const std::string& s) {
    if (s.size() == 1) return static_cast<char>(std::toupper(static_cast<unsigned char>(s[0])));
    // VATCANSitu: leading space, one-letter code, optional space + remarks.
    if (s.size() >= 2 && s[0] == ' ' && (s.size() == 2 || s[2] == ' ')) return static_cast<char>(std::toupper(static_cast<unsigned char>(s[1])));
    return '\0';
}
inline std::string Runway(bool enabled, const std::string& flow, const std::string& scratchpad) {
    if (!enabled) return "";
    const char c = Sfi(scratchpad);
    if (c == 'N' || c == 'Y') return flow == "west" ? "23" : flow == "east" ? "05" : "";
    if (c != 'L' && c != 'R') return "";
    const std::string side(1, c);
    if (flow == "west") return "24" + side;
    if (flow == "east") return "06" + side;
    if (flow == "north") return "33" + side;
    if (flow == "south") return "15" + side;
    return "";
}
inline std::string Upper(std::string s) { for (auto& c : s) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c))); return s; }
inline std::string WithRunway(const std::string& route, const std::string& runway, const std::string& star) {
    if (runway.empty()) return "";
    std::istringstream stream(route); std::vector<std::string> tokens; std::string token;
    while (stream >> token) tokens.push_back(token);
    if (tokens.empty()) return "";
    auto& last = tokens.back(); const auto slash = last.find('/'); const auto base = Upper(last.substr(0, slash));
    if (base == "CYYZ" || (!star.empty() && base == Upper(star))) last = last.substr(0, slash) + "/" + runway;
    else tokens.push_back("CYYZ/" + runway);
    std::string result; for (const auto& t : tokens) { if (!result.empty()) result += ' '; result += t; } return result;
}
}
