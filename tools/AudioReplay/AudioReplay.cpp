#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "../../src/BuildChannel.h"
#define _WIN32_WINNT 0x0A00

#include <Windows.h>
#include <TlHelp32.h>
#include <ShlObj.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>

#include "../TrackAudioTap/TrackAudioTxTapShared.h"
#include "ControllerFilter.h"

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <ctime>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_set>
#include <vector>

#pragma comment(lib, "Ole32.lib")
#pragma comment(lib, "Mmdevapi.lib")
#pragma comment(lib, "Shell32.lib")
#pragma comment(lib, "Version.lib")

namespace
{
    constexpr DWORD SAMPLE_RATE = TRACKAUDIO_TX_TAP_SAMPLE_RATE;
    constexpr WORD CHANNELS = 2;
    constexpr WORD BITS_PER_SAMPLE = 16;
    constexpr DWORD BYTES_PER_SECOND =
        SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8);
    constexpr DWORD IDLE_CAPTURE_POLL_MS = 250;
    constexpr UINT32 IDLE_CAPTURE_FRAMES =
        SAMPLE_RATE * IDLE_CAPTURE_POLL_MS / 1000;
    constexpr const char *PIPE_NAME = ZYZTOOLS_REPLAY_PIPE;

    bool ContainsAudiblePcm(const std::vector<BYTE> &audio)
    {
        constexpr int kAudibleThreshold = 64;
        constexpr int kRequiredSamples = 48;
        int audibleSamples = 0;
        for (size_t i = 0; i + 1 < audio.size(); i += 2)
        {
            int16_t sample = 0;
            std::memcpy(&sample, audio.data() + i, sizeof(sample));
            const int amplitude =
                sample < 0 ? -static_cast<int>(sample) : static_cast<int>(sample);
            if (amplitude > kAudibleThreshold &&
                ++audibleSamples >= kRequiredSamples)
                return true;
        }
        return false;
    }

    template <typename T>
    void SafeRelease(T *&value)
    {
        if (value)
        {
            value->Release();
            value = nullptr;
        }
    }

    std::wstring Lower(std::wstring value)
    {
        std::transform(
            value.begin(), value.end(), value.begin(),
            [](wchar_t c) { return static_cast<wchar_t>(towlower(c)); });
        return value;
    }

    std::vector<std::wstring> SplitProcesses(const std::wstring &value)
    {
        std::vector<std::wstring> result;
        std::wstring current;
        for (wchar_t c : value)
        {
            if (c == L';' || c == L',')
            {
                if (!current.empty())
                    result.push_back(Lower(current));
                current.clear();
            }
            else if (!iswspace(c) || !current.empty())
            {
                current.push_back(c);
            }
        }
        while (!current.empty() && iswspace(current.back()))
            current.pop_back();
        if (!current.empty())
            result.push_back(Lower(current));
        return result;
    }

    bool ProcessIsAlive(DWORD processId)
    {
        HANDLE process = OpenProcess(SYNCHRONIZE, FALSE, processId);
        if (!process)
            return false;
        const bool alive = WaitForSingleObject(process, 0) == WAIT_TIMEOUT;
        CloseHandle(process);
        return alive;
    }

    std::string ProcessFileVersion(DWORD processId)
    {
        HANDLE process = OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION,
            FALSE,
            processId);
        if (!process)
            return {};

        wchar_t path[32768]{};
        DWORD pathLength =
            static_cast<DWORD>(sizeof(path) / sizeof(path[0]));
        const BOOL queried = QueryFullProcessImageNameW(
            process,
            0,
            path,
            &pathLength);
        CloseHandle(process);
        if (!queried)
            return {};

        DWORD unused = 0;
        const DWORD infoSize =
            GetFileVersionInfoSizeW(path, &unused);
        if (infoSize == 0)
            return {};

        std::vector<BYTE> versionInfo(infoSize);
        if (!GetFileVersionInfoW(
                path,
                0,
                infoSize,
                versionInfo.data()))
        {
            return {};
        }

        VS_FIXEDFILEINFO *fixedInfo = nullptr;
        UINT fixedInfoSize = 0;
        if (!VerQueryValueW(
                versionInfo.data(),
                L"\\",
                reinterpret_cast<void **>(&fixedInfo),
                &fixedInfoSize) ||
            !fixedInfo ||
            fixedInfoSize < sizeof(VS_FIXEDFILEINFO))
        {
            return {};
        }

        char version[64]{};
        sprintf_s(
            version,
            "%u.%u.%u",
            HIWORD(fixedInfo->dwFileVersionMS),
            LOWORD(fixedInfo->dwFileVersionMS),
            HIWORD(fixedInfo->dwFileVersionLS));
        return version;
    }

    DWORD FindTargetProcess(
        const std::vector<std::wstring> &processNames,
        std::wstring &nameOut)
    {
        HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snapshot == INVALID_HANDLE_VALUE)
            return 0;

        PROCESSENTRY32W entry{};
        entry.dwSize = sizeof(entry);
        struct Candidate
        {
            DWORD processId = 0;
            DWORD parentProcessId = 0;
            std::wstring name;
        };
        std::vector<Candidate> candidates;
        if (Process32FirstW(snapshot, &entry))
        {
            do
            {
                const std::wstring candidate = Lower(entry.szExeFile);
                if (std::find(processNames.begin(), processNames.end(), candidate) !=
                    processNames.end())
                {
                    candidates.push_back(
                        Candidate{
                            entry.th32ProcessID,
                            entry.th32ParentProcessID,
                            entry.szExeFile});
                }
            } while (Process32NextW(snapshot, &entry));
        }
        CloseHandle(snapshot);

        if (candidates.empty())
            return 0;

        std::unordered_set<DWORD> candidateIds;
        for (const Candidate &candidate : candidates)
            candidateIds.insert(candidate.processId);

        // TrackAudio is an Electron application. Capture the root process so
        // PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE includes its
        // renderer and audio-service children, rather than an arbitrary child.
        const Candidate *selected = &candidates.front();
        for (const Candidate &candidate : candidates)
        {
            if (candidateIds.find(candidate.parentProcessId) ==
                candidateIds.end())
            {
                selected = &candidate;
                break;
            }
        }
        nameOut = selected->name;
        return selected->processId;
    }

    std::string WideToUtf8(const std::wstring &value)
    {
        if (value.empty())
            return {};
        const int required = WideCharToMultiByte(
            CP_UTF8, 0, value.c_str(), -1, nullptr, 0, nullptr, nullptr);
        if (required <= 1)
            return {};
        std::string output(static_cast<size_t>(required), '\0');
        WideCharToMultiByte(
            CP_UTF8, 0, value.c_str(), -1, output.data(), required, nullptr, nullptr);
        output.resize(static_cast<size_t>(required - 1));
        return output;
    }

    std::wstring JoinPath(const std::wstring &directory, const std::wstring &name)
    {
        if (directory.empty())
            return name;
        if (directory.back() == L'\\' || directory.back() == L'/')
            return directory + name;
        return directory + L"\\" + name;
    }

    bool EnsureDirectory(const std::wstring &path)
    {
        if (path.empty())
            return false;
        const int result = SHCreateDirectoryExW(nullptr, path.c_str(), nullptr);
        return result == ERROR_SUCCESS ||
               result == ERROR_ALREADY_EXISTS ||
               result == ERROR_FILE_EXISTS;
    }

    std::wstring ReplayFileName(std::time_t startUtc, std::time_t endUtc)
    {
        tm start{};
        tm end{};
        gmtime_s(&start, &startUtc);
        gmtime_s(&end, &endUtc);

        wchar_t value[128]{};
        swprintf_s(
            value,
            L"VATSIM_Replay-%04d%02d%02d-%02d%02d%02dZ-%02d%02d%02dZ.wav",
            start.tm_year + 1900,
            start.tm_mon + 1,
            start.tm_mday,
            start.tm_hour,
            start.tm_min,
            start.tm_sec,
            end.tm_hour,
            end.tm_min,
            end.tm_sec);
        return value;
    }

    class ControllerRadioEffect
    {
        class Biquad;

    public:
        ControllerRadioEffect()
        {
            m_filters.push_back(Biquad::HighPass(310.0f, 0.25f));
            m_filters.push_back(Biquad::Peaking(450.0f, 0.75f, 12.0f));
            m_filters.push_back(Biquad::Peaking(1450.0f, 1.0f, 20.0f));
            m_filters.push_back(Biquad::Peaking(2000.0f, 1.0f, 20.0f));
            m_filters.push_back(Biquad::LowPass(2500.0f, 0.25f));
        }

        void Reset()
        {
            m_envelope = 0.0f;
            m_noiseState = 0x5A17D3B5u;
            for (Biquad &filter : m_filters)
                filter.Reset();
        }

        float Process(float sample)
        {
            sample = std::max(-1.0f, std::min(1.0f, sample));

            const float absolute = std::fabs(sample);
            const float attack = absolute > m_envelope ? 0.035f : 0.0012f;
            m_envelope += attack * (absolute - m_envelope);

            // AFV receive audio is not just narrow-band; it is compressed,
            // aggressively EQ-shaped, then limited. The controller TX tap can
            // arrive cleaner than RX on some TrackAudio states, so replay
            // applies a Schmid-style VHF chain here before mixing it into the
            // saved WAV.
            float x = sample;
            if (m_envelope > 0.0005f)
            {
                const float agcGain =
                    std::max(
                        1.0f,
                        std::min(
                            4.5f,
                            0.24f / m_envelope));
                x *= agcGain;
            }

            for (Biquad &filter : m_filters)
                x = filter.Process(x);

            if (m_envelope > 0.012f)
                x += NextNoise() * 0.0075f;

            // Hard enough to sound like radio; soft enough not to splatter
            // over received pilot audio when both are present.
            x = std::tanh(x * 1.85f) * 0.72f;
            return std::max(-1.0f, std::min(1.0f, x));
        }

    private:
        class Biquad
        {
        public:
            static Biquad HighPass(float frequency, float q)
            {
                const float omega =
                    2.0f * Pi() * frequency /
                    static_cast<float>(SAMPLE_RATE);
                const float sinOmega = std::sin(omega);
                const float cosOmega = std::cos(omega);
                const float alpha = sinOmega / (2.0f * q);
                const float b0 = (1.0f + cosOmega) * 0.5f;
                const float b1 = -(1.0f + cosOmega);
                const float b2 = (1.0f + cosOmega) * 0.5f;
                const float a0 = 1.0f + alpha;
                const float a1 = -2.0f * cosOmega;
                const float a2 = 1.0f - alpha;
                return Biquad(b0, b1, b2, a0, a1, a2);
            }

            static Biquad LowPass(float frequency, float q)
            {
                const float omega =
                    2.0f * Pi() * frequency /
                    static_cast<float>(SAMPLE_RATE);
                const float sinOmega = std::sin(omega);
                const float cosOmega = std::cos(omega);
                const float alpha = sinOmega / (2.0f * q);
                const float b0 = (1.0f - cosOmega) * 0.5f;
                const float b1 = 1.0f - cosOmega;
                const float b2 = (1.0f - cosOmega) * 0.5f;
                const float a0 = 1.0f + alpha;
                const float a1 = -2.0f * cosOmega;
                const float a2 = 1.0f - alpha;
                return Biquad(b0, b1, b2, a0, a1, a2);
            }

            static Biquad Peaking(float frequency, float q, float gainDb)
            {
                const float a = std::pow(10.0f, gainDb / 40.0f);
                const float omega =
                    2.0f * Pi() * frequency /
                    static_cast<float>(SAMPLE_RATE);
                const float sinOmega = std::sin(omega);
                const float cosOmega = std::cos(omega);
                const float alpha = sinOmega / (2.0f * q);
                const float b0 = 1.0f + alpha * a;
                const float b1 = -2.0f * cosOmega;
                const float b2 = 1.0f - alpha * a;
                const float a0 = 1.0f + alpha / a;
                const float a1 = -2.0f * cosOmega;
                const float a2 = 1.0f - alpha / a;
                return Biquad(b0, b1, b2, a0, a1, a2);
            }

            float Process(float x)
            {
                const float y = m_b0 * x + m_z1;
                m_z1 = m_b1 * x - m_a1 * y + m_z2;
                m_z2 = m_b2 * x - m_a2 * y;
                return y;
            }

            void Reset()
            {
                m_z1 = 0.0f;
                m_z2 = 0.0f;
            }

        private:
            Biquad(
                float b0,
                float b1,
                float b2,
                float a0,
                float a1,
                float a2)
                : m_b0(b0 / a0),
                  m_b1(b1 / a0),
                  m_b2(b2 / a0),
                  m_a1(a1 / a0),
                  m_a2(a2 / a0)
            {
            }

            static float Pi()
            {
                return 3.14159265358979323846f;
            }

            float m_b0 = 1.0f;
            float m_b1 = 0.0f;
            float m_b2 = 0.0f;
            float m_a1 = 0.0f;
            float m_a2 = 0.0f;
            float m_z1 = 0.0f;
            float m_z2 = 0.0f;
        };

        float NextNoise()
        {
            m_noiseState =
                m_noiseState * 1664525u +
                1013904223u;
            const int value =
                static_cast<int>(
                    (m_noiseState >> 8) & 0xFFFFu) -
                32768;
            return static_cast<float>(value) / 32768.0f;
        }

        std::vector<Biquad> m_filters;
        float m_envelope = 0.0f;
        std::uint32_t m_noiseState = 0x5A17D3B5u;
    };

    class CircularAudioBuffer
    {
    public:
        explicit CircularAudioBuffer(size_t capacity)
            : m_data(std::max<size_t>(capacity, BYTES_PER_SECOND))
        {
        }

        void Append(const BYTE *data, size_t bytes, bool silent)
        {
            if (bytes == 0)
                return;
            std::lock_guard<std::mutex> lock(m_mutex);

            if (bytes >= m_data.size())
            {
                const size_t offset = bytes - m_data.size();
                if (silent)
                    std::fill(m_data.begin(), m_data.end(), 0);
                else
                    memcpy(m_data.data(), data + offset, m_data.size());
                m_write = 0;
                m_size = m_data.size();
                return;
            }

            const size_t first = std::min(bytes, m_data.size() - m_write);
            if (silent)
                std::fill(m_data.begin() + m_write, m_data.begin() + m_write + first, 0);
            else
                memcpy(m_data.data() + m_write, data, first);

            const size_t remaining = bytes - first;
            if (remaining)
            {
                if (silent)
                    std::fill(m_data.begin(), m_data.begin() + remaining, 0);
                else
                    memcpy(m_data.data(), data + first, remaining);
            }

            m_write = (m_write + bytes) % m_data.size();
            m_size = std::min(m_data.size(), m_size + bytes);
        }

        std::vector<BYTE> Snapshot()
        {
            std::lock_guard<std::mutex> lock(m_mutex);
            std::vector<BYTE> result(m_size);
            if (m_size == 0)
                return result;

            const size_t start =
                (m_write + m_data.size() - m_size) % m_data.size();
            const size_t first = std::min(m_size, m_data.size() - start);
            memcpy(result.data(), m_data.data() + start, first);
            if (first < m_size)
                memcpy(result.data() + first, m_data.data(), m_size - first);
            return result;
        }

        size_t Size()
        {
            std::lock_guard<std::mutex> lock(m_mutex);
            return m_size;
        }

    private:
        std::mutex m_mutex;
        std::vector<BYTE> m_data;
        size_t m_write = 0;
        size_t m_size = 0;
    };

    class TrackAudioTxTapReader
    {
    public:
        explicit TrackAudioTxTapReader(int radioIntensity = 70)
            : m_radioIntensity(ClampRadioIntensity(radioIntensity))
        {
        }

        ~TrackAudioTxTapReader()
        {
            Reset();
        }

        bool IsConnected() const
        {
            return m_connected.load();
        }

        void Reset()
        {
            m_connected = false;
            m_readCounter = 0;
            m_counterInitialized = false;
            m_controllerFilter = ControllerFilter{};
            if (m_shared)
            {
                UnmapViewOfFile(m_shared);
                m_shared = nullptr;
            }
            if (m_mapping)
            {
                CloseHandle(m_mapping);
                m_mapping = nullptr;
            }
        }

        void MixInto(
            std::vector<BYTE> &pcm,
            UINT32 frames)
        {
            if (frames == 0 || pcm.size() <
                                   static_cast<size_t>(frames) *
                                       CHANNELS *
                                       (BITS_PER_SAMPLE / 8))
            {
                return;
            }
            if (!EnsureConnected())
                return;

            MemoryBarrier();
            const LONG64 writeCounter = m_shared->writeCounter;
            if (!m_counterInitialized)
            {
                m_readCounter = writeCounter;
                m_counterInitialized = true;
                return;
            }

            LONG64 available = writeCounter - m_readCounter;
            if (available <= 0)
                return;

            if (available >
                static_cast<LONG64>(
                    TRACKAUDIO_TX_TAP_CAPACITY))
            {
                m_readCounter =
                    writeCounter -
                    TRACKAUDIO_TX_TAP_CAPACITY;
                available =
                    TRACKAUDIO_TX_TAP_CAPACITY;
            }

            // Keep the direct TX tap close to the rendered RX timeline if the
            // helper was paused or starved for more than a few packets.
            const LONG64 maximumUsefulBacklog =
                static_cast<LONG64>(frames) * 4;
            if (available > maximumUsefulBacklog)
            {
                m_readCounter =
                    writeCounter -
                    static_cast<LONG64>(frames);
                available = frames;
            }

            const UINT32 toRead = static_cast<UINT32>(
                std::min<LONG64>(
                    available,
                    frames));
            auto *output =
                reinterpret_cast<std::int16_t *>(
                    pcm.data());

            MemoryBarrier();
            for (UINT32 i = 0; i < toRead; ++i)
            {
                const size_t source =
                    static_cast<size_t>(
                        (m_readCounter + i) %
                        TRACKAUDIO_TX_TAP_CAPACITY);
                const float sample =
                    std::max(
                        -1.0f,
                        std::min(
                            1.0f,
                            m_shared->samples[source]));
                // TrackAudio publishes the selected hardware's processed TX.
                // Add the user-selected replay-only filter blend to controller
                // audio; received pilot audio never passes through this filter.
                const float radioSample = ShapeControllerSample(sample);
                const int transmit =
                    static_cast<int>(radioSample * 32767.0f);
                for (WORD channel = 0;
                     channel < CHANNELS;
                     ++channel)
                {
                    const size_t destination =
                        static_cast<size_t>(i) *
                            CHANNELS +
                        channel;
                    const int mixed =
                        static_cast<int>(
                            output[destination]) +
                        transmit;
                    output[destination] =
                        static_cast<std::int16_t>(
                            std::max(
                                -32768,
                                std::min(32767, mixed)));
                }
            }
            m_readCounter += toRead;
        }

    public:
        void SetIntensity(int value) { m_radioIntensity.store(ClampRadioIntensity(value)); }
    private:
        static int ClampRadioIntensity(int value)
        {
            return std::max(0, std::min(100, value));
        }

        float ShapeControllerSample(float sample)
        {
            return m_controllerFilter.Process(sample, m_radioIntensity.load());
        }

        bool EnsureConnected()
        {
            if (m_shared)
                return true;

            m_mapping = OpenFileMappingW(
                FILE_MAP_READ,
                FALSE,
                TRACKAUDIO_TX_TAP_MAPPING_NAME);
            if (!m_mapping)
                return false;

            m_shared =
                static_cast<TrackAudioTxTapShared *>(
                    MapViewOfFile(
                        m_mapping,
                        FILE_MAP_READ,
                        0,
                        0,
                        sizeof(TrackAudioTxTapShared)));
            if (!m_shared ||
                m_shared->magic !=
                    TRACKAUDIO_TX_TAP_MAGIC ||
                m_shared->version !=
                    TRACKAUDIO_TX_TAP_VERSION ||
                m_shared->sampleRate != SAMPLE_RATE ||
                m_shared->channels !=
                    TRACKAUDIO_TX_TAP_CHANNELS ||
                m_shared->capacity !=
                    TRACKAUDIO_TX_TAP_CAPACITY)
            {
                Reset();
                return false;
            }

            MemoryBarrier();
            m_readCounter = m_shared->writeCounter;
            m_counterInitialized = true;
            m_connected = true;
            return true;
        }

        HANDLE m_mapping = nullptr;
        TrackAudioTxTapShared *m_shared = nullptr;
        LONG64 m_readCounter = 0;
        bool m_counterInitialized = false;
        std::atomic<int> m_radioIntensity{70};
        ControllerFilter m_controllerFilter;
        std::atomic<bool> m_connected{false};
    };

    class ActivationHandler final
        : public IActivateAudioInterfaceCompletionHandler,
          public IAgileObject
    {
    public:
        explicit ActivationHandler(HANDLE completedEvent)
            : m_completedEvent(completedEvent)
        {
        }

        HRESULT STDMETHODCALLTYPE QueryInterface(
            REFIID iid,
            void **object) override
        {
            if (!object)
                return E_POINTER;
            *object = nullptr;
            if (iid == __uuidof(IUnknown) ||
                iid == __uuidof(IActivateAudioInterfaceCompletionHandler))
            {
                *object =
                    static_cast<IActivateAudioInterfaceCompletionHandler *>(this);
            }
            else if (iid == __uuidof(IAgileObject))
            {
                *object = static_cast<IAgileObject *>(this);
            }
            else
            {
                return E_NOINTERFACE;
            }
            AddRef();
            return S_OK;
        }

        ULONG STDMETHODCALLTYPE AddRef() override
        {
            return static_cast<ULONG>(InterlockedIncrement(&m_refs));
        }

        ULONG STDMETHODCALLTYPE Release() override
        {
            const ULONG refs =
                static_cast<ULONG>(InterlockedDecrement(&m_refs));
            if (refs == 0)
                delete this;
            return refs;
        }

        HRESULT STDMETHODCALLTYPE ActivateCompleted(
            IActivateAudioInterfaceAsyncOperation *operation) override
        {
            IUnknown *activated = nullptr;
            HRESULT activationResult = E_FAIL;
            HRESULT result =
                operation->GetActivateResult(&activationResult, &activated);
            if (SUCCEEDED(result))
                result = activationResult;
            if (SUCCEEDED(result) && activated)
                result = activated->QueryInterface(
                    __uuidof(IAudioClient),
                    reinterpret_cast<void **>(&m_audioClient));
            SafeRelease(activated);
            m_result = result;
            SetEvent(m_completedEvent);
            return S_OK;
        }

        HRESULT Result() const
        {
            return m_result;
        }

        IAudioClient *DetachAudioClient()
        {
            IAudioClient *result = m_audioClient;
            m_audioClient = nullptr;
            return result;
        }

    private:
        ~ActivationHandler()
        {
            SafeRelease(m_audioClient);
        }

        LONG m_refs = 1;
        HANDLE m_completedEvent = nullptr;
        HRESULT m_result = E_PENDING;
        IAudioClient *m_audioClient = nullptr;
    };

    class AudioCapture
    {
    public:
        AudioCapture()
        {
            m_format.wFormatTag = WAVE_FORMAT_PCM;
            m_format.nChannels = CHANNELS;
            m_format.nSamplesPerSec = SAMPLE_RATE;
            m_format.wBitsPerSample = BITS_PER_SAMPLE;
            m_format.nBlockAlign =
                CHANNELS * (BITS_PER_SAMPLE / 8);
            m_format.nAvgBytesPerSec =
                SAMPLE_RATE * m_format.nBlockAlign;
            m_format.cbSize = 0;
        }

        ~AudioCapture()
        {
            Stop();
        }

        HRESULT StartProcess(DWORD processId)
        {
            Stop();

            HANDLE completed = CreateEventW(nullptr, FALSE, FALSE, nullptr);
            if (!completed)
                return HRESULT_FROM_WIN32(GetLastError());

            ActivationHandler *handler = new ActivationHandler(completed);
            AUDIOCLIENT_ACTIVATION_PARAMS parameters{};
            parameters.ActivationType =
                AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
            parameters.ProcessLoopbackParams.TargetProcessId = processId;
            parameters.ProcessLoopbackParams.ProcessLoopbackMode =
                PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

            PROPVARIANT activation{};
            activation.vt = VT_BLOB;
            activation.blob.cbSize = sizeof(parameters);
            activation.blob.pBlobData =
                reinterpret_cast<BYTE *>(&parameters);

            IActivateAudioInterfaceAsyncOperation *operation = nullptr;
            HRESULT result = ActivateAudioInterfaceAsync(
                VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
                __uuidof(IAudioClient),
                &activation,
                handler,
                &operation);
            if (SUCCEEDED(result))
            {
                const DWORD wait = WaitForSingleObject(completed, 10000);
                if (wait == WAIT_OBJECT_0)
                {
                    result = handler->Result();
                    if (SUCCEEDED(result))
                        m_audioClient = handler->DetachAudioClient();
                }
                else
                {
                    result =
                        wait == WAIT_TIMEOUT
                            ? HRESULT_FROM_WIN32(ERROR_TIMEOUT)
                            : HRESULT_FROM_WIN32(GetLastError());
                }
            }

            SafeRelease(operation);
            handler->Release();
            CloseHandle(completed);
            if (FAILED(result))
                return result;
            return InitializeClient();
        }

        HRESULT Drain(
            CircularAudioBuffer &buffer,
            TrackAudioTxTapReader &transmitTap,
            bool &appendedOut)
        {
            appendedOut = false;
            if (!m_captureClient)
                return E_UNEXPECTED;

            UINT32 frames = 0;
            HRESULT result = m_captureClient->GetNextPacketSize(&frames);
            while (SUCCEEDED(result) && frames > 0)
            {
                BYTE *data = nullptr;
                DWORD flags = 0;
                UINT64 devicePosition = 0;
                UINT64 qpcPosition = 0;
                result = m_captureClient->GetBuffer(
                    &data,
                    &frames,
                    &flags,
                    &devicePosition,
                    &qpcPosition);
                if (FAILED(result))
                    break;

                const size_t bytes =
                    static_cast<size_t>(frames) * m_format.nBlockAlign;
                std::vector<BYTE> mixed(bytes, 0);
                if ((flags & AUDCLNT_BUFFERFLAGS_SILENT) == 0 &&
                    data)
                {
                    std::memcpy(
                        mixed.data(),
                        data,
                        bytes);
                }
                transmitTap.MixInto(mixed, frames);
                buffer.Append(
                    mixed.data(),
                    bytes,
                    false);
                appendedOut = true;
                m_captureClient->ReleaseBuffer(frames);
                result = m_captureClient->GetNextPacketSize(&frames);
            }
            return result;
        }

        HANDLE Event() const
        {
            return m_audioEvent;
        }

        void Stop()
        {
            if (m_audioClient)
                m_audioClient->Stop();
            SafeRelease(m_captureClient);
            SafeRelease(m_audioClient);
            if (m_audioEvent)
            {
                CloseHandle(m_audioEvent);
                m_audioEvent = nullptr;
            }
        }

    private:
        HRESULT InitializeClient()
        {
            m_audioEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
            if (!m_audioEvent)
                return HRESULT_FROM_WIN32(GetLastError());

            const DWORD flags =
                AUDCLNT_STREAMFLAGS_LOOPBACK |
                AUDCLNT_STREAMFLAGS_EVENTCALLBACK |
                AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM |
                AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY;
            HRESULT result = m_audioClient->Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                flags,
                0,
                0,
                &m_format,
                nullptr);
            if (SUCCEEDED(result))
                result = m_audioClient->SetEventHandle(m_audioEvent);
            if (SUCCEEDED(result))
                result = m_audioClient->GetService(
                    __uuidof(IAudioCaptureClient),
                    reinterpret_cast<void **>(&m_captureClient));
            if (SUCCEEDED(result))
                result = m_audioClient->Start();
            if (FAILED(result))
                Stop();
            return result;
        }

        WAVEFORMATEX m_format{};
        IAudioClient *m_audioClient = nullptr;
        IAudioCaptureClient *m_captureClient = nullptr;
        HANDLE m_audioEvent = nullptr;
    };

    void AppendIdleFrames(
        CircularAudioBuffer &buffer,
        TrackAudioTxTapReader &transmitTap,
        UINT32 frames)
    {
        const size_t bytes =
            static_cast<size_t>(frames) *
            CHANNELS *
            (BITS_PER_SAMPLE / 8);
        if (bytes == 0)
            return;

        std::vector<BYTE> idleAudio(bytes, 0);
        transmitTap.MixInto(idleAudio, frames);
        buffer.Append(
            idleAudio.data(),
            idleAudio.size(),
            false);
    }

    struct Options
    {
        int seconds = 180;
        int txRadioIntensity = 70;
        std::wstring outputFolder = L"Recordings";
        std::wstring captureMode = L"process";
        std::wstring processes = L"trackaudio.exe";
    };

    Options ParseOptions(int argc, wchar_t **argv)
    {
        Options options;
        for (int i = 1; i + 1 < argc; i += 2)
        {
            const std::wstring key = Lower(argv[i]);
            const std::wstring value = argv[i + 1];
            if (key == L"--seconds")
                options.seconds =
                    std::max(30, std::min(600, _wtoi(value.c_str())));
            else if (key == L"--tx-radio-intensity" ||
                     key == L"--tx-intensity")
            {
                const int parsed = _wtoi(value.c_str());
                options.txRadioIntensity =
                    std::max(0, std::min(100, parsed));
            }
            else if (key == L"--output")
                options.outputFolder = value;
            else if (key == L"--mode")
                options.captureMode = Lower(value);
            else if (key == L"--processes")
                options.processes = value;
        }
        // Legacy mode values are accepted on the command line, but replay is
        // deliberately strict process capture. It never records system audio.
        options.captureMode = L"process";
        options.processes = L"trackaudio.exe";
        return options;
    }

    class ReplayService
    {
    public:
        explicit ReplayService(const Options &options)
            : m_options(options),
              m_buffer(
                  static_cast<size_t>(options.seconds) *
                  static_cast<size_t>(BYTES_PER_SECOND)),
              m_transmitTap(options.txRadioIntensity),
              m_processNames(SplitProcesses(options.processes))
        {
            m_stopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
        }

        ~ReplayService()
        {
            Stop();
            if (m_stopEvent)
                CloseHandle(m_stopEvent);
        }

        void Start()
        {
            m_running = true;
            m_worker = std::thread([this]() { CaptureWorker(); });
        }

        void Stop()
        {
            if (!m_running.exchange(false))
                return;
            if (m_stopEvent)
                SetEvent(m_stopEvent);
            if (m_worker.joinable())
                m_worker.join();
        }

        void SetIntensity(int intensity)
        {
            std::lock_guard<std::mutex> lock(m_statusMutex);
            m_options.txRadioIntensity = std::clamp(intensity, 0, 100);
            m_transmitTap.SetIntensity(m_options.txRadioIntensity);
        }

        std::string Status()
        {
            std::lock_guard<std::mutex> lock(m_statusMutex);
            const double bufferedSeconds =
                static_cast<double>(m_buffer.Size()) /
                static_cast<double>(BYTES_PER_SECOND);
            char seconds[32]{};
            sprintf_s(seconds, "%.1f", bufferedSeconds);
            return m_status +
                   (m_transmitTap.IsConnected()
                        ? " // PROCESSED TX TAP READY"
                        : " // PROCESSED TX TAP WAITING") +
                   " // window " + std::to_string(m_options.seconds) +
                   " sec" +
                   " // controller radio " +
                   std::to_string(m_options.txRadioIntensity) + "%" +
                   " // buffered " + seconds + " sec";
        }

        bool Save(std::wstring &pathOut, std::string &errorOut)
        {
            std::vector<BYTE> audio = m_buffer.Snapshot();
            if (audio.empty())
            {
                errorOut =
                    "No audio has been buffered yet. Current status: " +
                    Status();
                return false;
            }

            const size_t blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);
            audio.resize(audio.size() - (audio.size() % blockAlign));
            if (audio.empty() || !ContainsAudiblePcm(audio))
            {
                errorOut =
                    "No audible TrackAudio audio has been buffered yet. Current status: " +
                    Status() +
                    ". If you reinstalled TrackAudio, open the settings app and click Apply / repair TrackAudio tap.";
                return false;
            }

            if (!EnsureDirectory(m_options.outputFolder))
            {
                errorOut = "Could not create the Recordings folder.";
                return false;
            }

            const double savedSeconds =
                static_cast<double>(audio.size()) /
                static_cast<double>(BYTES_PER_SECOND);
            const std::time_t endUtc = std::time(nullptr);
            const std::time_t startUtc =
                endUtc -
                static_cast<std::time_t>(
                    std::ceil(std::max(0.0, savedSeconds)));
            pathOut =
                JoinPath(
                    m_options.outputFolder,
                    ReplayFileName(startUtc, endUtc));
            HANDLE file = CreateFileW(
                pathOut.c_str(),
                GENERIC_WRITE,
                FILE_SHARE_READ,
                nullptr,
                CREATE_ALWAYS,
                FILE_ATTRIBUTE_NORMAL,
                nullptr);
            if (file == INVALID_HANDLE_VALUE)
            {
                errorOut =
                    "Could not create the WAV file (Windows error " +
                    std::to_string(GetLastError()) + ").";
                return false;
            }

            const DWORD dataSize = static_cast<DWORD>(
                std::min<size_t>(audio.size(), 0xFFFFFFFFu - 44u));
            const DWORD riffSize = dataSize + 36;
            const DWORD fmtSize = 16;
            const WORD formatTag = WAVE_FORMAT_PCM;
            const WORD channels = CHANNELS;
            const DWORD sampleRate = SAMPLE_RATE;
            const DWORD avgBytes = BYTES_PER_SECOND;
            const WORD align = static_cast<WORD>(blockAlign);
            const WORD bits = BITS_PER_SAMPLE;
            DWORD written = 0;
            bool ok =
                WriteFile(file, "RIFF", 4, &written, nullptr) &&
                WriteFile(file, &riffSize, 4, &written, nullptr) &&
                WriteFile(file, "WAVE", 4, &written, nullptr) &&
                WriteFile(file, "fmt ", 4, &written, nullptr) &&
                WriteFile(file, &fmtSize, 4, &written, nullptr) &&
                WriteFile(file, &formatTag, 2, &written, nullptr) &&
                WriteFile(file, &channels, 2, &written, nullptr) &&
                WriteFile(file, &sampleRate, 4, &written, nullptr) &&
                WriteFile(file, &avgBytes, 4, &written, nullptr) &&
                WriteFile(file, &align, 2, &written, nullptr) &&
                WriteFile(file, &bits, 2, &written, nullptr) &&
                WriteFile(file, "data", 4, &written, nullptr) &&
                WriteFile(file, &dataSize, 4, &written, nullptr) &&
                WriteFile(file, audio.data(), dataSize, &written, nullptr);
            FlushFileBuffers(file);
            CloseHandle(file);
            if (!ok || written != dataSize)
            {
                DeleteFileW(pathOut.c_str());
                errorOut = "The WAV file could not be written completely.";
                return false;
            }
            return true;
        }

    private:
        void SetStatus(const std::string &status)
        {
            std::lock_guard<std::mutex> lock(m_statusMutex);
            m_status = status;
        }

        void CaptureWorker()
        {
            const HRESULT comResult =
                CoInitializeEx(nullptr, COINIT_MULTITHREADED);
            if (FAILED(comResult) && comResult != RPC_E_CHANGED_MODE)
            {
                SetStatus(
                    "ERROR // COM initialization 0x" +
                    Hex(comResult));
                return;
            }

            while (m_running.load())
            {
                AudioCapture capture;
                DWORD targetProcessId = 0;
                std::wstring targetProcessName;
                HRESULT startResult = E_FAIL;
                bool processCapture = false;

                if (!m_processNames.empty())
                {
                    targetProcessId =
                        FindTargetProcess(
                            m_processNames,
                            targetProcessName);
                    if (targetProcessId)
                    {
                        startResult =
                            capture.StartProcess(targetProcessId);
                        processCapture = SUCCEEDED(startResult);
                    }
                }

                if (!processCapture)
                {
                    if (targetProcessId)
                    {
                        SetStatus(
                            "ERROR // capture initialization 0x" +
                            Hex(startResult));
                    }
                    else
                    {
                        SetStatus(
                            "WAITING // TrackAudio is not running");
                    }
                    if (WaitForSingleObject(m_stopEvent, 2000) ==
                        WAIT_OBJECT_0)
                    {
                        break;
                    }
                    continue;
                }
                else
                {
                    const std::string version =
                        ProcessFileVersion(targetProcessId);
                    SetStatus(
                        "TRACKAUDIO " +
                        (version.empty() ? std::string("UNKNOWN") : version) +
                        " // RX PROCESS CAPTURE" +
                        " // PID " + std::to_string(targetProcessId));
                }

                if (FAILED(startResult))
                {
                    SetStatus(
                        "ERROR // capture initialization 0x" +
                        Hex(startResult));
                    if (WaitForSingleObject(m_stopEvent, 2000) ==
                        WAIT_OBJECT_0)
                    {
                        break;
                    }
                    continue;
                }

                ULONGLONG lastTargetCheck = GetTickCount64();
                bool restart = false;
                while (m_running.load() && !restart)
                {
                    HANDLE events[2] = {m_stopEvent, capture.Event()};
                    const DWORD wait =
                        WaitForMultipleObjects(
                            2,
                            events,
                            FALSE,
                            IDLE_CAPTURE_POLL_MS);
                    if (wait == WAIT_OBJECT_0)
                        break;
                    if (wait == WAIT_OBJECT_0 + 1)
                    {
                        bool appended = false;
                        const HRESULT drainResult =
                            capture.Drain(
                                m_buffer,
                                m_transmitTap,
                                appended);
                        if (FAILED(drainResult))
                        {
                            SetStatus(
                                "ERROR // audio read 0x" +
                                Hex(drainResult));
                            restart = true;
                        }
                        else if (!appended)
                        {
                            AppendIdleFrames(
                                m_buffer,
                                m_transmitTap,
                                IDLE_CAPTURE_FRAMES);
                        }
                    }
                    else if (wait == WAIT_TIMEOUT)
                    {
                        bool appended = false;
                        const HRESULT drainResult =
                            capture.Drain(
                                m_buffer,
                                m_transmitTap,
                                appended);
                        if (FAILED(drainResult))
                        {
                            SetStatus(
                                "ERROR // audio read 0x" +
                                Hex(drainResult));
                            restart = true;
                        }
                        else if (!appended)
                        {
                            AppendIdleFrames(
                                m_buffer,
                                m_transmitTap,
                                IDLE_CAPTURE_FRAMES);
                        }
                    }
                    else if (wait == WAIT_FAILED)
                    {
                        SetStatus(
                            "ERROR // wait failed " +
                            std::to_string(GetLastError()));
                        restart = true;
                    }

                    const ULONGLONG now = GetTickCount64();
                    if (now - lastTargetCheck >= 3000)
                    {
                        lastTargetCheck = now;
                        if (processCapture)
                        {
                            restart =
                                !ProcessIsAlive(targetProcessId);
                        }
                        else
                        {
                            std::wstring foundName;
                            restart =
                                FindTargetProcess(
                                    m_processNames,
                                    foundName) != 0;
                        }
                    }
                }
            }

            if (SUCCEEDED(comResult))
                CoUninitialize();
            SetStatus("STOPPED");
        }

        static std::string Hex(HRESULT value)
        {
            char text[16]{};
            sprintf_s(
                text,
                "%08lX",
                static_cast<unsigned long>(value));
            return text;
        }

        Options m_options;
        CircularAudioBuffer m_buffer;
        TrackAudioTxTapReader m_transmitTap;
        std::vector<std::wstring> m_processNames;
        std::atomic<bool> m_running{false};
        HANDLE m_stopEvent = nullptr;
        std::thread m_worker;
        std::mutex m_statusMutex;
        std::string m_status = "STARTING";
    };

    void WritePipeResponse(HANDLE pipe, const std::string &response)
    {
        DWORD written = 0;
        WriteFile(
            pipe,
            response.data(),
            static_cast<DWORD>(response.size()),
            &written,
            nullptr);
        FlushFileBuffers(pipe);
    }
}

