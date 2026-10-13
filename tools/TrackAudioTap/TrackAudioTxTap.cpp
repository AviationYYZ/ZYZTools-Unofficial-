#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <Windows.h>

#include "TrackAudioTxTap.h"
#include "TrackAudioTxTapShared.h"

#include <algorithm>
#include <cstring>
#include <mutex>

namespace
{
    class SharedTransmitTap
    {
    public:
        ~SharedTransmitTap()
        {
            if (m_shared)
                UnmapViewOfFile(m_shared);
            if (m_mapping)
                CloseHandle(m_mapping);
        }

        void Initialize()
        {
            std::call_once(
                m_initializeOnce,
                [this]()
                {
                    m_mapping = CreateFileMappingW(
                        INVALID_HANDLE_VALUE,
                        nullptr,
                        PAGE_READWRITE,
                        0,
                        static_cast<DWORD>(
                            sizeof(TrackAudioTxTapShared)),
                        TRACKAUDIO_TX_TAP_MAPPING_NAME);
                    if (!m_mapping)
                        return;

                    const bool created =
                        GetLastError() != ERROR_ALREADY_EXISTS;
                    m_shared = static_cast<TrackAudioTxTapShared *>(
                        MapViewOfFile(
                            m_mapping,
                            FILE_MAP_ALL_ACCESS,
                            0,
                            0,
                            sizeof(TrackAudioTxTapShared)));
                    if (!m_shared)
                        return;

                    if (created ||
                        m_shared->magic != TRACKAUDIO_TX_TAP_MAGIC ||
                        m_shared->version !=
                            TRACKAUDIO_TX_TAP_VERSION)
                    {
                        std::memset(
                            m_shared,
                            0,
                            sizeof(TrackAudioTxTapShared));
                        m_shared->magic =
                            TRACKAUDIO_TX_TAP_MAGIC;
                        m_shared->version =
                            TRACKAUDIO_TX_TAP_VERSION;
                        m_shared->sampleRate =
                            TRACKAUDIO_TX_TAP_SAMPLE_RATE;
                        m_shared->channels =
                            TRACKAUDIO_TX_TAP_CHANNELS;
                        m_shared->capacity =
                            TRACKAUDIO_TX_TAP_CAPACITY;
                        MemoryBarrier();
                        InterlockedExchange(
                            &m_shared->initialized,
                            1);
                    }
                });
        }

        void Publish(
            const float *samples,
            std::size_t sampleCount,
            bool active)
        {
            Initialize();
            if (!m_shared || !samples || sampleCount == 0)
                return;

            const LONG64 start =
                InterlockedCompareExchange64(
                    &m_shared->writeCounter,
                    0,
                    0);
            std::size_t sourceOffset = 0;
            std::size_t remaining = sampleCount;
            while (remaining > 0)
            {
                const std::size_t destination =
                    static_cast<std::size_t>(
                        (start +
                         static_cast<LONG64>(sourceOffset)) %
                        TRACKAUDIO_TX_TAP_CAPACITY);
                const std::size_t chunk = std::min(
                    remaining,
                    static_cast<std::size_t>(
                        TRACKAUDIO_TX_TAP_CAPACITY) -
                        destination);
                std::memcpy(
                    m_shared->samples + destination,
                    samples + sourceOffset,
                    chunk * sizeof(float));
                sourceOffset += chunk;
                remaining -= chunk;
            }

            MemoryBarrier();
            InterlockedExchange(
                &m_shared->active,
                active ? 1 : 0);
            InterlockedExchange64(
                &m_shared->writeCounter,
                start +
                    static_cast<LONG64>(sampleCount));
        }

    private:
        std::once_flag m_initializeOnce;
        HANDLE m_mapping = nullptr;
        TrackAudioTxTapShared *m_shared = nullptr;
    };

    SharedTransmitTap g_transmitTap;
}

void TrackAudioTxTapInitialize()
{
    g_transmitTap.Initialize();
}

void TrackAudioTxTapPublish(
    const float *samples,
    std::size_t sampleCount,
    bool active)
{
    g_transmitTap.Publish(
        samples,
        sampleCount,
        active);
}
