#pragma once

#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

#include <cstdint>

constexpr wchar_t TRACKAUDIO_TX_TAP_MAPPING_NAME[] =
    L"Local\\PreferredCYYZTrackAudioTx";
constexpr std::uint32_t TRACKAUDIO_TX_TAP_MAGIC = 0x54585A59;
constexpr std::uint32_t TRACKAUDIO_TX_TAP_VERSION = 1;
constexpr std::uint32_t TRACKAUDIO_TX_TAP_SAMPLE_RATE = 48000;
constexpr std::uint32_t TRACKAUDIO_TX_TAP_CHANNELS = 1;
constexpr std::uint32_t TRACKAUDIO_TX_TAP_CAPACITY =
    TRACKAUDIO_TX_TAP_SAMPLE_RATE * 4;

struct alignas(64) TrackAudioTxTapShared
{
    std::uint32_t magic;
    std::uint32_t version;
    std::uint32_t sampleRate;
    std::uint32_t channels;
    std::uint32_t capacity;
    std::uint32_t reserved;
    volatile LONG64 writeCounter;
    volatile LONG active;
    volatile LONG initialized;
    float samples[TRACKAUDIO_TX_TAP_CAPACITY];
};
