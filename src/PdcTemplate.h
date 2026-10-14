#pragma once
#include <string>
#include <unordered_map>
inline std::string RenderPdcTemplate(const std::string& text, const std::unordered_map<std::string, std::string>& values)
{
    std::string result;
    for (size_t i = 0; i < text.size();) {
        if (text[i] == '{') {
            const size_t end = text.find('}', i + 1);
            if (end == std::string::npos) return {};
            const auto value = values.find(text.substr(i + 1, end - i - 1));
            if (value == values.end()) return {};
            result += value->second;
            i = end + 1;
        } else {
            if (text[i] == '}') return {};
            result += text[i++];
        }
    }
    return result;
}
