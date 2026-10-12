#include "ControllerFilter.h"
#include <cassert>
float energy(int intensity) {
    ControllerFilter filter;
    double sum = 0;
    for (int i = 0; i < 48000; i++) {
        const float input = 0.25f * std::sin(2.0 * 3.141592653589793 * 6000 * i / 48000);
        const float output = filter.Process(input, intensity);
        assert(std::isfinite(output) && std::abs(output) <= 1);
        if (intensity == 0) assert(output == input);
        if (i > 1000) sum += output * output;
    }
    return static_cast<float>(sum);
}
int main() {
    const auto dry = energy(0), medium = energy(50), wet = energy(100);
    assert(medium < dry * 0.65f && wet < medium * 0.5f);
}
