#pragma once

#include <cstddef>

void TrackAudioTxTapInitialize();
void TrackAudioTxTapPublish(
    const float *samples,
    std::size_t sampleCount,
    bool active);
