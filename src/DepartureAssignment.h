#pragma once
#include <string>
#include <sstream>
#include <vector>
#include <algorithm>
#include <cctype>

namespace DepartureAssignment {
inline std::string Runway(const std::string& mode, const std::string& sid,
                          const std::vector<std::string>& north, const std::vector<std::string>& south) {
    if (mode != "east" && mode != "west") return "";
    const bool n = std::find(north.begin(), north.end(), sid) != north.end();
    const bool s = std::find(south.begin(), south.end(), sid) != south.end();
    if (n == s) return ""; // Unknown or conflicting matrix entry: await a correction.
    return mode == "east" ? (n ? "05" : "06L") : (n ? "23" : "24R");
}
inline bool Prefix(const std::string& token) {
    return token == "DCT" || (token.size() > 1 &&
        (token[0] == 'N' || token[0] == 'K' || token[0] == 'M') &&
        std::isdigit(static_cast<unsigned char>(token[1])));
}
inline std::string WithRunway(const std::string& route, const std::string& runway) {
    std::istringstream stream(route);
    std::string token, result;
    bool assigned = false;
    while (stream >> token) {
        std::transform(token.begin(), token.end(), token.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
        if (!assigned && !Prefix(token)) {
            token = token.substr(0, token.find('/')) + "/" + runway;
            assigned = true;
        }
        if (!result.empty()) result += " ";
        result += token;
    }
    return assigned ? result : "";
}
inline std::string Base(std::string token) {
    std::transform(token.begin(), token.end(), token.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
    return token.substr(0, token.find_first_not_of("ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
}
inline std::string Match(const std::string& token, const std::vector<std::string>& north, const std::vector<std::string>& south) {
    const auto base = Base(token);
    if (std::find(north.begin(), north.end(), base) != north.end() ||
        std::find(south.begin(), south.end(), base) != south.end()) return base;
    return "";
}
inline std::string Sid(const std::string& filedRoute, const std::string& extractedSid,
                       const std::vector<std::string>& north, const std::vector<std::string>& south) {
    std::string route = filedRoute;
    std::transform(route.begin(), route.end(), route.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
    std::istringstream stream(route);
    std::string token;
    while (stream >> token) {
        const auto base = Base(token);
        if (base == "DCT" || base == "CYYZ" ||
            ((base == "N" || base == "K" || base == "M") && token.size() > 1 && std::isdigit(static_cast<unsigned char>(token[1])))) continue;
        const auto match = Match(token, north, south);
        if (!match.empty()) return match;
        break; // Never use a later enroute fix as a departure SID.
    }
    return Match(extractedSid, north, south);
}
}