int wmain(int argc, wchar_t **argv)
{
    HANDLE singleton = CreateMutexW(
        nullptr,
        TRUE,
        ZYZTOOLS_REPLAY_MUTEX);
    if (!singleton)
        return 1;
    if (GetLastError() == ERROR_ALREADY_EXISTS)
    {
        CloseHandle(singleton);
        return 0;
    }

    const Options options = ParseOptions(argc, argv);
    ReplayService service(options);
    service.Start();

    bool running = true;
    while (running)
    {
        HANDLE pipe = CreateNamedPipeA(
            PIPE_NAME,
            PIPE_ACCESS_DUPLEX,
            PIPE_TYPE_MESSAGE |
                PIPE_READMODE_MESSAGE |
                PIPE_WAIT,
            1,
            4096,
            4096,
            0,
            nullptr);
        if (pipe == INVALID_HANDLE_VALUE)
            break;

        const BOOL connected =
            ConnectNamedPipe(pipe, nullptr)
                ? TRUE
                : GetLastError() == ERROR_PIPE_CONNECTED;
        if (connected)
        {
            char buffer[1024]{};
            DWORD read = 0;
            if (ReadFile(
                    pipe,
                    buffer,
                    sizeof(buffer) - 1,
                    &read,
                    nullptr) &&
                read > 0)
            {
                buffer[read] = '\0';
                std::string command(buffer);
                std::transform(
                    command.begin(),
                    command.end(),
                    command.begin(),
                    [](unsigned char c)
                    {
                        return static_cast<char>(std::tolower(c));
                    });
                if (command.size() >= 3 &&
                    static_cast<unsigned char>(command[0]) == 0xEF &&
                    static_cast<unsigned char>(command[1]) == 0xBB &&
                    static_cast<unsigned char>(command[2]) == 0xBF)
                {
                    command.erase(0, 3);
                }
                command.erase(
                    command.begin(),
                    std::find_if(
                        command.begin(),
                        command.end(),
                        [](unsigned char c)
                        {
                            return !std::isspace(c);
                        }));

                if (command.find("shutdown") == 0)
                {
                    WritePipeResponse(pipe, "OK|shutdown");
                    running = false;
                }
                else if (command.find("intensity ") == 0)
                {
                    try {
                        service.SetIntensity(std::stoi(command.substr(10)));
                        WritePipeResponse(pipe, "OK|" + service.Status());
                    } catch (...) { WritePipeResponse(pipe, "ERROR|Invalid filter intensity."); }
                }
                else if (command.find("save") == 0)
                {
                    std::wstring path;
                    std::string error;
                    if (service.Save(path, error))
                        WritePipeResponse(
                            pipe,
                            "OK|" + WideToUtf8(path));
                    else
                        WritePipeResponse(
                            pipe,
                            "ERROR|" + error);
                }
                else if (command.find("status") == 0)
                {
                    WritePipeResponse(
                        pipe,
                        "OK|" + service.Status());
                }
                else
                {
                    WritePipeResponse(
                        pipe,
                        "ERROR|Unknown command.");
                }
            }
        }
        DisconnectNamedPipe(pipe);
        CloseHandle(pipe);
    }

    service.Stop();
    CloseHandle(singleton);
    return 0;
}
