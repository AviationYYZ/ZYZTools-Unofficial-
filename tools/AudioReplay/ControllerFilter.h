#pragma once
#include <algorithm>
#include <cmath>
class ControllerFilter {
    float bass = 0.0f, treble = 0.0f;
public:
    float Process(float sample, int intensity) {
        // Processed TrackAudio hardware is retained. Blend an additional radio band
        // into controller replay only; 0% adds no filtering, 100% is the full effect.
        bass += 0.045f * (sample - bass);
        const float highPassed = sample - bass;
        treble += 0.23f * (highPassed - treble);
        const float wet = std::tanh(1.6f * treble) / 1.6f;
        const float mix = std::clamp(intensity, 0, 100) / 100.0f;
        return std::clamp(sample * (1.0f - mix) + wet * mix, -1.0f, 1.0f);
    }
};
