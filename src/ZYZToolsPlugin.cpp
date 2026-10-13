#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "BuildChannel.h"
#include <Windows.h>
#include <windowsx.h>
#include <winhttp.h>
#include <mmsystem.h>
#include <TlHelp32.h>

#include "../SDK/EuroScopePlugIn.h"
#include "DepartureAssignment.h"
#include "ArrivalAssignment.h"

#include <algorithm>
#include <atomic>
#include <cctype>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <deque>
#include <fstream>
#include <iomanip>
#include <random>
#include <mutex>
#include <regex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#pragma comment(lib, "Winhttp.lib")
#pragma comment(lib, "Winmm.lib")
#pragma comment(lib, "Gdi32.lib")
#pragma comment(lib, "User32.lib")

using namespace EuroScopePlugIn;

class CSettingsScreen;

// EuroScope fallback state for click contexts where the tag item string is empty.
static std::string g_lastRenderedCallsign;
static ULONGLONG g_lastRenderedTick = 0;

namespace
{
    std::string Upper(std::string s);
    std::string Lower(std::string s);
    std::string Trim(const std::string &s);
    std::string CollapseWhitespace(const std::string &s);
    static std::string BaseSidName(const std::string &sidToken);
    static std::string GetThisDllDir();

    constexpr int TAG_PDC_FLAG_TYPE = 9101;
    constexpr int TAG_PDC_RUNWAY_TYPE = 9102;
    constexpr int TAG_PDC_FLAG_LEGACY_TYPE = 9103;
    constexpr int FUNC_PDC_GENERATE = 9201;
    constexpr int FUNC_PDC_TEST = 9202;
    constexpr int FUNC_PDC_RESTORE = 9203;
    constexpr int FUNC_PDC_GENERATE_LEGACY = 9204;
    constexpr int FUNC_SIDS_EDIT_DUALS23_23 = 9210;
    constexpr int FUNC_SIDS_EDIT_DUALS23_24R = 9211;
    constexpr int FUNC_SIDS_EDIT_DUALS05_05 = 9212;
    constexpr int FUNC_SIDS_EDIT_DUALS05_06L = 9213;
    constexpr int FUNC_SETTINGS_EDIT_HOPPIE_LOGON = 9214;
    constexpr int FUNC_SETTINGS_EDIT_STATION_CODE = 9215;
    constexpr int FUNC_SETTINGS_EDIT_POLL_SECONDS = 9216;
    constexpr int FUNC_SETTINGS_EDIT_AUDIO_REPLAY_MINUTES = 9217;
    constexpr int FUNC_SETTINGS_EDIT_PDC_SOUND = 9218;
    constexpr int FUNC_SETTINGS_EDIT_IFR_SOUND = 9219;
    constexpr int FUNC_SETTINGS_EDIT_REPLAY_SAVE_COMMAND = 9220;
    constexpr int SCREEN_OBJECT_SETTINGS = 9301;

    constexpr ULONGLONG LAST_RENDERED_FALLBACK_MS = 1500ULL;
    constexpr int DEPARTURE_SNAPSHOT_INTERVAL_SECONDS = 10;
    constexpr ULONGLONG DEPARTURE_LIST_RECENT_MS = 30000ULL;
    constexpr ULONGLONG RECONNECT_RESTORE_WINDOW_MS = 20ULL * 60ULL * 1000ULL;

    // Sound files live in plugin folder first; fallback to EuroScope.exe folder.
    const char *DEFAULT_PDC_SOUND_FILE = "pdc_request.wav";
    const char *DEFAULT_IFR_RELEASE_SOUND_FILE = "IFR_release.wav";
    const char *DEFAULT_SEND_SOUND_FILE = "pdc_send.wav";

    enum class UiTheme
    {
        Current,
        Vatcan,
        Navcan,
        Custom,
        PluginCore
    };

    struct ThemePalette
    {
        COLORREF background;
        COLORREF panel;
        COLORREF panelAlt;
        COLORREF line;
        COLORREF text;
        COLORREF muted;
        COLORREF accent;
        COLORREF green;
        COLORREF amber;
        COLORREF red;
        COLORREF button;
        COLORREF buttonActive;
        COLORREF header;
        COLORREF grid;
        COLORREF edit;
        COLORREF warningHeader;
        COLORREF rx;
        COLORREF tx;
        const char *fontFace;
        int titleFontHeight;
        int bodyFontHeight;
        int titleWeight;
        bool bevelButtons;
    };

    UiTheme ParseUiTheme(const std::string &value)
    {
        const std::string normalized = Upper(Trim(value));
        if (normalized == "VATCAN" || normalized == "VATCANSITU")
            return UiTheme::Vatcan;
        if (normalized == "NAVCAN" || normalized == "NAVCANADA")
            return UiTheme::Navcan;
        if (normalized == "CUSTOM")
            return UiTheme::Custom;
        if (normalized == "CPP" || normalized == "PLUGINCORE" || normalized == "PLUGIN_CORE" || normalized == "CORE")
            return UiTheme::PluginCore;
        return UiTheme::Current;
    }

    const char *UiThemeConfigName(UiTheme theme)
    {
        switch (theme)
        {
        case UiTheme::Vatcan:
            return "vatcan";
        case UiTheme::Navcan:
            return "navcan";
        case UiTheme::Custom:
            return "custom";
        case UiTheme::PluginCore:
            return "plugincore";
        default:
            return "current";
        }
    }

    const char *UiThemeDisplayName(UiTheme theme)
    {
        switch (theme)
        {
        case UiTheme::Vatcan:
            return "VATCAN";
        case UiTheme::Navcan:
            return "NAV CANADA";
        case UiTheme::Custom:
            return "CUSTOM";
        case UiTheme::PluginCore:
            return "CPP";
        default:
            return "CURRENT";
        }
    }

    ThemePalette GetThemePalette(UiTheme theme)
    {
        if (theme == UiTheme::Vatcan)
        {
            return {
                RGB(40, 40, 40),
                RGB(55, 55, 55),
                RGB(66, 66, 66),
                RGB(140, 140, 140),
                RGB(230, 230, 230),
                RGB(170, 170, 170),
                RGB(0, 135, 0),
                RGB(0, 180, 0),
                RGB(242, 120, 57),
                RGB(209, 39, 27),
                RGB(55, 55, 55),
                RGB(66, 66, 66),
                RGB(40, 40, 40),
                RGB(55, 55, 55),
                RGB(66, 66, 66),
                RGB(72, 50, 40),
                RGB(0, 32, 120),
                RGB(0, 135, 0),
                "Segoe UI",
                -14,
                -12,
                FW_NORMAL,
                true};
        }

        if (theme == UiTheme::PluginCore)
        {
            return {
                RGB(12, 12, 14),
                RGB(25, 28, 32),
                RGB(35, 39, 45),
                RGB(75, 85, 98),
                RGB(235, 238, 242),
                RGB(155, 164, 176),
                RGB(80, 160, 255),
                RGB(80, 255, 120),
                RGB(255, 190, 80),
                RGB(255, 96, 80),
                RGB(30, 37, 46),
                RGB(35, 70, 95),
                RGB(18, 22, 28),
                RGB(30, 34, 40),
                RGB(40, 48, 58),
                RGB(55, 35, 30),
                RGB(80, 160, 255),
                RGB(80, 255, 120),
                "Segoe UI",
                -22,
                -16,
                FW_SEMIBOLD,
                false};
        }

        return {
            RGB(7, 15, 19),
            RGB(12, 27, 32),
            RGB(16, 35, 41),
            RGB(48, 82, 88),
            RGB(226, 240, 239),
            RGB(126, 154, 157),
            RGB(67, 220, 211),
            RGB(76, 224, 146),
            RGB(244, 185, 66),
            RGB(232, 91, 92),
            RGB(19, 42, 48),
            RGB(25, 66, 69),
            RGB(10, 29, 34),
            RGB(13, 35, 39),
            RGB(22, 59, 65),
            RGB(39, 31, 17),
            RGB(0, 120, 255),
            RGB(0, 190, 90),
            "Consolas",
            -19,
            -14,
            FW_BOLD,
            false};
    }

    struct DarkEditorState
    {
        std::string title;
        std::string initialValue;
        std::string result;
        UiTheme theme = UiTheme::Current;
        ThemePalette palette = GetThemePalette(UiTheme::Current);
        bool multiline = false;
        bool accepted = false;
        bool done = false;
        HWND edit = nullptr;
        HFONT font = nullptr;
        HBRUSH backgroundBrush = nullptr;
        HBRUSH editBrush = nullptr;
    };

    constexpr int DARK_EDITOR_OK = 1001;
    constexpr int DARK_EDITOR_CANCEL = 1002;

    LRESULT CALLBACK DarkEditorProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam)
    {
        DarkEditorState *state = reinterpret_cast<DarkEditorState *>(GetWindowLongPtrA(hwnd, GWLP_USERDATA));

        if (msg == WM_NCCREATE)
        {
            auto *create = reinterpret_cast<CREATESTRUCTA *>(lParam);
            state = static_cast<DarkEditorState *>(create->lpCreateParams);
            SetWindowLongPtrA(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(state));
        }

        if (!state)
            return DefWindowProcA(hwnd, msg, wParam, lParam);

        switch (msg)
        {
        case WM_CREATE:
        {
            const bool vatcan = state->theme == UiTheme::Vatcan;
            const bool pluginCore = state->theme == UiTheme::PluginCore;
            state->backgroundBrush = CreateSolidBrush(state->palette.background);
            state->editBrush = CreateSolidBrush(state->palette.edit);
            state->font = CreateFontA(
                state->palette.bodyFontHeight, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, ANSI_CHARSET,
                OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                DEFAULT_PITCH | FF_DONTCARE, state->palette.fontFace);

            DWORD editStyle = WS_CHILD | WS_VISIBLE | WS_BORDER | ES_LEFT;
            if (state->multiline)
                editStyle |= ES_MULTILINE | ES_AUTOVSCROLL | ES_WANTRETURN | WS_VSCROLL;
            else
                editStyle |= ES_AUTOHSCROLL;

            state->edit = CreateWindowExA(
                0, "EDIT", state->initialValue.c_str(), editStyle,
                vatcan ? 12 : pluginCore ? 14 : 20,
                vatcan ? 38 : pluginCore ? 50 : 68,
                vatcan ? 396 : pluginCore ? 412 : 520,
                state->multiline ? (vatcan ? 104 : pluginCore ? 150 : 158) : (vatcan ? 28 : pluginCore ? 27 : 42),
                hwnd, reinterpret_cast<HMENU>(static_cast<INT_PTR>(1000)),
                GetModuleHandleA(nullptr), nullptr);

            HWND ok = CreateWindowExA(
                0, "BUTTON", "APPLY", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW,
                vatcan ? 270 : pluginCore ? 282 : 356,
                vatcan ? 168 : pluginCore ? (state->multiline ? 238 : 158) : 244,
                vatcan ? 64 : pluginCore ? 64 : 86,
                vatcan ? 25 : pluginCore ? 27 : 36, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(DARK_EDITOR_OK)),
                GetModuleHandleA(nullptr), nullptr);
            HWND cancel = CreateWindowExA(
                0, "BUTTON", "CANCEL", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW,
                vatcan ? 340 : pluginCore ? 352 : 454,
                vatcan ? 168 : pluginCore ? (state->multiline ? 238 : 158) : 244,
                vatcan ? 68 : pluginCore ? 74 : 86,
                vatcan ? 25 : pluginCore ? 27 : 36, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(DARK_EDITOR_CANCEL)),
                GetModuleHandleA(nullptr), nullptr);

            SendMessageA(state->edit, WM_SETFONT, reinterpret_cast<WPARAM>(state->font), TRUE);
            SendMessageA(ok, WM_SETFONT, reinterpret_cast<WPARAM>(state->font), TRUE);
            SendMessageA(cancel, WM_SETFONT, reinterpret_cast<WPARAM>(state->font), TRUE);
            SendMessageA(state->edit, EM_SETSEL, 0, -1);
            SetFocus(state->edit);
            return 0;
        }
        case WM_NCHITTEST:
        {
            LRESULT hit = DefWindowProcA(hwnd, msg, wParam, lParam);
            if (hit == HTCLIENT)
            {
                POINT pt{GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam)};
                ScreenToClient(hwnd, &pt);
                const int dragHeight = state->theme == UiTheme::Vatcan ? 25 : state->theme == UiTheme::PluginCore ? 38 : 48;
                if (pt.y >= 0 && pt.y < dragHeight)
                    return HTCAPTION;
            }
            return hit;
        }
        case WM_PAINT:
        {
            PAINTSTRUCT ps{};
            HDC hdc = BeginPaint(hwnd, &ps);
            RECT client{};
            GetClientRect(hwnd, &client);
            FillRect(hdc, &client, state->backgroundBrush);

            RECT header{0, 0, client.right, state->theme == UiTheme::Vatcan ? 25 : state->theme == UiTheme::PluginCore ? 38 : 48};
            HBRUSH headerBrush = CreateSolidBrush(state->palette.header);
            FillRect(hdc, &header, headerBrush);
            DeleteObject(headerBrush);

            SetBkMode(hdc, TRANSPARENT);
            SetTextColor(hdc, state->palette.accent);
            SelectObject(hdc, state->font);
            RECT titleRc{
                state->theme == UiTheme::Vatcan ? 8 : 20,
                state->theme == UiTheme::Vatcan ? 3 : state->theme == UiTheme::PluginCore ? 10 : 13,
                client.right - 20,
                state->theme == UiTheme::Vatcan ? 23 : state->theme == UiTheme::PluginCore ? 31 : 42};
            DrawTextA(
                hdc, state->title.c_str(), -1, &titleRc,
                state->theme == UiTheme::Vatcan ? DT_CENTER | DT_SINGLELINE : DT_LEFT | DT_SINGLELINE);

            SetTextColor(hdc, state->palette.muted);
            RECT hintRc{
                state->theme == UiTheme::Vatcan ? 12 : 20,
                state->theme == UiTheme::Vatcan ? 146 : state->multiline ? (state->theme == UiTheme::PluginCore ? 212 : 230) : (state->theme == UiTheme::PluginCore ? 94 : 126),
                client.right - 20,
                state->theme == UiTheme::Vatcan ? 165 : state->multiline ? (state->theme == UiTheme::PluginCore ? 232 : 248) : (state->theme == UiTheme::PluginCore ? 114 : 150)};
            DrawTextA(
                hdc,
                state->multiline ? "SPACE OR COMMA SEPARATED VALUES" : "ENTER VALUE AND SELECT APPLY",
                -1, &hintRc, DT_LEFT | DT_SINGLELINE);
            EndPaint(hwnd, &ps);
            return 0;
        }
        case WM_CTLCOLOREDIT:
        {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            SetTextColor(hdc, state->palette.text);
            SetBkColor(hdc, state->palette.edit);
            return reinterpret_cast<INT_PTR>(state->editBrush);
        }
        case WM_DRAWITEM:
        {
            auto *draw = reinterpret_cast<DRAWITEMSTRUCT *>(lParam);
            const bool okButton = draw->CtlID == DARK_EDITOR_OK;
            HBRUSH brush = CreateSolidBrush(okButton ? state->palette.buttonActive : state->palette.warningHeader);
            FillRect(draw->hDC, &draw->rcItem, brush);
            DeleteObject(brush);
            HBRUSH border = CreateSolidBrush(okButton ? state->palette.green : state->palette.red);
            FrameRect(draw->hDC, &draw->rcItem, border);
            DeleteObject(border);
            SetBkMode(draw->hDC, TRANSPARENT);
            SetTextColor(draw->hDC, okButton ? state->palette.green : state->palette.red);
            DrawTextA(
                draw->hDC, okButton ? "APPLY" : "CANCEL", -1,
                &draw->rcItem, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
            return TRUE;
        }
        case WM_COMMAND:
            if (LOWORD(wParam) == DARK_EDITOR_OK)
            {
                int length = GetWindowTextLengthA(state->edit);
                std::string value(static_cast<size_t>(length) + 1, '\0');
                if (length > 0)
                    GetWindowTextA(state->edit, value.data(), length + 1);
                value.resize(static_cast<size_t>(length));
                state->result = value;
                state->accepted = true;
                state->done = true;
                DestroyWindow(hwnd);
                return 0;
            }
            if (LOWORD(wParam) == DARK_EDITOR_CANCEL)
            {
                state->done = true;
                DestroyWindow(hwnd);
                return 0;
            }
            break;
        case WM_KEYDOWN:
            if (wParam == VK_ESCAPE)
            {
                state->done = true;
                DestroyWindow(hwnd);
                return 0;
            }
            break;
        case WM_CLOSE:
            state->done = true;
            DestroyWindow(hwnd);
            return 0;
        case WM_DESTROY:
            state->done = true;
            return 0;
        }

        return DefWindowProcA(hwnd, msg, wParam, lParam);
    }

    bool ShowDarkTextEditor(
        const std::string &title,
        const std::string &initialValue,
        bool multiline,
        UiTheme theme,
        const ThemePalette &palette,
        std::string &resultOut)
    {
        static bool classRegistered = false;
        const char *className = "PreferredPDCFlag.DarkEditor";
        HINSTANCE instance = GetModuleHandleA(nullptr);

        if (!classRegistered)
        {
            WNDCLASSEXA wc{};
            wc.cbSize = sizeof(wc);
            wc.lpfnWndProc = DarkEditorProc;
            wc.hInstance = instance;
            wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
            wc.lpszClassName = className;
            wc.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1);
            if (!RegisterClassExA(&wc) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS)
                return false;
            classRegistered = true;
        }

        DarkEditorState state{};
        state.title = title;
        state.initialValue = initialValue;
        state.multiline = multiline;
        state.theme = theme;
        state.palette = palette;

        HWND owner = GetForegroundWindow();
        RECT ownerRect{};
        GetWindowRect(owner, &ownerRect);
        const int width = theme == UiTheme::Vatcan ? 420 : theme == UiTheme::PluginCore ? 440 : 560;
        const int height = theme == UiTheme::Vatcan ? 210 : theme == UiTheme::PluginCore ? (multiline ? 280 : 210) : 300;
        const int x = ownerRect.left + ((ownerRect.right - ownerRect.left) - width) / 2;
        const int y = ownerRect.top + ((ownerRect.bottom - ownerRect.top) - height) / 2;

        HWND window = CreateWindowExA(
            WS_EX_DLGMODALFRAME | WS_EX_TOPMOST,
            className, title.c_str(), WS_POPUP | WS_BORDER,
            x, y, width, height, owner, nullptr, instance, &state);
        if (!window)
            return false;

        EnableWindow(owner, FALSE);
        ShowWindow(window, SW_SHOW);
        UpdateWindow(window);

        MSG msg{};
        while (!state.done)
        {
            const BOOL messageResult = GetMessageA(&msg, nullptr, 0, 0);
            if (messageResult <= 0)
            {
                if (messageResult == 0)
                    PostQuitMessage(static_cast<int>(msg.wParam));
                break;
            }
            TranslateMessage(&msg);
            DispatchMessageA(&msg);
        }

        EnableWindow(owner, TRUE);
        SetForegroundWindow(owner);

        if (state.font)
            DeleteObject(state.font);
        if (state.backgroundBrush)
            DeleteObject(state.backgroundBrush);
        if (state.editBrush)
            DeleteObject(state.editBrush);

        if (state.accepted)
            resultOut = state.result;
        return state.accepted;
    }

    enum class DualsMode
    {
        Off = 0,
        Duals05,
        Duals23
    };

    enum class SettingsTab
    {
        Operations = 0,
        Hoppie,
        SidMatrix,
        Recordings,
        Statistics
    };

    static bool IsLikelyPdcId(const std::string &s)
    {
        std::string u = Upper(Trim(s));
        const size_t slash = u.find('/');
        if (slash != std::string::npos)
            u = u.substr(0, slash);
        if (u.size() != 4)
            return false;
        if (!std::isdigit((unsigned char)u[0]) ||
            !std::isdigit((unsigned char)u[1]) ||
            !std::isdigit((unsigned char)u[2]))
            return false;
        if (u[3] < 'A' || u[3] > 'Z')
            return false;
        return true;
    }

    static const std::unordered_set<std::string> SID_BASES_CLEARED_3000 = {
        "OAKVL", "PEMBA", "TULEK", "NOSIK", "NUGOP", "EBKIN", "MATES", "LAKES",
        "BOMET", "TEVAD", "MAVAN", "DUSOM", "PERLO"};

    // Best-effort base SID name: prefer fpd.GetSidName(), else route first token
    static std::string GetBaseSidFromFp(const EuroScopePlugIn::CFlightPlanData &fpd)
    {
        std::string sid = Upper(Trim(fpd.GetSidName()));
        if (!sid.empty())
            return BaseSidName(sid);

        std::string route = Trim(fpd.GetRoute());
        if (route.empty())
            return "";

        std::stringstream ss(Upper(route));
        std::string firstTok;
        ss >> firstTok;
        if (firstTok.empty())
            return "";

        // If fused token exists like "DEDKI5NUGOP/24R", strip "/..."
        size_t slash = firstTok.find('/');
        if (slash != std::string::npos)
            firstTok = firstTok.substr(0, slash);

        return BaseSidName(firstTok);
    }

    std::string Upper(std::string s)
    {
        std::transform(s.begin(), s.end(), s.begin(),
                       [](unsigned char c)
                       { return (char)std::toupper(c); });
        return s;
    }

    std::string Lower(std::string s)
    {
        std::transform(
            s.begin(),
            s.end(),
            s.begin(),
            [](unsigned char c)
            {
                return static_cast<char>(std::tolower(c));
            });
        return s;
    }

    std::string Trim(const std::string &s)
    {
        size_t b = 0;
        while (b < s.size() && std::isspace((unsigned char)s[b]))
            ++b;
        size_t e = s.size();
        while (e > b && std::isspace((unsigned char)s[e - 1]))
            --e;
        return s.substr(b, e - b);
    }

    std::string CollapseWhitespace(const std::string &s)
    {
        std::string out;
        bool pendingSpace = false;
        for (unsigned char ch : s)
        {
            if (std::isspace(ch))
            {
                if (!out.empty())
                    pendingSpace = true;
                continue;
            }

            if (pendingSpace)
            {
                out.push_back(' ');
                pendingSpace = false;
            }
            out.push_back(static_cast<char>(ch));
        }
        return Trim(out);
    }

    const char *MonthShort(int mon0)
    {
        static const char *m[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};
        if (mon0 < 0 || mon0 > 11)
            return "UNK";
        return m[mon0];
    }

    std::string TimestampDDMonYY_HHMM()
    {
        auto t = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
        std::tm utc{};
        gmtime_s(&utc, &t);

        int yy = (utc.tm_year + 1900) % 100;
        std::ostringstream oss;
        oss << std::setfill('0') << std::setw(2) << utc.tm_mday
            << MonthShort(utc.tm_mon)
            << std::setw(2) << yy
            << " " << std::setfill('0') << std::setw(2) << utc.tm_hour
            << std::setw(2) << utc.tm_min;
        return oss.str();
    }

    std::wstring Widen(const std::string &s)
    {
        if (s.empty())
            return {};
        int len = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
        if (len <= 0)
            return {};

        std::wstring out(len, L'\0'); // allocate including null
        MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, out.data(), len);

        if (!out.empty() && out.back() == L'\0')
            out.pop_back(); // remove null terminator
        return out;
    }

    std::string UrlEncode(const std::string &s)
    {
        std::ostringstream out;
        out << std::uppercase << std::hex;
        for (unsigned char c : s)
        {
            if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~')
                out << static_cast<char>(c);
            else
                out << '%' << std::setw(2) << std::setfill('0') << static_cast<int>(c);
        }
        return out.str();
    }

    bool HttpPostForm(
        const std::string &host,
        const std::string &path,
        const std::string &formBody,
        std::string &responseOut,
        std::string &errOut)
    {
        HINTERNET hSession = WinHttpOpen(L"PreferredPDCFlag/1.1",
                                         WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
                                         WINHTTP_NO_PROXY_NAME,
                                         WINHTTP_NO_PROXY_BYPASS,
                                         0);
        if (!hSession)
        {
            errOut = "WinHTTP session open failed.";
            return false;
        }
        WinHttpSetTimeouts(hSession, 5000, 5000, 10000, 10000);

        std::wstring whost = Widen(host);
        std::wstring wpath = Widen(path);

        HINTERNET hConnect = WinHttpConnect(hSession, whost.c_str(), INTERNET_DEFAULT_HTTPS_PORT, 0);
        if (!hConnect)
        {
            WinHttpCloseHandle(hSession);
            errOut = "WinHTTP connect failed.";
            return false;
        }

        HINTERNET hRequest = WinHttpOpenRequest(
            hConnect,
            L"POST",
            wpath.c_str(),
            nullptr,
            WINHTTP_NO_REFERER,
            WINHTTP_DEFAULT_ACCEPT_TYPES,
            WINHTTP_FLAG_SECURE);

        if (!hRequest)
        {
            WinHttpCloseHandle(hConnect);
            WinHttpCloseHandle(hSession);
            errOut = "WinHTTP request open failed.";
            return false;
        }

        const wchar_t *headers = L"Content-Type: application/x-www-form-urlencoded\r\n";
        BOOL ok = WinHttpSendRequest(
            hRequest,
            headers, -1L,
            (LPVOID)formBody.data(),
            (DWORD)formBody.size(),
            (DWORD)formBody.size(),
            0);

        if (!ok)
        {
            WinHttpCloseHandle(hRequest);
            WinHttpCloseHandle(hConnect);
            WinHttpCloseHandle(hSession);
            errOut = "WinHTTP send failed.";
            return false;
        }

        ok = WinHttpReceiveResponse(hRequest, nullptr);
        if (!ok)
        {
            WinHttpCloseHandle(hRequest);
            WinHttpCloseHandle(hConnect);
            WinHttpCloseHandle(hSession);
            errOut = "WinHTTP receive failed.";
            return false;
        }

        responseOut.clear();
        DWORD bytesAvailable = 0;

        for (;;)
        {
            bytesAvailable = 0;
            if (!WinHttpQueryDataAvailable(hRequest, &bytesAvailable))
            {
                errOut = "WinHTTP query-data failed.";
                break;
            }
            if (bytesAvailable == 0)
                break;

            std::string chunk(bytesAvailable, '\0');
            DWORD bytesRead = 0;

            if (!WinHttpReadData(hRequest, chunk.data(), bytesAvailable, &bytesRead))
            {
                errOut = "WinHTTP read failed.";
                break;
            }

            chunk.resize(bytesRead);
            responseOut += chunk;
            if (responseOut.size() > 1024U * 1024U)
            {
                errOut = "Hoppie response exceeded the 1 MB safety limit.";
                break;
            }
        }

        WinHttpCloseHandle(hRequest);
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);

        return errOut.empty();
    }

    bool JsonStringValue(const std::string &json, const char *key, std::string &out)
    {
        std::string pattern = "\\s*\"";
        pattern += key;
        pattern += "\"\\s*:\\s*\"([^\"]*)\"";
        const std::regex re(pattern, std::regex::icase);
        std::smatch m;
        if (!std::regex_search(json, m, re))
            return false;
        out = m[1].str();
        return true;
    }

    bool JsonIntValue(const std::string &json, const char *key, int &out)
    {
        std::string pattern = "\\s*\"";
        pattern += key;
        pattern += "\"\\s*:\\s*([0-9]+)";
        const std::regex re(pattern, std::regex::icase);
        std::smatch m;
        if (!std::regex_search(json, m, re))
            return false;
        out = std::stoi(m[1].str());
        return true;
    }

    static size_t SkipJsonWs(const std::string &s, size_t i)
    {
        while (i < s.size() && std::isspace((unsigned char)s[i]))
            ++i;
        return i;
    }

    static bool FindJsonValueStart(const std::string &json, const std::string &key, size_t &valuePosOut)
    {
        const std::string token = "\"" + key + "\"";
        size_t k = json.find(token);
        if (k == std::string::npos)
            return false;

        size_t i = SkipJsonWs(json, k + token.size());
        if (i >= json.size() || json[i] != ':')
            return false;

        i = SkipJsonWs(json, i + 1);
        if (i >= json.size())
            return false;

        valuePosOut = i;
        return true;
    }

    static bool ParseJsonStringAt(const std::string &json, size_t &i, std::string &out)
    {
        if (i >= json.size() || json[i] != '"')
            return false;

        ++i;
        std::string v;
        while (i < json.size())
        {
            char c = json[i++];
            if (c == '\\')
            {
                if (i >= json.size())
                    return false;
                char e = json[i++];
                switch (e)
                {
                case '"':
                case '\\':
                case '/':
                    v.push_back(e);
                    break;
                case 'b':
                    v.push_back('\b');
                    break;
                case 'f':
                    v.push_back('\f');
                    break;
                case 'n':
                    v.push_back('\n');
                    break;
                case 'r':
                    v.push_back('\r');
                    break;
                case 't':
                    v.push_back('\t');
                    break;
                default:
                    v.push_back(e);
                    break;
                }
                continue;
            }

            if (c == '"')
            {
                out = v;
                return true;
            }

            v.push_back(c);
        }

        return false;
    }

    static bool JsonObjectValue(const std::string &json, const std::string &key, std::string &out)
    {
        size_t i = 0;
        if (!FindJsonValueStart(json, key, i))
            return false;
        if (json[i] != '{')
            return false;

        size_t start = i;
        int depth = 0;
        bool inString = false;
        bool escaped = false;

        for (; i < json.size(); ++i)
        {
            char c = json[i];
            if (inString)
            {
                if (escaped)
                    escaped = false;
                else if (c == '\\')
                    escaped = true;
                else if (c == '"')
                    inString = false;
                continue;
            }

            if (c == '"')
                inString = true;
            else if (c == '{')
                ++depth;
            else if (c == '}')
            {
                --depth;
                if (depth == 0)
                {
                    out = json.substr(start, i - start + 1);
                    return true;
                }
            }
        }

        return false;
    }

    static bool JsonStringArrayValue(const std::string &json, const std::string &key, std::vector<std::string> &out)
    {
        size_t i = 0;
        if (!FindJsonValueStart(json, key, i))
            return false;
        if (json[i] != '[')
            return false;

        ++i;
        std::vector<std::string> values;

        for (;;)
        {
            i = SkipJsonWs(json, i);
            if (i >= json.size())
                return false;
            if (json[i] == ']')
            {
                out = values;
                return true;
            }

            std::string value;
            if (!ParseJsonStringAt(json, i, value))
                return false;
            values.push_back(value);

            i = SkipJsonWs(json, i);
            if (i < json.size() && json[i] == ',')
            {
                ++i;
                continue;
            }
            if (i < json.size() && json[i] == ']')
            {
                out = values;
                return true;
            }
            return false;
        }
    }

    static std::string JsonEscape(const std::string &s)
    {
        std::string out;
        for (char c : s)
        {
            switch (c)
            {
            case '"':
                out += "\\\"";
                break;
            case '\\':
                out += "\\\\";
                break;
            case '\n':
                out += "\\n";
                break;
            case '\r':
                out += "\\r";
                break;
            case '\t':
                out += "\\t";
                break;
            default:
                out.push_back(c);
                break;
            }
        }
        return out;
    }

    static std::string XmlEscape(const std::string &s)
    {
        std::string out;
        out.reserve(s.size() + 16);
        for (char c : s)
        {
            switch (c)
            {
            case '&':
                out += "&amp;";
                break;
            case '<':
                out += "&lt;";
                break;
            case '>':
                out += "&gt;";
                break;
            case '"':
                out += "&quot;";
                break;
            case '\'':
                out += "&apos;";
                break;
            default:
                if (static_cast<unsigned char>(c) >= 0x20 || c == '\t')
                    out.push_back(c);
                break;
            }
        }
        return out;
    }

    static std::string FormatLocalTime(std::time_t value, const char *format)
    {
        if (value <= 0)
            return "";
        std::tm local{};
        localtime_s(&local, &value);
        char buffer[64]{};
        if (std::strftime(buffer, sizeof(buffer), format, &local) == 0)
            return "";
        return buffer;
    }

    static std::vector<std::string> NormalizeSidList(const std::vector<std::string> &raw)
    {
        std::vector<std::string> out;
        std::unordered_set<std::string> seen;

        for (const auto &item : raw)
        {
            std::string v = Upper(Trim(item));
            size_t slash = v.find('/');
            if (slash != std::string::npos)
                v = v.substr(0, slash);

            v = BaseSidName(v);
            if (v.empty() || seen.find(v) != seen.end())
                continue;

            seen.insert(v);
            out.push_back(v);
        }

        return out;
    }

    static std::vector<std::string> ParseSidListText(const std::string &text)
    {
        std::string normalized = text;
        for (char &c : normalized)
        {
            if (c == ',' || c == ';' || c == '\n' || c == '\r' || c == '\t')
                c = ' ';
        }

        std::stringstream ss(normalized);
        std::vector<std::string> raw;
        std::string token;
        while (ss >> token)
            raw.push_back(token);

        return NormalizeSidList(raw);
    }

    static std::string JoinSidList(const std::vector<std::string> &items)
    {
        std::ostringstream out;
        for (size_t i = 0; i < items.size(); ++i)
        {
            if (i)
                out << ", ";
            out << items[i];
        }
        return out.str();
    }

    static std::string JsonArray(const std::vector<std::string> &items)
    {
        std::ostringstream out;
        out << "[";
        for (size_t i = 0; i < items.size(); ++i)
        {
            if (i)
                out << ", ";
            out << "\"" << JsonEscape(items[i]) << "\"";
        }
        out << "]";
        return out.str();
    }

    std::vector<std::string> Split(const std::string &s, char sep)
    {
        std::vector<std::string> out;
        std::string cur;
        for (char c : s)
        {
            if (c == sep)
            {
                out.push_back(cur);
                cur.clear();
            }
            else
                cur.push_back(c);
        }
        out.push_back(cur);
        return out;
    }

    std::vector<std::string> ExtractBraceGroups(const std::string &s)
    {
        std::vector<std::string> out;
        int depth = 0;
        size_t start = std::string::npos;
        for (size_t i = 0; i < s.size(); ++i)
        {
            char c = s[i];
            if (c == '{')
            {
                if (depth == 0)
                    start = i + 1;
                ++depth;
            }
            else if (c == '}')
            {
                if (depth > 0)
                {
                    --depth;
                    if (depth == 0 && start != std::string::npos && i >= start)
                    {
                        out.push_back(s.substr(start, i - start));
                        start = std::string::npos;
                    }
                }
            }
        }
        return out;
    }

    std::string GeneratePdcIdentifier(const std::string &callsign)
    {
        (void)callsign;
        static std::mt19937 generator(std::random_device{}());
        static std::uniform_int_distribution<unsigned int> numberDistribution(0U, 999U);
        static std::uniform_int_distribution<unsigned int> letterDistribution(0U, 25U);
        const unsigned int pdcNumbers = numberDistribution(generator);
        const char letter = static_cast<char>('A' + letterDistribution(generator));

        std::ostringstream oss;
        oss << std::setfill('0') << std::setw(3) << pdcNumbers << letter;
        return oss.str();
    }

    std::string GenerateHoppieMessageId()
    {
        static std::mt19937 generator(std::random_device{}());
        static std::uniform_int_distribution<unsigned int> distribution(0U, 99999U);
        std::ostringstream out;
        out << std::setfill('0') << std::setw(5) << distribution(generator);
        return out.str();
    }

    HANDLE g_bridgeProcessHandle = nullptr;
    HANDLE g_audioReplayProcessHandle = nullptr;

    void CloseOwnedBridgeHandle()
    {
        if (g_bridgeProcessHandle)
        {
            CloseHandle(g_bridgeProcessHandle);
            g_bridgeProcessHandle = nullptr;
        }
    }

    bool BridgePipeAvailable()
    {
        const char *pipeName = ZYZTOOLS_BRIDGE_PIPE;
        if (WaitNamedPipeA(pipeName, 0))
            return true;
        return GetLastError() == ERROR_SEM_TIMEOUT;
    }

    bool EnsureBridgeRunning(std::string &errOut)
    {
        if (BridgePipeAvailable())
            return true;

        if (g_bridgeProcessHandle &&
            WaitForSingleObject(g_bridgeProcessHandle, 0) == WAIT_OBJECT_0)
        {
            CloseOwnedBridgeHandle();
        }

        const std::string bridgePath = GetThisDllDir() + "PreferredCYYZPdcBridge.exe";
        if (GetFileAttributesA(bridgePath.c_str()) == INVALID_FILE_ATTRIBUTES)
        {
            errOut = "PreferredCYYZPdcBridge.exe not found beside the plugin DLL.";
            return false;
        }

        std::string commandLine = "\"" + bridgePath + "\"";
        std::vector<char> mutableCommand(commandLine.begin(), commandLine.end());
        mutableCommand.push_back('\0');

        STARTUPINFOA startup{};
        startup.cb = sizeof(startup);
        PROCESS_INFORMATION process{};
        const std::string workingDir = GetThisDllDir();

        if (!CreateProcessA(
                bridgePath.c_str(), mutableCommand.data(), nullptr, nullptr, FALSE,
                CREATE_NO_WINDOW, nullptr,
                workingDir.empty() ? nullptr : workingDir.c_str(),
                &startup, &process))
        {
            errOut = "Could not auto-start PreferredCYYZPdcBridge.exe (Windows error " + std::to_string(GetLastError()) + ").";
            return false;
        }

        CloseHandle(process.hThread);
        CloseOwnedBridgeHandle();
        g_bridgeProcessHandle = process.hProcess;

        for (int i = 0; i < 30; ++i)
        {
            Sleep(100);
            if (BridgePipeAvailable())
                return true;
        }

        if (g_bridgeProcessHandle)
        {
            TerminateProcess(g_bridgeProcessHandle, 1);
            WaitForSingleObject(g_bridgeProcessHandle, 1000);
            CloseOwnedBridgeHandle();
        }
        errOut = "PreferredCYYZPdcBridge.exe started but its named pipe did not become available.";
        return false;
    }

    void ShutdownBridge()
    {
        const char *pipeName = ZYZTOOLS_BRIDGE_PIPE;
        HANDLE pipe = INVALID_HANDLE_VALUE;
        for (int i = 0; i < 20 && pipe == INVALID_HANDLE_VALUE; ++i)
        {
            pipe = CreateFileA(pipeName, GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
            if (pipe == INVALID_HANDLE_VALUE)
                Sleep(25);
        }

        if (pipe != INVALID_HANDLE_VALUE)
        {
            const char payload[] = "{\"command\":\"shutdown\"}\n";
            DWORD written = 0;
            WriteFile(pipe, payload, static_cast<DWORD>(sizeof(payload) - 1), &written, nullptr);
            FlushFileBuffers(pipe);
            CloseHandle(pipe);
        }

        if (g_bridgeProcessHandle)
        {
            const DWORD waitResult = WaitForSingleObject(g_bridgeProcessHandle, 2000);
            if (waitResult == WAIT_TIMEOUT)
            {
                TerminateProcess(g_bridgeProcessHandle, 0);
                WaitForSingleObject(g_bridgeProcessHandle, 1000);
            }
            CloseOwnedBridgeHandle();
        }
    }

    void CloseOwnedAudioReplayHandle()
    {
        if (g_audioReplayProcessHandle)
        {
            CloseHandle(g_audioReplayProcessHandle);
            g_audioReplayProcessHandle = nullptr;
        }
    }

    bool AudioReplayPipeAvailable()
    {
        const char *pipeName = ZYZTOOLS_REPLAY_PIPE;
        if (WaitNamedPipeA(pipeName, 0))
            return true;
        return GetLastError() == ERROR_SEM_TIMEOUT;
    }

    void TerminateStaleAudioReplayHelpers()
    {
        HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snapshot == INVALID_HANDLE_VALUE)
            return;

        const DWORD currentProcessId = GetCurrentProcessId();
        PROCESSENTRY32W entry{};
        entry.dwSize = sizeof(entry);
        if (Process32FirstW(snapshot, &entry))
        {
            do
            {
                std::wstring exeName = entry.szExeFile;
                std::transform(
                    exeName.begin(),
                    exeName.end(),
                    exeName.begin(),
                    [](wchar_t c)
                    {
                        return static_cast<wchar_t>(towlower(c));
                    });
                if (exeName != L"preferredcyyzaudioreplay.exe" ||
                    entry.th32ProcessID == currentProcessId)
                {
                    continue;
                }

                HANDLE process = OpenProcess(
                    PROCESS_TERMINATE | SYNCHRONIZE,
                    FALSE,
                    entry.th32ProcessID);
                if (!process)
                    continue;

                TerminateProcess(process, 2);
                WaitForSingleObject(process, 1000);
                CloseHandle(process);
            } while (Process32NextW(snapshot, &entry));
        }
        CloseHandle(snapshot);
        CloseOwnedAudioReplayHandle();
    }

    std::string QuoteCommandLineArgument(const std::string &value)
    {
        std::string quoted = "\"";
        for (char c : value)
        {
            if (c == '"')
                quoted += '\\';
            quoted += c;
        }
        quoted += '"';
        return quoted;
    }

    bool SendAudioReplayCommand(
        const std::string &command,
        std::string &responseOut,
        std::string &errOut)
    {
        const char *pipeName = ZYZTOOLS_REPLAY_PIPE;
        HANDLE pipe = INVALID_HANDLE_VALUE;
        for (int i = 0; i < 20 && pipe == INVALID_HANDLE_VALUE; ++i)
        {
            pipe = CreateFileA(
                pipeName,
                GENERIC_READ | GENERIC_WRITE,
                0,
                nullptr,
                OPEN_EXISTING,
                0,
                nullptr);
            if (pipe == INVALID_HANDLE_VALUE)
                Sleep(25);
        }
        if (pipe == INVALID_HANDLE_VALUE)
        {
            errOut = "Audio replay helper is not responding.";
            return false;
        }

        DWORD written = 0;
        if (!WriteFile(
                pipe,
                command.data(),
                static_cast<DWORD>(command.size()),
                &written,
                nullptr) ||
            written != command.size())
        {
            errOut =
                "Could not send the audio replay command (Windows error " +
                std::to_string(GetLastError()) + ").";
            CloseHandle(pipe);
            return false;
        }
        FlushFileBuffers(pipe);

        char buffer[4096]{};
        DWORD read = 0;
        if (!ReadFile(pipe, buffer, sizeof(buffer) - 1, &read, nullptr))
        {
            errOut =
                "Could not read the audio replay response (Windows error " +
                std::to_string(GetLastError()) + ").";
            CloseHandle(pipe);
            return false;
        }
        CloseHandle(pipe);
        buffer[read] = '\0';
        responseOut.assign(buffer, read);
        if (responseOut.rfind("OK|", 0) == 0)
        {
            responseOut.erase(0, 3);
            return true;
        }
        if (responseOut.rfind("ERROR|", 0) == 0)
            responseOut.erase(0, 6);
        errOut = responseOut.empty() ? "Audio replay command failed." : responseOut;
        return false;
    }

    bool AudioReplayStatusMatchesConfig(
        const std::string &status,
        int seconds,
        int txRadioIntensity)
    {
        const int normalizedSeconds =
            std::max(30, std::min(seconds, 600));
        const int normalizedIntensity =
            std::max(0, std::min(txRadioIntensity, 100));
        return status.find(
                   "window " + std::to_string(normalizedSeconds) +
                   " sec") != std::string::npos &&
               status.find(
                   "controller radio " +
                   std::to_string(normalizedIntensity) + "%") !=
                   std::string::npos;
    }

    bool EnsureAudioReplayRunning(
        int seconds,
        int txRadioIntensity,
        const std::string &captureMode,
        const std::string &processNames,
        const std::string &outputFolder,
        std::string &errOut)
    {
        if (AudioReplayPipeAvailable())
        {
            std::string status;
            std::string statusError;
            if (SendAudioReplayCommand("status", status, statusError) &&
                AudioReplayStatusMatchesConfig(
                    status,
                    seconds,
                    txRadioIntensity))
            {
                return true;
            }

            std::string shutdownResponse;
            std::string shutdownError;
            SendAudioReplayCommand(
                "shutdown",
                shutdownResponse,
                shutdownError);
            CloseOwnedAudioReplayHandle();
            Sleep(250);
            if (AudioReplayPipeAvailable())
                TerminateStaleAudioReplayHelpers();
        }

        if (g_audioReplayProcessHandle &&
            WaitForSingleObject(g_audioReplayProcessHandle, 0) == WAIT_OBJECT_0)
        {
            CloseOwnedAudioReplayHandle();
        }
        if (!AudioReplayPipeAvailable())
        {
            TerminateStaleAudioReplayHelpers();
            Sleep(150);
            if (AudioReplayPipeAvailable())
                return true;
        }

        const std::string helperPath =
            GetThisDllDir() + "PreferredCYYZAudioReplay.exe";
        if (GetFileAttributesA(helperPath.c_str()) == INVALID_FILE_ATTRIBUTES)
        {
            errOut =
                "PreferredCYYZAudioReplay.exe not found beside the plugin DLL.";
            return false;
        }

        std::string commandLine =
            QuoteCommandLineArgument(helperPath) +
            " --seconds " + std::to_string(seconds) +
            " --tx-radio-intensity " +
            std::to_string(std::max(0, std::min(txRadioIntensity, 100))) +
            " --mode " + QuoteCommandLineArgument(captureMode) +
            " --processes " + QuoteCommandLineArgument(processNames) +
            " --output " + QuoteCommandLineArgument(outputFolder);
        std::vector<char> mutableCommand(
            commandLine.begin(),
            commandLine.end());
        mutableCommand.push_back('\0');

        STARTUPINFOA startup{};
        startup.cb = sizeof(startup);
        PROCESS_INFORMATION process{};
        const std::string workingDir = GetThisDllDir();
        if (!CreateProcessA(
                helperPath.c_str(),
                mutableCommand.data(),
                nullptr,
                nullptr,
                FALSE,
                CREATE_NO_WINDOW,
                nullptr,
                workingDir.empty() ? nullptr : workingDir.c_str(),
                &startup,
                &process))
        {
            errOut =
                "Could not auto-start PreferredCYYZAudioReplay.exe (Windows error " +
                std::to_string(GetLastError()) + ").";
            return false;
        }

        CloseHandle(process.hThread);
        CloseOwnedAudioReplayHandle();
        g_audioReplayProcessHandle = process.hProcess;

        for (int i = 0; i < 100; ++i)
        {
            Sleep(100);
            if (AudioReplayPipeAvailable())
            {
                std::string status;
                std::string statusError;
                if (SendAudioReplayCommand("status", status, statusError) &&
                    AudioReplayStatusMatchesConfig(
                        status,
                        seconds,
                        txRadioIntensity))
                {
                    return true;
                }
            }
            if (g_audioReplayProcessHandle &&
                WaitForSingleObject(g_audioReplayProcessHandle, 0) == WAIT_OBJECT_0)
            {
                DWORD exitCode = 0;
                GetExitCodeProcess(g_audioReplayProcessHandle, &exitCode);
                CloseOwnedAudioReplayHandle();
                errOut =
                    "PreferredCYYZAudioReplay.exe exited before its named pipe became available with the configured replay window (exit code " +
                    std::to_string(exitCode) + ").";
                return false;
            }
        }

        if (g_audioReplayProcessHandle)
        {
            TerminateProcess(g_audioReplayProcessHandle, 1);
            WaitForSingleObject(g_audioReplayProcessHandle, 1000);
            CloseOwnedAudioReplayHandle();
        }
        errOut =
            "PreferredCYYZAudioReplay.exe started but its named pipe did not report the configured replay window.";
        return false;
    }

    void ShutdownAudioReplay()
    {
        std::string response;
        std::string error;
        SendAudioReplayCommand("shutdown", response, error);

        if (g_audioReplayProcessHandle)
        {
            const DWORD waitResult =
                WaitForSingleObject(g_audioReplayProcessHandle, 3000);
            if (waitResult == WAIT_TIMEOUT)
            {
                TerminateProcess(g_audioReplayProcessHandle, 0);
                WaitForSingleObject(g_audioReplayProcessHandle, 1000);
            }
            CloseOwnedAudioReplayHandle();
        }
    }

    bool SendToBridge(const std::string &callsignRaw, const std::string &pdc, std::string &errOut)
    {
        std::string callsign = Upper(Trim(callsignRaw));
        if (callsign.empty())
        {
            errOut = "Bridge callsign empty.";
            return false;
        }

        const char *pipeName = ZYZTOOLS_BRIDGE_PIPE;
        if (!EnsureBridgeRunning(errOut))
            return false;

        HANDLE h = INVALID_HANDLE_VALUE;
        for (int i = 0; i < 20 && h == INVALID_HANDLE_VALUE; ++i)
        {
            h = CreateFileA(pipeName, GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
            if (h == INVALID_HANDLE_VALUE)
                Sleep(50);
        }
        if (h == INVALID_HANDLE_VALUE)
        {
            errOut = "Could not connect to PreferredCYYZPdcBridge (is it running?).";
            return false;
        }

        std::string payload;
        payload.reserve(callsign.size() + pdc.size() + 80);

        payload += "{\"callsign\":\"";
        for (char c : callsign)
        {
            if (c == '"' || c == '\\')
                payload += '\\';
            payload += c;
        }
        payload += "\",\"pdc\":\"";
        for (char c : pdc)
        {
            if (c == '"' || c == '\\')
                payload += '\\';
            if (c == '\n')
            {
                payload += "\\n";
                continue;
            }
            if (c == '\r')
                continue;
            payload += c;
        }
        payload += "\"}\n";

        DWORD written = 0;
        BOOL ok = WriteFile(h, payload.data(), (DWORD)payload.size(), &written, nullptr);
        CloseHandle(h);

        if (!ok || written != payload.size())
        {
            errOut = "Failed writing to PreferredCYYZPdcBridge pipe.";
            return false;
        }
        return true;
    }

    // Remove stepclimbs: "SLOJO/N0440F350" -> "SLOJO"
    static std::vector<std::string> RouteTokens_NoStepClimbs(const std::string &routeRaw)
    {
        std::string r = Upper(routeRaw);
        std::stringstream ss(r);
        std::string tok;

        std::vector<std::string> tokens;
        while (ss >> tok)
        {
            size_t slash = tok.find('/');
            if (slash != std::string::npos)
            {
                std::string left = tok.substr(0, slash);
                if (!left.empty())
                    tokens.push_back(left);
                continue;
            }
            if (tok.find('/') != std::string::npos)
                continue;
            tokens.push_back(tok);
        }
        return tokens;
    }

    static std::string JoinWrapped(const std::vector<std::string> &tokens, size_t maxLineLen)
    {
        std::ostringstream out;
        std::string line;

        auto flush = [&]()
        {
            if (!line.empty())
            {
                out << line << "\n";
                line.clear();
            }
        };

        for (const auto &t : tokens)
        {
            if (t.empty())
                continue;

            if (line.empty())
            {
                line = t;
            }
            else
            {
                if (line.size() + 1 + t.size() > maxLineLen)
                {
                    flush();
                    line = t;
                }
                else
                {
                    line += " " + t;
                }
            }
        }
        flush();

        std::string s = out.str();
        if (!s.empty() && s.back() == '\n')
            s.pop_back();
        return s;
    }

    // DLL directory (PreferredPDCFlag folder) – robust even if DLL name changes.
    static std::string GetThisDllDir()
    {
        HMODULE hm = nullptr;
        if (!GetModuleHandleExA(
                GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                (LPCSTR)&GetThisDllDir,
                &hm))
        {
            return "";
        }

        char path[MAX_PATH] = {0};
        if (!GetModuleFileNameA(hm, path, MAX_PATH))
            return "";

        std::string p(path);
        size_t slash = p.find_last_of("\\/");
        if (slash == std::string::npos)
            return "";
        return p.substr(0, slash + 1);
    }

    static std::string GetExeDir()
    {
        char exePath[MAX_PATH] = {0};
        if (!GetModuleFileNameA(nullptr, exePath, MAX_PATH))
            return "";

        std::string p(exePath);
        size_t slash = p.find_last_of("\\/");
        if (slash == std::string::npos)
            return "";
        return p.substr(0, slash + 1);
    }

    static bool FileExistsA_(const std::string &p)
    {
        DWORD attr = GetFileAttributesA(p.c_str());
        return (attr != INVALID_FILE_ATTRIBUTES) && !(attr & FILE_ATTRIBUTE_DIRECTORY);
    }

    static void PlayPdcSound(const std::string &soundFileName)
    {
        // Try plugin folder first, then EuroScope.exe folder
        std::string dllDir = GetThisDllDir();
        if (!dllDir.empty())
        {
            std::string full = dllDir + soundFileName;
            if (FileExistsA_(full))
            {
                PlaySoundA(full.c_str(), nullptr, SND_FILENAME | SND_ASYNC);
                return;
            }
        }

        std::string exeDir = GetExeDir();
        if (!exeDir.empty())
        {
            std::string full = exeDir + soundFileName;
            if (FileExistsA_(full))
            {
                PlaySoundA(full.c_str(), nullptr, SND_FILENAME | SND_ASYNC);
                return;
            }
        }
    }

    // Extract base SID name from something like "DEDKI5" -> "DEDKI"
    static std::string BaseSidName(const std::string &sidToken)
    {
        std::string u = Upper(sidToken);
        std::string base;
        for (char c : u)
        {
            if (c >= 'A' && c <= 'Z')
                base.push_back(c);
            else
                break;
        }
        return base;
    }

    static bool InList(const std::string &baseSid, const std::vector<std::string> &list)
    {
        for (const auto &item : list)
        {
            if (baseSid == item)
                return true;
        }
        return false;
    }

    // Runs when the clearance flag is set. The PDC identifier is removed;
    // non-conforming departures retain a plain NCD scratchpad marker.
    static bool ApplyClearanceHook(CFlightPlan fp, bool knownNcd, bool &ncdOut)
    {
        ncdOut = false;
        if (!fp.IsValid())
            return false;

        auto cad = fp.GetControllerAssignedData();

        std::string sp = cad.GetScratchPadString() ? cad.GetScratchPadString() : "";
        if (!IsLikelyPdcId(sp))
            return false;
        ncdOut = knownNcd || Upper(sp).find("NCD") != std::string::npos;

        CFlightPlanData fpd = fp.GetFlightPlanData();
        std::string baseSid = GetBaseSidFromFp(fpd);

        int clearedAlt = 5000;
        if (!baseSid.empty() && SID_BASES_CLEARED_3000.find(baseSid) != SID_BASES_CLEARED_3000.end())
            clearedAlt = 3000;

        cad.SetScratchPadString(ncdOut ? "NCD" : "");
        cad.SetClearedAltitude(clearedAlt);
        return true;
    }

} // namespace

class CZYZToolsPlugin final : public CPlugIn
{
public:
    CZYZToolsPlugin()
        : CPlugIn(COMPATIBILITY_CODE, ZYZTOOLS_PLUGIN_NAME, "1.2.6", "Charlie Yablon and Elliot Potts", "ZYZTools EuroScope controller tools")
    {
        RegisterTagItemType("CYYZ_PDC STATUS", TAG_PDC_FLAG_TYPE);
        RegisterTagItemType("CYYZ_PDC RWY", TAG_PDC_RUNWAY_TYPE);
        RegisterTagItemType("PDC Flag (legacy)", TAG_PDC_FLAG_LEGACY_TYPE);
        RegisterTagItemFunction("CYYZ_PDC SEND PDC", FUNC_PDC_GENERATE);
        RegisterTagItemFunction("CYYZ_PDC RESTORE FLAG", FUNC_PDC_RESTORE);
        RegisterTagItemFunction("Generate PDC (legacy)", FUNC_PDC_GENERATE_LEGACY);
        RegisterTagItemFunction("TEST: Trigger Incoming Message", FUNC_PDC_TEST);

        LoadConfig();
        StartHoppieWorker();
        std::string bridgeError;
        if (EnsureBridgeRunning(bridgeError))
        {
            WriteAuditLog("bridge_autostart", "result=ready");
        }
        else
        {
            WriteAuditLog("bridge_autostart", "result=failed error=\"" + bridgeError + "\"");
            DisplayUserMessage(
                "ZYZTools", "BRIDGE",
                bridgeError.c_str(), true, true, false, false, false);
        }

        if (m_cfg.audioReplayEnabled)
        {
            std::string audioError;
            if (EnsureAudioReplayService(audioError))
            {
                RefreshAudioReplayStatus();
                WriteAuditLog(
                    "audio_replay_autostart",
                    "result=ready seconds=" +
                        std::to_string(m_cfg.audioReplaySeconds) +
                        " mode=" + m_cfg.audioReplayCaptureMode);
            }
            else
            {
                m_audioReplayStatus = "ERROR // " + audioError;
                WriteAuditLog(
                    "audio_replay_autostart",
                    "result=failed error=\"" + audioError + "\"");
                DisplayUserMessage(
                    "ZYZTools",
                    "AUDIO REPLAY",
                    audioError.c_str(),
                    true,
                    true,
                    false,
                    false,
                    false);
            }
        }

        DisplayUserMessage(
            "ZYZTools", "OK",
            "Loaded. PDC column states: > idle, RX pending Hoppie request, TX normal sent, TXH Hoppie sent. "
            "Runway preview and PDC sending preserve an existing manual runway and mark SID/runway mismatches as NCD. "
            "Open the EuroScope-native settings console with .UI; no Electron application is required. "
            "Departure-list scratchpad/PDC status snapshots run every 10 seconds and restore after reconnects within 20 minutes. "
            "Clearance flag hook: When clearance received flag is set AND scratchpad has a PDC ID, the identifier is removed, NCD is retained for non-conforming departures, and cleared altitude is set (5000 or 3000 depending on SID).",
            true, true, false, false, false);
    }

    ~CZYZToolsPlugin() override
    {
        EndStatisticsSession("plugin unload");
        StopAudioRecordingPlayback();
        StopHoppieWorker();
        ShutdownAudioReplay();
        ShutdownBridge();
    }
    CRadarScreen *OnRadarScreenCreated(const char *sDisplayName, bool NeedRadarContent, bool GeoReferenced, bool CanBeSaved, bool CanBeCreated) override;

    void OnGetTagItem(CFlightPlan FlightPlan, CRadarTarget, int ItemCode, int,
                      char sItemString[16], int *pColorCode, COLORREF *pRGB, double *) override
    {
        if (ItemCode != TAG_PDC_FLAG_TYPE &&
            ItemCode != TAG_PDC_FLAG_LEGACY_TYPE &&
            ItemCode != TAG_PDC_RUNWAY_TYPE)
            return;

        // The PDC Flag item is configured on the Departure List, so rendering
        // this item is the membership signal for reconnect snapshots.
        NoteDepartureListAircraft(FlightPlan);

        CacheFp(FlightPlan);
        ObserveStatisticsFlightPlan(FlightPlan, true);

        std::string cs = Upper(Trim(FlightPlan.GetCallsign()));
        if (cs.empty())
        {
            strncpy_s(sItemString, 16, "", _TRUNCATE);
            if (pColorCode)
                *pColorCode = TAG_COLOR_DEFAULT;
            return;
        }

        g_lastRenderedCallsign = cs;
        g_lastRenderedTick = GetTickCount64();

        if (ItemCode == TAG_PDC_RUNWAY_TYPE)
        {
            bool ncd = false;
            std::string reason;
            std::string runway = SelectPdcRunway(FlightPlan, ncd, reason);
            if (runway.empty())
                runway = "-";
            if (ncd)
                runway += "*";
            strncpy_s(sItemString, 16, runway.c_str(), _TRUNCATE);
            if (pColorCode)
                *pColorCode = TAG_COLOR_DEFAULT;
            return;
        }

        const bool pendingHoppie = (m_hoppieMode && (m_pendingRequestId.find(cs) != m_pendingRequestId.end()));
        const auto sentIt = m_sentChannel.find(cs);
        const bool sentNormal = sentIt != m_sentChannel.end() && sentIt->second == SentChannel::Normal;
        const bool sentHoppie = sentIt != m_sentChannel.end() && sentIt->second == SentChannel::Hoppie;
        const ThemePalette theme = GetThemePalette(m_cfg.uiTheme);

        std::string encoded;
        const std::string state = pendingHoppie ? "RX" : sentHoppie ? "TXH"
                                                        : sentNormal  ? "TX"
                                                                      : ">";
        encoded.reserve(state.size() + 1 + cs.size());
        encoded += state;
        encoded += '|';
        encoded += cs;

        strncpy_s(sItemString, 16, encoded.c_str(), _TRUNCATE);

        if (pColorCode)
        {
            if (pendingHoppie && pRGB)
            {
                *pColorCode = TAG_COLOR_RGB_DEFINED;
                *pRGB = theme.rx;
            }
            else if ((sentNormal || sentHoppie) && pRGB)
            {
                *pColorCode = TAG_COLOR_RGB_DEFINED;
                *pRGB = theme.tx;
            }
            else
            {
                *pColorCode = TAG_COLOR_DEFAULT;
            }
        }
    }

    void OnFunctionCall(int FunctionId, const char *sItemString, POINT, RECT) override
    {
        if (HandleSettingsEdit(FunctionId, sItemString))
            return;

        if (FunctionId == FUNC_PDC_TEST)
        {
            TriggerIncomingPdcTest();
            return;
        }

        if (FunctionId != FUNC_PDC_GENERATE &&
            FunctionId != FUNC_PDC_GENERATE_LEGACY &&
            FunctionId != FUNC_PDC_RESTORE)
            return;

        std::string raw = sItemString ? sItemString : "";
        std::string cs;

        const auto bar = raw.find('|');
        if (bar != std::string::npos && bar + 1 < raw.size())
            cs = raw.substr(bar + 1);
        cs = Upper(Trim(cs));

        // Fallbacks
        if (cs.empty())
        {
            CFlightPlan fpASEL = FlightPlanSelectASEL();
            if (fpASEL.IsValid())
                cs = Upper(Trim(fpASEL.GetCallsign()));
            else
            {
                ULONGLONG now = GetTickCount64();
                if (!g_lastRenderedCallsign.empty() && (now - g_lastRenderedTick) < LAST_RENDERED_FALLBACK_MS)
                    cs = g_lastRenderedCallsign;
            }
        }

        cs = Upper(Trim(cs));

        if (cs.empty())
        {
            DisplayUserMessage("ZYZTools", "ERROR",
                               "Could not determine callsign from click. Click directly on the PDC cell.",
                               true, true, false, false, false);
            return;
        }

        if (FunctionId == FUNC_PDC_RESTORE)
        {
            TryRestoreDepartureSnapshot(FlightPlanSelect(cs.c_str()), cs);
            return;
        }

        RequestPdcSend(cs);
    }

    void OnFlightPlanDisconnect(CFlightPlan FlightPlan) override
    {
        std::string cs = Upper(Trim(FlightPlan.GetCallsign()));
        if (!cs.empty())
        {
            ObserveStatisticsDisconnect(FlightPlan);
            MarkDepartureAircraftDisconnected(FlightPlan, cs);

            m_sentChannel.erase(cs);
            m_lastFpCache.erase(cs);
            m_pendingRequestId.erase(cs);
            m_hoppieContextId.erase(cs);
            m_dualsApplied.erase(cs);
            m_spawnAssignments.erase(cs);
            m_ncdClearancePending.erase(cs);
            m_seenOnce.erase(cs);
            m_lastScratchpad.erase(cs);
        }
    }

    void OnFlightPlanFlightPlanDataUpdate(CFlightPlan FlightPlan) override
    {
        TryAssignArrivalRunway(FlightPlan);
        TryAssignSpawnRunway(FlightPlan);
        CacheFp(FlightPlan);
        ObserveStatisticsFlightPlan(FlightPlan, false);
    }

    void OnFlightPlanControllerAssignedDataUpdate(CFlightPlan FlightPlan, int DataType) override
    {
        if (DataType == CTR_DATA_TYPE_SCRATCH_PAD_STRING) TryAssignArrivalRunway(FlightPlan);
        CacheFp(FlightPlan);

        std::string cs = Upper(Trim(FlightPlan.GetCallsign()));
        auto cad = FlightPlan.GetControllerAssignedData();
        std::string sp = cad.GetScratchPadString() ? cad.GetScratchPadString() : "";
        sp = Upper(Trim(sp));

        // IFR release request sound hook from VATCANSitu:
        // tower clicking "Request IFR Release" prefixes scratchpad with "RREQ".
        if (!cs.empty() && DataType == CTR_DATA_TYPE_SCRATCH_PAD_STRING)
        {
            auto it = m_lastScratchpad.find(cs);
            const std::string oldSp = (it != m_lastScratchpad.end()) ? it->second : "";

            if (sp.rfind("RREQ", 0) == 0 && oldSp.rfind("RREQ", 0) != 0)
            {
                PlayConfiguredIfrSound();
            }

            m_lastScratchpad[cs] = sp;
        }

        // This is the "hook" for the built-in EuroScope "Set clearance received flag".
        if (DataType == CTR_DATA_TYPE_CLEARENCE_FLAG && FlightPlan.GetClearenceFlag())
        {
            bool ncd = false;
            const bool knownNcd = m_ncdClearancePending.find(cs) != m_ncdClearancePending.end();
            if (ApplyClearanceHook(FlightPlan, knownNcd, ncd))
            {
                m_savedIdentifier.erase(cs);
                m_ncdClearancePending.erase(cs);
                m_lastScratchpad[cs] = ncd ? "NCD" : "";
                WriteAuditLog(
                    "pdc_identifier_cleared",
                    "callsign=" + cs +
                        " reason=CLEARANCE_FLAG" +
                        " scratchpad=" + (ncd ? "NCD" : "EMPTY"));
            }
        }

        if (DataType == CTR_DATA_TYPE_GROUND_STATE)
        {
            const std::string groundState = Upper(Trim(FlightPlan.GetGroundState() ? FlightPlan.GetGroundState() : ""));
            ObserveStatisticsGroundState(FlightPlan, groundState);
            if (groundState == "PUSH" && IsLikelyPdcId(sp))
            {
                const bool knownNcd = m_ncdClearancePending.find(cs) != m_ncdClearancePending.end();
                cad.SetScratchPadString(knownNcd ? "NCD" : "");
                m_savedIdentifier.erase(cs);
                m_ncdClearancePending.erase(cs);
                m_lastScratchpad[cs] = knownNcd ? "NCD" : "";
                WriteAuditLog(
                    "pdc_identifier_cleared",
                    "callsign=" + cs +
                        " reason=PUSH" +
                        " scratchpad=" + (knownNcd ? "NCD" : "EMPTY"));
            }
        }
    }

    void OnRadarTargetPositionUpdate(CRadarTarget RadarTarget) override
    {
        TryAssignSpawnRunway(RadarTarget.GetCorrelatedFlightPlan());
        ObserveStatisticsRadarTarget(RadarTarget);
    }

    void OnTimer(int Counter) override
    {
        UpdateStatisticsConnectionState();
        if (Counter % 2 == 0)
            RefreshDepartureAssignmentConfig();
        PollSettingsActions();
        if (Counter % 2 == 0 && (m_cfg.runwayAssignmentConfig != "off" || m_cfg.arrivalAssignmentEnabled))
            for (CFlightPlan fp = FlightPlanSelectFirst(); fp.IsValid(); fp = FlightPlanSelectNext(fp))
            {
                TryAssignSpawnRunway(fp);
                TryAssignArrivalRunway(fp);
            }
        if ((Counter % DEPARTURE_SNAPSHOT_INTERVAL_SECONDS) == 0)
        {
            SnapshotDepartureListAircraft();
            if (m_cfg.audioReplayEnabled)
                RefreshAudioReplayStatus();
        }
        DrainHoppiePollResults();
    }

    // ---- CORRECT SDK SIGNATURE ----
    bool OnCompileCommand(const char *sCommandLine) override
    {
        if (!sCommandLine) return false;
        const std::string command = Upper(CollapseWhitespace(Trim(sCommandLine)));
        if (command == ".UI" || command == "." + ReplaySaveCommandKey())
            return HandleUiAction(sCommandLine);
        return false;
    }

    bool HandleUiAction(const char *sCommandLine)
    {
        if (!sCommandLine)
            return false;

        std::string cmd = Trim(sCommandLine);
        if (cmd.empty())
            return false;

        std::string u = Upper(CollapseWhitespace(cmd));
        if (!u.empty() && u[0] == '.')
            u = Upper(CollapseWhitespace(u.substr(1)));

        std::stringstream ss(u);
        std::string verb, arg;
        ss >> verb;
        ss >> arg;
        arg = Upper(Trim(arg));

        if (!u.empty() && u == ReplaySaveCommandKey())
        {
            SaveAudioReplay(true);
            return true;
        }

        if (verb == "UI" || verb == "SETTINGS" || verb == "SETTING")
        {
            std::string launchError;
            if (LaunchSettingsApp(launchError))
            {
                DisplayUserMessage(
                    "ZYZTools",
                    "SETTINGS",
                    "Electron settings app opened.",
                    true,
                    true,
                    false,
                    false,
                    false);
                return true;
            }
            WriteAuditLog("settings_app_launch", "result=failed error=\"" + launchError + "\"");

            if ((verb == "UI" || verb == "SETTINGS") && arg.empty())
            {
                m_settingsVisible = !m_settingsVisible;
            }
            else
            {
                m_settingsVisible = true;
                if (arg == "HOPPIE")
                    m_settingsTab = SettingsTab::Hoppie;
                else if (arg == "SIDS" || arg == "SID")
                    m_settingsTab = SettingsTab::SidMatrix;
                else if (arg == "RECORDINGS" || arg == "RECORDING" || arg == "RECS" || arg == "REPLAY")
                    m_settingsTab = SettingsTab::Recordings;
                else if (arg == "STATS" || arg == "STATISTICS")
                    m_settingsTab = SettingsTab::Statistics;
                else
                    m_settingsTab = SettingsTab::Operations;
            }

            WriteAuditLog(
                "settings_visibility",
                std::string("visible=") + (m_settingsVisible ? "1" : "0") +
                    " tab=" + (m_settingsTab == SettingsTab::Hoppie ? "hoppie" : m_settingsTab == SettingsTab::SidMatrix ? "sids"
                                                                 : m_settingsTab == SettingsTab::Recordings            ? "recordings"
                                                                 : m_settingsTab == SettingsTab::Statistics            ? "statistics"
                                                                                                                        : "operations") +
                    " theme=" + UiThemeConfigName(m_cfg.uiTheme));
            DisplayUserMessage("ZYZTools", "SETTINGS",
                               (std::string("Electron app not found; fallback native console ") + (m_settingsVisible ? "OPEN." : "CLOSED.")).c_str(),
                               true, true, false, false, false);
            return true;
        }


        if (verb == "CHECK") { ApplyDualsToExisting(true); return true; }
        if (verb == "LINKTEST") { TestHoppieLink(); return true; }
        if (verb == "TESTPDC") { TriggerIncomingPdcTest(); return true; }
        if (verb == "EXPORT") { ExportVisibleStatistics(true); return true; }
        if (verb == "REJECT" || verb == "REJECTFP")
        {
            if (!m_hoppieMode)
            {
                DisplayUserMessage("ZYZTools", "CMD",
                                   "Enable Hoppie in settings before rejecting a request.",
                                   true, true, false, false, false);
                return false;
            }

            if (arg.empty())
            {
                DisplayUserMessage("ZYZTools", "CMD",
                                   "Enter the aircraft callsign in the Hoppie menu.",
                                   true, true, false, false, false);
                return false;
            }

            if (!m_cfg.valid)
            {
                DisplayUserMessage("ZYZTools", "CMD",
                                   "Hoppie config invalid (check PreferredCYYZPdcPlugin.json).",
                                   true, true, false, false, false);
                return false;
            }

            std::string text;
            if (verb == "REJECTFP")
                text = "DEPARTURE CLEARANCE REQUEST REJECTED - FLIGHT PLAN INVALID - REVERT TO VOICE PROCEDURES";
            else
                text = "DEPARTURE CLEARANCE REQUEST REJECTED - REVERT TO VOICE PROCEDURES";

            std::string resp, err;
            if (!SendHoppie(arg, "telex", text, resp, err) || Upper(Trim(resp)).rfind("OK", 0) != 0)
            {
                WriteAuditLog("reject_failed", "callsign=" + arg + " type=" + verb + " error=\"" + err + "\"");
                DisplayUserMessage("ZYZTools", "CMD ERROR", err.c_str(), true, true, false, false, false);
                return false;
            }

            WriteAuditLog("reject_sent", "callsign=" + arg + " type=" + verb);
            DisplayUserMessage("ZYZTools", "CMD",
                               ("Sent TELEX to " + arg + ": " + text).c_str(),
                               true, true, false, false, false);
            return true;
        }

        return false;
    }

private:
    friend class CSettingsScreen;

    enum class SentChannel
    {
        Normal,
        Hoppie
    };

    struct Config
    {
        std::string logonCode;
        std::string stationCode = "CYYZ";
        int pollSeconds = 60;
        bool testMode = false;
        bool debugMode = false;
        bool confirmEveryPdc = false;
        bool pdcSoundEnabled = true;
        bool ifrSoundEnabled = true;
        bool sendSoundEnabled = true;
        bool audioReplayEnabled = true;
        bool valid = false;
        bool dualsAssignmentsLoaded = false;
        int audioReplaySeconds = 180;
        int audioReplayTxRadioIntensity = 70;
        std::string airportDirection = "WEST";
        std::string operation = "DUALS";
        std::string runwayAssignmentConfig = "off";
        bool arrivalAssignmentEnabled = false;
        std::string arrivalAssignmentFlow = "west";
        UiTheme uiTheme = UiTheme::Current;
        std::string audioReplayCaptureMode = "process";
        std::string audioReplayProcesses = "trackaudio.exe";
        std::string audioReplayFolder = "Recordings";
        std::string audioReplaySaveCommand = "replay save";
        std::string trackAudioVersion = "auto";
        std::string settingsAppPath;

        std::string pdcRequestSound = DEFAULT_PDC_SOUND_FILE;
        std::string ifrReleaseSound = DEFAULT_IFR_RELEASE_SOUND_FILE;
        std::string sendSound = DEFAULT_SEND_SOUND_FILE;

        std::vector<std::string> duals23Rwy23;
        std::vector<std::string> duals23Rwy24R;
        std::vector<std::string> duals05Rwy05;
        std::vector<std::string> duals05Rwy06L;
    };

    struct HoppieWorkerConfig
    {
        bool enabled = false;
        bool valid = false;
        int pollSeconds = 60;
        std::string logonCode;
        std::string stationCode;
    };

    struct HoppiePollResult
    {
        bool success = false;
        std::string response;
        std::string error;
    };

    enum class StatisticsEventType
    {
        Cleared,
        Departed,
        Landed
    };

    struct StatisticsEvent
    {
        StatisticsEventType type = StatisticsEventType::Cleared;
        std::time_t timestamp = 0;
        std::string callsign;
        std::string origin;
        std::string destination;
        std::string runway;
        std::string aircraftType;
        std::string source;
    };

    struct StatisticsBucket
    {
        int cleared = 0;
        int departures = 0;
        int landings = 0;
    };

    struct StatisticsSession
    {
        bool valid = false;
        bool active = false;
        std::time_t startedAt = 0;
        std::time_t endedAt = 0;
        std::string controller;
        int cleared = 0;
        int departures = 0;
        int landings = 0;
        std::vector<StatisticsEvent> events;
        std::vector<StatisticsBucket> buckets;
        std::string exportPath;
    };

    struct StatisticsAircraftState
    {
        bool clearanceFlag = false;
        bool clearedCounted = false;
        bool seenNearAirportGround = false;
        bool seenAirborne = false;
        bool departedCounted = false;
        bool landedCounted = false;
        std::string lastGroundState;
        int lastAltitude = 0;
        int lastGroundSpeed = 0;
        double lastDistanceNm = 9999.0;
    };

    struct AudioRecordingFile
    {
        std::string name;
        std::string path;
        ULONGLONG lastWrite = 0;
        ULONGLONG sizeBytes = 0;
    };

    Config m_cfg{};
    DualsMode m_dualsMode = DualsMode::Off;

    bool m_hoppieMode = false; // default OFF
    bool m_settingsVisible = false;
    bool m_settingsDirty = false;
    SettingsTab m_settingsTab = SettingsTab::Operations;
    RECT m_settingsRect{70, 70, 830, 760};
    std::string m_configPath;
    std::string m_lastLoadedConfig;
    std::atomic<bool> m_hoppieWorkerStop{false};
    std::thread m_hoppieWorker;
    std::mutex m_hoppieWorkerConfigMutex;
    HoppieWorkerConfig m_hoppieWorkerConfig;
    std::mutex m_hoppiePollResultMutex;
    std::deque<HoppiePollResult> m_hoppiePollResults;
    StatisticsSession m_statisticsSession;
    StatisticsSession m_lastStatisticsSession;
    std::unordered_map<std::string, StatisticsAircraftState> m_statisticsAircraft;
    std::string m_audioReplayStatus = "DISABLED";
    std::string m_playingRecording;
    int m_recordingsPageOffset = 0;

    struct CachedFp
    {
        std::string callsign, dep, dest, sid, rwy, squawk, actype, alt, route;

        std::string BuildPDCText_Bridge(const std::string &pdcId) const
        {
            std::ostringstream out;
            out
                << "TIMESTAMP " << TimestampDDMonYY_HHMM() << " "
                << "*PRE-DEPARTURE CLEARANCE* "
                << "FLT " << callsign << " " << dep << " "
                << actype << " FILED " << alt << " "
                << "XPRD " << squawk << " "
                << "USE SID " << sid << " "
                << "DEPARTURE RUNWAY " << rwy << " "
                << "DESTINATION " << dest << " "
                << "*** ADVISE ATC IF RUNUP REQUIRED *** "
                << "CONTACT ATC WITH IDENTIFIER " << pdcId << " "
                << sid << "/" << rwy << " "
                << route << "// FILED ROUTE END";
            return Upper(out.str());
        }

        std::string BuildPDCText_HoppieTelex(const std::string &pdcId) const
        {
            std::vector<std::string> toks = RouteTokens_NoStepClimbs(route);
            std::string routeWrapped = JoinWrapped(toks, 26);

            std::ostringstream out;
            out
                << "TIMESTAMP " << TimestampDDMonYY_HHMM() << "\n"
                << "*PRE-DEPARTURE CLEARANCE*\n"
                << "FLT " << callsign << " " << dep << "\n"
                << actype << " FILED " << alt << "\n"
                << "XPRD " << squawk << "\n"
                << "USE SID " << sid << "\n"
                << "DEPARTURE RUNWAY " << rwy << "\n"
                << "DESTINATION " << dest << "\n"
                << "*** ADVISE ATC IF RUNUP REQUIRED ***\n"
                << "CONTACT ATC WITH IDENTIFIER " << pdcId << "\n"
                << sid << "/" << rwy << "\n"
                << routeWrapped << "\n"
                << "// FILED ROUTE END";

            return Upper(out.str());
        }
    };

    struct DepartureReconnectSnapshot
    {
        std::string scratchpad;
        std::string pendingRequestId;
        bool sentOnce = false;
        bool ncdClearancePending = false;
        SentChannel sentChannel = SentChannel::Normal;
        bool awaitingReconnect = false;
        ULONGLONG capturedAt = 0;
        ULONGLONG disconnectedAt = 0;
    };

    struct PendingPdcConfirmation
    {
        bool active = false;
        std::string callsign;
        std::string reason;
    };

    void RefreshConfigValidity()
    {
        m_cfg.stationCode = Upper(Trim(m_cfg.stationCode));
        m_cfg.logonCode = Trim(m_cfg.logonCode);
        const std::string upperLogon = Upper(m_cfg.logonCode);
        const bool placeholder =
            upperLogon.find("REPLACE_WITH") != std::string::npos ||
            upperLogon == "YOUR_HOPPIE_LOGON_CODE";
        m_cfg.valid = !m_cfg.logonCode.empty() && !m_cfg.stationCode.empty() && !placeholder;
    }

    void WriteAuditLog(const std::string &event, std::string details)
    {
        for (char &c : details)
        {
            if (c == '\r' || c == '\n')
                c = ' ';
        }

        SYSTEMTIME now{};
        GetLocalTime(&now);
        std::ostringstream line;
        line << std::setfill('0')
             << std::setw(4) << now.wYear << "-"
             << std::setw(2) << now.wMonth << "-"
             << std::setw(2) << now.wDay << " "
             << std::setw(2) << now.wHour << ":"
             << std::setw(2) << now.wMinute << ":"
             << std::setw(2) << now.wSecond
             << " event=" << event;
        if (!details.empty())
            line << " " << details;
        line << "\n";

        const std::string pluginDir = GetThisDllDir();
        if (pluginDir.empty())
            return;

        std::ofstream log(pluginDir + "PreferredCYYZPdcPlugin.log", std::ios::binary | std::ios::app);
        if (log)
            log << line.str();
    }

    bool LaunchSettingsApp(std::string &errorOut)
    {
        std::vector<std::string> candidates;
        const std::string configured = Trim(m_cfg.settingsAppPath);
        if (!configured.empty())
        {
            const auto separator = configured.find_last_of("\\/");
            const std::string filename = separator == std::string::npos ? configured : configured.substr(separator + 1);
            if (Upper(filename) == Upper(ZYZTOOLS_APP_EXE)) candidates.push_back(configured);
#ifndef ZYZTOOLS_TEST_BUILD
            if (Upper(filename) == "PREFERRED CYYZ PDC SETTINGS.EXE") candidates.push_back(configured);
#endif
            if (separator != std::string::npos)
                candidates.push_back(configured.substr(0, separator + 1) + ZYZTOOLS_APP_EXE);
        }

        const std::string pluginDir = GetThisDllDir();
        if (!pluginDir.empty()) candidates.push_back(pluginDir + ZYZTOOLS_APP_EXE);
        char localAppData[MAX_PATH] = {0};
        const DWORD localLength = GetEnvironmentVariableA("LOCALAPPDATA", localAppData, MAX_PATH);
        if (localLength > 0 && localLength < MAX_PATH) {
            std::string base(localAppData);
            base += "\\Programs\\";
#ifdef ZYZTOOLS_TEST_BUILD
            candidates.push_back(base + "ZYZTools test\\ZYZTools test.exe");
            candidates.push_back(base + "zyztools-test\\ZYZTools test.exe");
#else
            candidates.push_back(base + "ZYZTools\\ZYZTools.exe");
            candidates.push_back(base + "zyztools\\ZYZTools.exe");
            candidates.push_back(base + "Preferred CYYZ PDC Settings\\ZYZTools.exe");
            candidates.push_back(base + "Preferred CYYZ PDC Settings\\Preferred CYYZ PDC Settings.exe");
#endif
        }

        for (const std::string &candidate : candidates)
        {
            if (candidate.empty() || !FileExistsA_(candidate))
                continue;

            std::string commandLine =
                "\"" + candidate + "\" --plugin-dir \"" + pluginDir + "\"";
            std::vector<char> mutableCommand(commandLine.begin(), commandLine.end());
            mutableCommand.push_back('\0');

            STARTUPINFOA startup{};
            startup.cb = sizeof(startup);
            PROCESS_INFORMATION process{};
            std::string workingDir = candidate;
            const size_t slash = workingDir.find_last_of("\\/");
            if (slash != std::string::npos)
                workingDir.resize(slash + 1);

            if (CreateProcessA(
                    candidate.c_str(),
                    mutableCommand.data(),
                    nullptr,
                    nullptr,
                    FALSE,
                    0,
                    nullptr,
                    workingDir.empty() ? nullptr : workingDir.c_str(),
                    &startup,
                    &process))
            {
                CloseHandle(process.hThread);
                CloseHandle(process.hProcess);
                WriteAuditLog("settings_app_launch", "result=success path=\"" + candidate + "\"");
                return true;
            }
        }

        errorOut = "ZYZTools settings app not found. Open ZYZTools test or use the fallback native console.";
        return false;
    }

    std::string NormalizeReplaySaveCommand(std::string value) const
    {
        value = Trim(value);
        while (!value.empty() && value[0] == '.')
            value = Trim(value.substr(1));
        value = CollapseWhitespace(value);
        if (value.empty())
            value = "replay save";
        return value;
    }

    std::string ReplaySaveCommandSuffix() const
    {
        return NormalizeReplaySaveCommand(m_cfg.audioReplaySaveCommand);
    }

    std::string ReplaySaveCommandDisplay() const
    {
        return "." + ReplaySaveCommandSuffix();
    }

    std::string ReplaySaveCommandKey() const
    {
        return Upper(ReplaySaveCommandSuffix());
    }

    void SetReplaySaveCommand(const std::string &value, bool announce)
    {
        const std::string normalized = NormalizeReplaySaveCommand(value);
        if (m_cfg.audioReplaySaveCommand == normalized)
            return;

        m_cfg.audioReplaySaveCommand = normalized;
        m_settingsDirty = true;
        WriteAuditLog(
            "config_changed",
            "field=audio_replay_save_command value=\"" + normalized + "\"");

        if (announce)
        {
            DisplayUserMessage(
                "ZYZTools",
                "AUDIO REPLAY",
                ("Replay save command set to " + ReplaySaveCommandDisplay() + ". Save config to persist.").c_str(),
                true,
                true,
                false,
                false,
                false);
        }
    }

    static ULONGLONG FileTimeToUnsignedLongLong(const FILETIME &fileTime)
    {
        ULARGE_INTEGER value{};
        value.LowPart = fileTime.dwLowDateTime;
        value.HighPart = fileTime.dwHighDateTime;
        return value.QuadPart;
    }

    std::string FormatRecordingSize(ULONGLONG bytes) const
    {
        std::ostringstream out;
        if (bytes >= 1024ULL * 1024ULL)
        {
            out << std::fixed << std::setprecision(1)
                << static_cast<double>(bytes) / (1024.0 * 1024.0)
                << " MB";
        }
        else
        {
            out << std::max<ULONGLONG>(1, (bytes + 1023ULL) / 1024ULL)
                << " KB";
        }
        return out.str();
    }

    std::vector<AudioRecordingFile> ListAudioRecordings() const
    {
        std::vector<AudioRecordingFile> files;
        std::string folder = AudioReplayOutputFolder();
        if (folder.empty())
            return files;

        std::string pattern = folder;
        if (!pattern.empty() && pattern.back() != '\\' && pattern.back() != '/')
            pattern += "\\";
        pattern += "*.wav";

        WIN32_FIND_DATAA data{};
        HANDLE find = FindFirstFileA(pattern.c_str(), &data);
        if (find == INVALID_HANDLE_VALUE)
            return files;

        do
        {
            if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)
                continue;

            AudioRecordingFile file;
            file.name = data.cFileName;
            file.path = folder;
            if (!file.path.empty() && file.path.back() != '\\' && file.path.back() != '/')
                file.path += "\\";
            file.path += file.name;
            file.lastWrite = FileTimeToUnsignedLongLong(data.ftLastWriteTime);
            file.sizeBytes =
                (static_cast<ULONGLONG>(data.nFileSizeHigh) << 32) |
                static_cast<ULONGLONG>(data.nFileSizeLow);
            files.push_back(file);
        } while (FindNextFileA(find, &data));

        FindClose(find);
        std::sort(
            files.begin(),
            files.end(),
            [](const AudioRecordingFile &a, const AudioRecordingFile &b)
            {
                if (a.lastWrite != b.lastWrite)
                    return a.lastWrite > b.lastWrite;
                return a.name > b.name;
            });
        return files;
    }

    void PlayAudioRecording(size_t index)
    {
        const auto files = ListAudioRecordings();
        if (index >= files.size())
        {
            DisplayUserMessage(
                "ZYZTools",
                "RECORDINGS",
                "That recording is no longer available.",
                true,
                true,
                false,
                false,
                false);
            return;
        }

        const AudioRecordingFile &file = files[index];
        if (!PlaySoundA(file.path.c_str(), nullptr, SND_FILENAME | SND_ASYNC | SND_NODEFAULT))
        {
            DisplayUserMessage(
                "ZYZTools",
                "RECORDINGS ERROR",
                ("Could not play " + file.name).c_str(),
                true,
                true,
                false,
                false,
                false);
            WriteAuditLog("recording_play", "result=failed path=\"" + file.path + "\"");
            return;
        }

        m_playingRecording = file.name;
        WriteAuditLog("recording_play", "result=started path=\"" + file.path + "\"");
        DisplayUserMessage(
            "ZYZTools",
            "RECORDINGS",
            ("Playing " + file.name).c_str(),
            true,
            true,
            false,
            false,
            false);
    }

    void StopAudioRecordingPlayback()
    {
        PlaySoundA(nullptr, nullptr, 0);
        if (!m_playingRecording.empty())
            WriteAuditLog("recording_play", "result=stopped name=\"" + m_playingRecording + "\"");
        m_playingRecording.clear();
    }

    int AudioReplayMinutes() const
    {
        return std::max(
            1,
            std::min(
                10,
                (m_cfg.audioReplaySeconds + 59) / 60));
    }

    void SetAudioReplayMinutes(int minutes)
    {
        minutes = std::max(1, std::min(10, minutes));
        const int seconds = minutes * 60;
        if (m_cfg.audioReplaySeconds == seconds)
            return;

        m_cfg.audioReplaySeconds = seconds;
        m_settingsDirty = true;
        WriteAuditLog(
            "config_changed",
            "field=audio_replay_minutes value=" + std::to_string(minutes));

        if (!m_cfg.audioReplayEnabled)
        {
            m_audioReplayStatus = "DISABLED";
            return;
        }

        ShutdownAudioReplay();
        std::string error;
        if (!EnsureAudioReplayService(error))
            m_audioReplayStatus = "ERROR // " + error;
        else
            RefreshAudioReplayStatus();
    }

    void AdjustAudioReplayMinutes(int delta)
    {
        SetAudioReplayMinutes(AudioReplayMinutes() + delta);
    }

    std::string AudioReplayOutputFolder() const
    {
        std::string folder = Trim(m_cfg.audioReplayFolder);
        if (folder.empty())
            folder = "Recordings";
        const bool absolute =
            (folder.size() >= 2 && folder[1] == ':') ||
            (folder.size() >= 2 &&
             folder[0] == '\\' &&
             folder[1] == '\\');
        if (absolute)
            return folder;
        return GetThisDllDir() + folder;
    }

    bool EnsureAudioReplayService(std::string &errOut)
    {
        if (!m_cfg.audioReplayEnabled)
        {
            errOut = "Audio replay is disabled. Use .REPLAY START to enable it.";
            return false;
        }
        return EnsureAudioReplayRunning(
            std::max(30, std::min(m_cfg.audioReplaySeconds, 600)),
            m_cfg.audioReplayTxRadioIntensity,
            m_cfg.audioReplayCaptureMode,
            m_cfg.audioReplayProcesses,
            AudioReplayOutputFolder(),
            errOut);
    }

    void RefreshAudioReplayStatus(bool announce = false)
    {
        if (!m_cfg.audioReplayEnabled)
        {
            m_audioReplayStatus = "DISABLED";
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools",
                    "AUDIO REPLAY",
                    "Audio replay is disabled. Use .REPLAY START to enable it.",
                    true,
                    true,
                    false,
                    false,
                    false);
            }
            return;
        }

        std::string error;
        if (!EnsureAudioReplayService(error))
        {
            m_audioReplayStatus = "ERROR // " + error;
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools",
                    "AUDIO REPLAY ERROR",
                    error.c_str(),
                    true,
                    true,
                    false,
                    false,
                    false);
            }
            return;
        }

        std::string response;
        if (!SendAudioReplayCommand("status", response, error))
        {
            m_audioReplayStatus = "ERROR // " + error;
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools",
                    "AUDIO REPLAY ERROR",
                    error.c_str(),
                    true,
                    true,
                    false,
                    false,
                    false);
            }
            return;
        }

        m_audioReplayStatus = response;
        if (announce)
        {
            DisplayUserMessage(
                "ZYZTools",
                "AUDIO REPLAY",
                m_audioReplayStatus.c_str(),
                true,
                true,
                false,
                false,
                false);
        }
    }

    void SaveAudioReplay(bool announce)
    {
        std::string error;
        if (!EnsureAudioReplayService(error))
        {
            m_audioReplayStatus = "ERROR // " + error;
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools",
                    "AUDIO REPLAY ERROR",
                    error.c_str(),
                    true,
                    true,
                    false,
                    false,
                    false);
            }
            WriteAuditLog(
                "audio_replay_save",
                "result=failed error=\"" + error + "\"");
            return;
        }

        std::string savedPath;
        if (!SendAudioReplayCommand("save", savedPath, error))
        {
            m_audioReplayStatus = "ERROR // " + error;
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools",
                    "AUDIO REPLAY ERROR",
                    error.c_str(),
                    true,
                    true,
                    false,
                    false,
                    false);
            }
            WriteAuditLog(
                "audio_replay_save",
                "result=failed error=\"" + error + "\"");
            return;
        }

        m_audioReplayStatus =
            "SAVED // " + savedPath;
        WriteAuditLog(
            "audio_replay_save",
            "result=success path=\"" + savedPath + "\"");
        if (announce)
        {
            DisplayUserMessage(
                "ZYZTools",
                "AUDIO REPLAY SAVED",
                savedPath.c_str(),
                true,
                true,
                false,
                false,
                false);
        }
    }

    void SetAudioReplayEnabled(bool enabled, bool announce)
    {
        if (m_cfg.audioReplayEnabled != enabled)
            m_settingsDirty = true;
        m_cfg.audioReplayEnabled = enabled;

        if (!enabled)
        {
            ShutdownAudioReplay();
            m_audioReplayStatus = "DISABLED";
            WriteAuditLog("audio_replay_enabled", "value=0");
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools",
                    "AUDIO REPLAY",
                    "Audio replay stopped. Save config to persist.",
                    true,
                    true,
                    false,
                    false,
                    false);
            }
            return;
        }

        std::string error;
        if (!EnsureAudioReplayService(error))
        {
            m_audioReplayStatus = "ERROR // " + error;
            WriteAuditLog(
                "audio_replay_enabled",
                "value=1 result=failed error=\"" + error + "\"");
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools",
                    "AUDIO REPLAY ERROR",
                    error.c_str(),
                    true,
                    true,
                    false,
                    false,
                    false);
            }
            return;
        }

        RefreshAudioReplayStatus();
        WriteAuditLog("audio_replay_enabled", "value=1 result=ready");
        if (announce)
        {
            DisplayUserMessage(
                "ZYZTools",
                "AUDIO REPLAY",
                "Audio replay started. Save config to persist.",
                true,
                true,
                false,
                false,
                false);
        }
    }

    static const char *StatisticsEventName(StatisticsEventType type)
    {
        switch (type)
        {
        case StatisticsEventType::Departed:
            return "DEPARTED";
        case StatisticsEventType::Landed:
            return "LANDED";
        default:
            return "CLEARED";
        }
    }

    bool IsStatisticsNetworkConnection() const
    {
        const int type = GetConnectionType();
        return type == CONNECTION_TYPE_DIRECT ||
               type == CONNECTION_TYPE_VIA_PROXY ||
               type == CONNECTION_TYPE_SWEATBOX;
    }

    const StatisticsSession *StatisticsForDisplay() const
    {
        if (m_statisticsSession.valid)
            return &m_statisticsSession;
        if (m_lastStatisticsSession.valid)
            return &m_lastStatisticsSession;
        return nullptr;
    }

    double StatisticsDurationHours(const StatisticsSession &session) const
    {
        const std::time_t end = session.active ? std::time(nullptr) : session.endedAt;
        if (session.startedAt <= 0 || end <= session.startedAt)
            return 0.0;
        return static_cast<double>(end - session.startedAt) / 3600.0;
    }

    double StatisticsMovementsPerHour(const StatisticsSession &session) const
    {
        const double hours = StatisticsDurationHours(session);
        if (hours <= 0.0)
            return 0.0;
        return static_cast<double>(session.departures + session.landings) / hours;
    }

    void EnsureStatisticsBucket(std::time_t timestamp)
    {
        if (!m_statisticsSession.active || m_statisticsSession.startedAt <= 0)
            return;
        const std::time_t elapsed = std::max<std::time_t>(0, timestamp - m_statisticsSession.startedAt);
        const size_t index = static_cast<size_t>(elapsed / (15 * 60));
        if (m_statisticsSession.buckets.size() <= index)
            m_statisticsSession.buckets.resize(index + 1);
    }

    void RecordStatisticsEvent(
        StatisticsEventType type,
        CFlightPlan fp,
        const std::string &source)
    {
        if (!m_statisticsSession.active || !fp.IsValid())
            return;

        const std::string callsign = Upper(Trim(fp.GetCallsign()));
        if (callsign.empty())
            return;

        const std::time_t now = std::time(nullptr);
        EnsureStatisticsBucket(now);
        const size_t bucketIndex =
            static_cast<size_t>(std::max<std::time_t>(0, now - m_statisticsSession.startedAt) / (15 * 60));

        StatisticsEvent event{};
        event.type = type;
        event.timestamp = now;
        event.callsign = callsign;
        const CFlightPlanData fpd = fp.GetFlightPlanData();
        event.origin = Upper(Trim(fpd.GetOrigin()));
        event.destination = Upper(Trim(fpd.GetDestination()));
        event.runway =
            type == StatisticsEventType::Landed
                ? Upper(Trim(fpd.GetArrivalRwy()))
                : Upper(Trim(fpd.GetDepartureRwy()));
        if (event.runway.empty())
            event.runway = RunwayFromRoute(fpd.GetRoute());
        event.aircraftType = Upper(Trim(fpd.GetAircraftFPType()));
        event.source = source;
        m_statisticsSession.events.push_back(event);

        StatisticsBucket &bucket = m_statisticsSession.buckets[bucketIndex];
        switch (type)
        {
        case StatisticsEventType::Cleared:
            ++m_statisticsSession.cleared;
            ++bucket.cleared;
            break;
        case StatisticsEventType::Departed:
            ++m_statisticsSession.departures;
            ++bucket.departures;
            break;
        case StatisticsEventType::Landed:
            ++m_statisticsSession.landings;
            ++bucket.landings;
            break;
        }

        WriteAuditLog(
            "statistics_event",
            "type=" + std::string(StatisticsEventName(type)) +
                " callsign=" + callsign +
                " source=\"" + source + "\"");
        ExportStatisticsSpreadsheet(m_statisticsSession, false, false);
    }

    void SeedStatisticsAircraft(CFlightPlan fp)
    {
        if (!fp.IsValid())
            return;
        const std::string callsign = Upper(Trim(fp.GetCallsign()));
        if (callsign.empty())
            return;

        StatisticsAircraftState &state = m_statisticsAircraft[callsign];
        state.clearanceFlag = fp.GetClearenceFlag();
        state.clearedCounted = state.clearanceFlag;
        state.lastGroundState = Upper(Trim(fp.GetGroundState() ? fp.GetGroundState() : ""));

        const CFlightPlanData fpd = fp.GetFlightPlanData();
        const bool departure = Upper(Trim(fpd.GetOrigin())) == "CYYZ";
        const bool arrival = Upper(Trim(fpd.GetDestination())) == "CYYZ";
        if (departure && state.lastGroundState == "DEPA")
            state.departedCounted = true;
        if (arrival && state.lastGroundState == "TAXI")
            state.landedCounted = true;

        const CRadarTarget target = fp.GetCorrelatedRadarTarget();
        if (!target.IsValid())
            return;
        const auto position = target.GetPosition();
        if (!position.IsValid())
            return;

        CPosition cyyz;
        cyyz.m_Latitude = 43.677717;
        cyyz.m_Longitude = -79.624819;
        state.lastAltitude = position.GetPressureAltitude();
        state.lastGroundSpeed = target.GetGS();
        state.lastDistanceNm = position.GetPosition().DistanceTo(cyyz);
        state.seenNearAirportGround =
            state.lastDistanceNm <= 8.0 &&
            state.lastAltitude <= 1300;
        state.seenAirborne =
            state.lastAltitude >= 1500 ||
            (state.lastDistanceNm > 8.0 && state.lastGroundSpeed >= 100);
        if (departure && state.seenAirborne)
            state.departedCounted = true;
    }

    void StartStatisticsSession()
    {
        if (m_statisticsSession.active)
            return;

        m_statisticsSession = {};
        m_statisticsSession.valid = true;
        m_statisticsSession.active = true;
        m_statisticsSession.startedAt = std::time(nullptr);
        const CController myself = ControllerMyself();
        if (myself.IsValid() && myself.GetCallsign())
            m_statisticsSession.controller = Upper(Trim(myself.GetCallsign()));
        m_statisticsSession.buckets.resize(1);
        m_statisticsAircraft.clear();

        for (CFlightPlan fp = FlightPlanSelectFirst(); fp.IsValid(); fp = FlightPlanSelectNext(fp))
            SeedStatisticsAircraft(fp);

        WriteAuditLog(
            "statistics_session_started",
            "controller=" + (m_statisticsSession.controller.empty() ? "UNKNOWN" : m_statisticsSession.controller));
        DisplayUserMessage(
            "ZYZTools", "STATISTICS",
            "Network session statistics recording started.",
            false, false, false, false, false);
        ExportStatisticsSpreadsheet(m_statisticsSession, false, false);
    }

    void EndStatisticsSession(const std::string &reason)
    {
        if (!m_statisticsSession.active)
            return;

        m_statisticsSession.active = false;
        m_statisticsSession.endedAt = std::time(nullptr);
        ExportStatisticsSpreadsheet(m_statisticsSession, false);
        m_lastStatisticsSession = m_statisticsSession;
        WriteAuditLog(
            "statistics_session_ended",
            "reason=\"" + reason + "\"" +
                " cleared=" + std::to_string(m_statisticsSession.cleared) +
                " departures=" + std::to_string(m_statisticsSession.departures) +
                " landings=" + std::to_string(m_statisticsSession.landings) +
                " export=\"" + m_statisticsSession.exportPath + "\"");
        m_statisticsAircraft.clear();
    }

    void UpdateStatisticsConnectionState()
    {
        const bool connected = IsStatisticsNetworkConnection();
        if (connected && !m_statisticsSession.active)
            StartStatisticsSession();
        else if (!connected && m_statisticsSession.active)
            EndStatisticsSession("network disconnected");
    }

    void ObserveStatisticsFlightPlan(CFlightPlan fp, bool allowClearanceEvent)
    {
        if (!m_statisticsSession.active || !fp.IsValid())
            return;
        const std::string callsign = Upper(Trim(fp.GetCallsign()));
        if (callsign.empty())
            return;

        StatisticsAircraftState &state = m_statisticsAircraft[callsign];
        const bool clearanceFlag = fp.GetClearenceFlag();
        const CFlightPlanData fpd = fp.GetFlightPlanData();
        if (allowClearanceEvent &&
            clearanceFlag &&
            !state.clearanceFlag &&
            !state.clearedCounted &&
            Upper(Trim(fpd.GetOrigin())) == "CYYZ")
        {
            state.clearedCounted = true;
            RecordStatisticsEvent(StatisticsEventType::Cleared, fp, "clearance flag");
        }
        state.clearanceFlag = clearanceFlag;
    }

    void ObserveStatisticsGroundState(CFlightPlan fp, const std::string &groundState)
    {
        if (!m_statisticsSession.active || !fp.IsValid())
            return;
        const std::string callsign = Upper(Trim(fp.GetCallsign()));
        if (callsign.empty())
            return;

        StatisticsAircraftState &state = m_statisticsAircraft[callsign];
        const CFlightPlanData fpd = fp.GetFlightPlanData();
        const std::string origin = Upper(Trim(fpd.GetOrigin()));
        const std::string destination = Upper(Trim(fpd.GetDestination()));
        if (origin == "CYYZ" &&
            groundState == "DEPA" &&
            state.lastGroundState != "DEPA" &&
            !state.departedCounted)
        {
            state.departedCounted = true;
            state.seenAirborne = true;
            RecordStatisticsEvent(StatisticsEventType::Departed, fp, "ground state DEPA");
        }
        if (destination == "CYYZ" &&
            groundState == "TAXI" &&
            state.lastGroundState != "TAXI" &&
            state.seenAirborne &&
            !state.landedCounted)
        {
            state.landedCounted = true;
            RecordStatisticsEvent(StatisticsEventType::Landed, fp, "ground state TAXI");
        }
        state.lastGroundState = groundState;
    }

    void ObserveStatisticsRadarTarget(CRadarTarget target)
    {
        if (!m_statisticsSession.active || !target.IsValid())
            return;
        const CFlightPlan fp = target.GetCorrelatedFlightPlan();
        if (!fp.IsValid())
            return;
        const std::string callsign = Upper(Trim(fp.GetCallsign()));
        if (callsign.empty())
            return;

        const auto position = target.GetPosition();
        if (!position.IsValid())
            return;

        const CFlightPlanData fpd = fp.GetFlightPlanData();
        const std::string origin = Upper(Trim(fpd.GetOrigin()));
        const std::string destination = Upper(Trim(fpd.GetDestination()));
        if (origin != "CYYZ" && destination != "CYYZ")
            return;

        CPosition cyyz;
        cyyz.m_Latitude = 43.677717;
        cyyz.m_Longitude = -79.624819;
        const double distance = position.GetPosition().DistanceTo(cyyz);
        const int altitude = position.GetPressureAltitude();
        const int groundSpeed = target.GetGS();
        const int verticalSpeed = target.GetVerticalSpeed();

        StatisticsAircraftState &state = m_statisticsAircraft[callsign];
        if (distance <= 8.0 && altitude <= 1300)
            state.seenNearAirportGround = true;
        if (altitude >= 1500 || (distance > 8.0 && groundSpeed >= 100))
            state.seenAirborne = true;

        if (origin == "CYYZ" &&
            state.seenNearAirportGround &&
            !state.departedCounted &&
            distance <= 15.0 &&
            altitude >= 1400 &&
            groundSpeed >= 90)
        {
            state.departedCounted = true;
            RecordStatisticsEvent(StatisticsEventType::Departed, fp, "radar airborne transition");
        }

        if (destination == "CYYZ" &&
            state.seenAirborne &&
            !state.landedCounted &&
            distance <= 2.5 &&
            altitude <= 900 &&
            groundSpeed <= 110 &&
            verticalSpeed < 500)
        {
            state.landedCounted = true;
            RecordStatisticsEvent(StatisticsEventType::Landed, fp, "radar landing transition");
        }

        state.lastAltitude = altitude;
        state.lastGroundSpeed = groundSpeed;
        state.lastDistanceNm = distance;
    }

    void ObserveStatisticsDisconnect(CFlightPlan fp)
    {
        if (!m_statisticsSession.active || !fp.IsValid())
            return;
        const std::string callsign = Upper(Trim(fp.GetCallsign()));
        const CFlightPlanData fpd = fp.GetFlightPlanData();
        if (callsign.empty() || Upper(Trim(fpd.GetDestination())) != "CYYZ")
            return;
        auto it = m_statisticsAircraft.find(callsign);
        if (it == m_statisticsAircraft.end())
            return;
        StatisticsAircraftState &state = it->second;
        if (state.seenAirborne &&
            !state.landedCounted &&
            state.lastDistanceNm <= 5.0 &&
            state.lastAltitude <= 1200)
        {
            state.landedCounted = true;
            RecordStatisticsEvent(StatisticsEventType::Landed, fp, "arrival disconnected near airport");
        }
    }

    bool ExportStatisticsSpreadsheet(
        StatisticsSession &session,
        bool announce,
        bool audit = true)
    {
        if (!session.valid)
        {
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools", "STATISTICS",
                    "No statistics session is available to export.",
                    true, true, false, false, false);
            }
            return false;
        }

        const std::string pluginDir = GetThisDllDir();
        if (pluginDir.empty())
            return false;
        const std::string statsDir = pluginDir + "Statistics";
        CreateDirectoryA(statsDir.c_str(), nullptr);

        const std::time_t exportEnd =
            session.active ? std::time(nullptr) : session.endedAt;
        const std::string stamp = FormatLocalTime(session.startedAt, "%Y%m%d_%H%M%S");
        const std::string path =
            statsDir + "\\CYYZ_Statistics_" + (stamp.empty() ? "session" : stamp) + ".xml";

        std::ofstream out(path, std::ios::binary | std::ios::trunc);
        if (!out)
        {
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools", "STATISTICS ERROR",
                    ("Could not create " + path).c_str(),
                    true, true, false, false, false);
            }
            return false;
        }

        auto stringCell = [&out](const std::string &value)
        {
            out << "<Cell><Data ss:Type=\"String\">" << XmlEscape(value) << "</Data></Cell>";
        };
        auto numberCell = [&out](double value)
        {
            out << "<Cell><Data ss:Type=\"Number\">" << std::fixed << std::setprecision(2) << value << "</Data></Cell>";
        };
        auto rowStart = [&out]()
        { out << "<Row>"; };
        auto rowEnd = [&out]()
        { out << "</Row>\n"; };

        out << "<?xml version=\"1.0\"?>\n"
            << "<?mso-application progid=\"Excel.Sheet\"?>\n"
            << "<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" "
            << "xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">\n";

        out << "<Worksheet ss:Name=\"Summary\"><Table>\n";
        rowStart();
        stringCell("CYYZ Session Statistics");
        rowEnd();
        const std::pair<std::string, std::string> summaryText[] = {
            {"Controller", session.controller.empty() ? "UNKNOWN" : session.controller},
            {"Session start", FormatLocalTime(session.startedAt, "%Y-%m-%d %H:%M:%S")},
            {"Session end", FormatLocalTime(exportEnd, "%Y-%m-%d %H:%M:%S")},
            {"Status", session.active ? "ACTIVE SNAPSHOT" : "COMPLETED"}};
        for (const auto &item : summaryText)
        {
            rowStart();
            stringCell(item.first);
            stringCell(item.second);
            rowEnd();
        }
        const std::pair<std::string, double> summaryNumbers[] = {
            {"Aircraft cleared", static_cast<double>(session.cleared)},
            {"Aircraft departed", static_cast<double>(session.departures)},
            {"Aircraft landed", static_cast<double>(session.landings)},
            {"Total movements", static_cast<double>(session.departures + session.landings)},
            {"Session hours", StatisticsDurationHours(session)},
            {"Average movements per hour", StatisticsMovementsPerHour(session)}};
        for (const auto &item : summaryNumbers)
        {
            rowStart();
            stringCell(item.first);
            numberCell(item.second);
            rowEnd();
        }
        out << "</Table></Worksheet>\n";

        out << "<Worksheet ss:Name=\"Movements\"><Table>\n";
        rowStart();
        for (const char *header : {"Timestamp", "Event", "Callsign", "Origin", "Destination", "Runway", "Aircraft Type", "Detection Source"})
            stringCell(header);
        rowEnd();
        for (const StatisticsEvent &event : session.events)
        {
            rowStart();
            stringCell(FormatLocalTime(event.timestamp, "%Y-%m-%d %H:%M:%S"));
            stringCell(StatisticsEventName(event.type));
            stringCell(event.callsign);
            stringCell(event.origin);
            stringCell(event.destination);
            stringCell(event.runway);
            stringCell(event.aircraftType);
            stringCell(event.source);
            rowEnd();
        }
        out << "</Table></Worksheet>\n";

        out << "<Worksheet ss:Name=\"Traffic Volume\"><Table>\n";
        rowStart();
        for (const char *header : {"Interval start", "Cleared", "Takeoffs", "Landings", "Movements"})
            stringCell(header);
        rowEnd();
        for (size_t i = 0; i < session.buckets.size(); ++i)
        {
            const StatisticsBucket &bucket = session.buckets[i];
            const std::time_t bucketStart =
                session.startedAt + static_cast<std::time_t>(i * 15 * 60);
            rowStart();
            stringCell(FormatLocalTime(bucketStart, "%Y-%m-%d %H:%M"));
            numberCell(bucket.cleared);
            numberCell(bucket.departures);
            numberCell(bucket.landings);
            numberCell(bucket.departures + bucket.landings);
            rowEnd();
        }
        out << "</Table></Worksheet>\n"
            << "</Workbook>\n";
        out.close();

        session.exportPath = path;
        if (announce)
        {
            DisplayUserMessage(
                "ZYZTools", "STATISTICS EXPORTED",
                ("Excel-compatible spreadsheet saved to " + path).c_str(),
                true, true, false, false, false);
        }
        if (audit)
            WriteAuditLog("statistics_exported", "path=\"" + path + "\"");
        return true;
    }

    void ExportVisibleStatistics(bool announce)
    {
        if (m_statisticsSession.valid)
        {
            if (m_statisticsSession.active)
            {
                StatisticsSession snapshot = m_statisticsSession;
                snapshot.endedAt = std::time(nullptr);
                if (ExportStatisticsSpreadsheet(snapshot, announce))
                    m_statisticsSession.exportPath = snapshot.exportPath;
            }
            else
            {
                ExportStatisticsSpreadsheet(m_statisticsSession, announce);
                m_lastStatisticsSession = m_statisticsSession;
            }
            return;
        }
        ExportStatisticsSpreadsheet(m_lastStatisticsSession, announce);
    }

    void SetHoppieMode(bool enabled, bool announce)
    {
        if (m_hoppieMode != enabled)
            m_settingsDirty = true;
        m_hoppieMode = enabled;
        if (!m_hoppieMode)
        {
            m_pendingRequestId.clear();
            m_hoppieContextId.clear();
        }
        UpdateHoppieWorkerConfig();
        WriteAuditLog("hoppie_mode", std::string("enabled=") + (m_hoppieMode ? "1" : "0"));

        if (!announce)
            return;

        DisplayUserMessage(
            "ZYZTools", "HOPPIE",
            m_hoppieMode
                ? "HOPPIE mode ON. Polling enabled; PDC requests will show BLUE R."
                : "HOPPIE mode OFF. Polling, auto-ACK, Hoppie PDC and reject messages are disabled.",
            true, true, false, false, false);
    }

    bool SetDualsMode(DualsMode mode, bool announce)
    {
        if (mode != DualsMode::Off && !m_cfg.dualsAssignmentsLoaded)
        {
            if (announce)
            {
                DisplayUserMessage(
                    "ZYZTools", "DUALS",
                    "No runway_assignments block loaded from PreferredCYYZPdcPlugin.json. DUALS mode not enabled.",
                    true, true, false, false, false);
            }
            return false;
        }

        if (m_dualsMode != mode)
            m_settingsDirty = true;
        m_dualsMode = mode;
        m_cfg.runwayAssignmentConfig = mode == DualsMode::Duals05 ? "east" : mode == DualsMode::Duals23 ? "west" : "off";
        if (mode == DualsMode::Duals05)
        {
            m_cfg.airportDirection = "EAST";
            m_cfg.operation = "DUALS";
        }
        else if (mode == DualsMode::Duals23)
        {
            m_cfg.airportDirection = "WEST";
            m_cfg.operation = "DUALS";
        }
        else if (m_cfg.operation == "DUALS")
        {
            if (m_cfg.airportDirection == "EAST")
                m_cfg.operation = "SINGLE 05";
            else if (m_cfg.airportDirection == "WEST")
                m_cfg.operation = "SINGLE 23";
        }
        WriteAuditLog(
            "duals_mode",
            std::string("mode=") +
                (mode == DualsMode::Duals05 ? "05" : mode == DualsMode::Duals23 ? "23"
                                                                            : "off"));

        if (announce)
        {
            std::string label = "OFF";
            if (mode == DualsMode::Duals05)
                label = "DUALS05";
            else if (mode == DualsMode::Duals23)
                label = "DUALS23";

            DisplayUserMessage(
                "ZYZTools", "DUALS",
                ("DUALS mode " + label + (mode == DualsMode::Off ? "." : " (use APPLY NOW for existing aircraft).")).c_str(),
                true, true, false, false, false);
        }

        return true;
    }

    std::vector<std::string> OperationsForDirection(const std::string &direction) const
    {
        const std::string normalized = Upper(Trim(direction));
        if (normalized == "WEST")
            return {"DUALS", "TRIPLES", "TRIPLE MAX", "SINGLE 23", "SINGLE 24R", "PIRSEC / PRISEC 23", "PIRSEC / PRISEC 24R"};
        if (normalized == "EAST")
            return {"DUALS", "TRIPLES", "TRIPLE MAX", "SINGLE 05", "SINGLE 06L", "PIRSEC / PRISEC 05", "PIRSEC / PRISEC 06L"};
        if (normalized == "NORTH")
            return {"SINGLE 33L", "SINGLE 33R", "PIRSEC / PRISEC 33L", "PIRSEC / PRISEC 33R"};
        return {"SINGLE 15L", "SINGLE 15R", "PIRSEC / PRISEC 15L", "PIRSEC / PRISEC 15R"};
    }

    void SetAirportDirection(const std::string &direction)
    {
        const std::string normalized = Upper(Trim(direction));
        if (normalized != "WEST" && normalized != "EAST" &&
            normalized != "NORTH" && normalized != "SOUTH")
            return;

        m_cfg.airportDirection = normalized;
        const auto operations = OperationsForDirection(normalized);
        if (std::find(operations.begin(), operations.end(), m_cfg.operation) == operations.end())
            m_cfg.operation = operations.front();
        m_dualsMode = normalized == "WEST" && m_cfg.operation == "DUALS"
                          ? DualsMode::Duals23
                      : normalized == "EAST" && m_cfg.operation == "DUALS"
                          ? DualsMode::Duals05
                          : DualsMode::Off;
        m_dualsApplied.clear();
        m_settingsDirty = true;
        WriteAuditLog("operation_changed", "direction=" + normalized + " operation=\"" + m_cfg.operation + "\"");
    }

    void SetUiTheme(UiTheme theme, bool announce)
    {
        if (m_cfg.uiTheme != theme)
            m_settingsDirty = true;
        m_cfg.uiTheme = theme;
        WriteAuditLog("config_changed", std::string("field=ui_theme value=") + UiThemeConfigName(m_cfg.uiTheme));
        if (announce)
        {
            DisplayUserMessage(
                "ZYZTools", "THEME",
                (std::string("UI theme changed to ") + UiThemeDisplayName(m_cfg.uiTheme) + ". Save config to persist.").c_str(),
                true, true, false, false, false);
        }
    }

    void CycleUiTheme()
    {
        UiTheme next = UiTheme::Current;
        switch (m_cfg.uiTheme)
        {
        case UiTheme::Current:
            next = UiTheme::Vatcan;
            break;
        case UiTheme::Vatcan:
            next = UiTheme::PluginCore;
            break;
        default:
            next = UiTheme::Current;
            break;
        }
        SetUiTheme(next, true);
    }

    void CycleAirportDirection()
    {
        const std::string direction = Upper(Trim(m_cfg.airportDirection));
        if (direction == "WEST")
            SetAirportDirection("EAST");
        else if (direction == "EAST")
            SetAirportDirection("NORTH");
        else if (direction == "NORTH")
            SetAirportDirection("SOUTH");
        else
            SetAirportDirection("WEST");
    }

    void CycleOperation()
    {
        const auto operations = OperationsForDirection(m_cfg.airportDirection);
        auto current = std::find(operations.begin(), operations.end(), m_cfg.operation);
        if (current == operations.end() || ++current == operations.end())
            m_cfg.operation = operations.front();
        else
            m_cfg.operation = *current;
        m_dualsMode = m_cfg.airportDirection == "WEST" && m_cfg.operation == "DUALS"
                          ? DualsMode::Duals23
                      : m_cfg.airportDirection == "EAST" && m_cfg.operation == "DUALS"
                          ? DualsMode::Duals05
                          : DualsMode::Off;
        m_dualsApplied.clear();
        m_settingsDirty = true;
        WriteAuditLog(
            "operation_changed",
            "direction=" + m_cfg.airportDirection + " operation=\"" + m_cfg.operation + "\"");
    }

    int ApplyDualsToExisting(bool announce)
    {
        int applied = 0;
        for (const auto &kv : m_lastFpCache)
        {
            CFlightPlan fp = FlightPlanSelect(kv.first.c_str());
            if (!fp.IsValid())
                continue;

            CFlightPlanData fpd = fp.GetFlightPlanData();
            if (MaybeApplyDualsOnce(fp, fpd, /*force=*/true))
                ++applied;
        }

        if (announce)
        {
            DisplayUserMessage(
                "ZYZTools", "DUALS APPLY",
                ("Applied current DUALS assignments to " + std::to_string(applied) + " flight(s).").c_str(),
                true, true, false, false, false);
        }
        WriteAuditLog("duals_apply", "applied=" + std::to_string(applied));
        return applied;
    }

    void TriggerIncomingPdcTest()
    {
        if (!m_hoppieMode)
        {
            DisplayUserMessage(
                "ZYZTools", "TEST",
                "HOPPIE is OFF. Enable it before testing an incoming request.",
                true, true, false, false, false);
            return;
        }

        HandleIncomingMessage("ACA236", "/data2/12345/0/WU/REQUEST PREDEPARTURE CLEARANCE", true);
        DisplayUserMessage(
            "ZYZTools", "TEST",
            "Injected a fake incoming request for ACA236.",
            true, true, false, false, false);
    }

    void TestHoppieLink()
    {
        RefreshConfigValidity();
        if (!m_cfg.valid)
        {
            DisplayUserMessage(
                "ZYZTools", "HOPPIE TEST",
                "Enter a valid Hoppie logon code and station first.",
                true, true, false, false, false);
            return;
        }

        std::string response;
        std::string error;
        if (!SendHoppie("SERVER", "ping", "", response, error))
        {
            DisplayUserMessage(
                "ZYZTools", "HOPPIE TEST FAILED",
                error.c_str(), true, true, false, false, false);
            return;
        }

        const bool ok = Upper(Trim(response)).rfind("OK", 0) == 0;
        DisplayUserMessage(
            "ZYZTools", ok ? "HOPPIE LINK OK" : "HOPPIE LINK REJECTED",
            response.c_str(), true, true, false, false, false);
        WriteAuditLog("hoppie_link_test", std::string("result=") + (ok ? "ok" : "rejected"));
    }

    void PlayConfiguredPdcSound(bool force = false)
    {
        if (force || m_cfg.pdcSoundEnabled)
            PlayPdcSound(m_cfg.pdcRequestSound);
    }

    void PlayConfiguredIfrSound(bool force = false)
    {
        if (force || m_cfg.ifrSoundEnabled)
            PlayPdcSound(m_cfg.ifrReleaseSound);
    }

    void PlayConfiguredSendSound(bool force = false)
    {
        if (force || m_cfg.sendSoundEnabled)
            PlayPdcSound(m_cfg.sendSound);
    }

    static std::string RunwayFromRoute(const std::string &route)
    {
        std::stringstream stream(Upper(Trim(route)));
        std::string first;
        while (stream >> first)
            if (!DepartureAssignment::Prefix(first)) break;
        const size_t slash = first.find('/');
        if (slash == std::string::npos || slash + 1 >= first.size())
            return "";
        std::string runway = first.substr(slash + 1);
        const size_t nextSlash = runway.find('/');
        if (nextSlash != std::string::npos)
            runway.resize(nextSlash);
        return Trim(runway);
    }


    static bool GetAircraftSpawnPosition(CFlightPlan fp, CPosition &positionOut)
    {
        if (!fp.IsValid())
            return false;

        CRadarTarget target = fp.GetCorrelatedRadarTarget();
        if (target.IsValid())
        {
            CRadarTargetPositionData targetPosition = target.GetPosition();
            if (targetPosition.IsValid())
            {
                const CPosition position = targetPosition.GetPosition();
                if (position.m_Latitude != 0.0 || position.m_Longitude != 0.0)
                {
                    positionOut = position;
                    return true;
                }
            }
        }

        CRadarTargetPositionData flightPlanPosition = fp.GetFPTrackPosition();
        if (flightPlanPosition.IsValid())
        {
            const CPosition position = flightPlanPosition.GetPosition();
            if (position.m_Latitude != 0.0 || position.m_Longitude != 0.0)
            {
                positionOut = position;
                return true;
            }
        }

        return false;
    }

    std::vector<std::string> ActiveRunways() const
    {
        const std::string direction = Upper(Trim(m_cfg.airportDirection));
        const std::string operation = Upper(Trim(m_cfg.operation));

        if (direction == "WEST")
        {
            if (operation.find("24R") != std::string::npos)
                return {"24R"};
            if (operation.find("SINGLE 23") != std::string::npos ||
                operation.find("PIRSEC 23") != std::string::npos ||
                operation.find("PRISEC 23") != std::string::npos)
                return {"23"};
            return {"23", "24R"};
        }
        if (direction == "EAST")
        {
            if (operation.find("06L") != std::string::npos)
                return {"06L"};
            if (operation.find("SINGLE 05") != std::string::npos ||
                operation.find("PIRSEC 05") != std::string::npos ||
                operation.find("PRISEC 05") != std::string::npos)
                return {"05"};
            return {"05", "06L"};
        }
        if (direction == "NORTH")
            return operation.find("33R") != std::string::npos ? std::vector<std::string>{"33R"}
                                                               : std::vector<std::string>{"33L"};
        if (direction == "SOUTH")
            return operation.find("15R") != std::string::npos ? std::vector<std::string>{"15R"}
                                                               : std::vector<std::string>{"15L"};
        return {};
    }

    std::string DefaultRunway() const
    {
        const auto runways = ActiveRunways();
        return runways.empty() ? "" : runways.front();
    }

    bool IsRunwayActive(const std::string &runway) const
    {
        const std::string normalized = Upper(Trim(runway));
        const auto runways = ActiveRunways();
        return std::find(runways.begin(), runways.end(), normalized) != runways.end();
    }

    std::string CalculateCorrectAssignedRunway(CFlightPlan fp, std::string &reasonOut) const
    {
        reasonOut.clear();
        if (m_cfg.runwayAssignmentConfig == "off")
            return "";
        if (!fp.IsValid())
            return "";

        CFlightPlanData fpd = fp.GetFlightPlanData();
        if (Upper(Trim(fpd.GetOrigin())) != "CYYZ")
            return "";

        const std::string direction = Upper(m_cfg.runwayAssignmentConfig);
        const std::string baseSid = DepartureAssignment::Sid(
            fpd.GetRoute(), fpd.GetSidName(),
            direction == "WEST" ? m_cfg.duals23Rwy23 : m_cfg.duals05Rwy05,
            direction == "WEST" ? m_cfg.duals23Rwy24R : m_cfg.duals05Rwy06L);
        const auto runway = DepartureAssignment::Runway(m_cfg.runwayAssignmentConfig, baseSid,
            direction == "WEST" ? m_cfg.duals23Rwy23 : m_cfg.duals05Rwy05,
            direction == "WEST" ? m_cfg.duals23Rwy24R : m_cfg.duals05Rwy06L);
        if (!runway.empty()) { reasonOut = direction + " SID assignment"; return runway; }

        reasonOut = "awaiting SID matrix match";
        return "";
    }


    std::string CalculateAssignedRunway(CFlightPlan fp, bool &ncdOut, std::string &reasonOut) const
    {
        ncdOut = false;
        reasonOut.clear();
        if (!fp.IsValid())
            return "";

        CFlightPlanData fpd = fp.GetFlightPlanData();
        if (Upper(Trim(fpd.GetOrigin())) != "CYYZ")
            return "";

        const auto cad = fp.GetControllerAssignedData();
        const std::string scratchpad = Upper(Trim(cad.GetScratchPadString() ? cad.GetScratchPadString() : ""));
        const bool manualNcd = scratchpad.find("NCD") != std::string::npos;
        std::string correctReason;
        const std::string correctRunway = CalculateCorrectAssignedRunway(fp, correctReason);

        if (manualNcd)
        {
            std::string manualRunway = RunwayFromRoute(fpd.GetRoute());
            if (manualRunway.empty())
                manualRunway = Upper(Trim(fpd.GetDepartureRwy()));
            if (!manualRunway.empty())
            {
                ncdOut = true;
                reasonOut = "manual NCD scratchpad override";
                return manualRunway;
            }
            ncdOut = true;
        }


        reasonOut = manualNcd ? "manual NCD normal fallback" : correctReason;
        return correctRunway;
    }

    std::string SelectPdcRunway(
        CFlightPlan fp,
        bool &ncdOut,
        std::string &reasonOut,
        bool *existingRunwayOut = nullptr) const
    {
        ncdOut = false;
        reasonOut.clear();
        if (existingRunwayOut)
            *existingRunwayOut = false;
        if (!fp.IsValid())
            return "";

        const CFlightPlanData fpd = fp.GetFlightPlanData();
        std::string existingRunway = RunwayFromRoute(fpd.GetRoute());
        std::string existingSource = "existing route runway";
        if (existingRunway.empty())
        {
            existingRunway = Upper(Trim(fpd.GetDepartureRwy()));
            existingSource = "existing EuroScope runway";
        }
        existingRunway = Upper(Trim(existingRunway));

        std::string correctReason;
        const std::string correctRunway =
            CalculateCorrectAssignedRunway(fp, correctReason);
        const auto cad = fp.GetControllerAssignedData();
        const char *scratchpadRaw = cad.GetScratchPadString();
        const std::string scratchpad =
            Upper(Trim(scratchpadRaw ? scratchpadRaw : ""));
        const bool manualNcd = scratchpad.find("NCD") != std::string::npos;
        bool calculatedNcd = false;
        std::string calculatedReason;
        const std::string calculatedRunway =
            CalculateAssignedRunway(fp, calculatedNcd, calculatedReason);

        if (!existingRunway.empty() && manualNcd)
        {
            if (existingRunwayOut)
                *existingRunwayOut = true;
            ncdOut = true;
            reasonOut = existingSource + "; manual NCD scratchpad override";
            return existingRunway;
        }

        if (existingRunway.empty() && calculatedNcd && !calculatedRunway.empty())
        {
            const bool alreadyOnCalculated =
                !existingRunway.empty() &&
                Upper(Trim(existingRunway)) == Upper(Trim(calculatedRunway));
            if (existingRunwayOut)
                *existingRunwayOut = alreadyOnCalculated;
            ncdOut = true;
            reasonOut = calculatedReason;
            if (!existingRunway.empty() && !alreadyOnCalculated)
            {
                reasonOut += "; overriding " + existingSource + " " + existingRunway;
            }
            return Upper(Trim(calculatedRunway));
        }

        if (!existingRunway.empty())
        {
            if (existingRunwayOut)
                *existingRunwayOut = true;

            const std::string comparisonRunway =
                !correctRunway.empty() ? correctRunway : calculatedRunway;
            const std::string comparisonReason =
                !correctRunway.empty() ? correctReason : calculatedReason;
            const bool runwayMismatch =
                !comparisonRunway.empty() &&
                Upper(Trim(existingRunway)) != Upper(Trim(comparisonRunway));
            ncdOut = runwayMismatch;
            if (runwayMismatch)
            {
                reasonOut =
                    existingSource + "; non-conforming against " +
                    comparisonRunway + " (" + comparisonReason + ")";
            }
            else
            {
                reasonOut = existingSource;
            }
            return existingRunway;
        }

        ncdOut = calculatedNcd;
        reasonOut = calculatedReason;
        return calculatedRunway;
    }

    bool AmendFlightPlanRunway(CFlightPlan fp, const std::string &runway, std::string &errorOut)
    {
        if (!fp.IsValid())
        {
            errorOut = "Invalid EuroScope flight plan.";
            return false;
        }

        CFlightPlanData fpd = fp.GetFlightPlanData();
        std::string route = Trim(fpd.GetRoute());
        const std::string newRoute = DepartureAssignment::WithRunway(route, Upper(Trim(runway)));
        if (newRoute.empty())
        {
            errorOut = "Flight plan route is empty; runway could not be written.";
            return false;
        }

        if (!fpd.SetRoute(newRoute.c_str()))
        {
            errorOut = "EuroScope SetRoute failed; PDC was not sent.";
            return false;
        }
        if (!fpd.AmendFlightPlan())
        {
            errorOut = "EuroScope AmendFlightPlan failed; PDC was not sent.";
            return false;
        }

        WriteAuditLog(
            "flight_plan_amended",
            "callsign=" + Upper(Trim(fp.GetCallsign())) +
                " runway=" + Upper(Trim(runway)) +
                " route=\"" + newRoute + "\"");
        return true;
    }

    void RequestPdcSend(const std::string &cs)
    {
        CFlightPlan fp = FlightPlanSelect(cs.c_str());
        if (!fp.IsValid())
        {
            DisplayUserMessage(
                "ZYZTools", "ERROR",
                ("FlightPlanSelect failed for " + cs).c_str(),
                true, true, false, false, false);
            return;
        }

        std::vector<std::string> reasons;
        const std::string groundState = Upper(Trim(fp.GetGroundState() ? fp.GetGroundState() : ""));
        if (!groundState.empty())
            reasons.push_back("departure status " + groundState);
        if (fp.GetClearenceFlag())
            reasons.push_back("clearance received flag set");
        if (m_sentChannel.find(cs) != m_sentChannel.end())
            reasons.push_back("PDC already sent");
        if (m_cfg.confirmEveryPdc)
            reasons.push_back("confirm-every-PDC enabled");

        if (!reasons.empty())
        {
            std::ostringstream reason;
            for (size_t i = 0; i < reasons.size(); ++i)
            {
                if (i)
                    reason << " / ";
                reason << reasons[i];
            }

            m_sendConfirmation.active = true;
            m_sendConfirmation.callsign = cs;
            m_sendConfirmation.reason = reason.str();
            WriteAuditLog("pdc_confirmation_opened", "callsign=" + cs + " reason=\"" + reason.str() + "\"");
            return;
        }

        ExecutePdcSend(cs);
    }

    void ExecutePdcSend(const std::string &cs)
    {
        CFlightPlan fp = FlightPlanSelect(cs.c_str());
        if (!fp.IsValid())
        {
            DisplayUserMessage(
                "ZYZTools", "ERROR",
                ("FlightPlanSelect failed for " + cs).c_str(),
                true, true, false, false, false);
            return;
        }

        bool ncd = false;
        bool existingRunway = false;
        std::string runwayReason;
        const std::string runway = SelectPdcRunway(fp, ncd, runwayReason, &existingRunway);
        if (runway.empty())
        {
            DisplayUserMessage(
                "ZYZTools", "RUNWAY ERROR",
                ("No departure runway available for " + cs + ". Assign a runway manually or enable Duals East/West in settings.").c_str(),
                true, true, false, false, false);
            return;
        }

        if (!existingRunway)
        {
            std::string amendError;
            if (!AmendFlightPlanRunway(fp, runway, amendError))
            {
                WriteAuditLog("pdc_send_failed", "callsign=" + cs + " stage=flight_plan error=\"" + amendError + "\"");
                DisplayUserMessage(
                    "ZYZTools", "RUNWAY ERROR",
                    amendError.c_str(), true, true, false, false, false);
                return;
            }
        }

        CacheFp(fp);
        auto cacheIt = m_lastFpCache.find(cs);
        if (cacheIt != m_lastFpCache.end())
        {
            cacheIt->second.rwy = runway;
            cacheIt->second.route = fp.GetFlightPlanData().GetRoute();
        }

        if (m_hoppieMode)
        {
            auto hopReqIt = m_pendingRequestId.find(cs);
            if (hopReqIt != m_pendingRequestId.end())
            {
                HandleHoppiePdc_Telex(fp, cs, hopReqIt->second, runway, ncd);
                return;
            }

            const auto sentIt = m_sentChannel.find(cs);
            const auto contextIt = m_hoppieContextId.find(cs);
            if (sentIt != m_sentChannel.end() &&
                sentIt->second == SentChannel::Hoppie &&
                contextIt != m_hoppieContextId.end())
            {
                HandleHoppiePdc_Telex(fp, cs, contextIt->second, runway, ncd);
                return;
            }
        }

        auto it = m_lastFpCache.find(cs);
        if (it == m_lastFpCache.end())
        {
            DisplayUserMessage(
                "ZYZTools", "ERROR",
                ("No cached data yet for " + cs + ". Wait 1 second and click again.").c_str(),
                true, true, false, false, false);
            return;
        }

        const std::string pdcId = GeneratePdcIdentifier(cs);
        const std::string pdc = it->second.BuildPDCText_Bridge(pdcId);

        std::string err;
        if (!SendToBridge(cs, pdc, err))
        {
            WriteAuditLog("pdc_send_failed", "channel=bridge callsign=" + cs + " error=\"" + err + "\"");
            DisplayUserMessage("ZYZTools", "ERROR", err.c_str(), true, true, false, false, false);
            return;
        }

        const std::string scratchpad = pdcId;
        fp.GetControllerAssignedData().SetScratchPadString(scratchpad.c_str());
        m_savedIdentifier[cs] = scratchpad;
        if (ncd)
            m_ncdClearancePending.insert(cs);
        else
            m_ncdClearancePending.erase(cs);
        m_sentChannel[cs] = SentChannel::Normal;
        PlayConfiguredSendSound();
        WriteAuditLog(
            "pdc_sent",
            "channel=bridge callsign=" + cs +
                " identifier=" + pdcId +
                " runway=" + runway +
                " ncd=" + (ncd ? "1" : "0") +
                " runway_source=\"" + runwayReason + "\"");
        DisplayUserMessage(
            "ZYZTools", "OK",
            ("Normal PDC sent for " + cs + " (ID " + scratchpad + (ncd ? ", NCD" : "") + ", RWY " + runway + ").").c_str(),
            true, true, false, false, false);
    }

    bool HandleSettingsEdit(int functionId, const char *value)
    {
        std::vector<std::string> *target = nullptr;
        const char *label = "";

        switch (functionId)
        {
        case FUNC_SIDS_EDIT_DUALS23_23:
            target = &m_cfg.duals23Rwy23;
            label = "DUALS23 RWY 23";
            break;
        case FUNC_SIDS_EDIT_DUALS23_24R:
            target = &m_cfg.duals23Rwy24R;
            label = "DUALS23 RWY 24R";
            break;
        case FUNC_SIDS_EDIT_DUALS05_05:
            target = &m_cfg.duals05Rwy05;
            label = "DUALS05 RWY 05";
            break;
        case FUNC_SIDS_EDIT_DUALS05_06L:
            target = &m_cfg.duals05Rwy06L;
            label = "DUALS05 RWY 06L";
            break;
        case FUNC_SETTINGS_EDIT_HOPPIE_LOGON:
            m_cfg.logonCode = Trim(value ? value : "");
            RefreshConfigValidity();
            UpdateHoppieWorkerConfig();
            m_settingsDirty = true;
            WriteAuditLog("config_changed", "field=hoppie_logon_code");
            return true;
        case FUNC_SETTINGS_EDIT_STATION_CODE:
            m_cfg.stationCode = Upper(Trim(value ? value : ""));
            RefreshConfigValidity();
            UpdateHoppieWorkerConfig();
            m_settingsDirty = true;
            WriteAuditLog("config_changed", "field=station_code value=" + m_cfg.stationCode);
            return true;
        case FUNC_SETTINGS_EDIT_POLL_SECONDS:
        {
            int seconds = 60;
            try
            {
                seconds = std::stoi(Trim(value ? value : ""));
            }
            catch (...)
            {
                seconds = 60;
            }
            m_cfg.pollSeconds = std::max(45, std::min(seconds, 75));
            UpdateHoppieWorkerConfig();
            m_settingsDirty = true;
            WriteAuditLog("config_changed", "field=poll_seconds value=" + std::to_string(m_cfg.pollSeconds));
            return true;
        }
        case FUNC_SETTINGS_EDIT_AUDIO_REPLAY_MINUTES:
        {
            int minutes = AudioReplayMinutes();
            try
            {
                minutes = std::stoi(Trim(value ? value : ""));
            }
            catch (...)
            {
                minutes = AudioReplayMinutes();
            }
            SetAudioReplayMinutes(minutes);
            return true;
        }
        case FUNC_SETTINGS_EDIT_REPLAY_SAVE_COMMAND:
            SetReplaySaveCommand(value ? value : "", true);
            return true;
        case FUNC_SETTINGS_EDIT_PDC_SOUND:
            m_cfg.pdcRequestSound = Trim(value ? value : "");
            m_settingsDirty = true;
            WriteAuditLog("config_changed", "field=pdc_request_sound value=\"" + m_cfg.pdcRequestSound + "\"");
            return true;
        case FUNC_SETTINGS_EDIT_IFR_SOUND:
            m_cfg.ifrReleaseSound = Trim(value ? value : "");
            m_settingsDirty = true;
            WriteAuditLog("config_changed", "field=ifr_release_sound value=\"" + m_cfg.ifrReleaseSound + "\"");
            return true;
        default:
            return false;
        }

        *target = ParseSidListText(value ? value : "");
        m_settingsDirty = true;
        m_dualsApplied.clear();
        WriteAuditLog("config_changed", std::string("field=") + label + " count=" + std::to_string(target->size()));

        DisplayUserMessage("ZYZTools", "SETTINGS",
                           (std::string(label) + " updated in memory. Click SAVE JSON to persist.").c_str(),
                           true, true, false, false, false);
        return true;
    }

    std::string SnapshotStatus(const DepartureReconnectSnapshot &snapshot) const
    {
        if (!snapshot.pendingRequestId.empty())
            return "RX";
        if (snapshot.sentOnce)
            return snapshot.sentChannel == SentChannel::Hoppie ? "TXH" : "TX";
        return ">";
    }

    void CaptureDepartureSnapshot(CFlightPlan fp, DepartureReconnectSnapshot &snapshot)
    {
        if (!fp.IsValid())
            return;

        const std::string cs = Upper(Trim(fp.GetCallsign()));
        if (cs.empty())
            return;

        const auto cad = fp.GetControllerAssignedData();
        const char *scratchpad = cad.GetScratchPadString();
        snapshot.scratchpad = scratchpad ? scratchpad : "";
        const auto sentIt = m_sentChannel.find(cs);
        snapshot.sentOnce = sentIt != m_sentChannel.end();
        if (snapshot.sentOnce)
            snapshot.sentChannel = sentIt->second;
        snapshot.ncdClearancePending =
            m_ncdClearancePending.find(cs) != m_ncdClearancePending.end();

        auto pendingIt = m_pendingRequestId.find(cs);
        snapshot.pendingRequestId = (pendingIt != m_pendingRequestId.end()) ? pendingIt->second : "";
        snapshot.capturedAt = GetTickCount64();
    }

    void AppendReconnectRestoreLog(const std::string &cs, const DepartureReconnectSnapshot &snapshot, ULONGLONG elapsedMs, bool scratchpadRestored)
    {
        WriteAuditLog(
            "reconnect_restore",
            "callsign=" + cs +
                " disconnected_seconds=" + std::to_string(elapsedMs / 1000ULL) +
                " scratchpad=\"" + snapshot.scratchpad + "\"" +
                " ncd_pending=" + (snapshot.ncdClearancePending ? "1" : "0") +
                " pdc_status=" + SnapshotStatus(snapshot) +
                " result=" + (scratchpadRestored ? "restored" : "scratchpad_failed"));

        DisplayUserMessage(
            "ZYZTools", "RECONNECT RESTORE",
            (cs + " restored after " + std::to_string(elapsedMs / 1000ULL) +
             "s; scratchpad='" + snapshot.scratchpad +
             "', PDC status=" + SnapshotStatus(snapshot) +
             (scratchpadRestored ? "." : " (scratchpad API failed)."))
                .c_str(),
            true, true, false, false, false);
    }

    void TryRestoreDepartureSnapshot(CFlightPlan fp, const std::string &cs)
    {
        auto snapshotIt = m_departureReconnectSnapshots.find(cs);
        if (snapshotIt == m_departureReconnectSnapshots.end() || !snapshotIt->second.awaitingReconnect)
            return;

        const ULONGLONG now = GetTickCount64();
        DepartureReconnectSnapshot &snapshot = snapshotIt->second;
        const ULONGLONG elapsed = now - snapshot.disconnectedAt;

        if (elapsed > RECONNECT_RESTORE_WINDOW_MS)
        {
            m_departureReconnectSnapshots.erase(snapshotIt);
            return;
        }

        const bool scratchpadRestored =
            fp.GetControllerAssignedData().SetScratchPadString(snapshot.scratchpad.c_str());

        if (!snapshot.pendingRequestId.empty())
        {
            m_pendingRequestId[cs] = snapshot.pendingRequestId;
            m_sentChannel.erase(cs);
        }
        else
        {
            m_pendingRequestId.erase(cs);
            if (snapshot.sentOnce)
                m_sentChannel[cs] = snapshot.sentChannel;
            else
                m_sentChannel.erase(cs);
        }

        if (snapshot.ncdClearancePending)
            m_ncdClearancePending.insert(cs);
        else
            m_ncdClearancePending.erase(cs);

        m_lastScratchpad[cs] = Upper(Trim(snapshot.scratchpad));
        snapshot.awaitingReconnect = false;
        snapshot.capturedAt = now;

        AppendReconnectRestoreLog(cs, snapshot, elapsed, scratchpadRestored);
    }


    void NoteDepartureListAircraft(CFlightPlan fp)
    {
        if (!fp.IsValid())
            return;

        const std::string cs = Upper(Trim(fp.GetCallsign()));
        if (cs.empty())
            return;

        TryRestoreDepartureSnapshot(fp, cs);
        TryAssignSpawnRunway(fp);
        m_departureListLastSeen[cs] = GetTickCount64();
    }

    void SnapshotDepartureListAircraft()
    {
        const ULONGLONG now = GetTickCount64();

        for (auto seenIt = m_departureListLastSeen.begin(); seenIt != m_departureListLastSeen.end();)
        {
            if ((now - seenIt->second) > DEPARTURE_LIST_RECENT_MS)
            {
                seenIt = m_departureListLastSeen.erase(seenIt);
                continue;
            }

            CFlightPlan fp = FlightPlanSelect(seenIt->first.c_str());
            if (fp.IsValid())
            {
                DepartureReconnectSnapshot &snapshot = m_departureReconnectSnapshots[seenIt->first];
                if (!snapshot.awaitingReconnect)
                    CaptureDepartureSnapshot(fp, snapshot);
            }

            ++seenIt;
        }

        for (auto snapshotIt = m_departureReconnectSnapshots.begin(); snapshotIt != m_departureReconnectSnapshots.end();)
        {
            const DepartureReconnectSnapshot &snapshot = snapshotIt->second;
            if (snapshot.awaitingReconnect &&
                (now - snapshot.disconnectedAt) > RECONNECT_RESTORE_WINDOW_MS)
            {
                snapshotIt = m_departureReconnectSnapshots.erase(snapshotIt);
                continue;
            }
            ++snapshotIt;
        }
    }

    void MarkDepartureAircraftDisconnected(CFlightPlan fp, const std::string &cs)
    {
        const ULONGLONG now = GetTickCount64();
        auto seenIt = m_departureListLastSeen.find(cs);
        if (seenIt == m_departureListLastSeen.end() ||
            (now - seenIt->second) > DEPARTURE_LIST_RECENT_MS)
        {
            return;
        }

        DepartureReconnectSnapshot &snapshot = m_departureReconnectSnapshots[cs];
        CaptureDepartureSnapshot(fp, snapshot);
        if (snapshot.capturedAt == 0)
            return;

        snapshot.disconnectedAt = now;
        snapshot.awaitingReconnect = true;
        m_departureListLastSeen.erase(seenIt);
    }

    void CacheFp(CFlightPlan fp)
    {
        if (!fp.IsValid())
            return;

        std::string cs = Upper(Trim(fp.GetCallsign()));
        if (cs.empty())
            return;

        CFlightPlanData fpd = fp.GetFlightPlanData();
        auto cad = fp.GetControllerAssignedData();

        m_seenOnce.insert(cs);

        CachedFp c{};
        c.callsign = cs;
        c.dep = Upper(Trim(fpd.GetOrigin()));
        c.dest = Upper(Trim(fpd.GetDestination()));
        c.sid = Upper(Trim(fpd.GetSidName()));
        c.rwy = Upper(Trim(fpd.GetDepartureRwy()));
        if (c.rwy.empty())
            c.rwy = RunwayFromRoute(fpd.GetRoute());
        if (c.sid.empty())
            c.sid = GetBaseSidFromFp(fpd);
        c.squawk = cad.GetSquawk();
        c.actype = Upper(Trim(fpd.GetAircraftFPType()));
        c.route = fpd.GetRoute();

        const int fa = fpd.GetFinalAltitude();
        if (fa > 18000)
            c.alt = "FL" + std::to_string(fa / 100);
        else
            c.alt = std::to_string(fa);

        m_lastFpCache[cs] = std::move(c);
    }

    void RefreshDepartureAssignmentConfig()
    {
        std::ifstream file(m_configPath, std::ios::binary);
        if (!file)
            return;
        const std::string json((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
        const std::string trimmed = Trim(json);
        if (trimmed.empty() || trimmed.back() != '}')
            return;
        if (json == m_lastLoadedConfig) return;
        LoadConfig(false);
    }

    void PollSettingsActions()
    {
        const std::string folder = GetThisDllDir();
        const std::string requestPath = folder + "SettingsAction.json";
        std::ifstream file(requestPath, std::ios::binary);
        if (!file) return;
        const std::string json((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
        file.close();
        const std::string complete = Trim(json);
        if (complete.empty() || complete.back() != '}') return;
        std::string id, action, callsign;
        int sentAt = 0;
        if (!JsonStringValue(json, "id", id) || id.empty()) return;
        JsonStringValue(json, "action", action);
        JsonStringValue(json, "callsign", callsign);
        JsonIntValue(json, "sent_at", sentAt);
        DeleteFileA(requestPath.c_str());
        bool ok = false;
        if (std::time(nullptr) - sentAt >= 0 && std::time(nullptr) - sentAt <= 15)
        {
            if (action == "apply") { ApplyDualsToExisting(true); ok = m_cfg.runwayAssignmentConfig != "off"; }
            else if (action == "link-test") { TestHoppieLink(); ok = true; }
            else if (action == "test-pdc") { TriggerIncomingPdcTest(); ok = true; }
            else if (action == "export") { ExportVisibleStatistics(true); ok = true; }
            else if (action == "reject" || action == "reject-fp")
            {
                const std::string cs = Upper(Trim(callsign));
                if (!cs.empty() && cs.size() <= 12 && std::all_of(cs.begin(), cs.end(), [](unsigned char c) { return std::isalnum(c); }))
                    ok = HandleUiAction(((action == "reject" ? "REJECT " : "REJECTFP ") + cs).c_str());
            }
        }
        const std::string responsePath = folder + "SettingsActionResult.json";
        std::ofstream response(responsePath + ".tmp", std::ios::binary | std::ios::trunc);
        response << "{\"id\":\"" << JsonEscape(id) << "\",\"ok\":" << (ok ? "true" : "false") << "}";
        response.close();
        MoveFileExA((responsePath + ".tmp").c_str(), responsePath.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH);
    }

    bool m_arrivalAssignmentInProgress = false;
    void TryAssignArrivalRunway(CFlightPlan fp)
    {
        if (!fp.IsValid() || !m_cfg.arrivalAssignmentEnabled || m_arrivalAssignmentInProgress) return;
        auto fpd = fp.GetFlightPlanData();
        if (Upper(Trim(fpd.GetDestination() ? fpd.GetDestination() : "")) != "CYYZ") return;
        const std::string sp = fp.GetControllerAssignedData().GetScratchPadString() ? fp.GetControllerAssignedData().GetScratchPadString() : "";
        const auto runway = ArrivalAssignment::Runway(true, m_cfg.arrivalAssignmentFlow, sp);
        if (runway.empty() || runway == Upper(Trim(fpd.GetArrivalRwy() ? fpd.GetArrivalRwy() : ""))) return;
        const std::string route = fpd.GetRoute() ? fpd.GetRoute() : "";
        const auto newRoute = ArrivalAssignment::WithRunway(route, runway, fpd.GetStarName() ? fpd.GetStarName() : "");
        if (newRoute.empty()) return;
        struct Guard { bool& flag; Guard(bool& f) : flag(f) { flag = true; } ~Guard() { flag = false; } } guard(m_arrivalAssignmentInProgress);
        if (fpd.SetRoute(newRoute.c_str()) && fpd.AmendFlightPlan())
            WriteAuditLog("arrival_runway_assigned", std::string("callsign=") + fp.GetCallsign() + " flow=" + m_cfg.arrivalAssignmentFlow + " runway=" + runway);
    }

    void TryAssignSpawnRunway(CFlightPlan fp)
    {
        if (!fp.IsValid() || m_cfg.runwayAssignmentConfig == "off")
            return;
        auto fpd = fp.GetFlightPlanData();
        MaybeApplyDualsOnce(fp, fpd, false);
    }

    bool MaybeApplyDualsOnce(CFlightPlan fp, CFlightPlanData &fpd, bool force)
    {
        if (!fp.IsValid() || m_cfg.runwayAssignmentConfig == "off" || fp.GetClearenceFlag())
            return false;
        std::string cs = Upper(Trim(fp.GetCallsign()));
        if (cs.empty())
            return false;
        if (m_sentChannel.find(cs) != m_sentChannel.end())
            return false;
        auto position = fp.GetFPTrackPosition();
        auto target = fp.GetCorrelatedRadarTarget();
        if (target.IsValid())
            position = target.GetPosition();
        if (!position.IsValid() || position.GetPressureAltitude() > 1500 ||
            (target.IsValid() && target.GetGS() > 60))
            return false;
        CPosition location;
        if (!GetAircraftSpawnPosition(fp, location))
            return false;

        if (!force)
        {
            if (m_dualsApplied.find(cs) != m_dualsApplied.end())
            {
                const auto previous = m_spawnAssignments.find(cs);
                if (previous == m_spawnAssignments.end())
                    return false; // Amendment callback currently in progress.
                std::string current = RunwayFromRoute(fpd.GetRoute());
                if (current.empty()) current = Upper(Trim(fpd.GetDepartureRwy()));
                if (current != previous->second.first)
                    return false; // Preserve controller/pilot amendments.
                std::string updatedReason;
                const auto expected = CalculateCorrectAssignedRunway(fp, updatedReason);
                if (expected.empty() || expected == previous->second.second)
                    return false;
            }
        }

        if (Upper(Trim(fpd.GetOrigin())) != "CYYZ")
            return false;

        bool ncd = false;
        std::string reason;
        const auto matrixRunway = CalculateCorrectAssignedRunway(fp, reason);
        if (matrixRunway.empty())
            return false;
        const std::string targetRwy = CalculateAssignedRunway(fp, ncd, reason);
        if (targetRwy.empty())
            return false;

        std::string error;
        // Guard synchronous EuroScope callbacks; failures remain eligible for retry.
        m_spawnAssignments.erase(cs);
        m_dualsApplied.insert(cs);
        if (!AmendFlightPlanRunway(fp, targetRwy, error))
        {
            m_dualsApplied.erase(cs);
            return false;
        }

        m_dualsApplied.insert(cs);
        m_spawnAssignments[cs] = {targetRwy, matrixRunway};
        if (ncd)
            fp.GetControllerAssignedData().SetScratchPadString("NCD");

        if (m_cfg.debugMode)
        {
            DisplayUserMessage("ZYZTools", "RUNWAY",
                               ("Amended " + cs + " to RWY " + targetRwy + " (" + reason + ")").c_str(),
                               false, false, false, false, false);
        }

        return true;
    }

    std::unordered_map<std::string, SentChannel> m_sentChannel;
    std::unordered_map<std::string, std::string> m_savedIdentifier;
    std::unordered_map<std::string, CachedFp> m_lastFpCache;
    std::unordered_map<std::string, std::string> m_pendingRequestId; // callsign -> msgId
    std::unordered_map<std::string, std::string> m_hoppieContextId;  // retained for TXH resend
    std::unordered_set<std::string> m_dualsApplied;
    std::unordered_map<std::string, std::pair<std::string, std::string>> m_spawnAssignments;
    std::unordered_set<std::string> m_ncdClearancePending;
    std::unordered_set<std::string> m_seenOnce;
    std::unordered_map<std::string, std::string> m_lastScratchpad;
    std::unordered_map<std::string, ULONGLONG> m_departureListLastSeen;
    std::unordered_map<std::string, DepartureReconnectSnapshot> m_departureReconnectSnapshots;
    PendingPdcConfirmation m_sendConfirmation;

    void UpdateHoppieWorkerConfig()
    {
        std::lock_guard<std::mutex> lock(m_hoppieWorkerConfigMutex);
        m_hoppieWorkerConfig.enabled = m_hoppieMode;
        m_hoppieWorkerConfig.valid = m_cfg.valid;
        m_hoppieWorkerConfig.pollSeconds = std::max(45, std::min(m_cfg.pollSeconds, 75));
        m_hoppieWorkerConfig.logonCode = m_cfg.logonCode;
        m_hoppieWorkerConfig.stationCode = m_cfg.stationCode;
    }

    void StartHoppieWorker()
    {
        UpdateHoppieWorkerConfig();
        m_hoppieWorkerStop = false;
        m_hoppieWorker = std::thread([this]()
        {
            ULONGLONG lastPoll = 0;
            while (!m_hoppieWorkerStop.load())
            {
                Sleep(250);

                HoppieWorkerConfig config;
                {
                    std::lock_guard<std::mutex> lock(m_hoppieWorkerConfigMutex);
                    config = m_hoppieWorkerConfig;
                }
                if (!config.enabled || !config.valid)
                {
                    lastPoll = 0;
                    continue;
                }

                const ULONGLONG now = GetTickCount64();
                if (lastPoll != 0 &&
                    (now - lastPoll) < static_cast<ULONGLONG>(config.pollSeconds) * 1000ULL)
                    continue;
                lastPoll = now;

                HoppiePollResult result;
                const std::string body =
                    "logon=" + UrlEncode(config.logonCode) +
                    "&from=" + UrlEncode(config.stationCode) +
                    "&to=SERVER&type=poll&packet=";
                result.success = HttpPostForm(
                    "www.hoppie.nl", "/acars/system/connect.html",
                    body, result.response, result.error);

                std::lock_guard<std::mutex> resultLock(m_hoppiePollResultMutex);
                if (m_hoppiePollResults.size() >= 8)
                    m_hoppiePollResults.pop_front();
                m_hoppiePollResults.push_back(std::move(result));
            }
        });
    }

    void StopHoppieWorker()
    {
        m_hoppieWorkerStop = true;
        if (m_hoppieWorker.joinable())
            m_hoppieWorker.join();
    }

    void DrainHoppiePollResults()
    {
        std::deque<HoppiePollResult> results;
        {
            std::lock_guard<std::mutex> lock(m_hoppiePollResultMutex);
            results.swap(m_hoppiePollResults);
        }

        for (const HoppiePollResult &result : results)
        {
            if (!m_hoppieMode)
                continue;
            if (!result.success)
            {
                if (m_cfg.debugMode)
                    DisplayUserMessage(
                        "ZYZTools", "POLL ERROR",
                        result.error.c_str(), true, false, false, false, false);
                continue;
            }

            if (Upper(Trim(result.response)).rfind("OK", 0) != 0)
            {
                if (m_cfg.debugMode)
                    DisplayUserMessage(
                        "ZYZTools", "POLL BAD",
                        result.response.c_str(), true, false, false, false, false);
                continue;
            }

            for (const auto &group : ExtractBraceGroups(result.response))
                ParseIncomingGroup(group);
        }
    }

    bool SendHoppie(const std::string &to, const std::string &type, const std::string &packet,
                    std::string &responseOut, std::string &errOut)
    {
        std::string body =
            "logon=" + UrlEncode(m_cfg.logonCode) +
            "&from=" + UrlEncode(m_cfg.stationCode) +
            "&to=" + UrlEncode(to) +
            "&type=" + UrlEncode(type) +
            "&packet=" + UrlEncode(packet);

        return HttpPostForm("www.hoppie.nl", "/acars/system/connect.html", body, responseOut, errOut);
    }

    void PollHoppie()
    {
        if (!m_hoppieMode)
            return;

        std::string resp, err;
        if (!SendHoppie("SERVER", "poll", "", resp, err))
        {
            if (m_cfg.debugMode)
                DisplayUserMessage("ZYZTools", "POLL ERROR", err.c_str(), true, false, false, false, false);
            return;
        }

        const std::string upperResp = Upper(resp);
        if (upperResp.rfind("OK", 0) != 0)
        {
            if (m_cfg.debugMode)
                DisplayUserMessage("ZYZTools", "POLL BAD", resp.c_str(), true, false, false, false, false);
            return;
        }

        const auto groups = ExtractBraceGroups(resp);
        for (const auto &g : groups)
            ParseIncomingGroup(g);
    }

    void ParseIncomingGroup(const std::string &group)
    {
        if (!m_hoppieMode)
            return;

        std::string text = Trim(group);
        if (text.empty())
            return;

        size_t i = 0;
        while (i < text.size() && std::isdigit((unsigned char)text[i]))
            ++i;
        if (i > 0 && i < text.size() && std::isspace((unsigned char)text[i]))
        {
            while (i < text.size() && std::isspace((unsigned char)text[i]))
                ++i;
            text = text.substr(i);
        }

        const size_t s1 = text.find(' ');
        if (s1 == std::string::npos)
            return;

        const std::string from = Upper(text.substr(0, s1));
        std::string rest = Trim(text.substr(s1 + 1));
        if (rest.empty())
            return;

        const size_t s2 = rest.find(' ');
        if (s2 == std::string::npos)
            return;

        const std::string tokenA = Upper(rest.substr(0, s2));
        const std::string rest2 = Trim(rest.substr(s2 + 1));

        if (tokenA == "CPDLC")
        {
            HandleIncomingMessage(from, rest2, false);
            return;
        }

        if (tokenA == "TELEX")
        {
            std::string packet = "/data2/TELEX_REQUEST/" + from + "/WU/" + rest2;
            HandleIncomingMessage(from, packet, false);
            return;
        }

        const size_t s3 = rest2.find(' ');
        if (s3 == std::string::npos)
            return;

        const std::string tokenB = Upper(rest2.substr(0, s3));
        if (tokenB != "CPDLC")
            return;

        const std::string to = tokenA;
        if (!m_cfg.stationCode.empty() && to != Upper(m_cfg.stationCode))
            return;

        const std::string packet = Trim(rest2.substr(s3 + 1));
        HandleIncomingMessage(from, packet, false);
    }

    void HandleIncomingMessage(const std::string &from, const std::string &packet, bool forceAccept = true)
    {
        if (!m_hoppieMode)
            return;

        const auto parts = Split(packet, '/');
        if (parts.size() < 3)
            return;
        if (parts[1] != "data2")
            return;

        const std::string msgId = parts[2];
        if (msgId.empty())
            return;

        const std::string freeText = (parts.size() > 3) ? Upper(parts.back()) : Upper(packet);
        if (!forceAccept)
        {
            if (freeText.find("REQUEST PREDEP CLEARANCE") == std::string::npos &&
                freeText.find("REQUEST PREDEPARTURE CLEARANCE") == std::string::npos &&
                freeText.find("PDC") == std::string::npos)
                return;
        }

        std::string targetCallsign = Upper(from);
        if (m_cfg.testMode)
            targetCallsign = "ACA236";

        auto existing = m_pendingRequestId.find(targetCallsign);
        if (existing != m_pendingRequestId.end() && existing->second == msgId)
            return;
        m_pendingRequestId[targetCallsign] = msgId;
        m_hoppieContextId[targetCallsign] = msgId;

        PlayConfiguredPdcSound();

        bool ackSent = false;
        if (m_cfg.valid && !m_cfg.testMode)
        {
            std::string resp, err;
            const std::string ack = "DEPARTURE CLEARANCE REQUEST RECEIVED - REQUEST BEING PROCESSED - STANDBY.";
            ackSent =
                SendHoppie(targetCallsign, "telex", ack, resp, err) &&
                Upper(Trim(resp)).rfind("OK", 0) == 0;
        }

        DisplayUserMessage("ZYZTools", "INCOMING",
                           (targetCallsign + " RX pending (MsgID " + msgId + ") - Auto-ACK " +
                            (ackSent ? "sent" : "not sent"))
                               .c_str(),
                           true, false, false, false, false);
    }

    void HandleHoppiePdc_Telex(
        CFlightPlan fp,
        const std::string &cs,
        const std::string &requestId,
        const std::string &runway,
        bool ncd)
    {
        if (!m_hoppieMode)
        {
            DisplayUserMessage("ZYZTools", "ERROR",
                               "HOPPIE is OFF.",
                               true, true, false, false, false);
            return;
        }

        CacheFp(fp);

        auto it = m_lastFpCache.find(cs);
        if (it == m_lastFpCache.end())
        {
            DisplayUserMessage("ZYZTools", "ERROR",
                               ("No cached data for " + cs).c_str(),
                               true, true, false, false, false);
            return;
        }

        const CachedFp &cfp = it->second;
        const std::string pdcId = GeneratePdcIdentifier(cs);
        const std::string pdcBody = cfp.BuildPDCText_HoppieTelex(pdcId);
        const std::string scratchpad = pdcId;

        if (m_cfg.testMode)
        {
            DisplayUserMessage("ZYZTools", "TEST MODE",
                               ("Would send TELEX PDC to " + cs + ":\n" + pdcBody).c_str(),
                               true, true, false, false, false);

            fp.GetControllerAssignedData().SetScratchPadString(scratchpad.c_str());
            m_savedIdentifier[cs] = scratchpad;
            if (ncd)
                m_ncdClearancePending.insert(cs);
            else
                m_ncdClearancePending.erase(cs);
            m_sentChannel[cs] = SentChannel::Hoppie;
            m_pendingRequestId.erase(cs);
            WriteAuditLog(
                "pdc_test_send",
                "channel=hoppie callsign=" + cs +
                    " identifier=" + pdcId +
                    " runway=" + runway +
                    " request_id=" + requestId);
            return;
        }

        if (!m_cfg.valid)
        {
            DisplayUserMessage("ZYZTools", "ERROR",
                               "Hoppie config invalid (PreferredCYYZPdcPlugin.json).",
                               true, true, false, false, false);
            return;
        }

        std::string resp, err;
        if (!SendHoppie(cs, "telex", pdcBody, resp, err) || Upper(Trim(resp)).rfind("OK", 0) != 0)
        {
            if (err.empty())
                err = "Hoppie rejected the TELEX send: " + resp;
            WriteAuditLog("pdc_send_failed", "channel=hoppie callsign=" + cs + " error=\"" + err + "\"");
            DisplayUserMessage("ZYZTools", "ERROR", err.c_str(), true, true, false, false, false);
            return;
        }

        fp.GetControllerAssignedData().SetScratchPadString(scratchpad.c_str());
        m_savedIdentifier[cs] = scratchpad;
        if (ncd)
            m_ncdClearancePending.insert(cs);
        else
            m_ncdClearancePending.erase(cs);
        m_sentChannel[cs] = SentChannel::Hoppie;
        m_pendingRequestId.erase(cs);
        PlayConfiguredSendSound();
        WriteAuditLog(
            "pdc_sent",
            "channel=hoppie callsign=" + cs +
                " identifier=" + pdcId +
                " runway=" + runway +
                " request_id=" + requestId);

        DisplayUserMessage("ZYZTools", "OK",
                           ("Hoppie TELEX PDC sent to " + cs + " (ID " + scratchpad + (ncd ? ", NCD" : "") + ", RWY " + runway + ")").c_str(),
                           true, true, false, false, false);
    }

    void LoadDualsAssignmentsFromJson(const std::string &json)
    {
        std::string dualsObj;
        bool legacy = false;
        if (!JsonObjectValue(json, "runway_assignments", dualsObj))
        {
            if (!JsonObjectValue(json, "duals_sid_assignments", dualsObj))
                return;
            legacy = true;
        }

        m_cfg.dualsAssignmentsLoaded = true;

        std::string modeObj;
        std::vector<std::string> parsed;

        if (JsonObjectValue(dualsObj, legacy ? "duals23" : "west", modeObj))
        {
            if (JsonStringArrayValue(modeObj, "23", parsed))
                m_cfg.duals23Rwy23 = NormalizeSidList(parsed);
            if (JsonStringArrayValue(modeObj, "24R", parsed))
                m_cfg.duals23Rwy24R = NormalizeSidList(parsed);
        }

        if (JsonObjectValue(dualsObj, legacy ? "duals05" : "east", modeObj))
        {
            if (JsonStringArrayValue(modeObj, "05", parsed))
                m_cfg.duals05Rwy05 = NormalizeSidList(parsed);
            if (JsonStringArrayValue(modeObj, "06L", parsed))
                m_cfg.duals05Rwy06L = NormalizeSidList(parsed);
        }
    }

    std::string BuildConfigJson() const
    {
        const char *dualsMode = "off";
        if (m_dualsMode == DualsMode::Duals05)
            dualsMode = "05";
        else if (m_dualsMode == DualsMode::Duals23)
            dualsMode = "23";

        std::ostringstream out;
        out
            << "{\n"
            << "  \"schema_version\": 1,\n"
            << "  \"build_channel\": \"" << ZYZTOOLS_CHANNEL << "\",\n"
            << "  \"hoppie_enabled\": " << (m_hoppieMode ? 1 : 0) << ",\n"
            << "  \"hoppie_logon_code\": \"" << JsonEscape(m_cfg.logonCode) << "\",\n"
            << "  \"station_code\": \"" << JsonEscape(m_cfg.stationCode) << "\",\n"
            << "  \"poll_seconds\": " << m_cfg.pollSeconds << ",\n"
            << "  \"airport_direction\": \"" << JsonEscape(m_cfg.airportDirection) << "\",\n"
            << "  \"operation\": \"" << JsonEscape(m_cfg.operation) << "\",\n"
            << "  \"runway_assignment_config\": \"" << JsonEscape(m_cfg.runwayAssignmentConfig) << "\",\n"
            << "  \"arrival_assignment_enabled\": " << (m_cfg.arrivalAssignmentEnabled ? 1 : 0) << ",\n"
            << "  \"arrival_assignment_flow\": \"" << JsonEscape(m_cfg.arrivalAssignmentFlow) << "\",\n"
            << "  \"ui_theme\": \"" << UiThemeConfigName(m_cfg.uiTheme) << "\",\n"
            << "  \"duals_mode\": \"" << dualsMode << "\",\n"
            << "  \"confirm_every_pdc\": " << (m_cfg.confirmEveryPdc ? 1 : 0) << ",\n"
            << "  \"pdc_sound_enabled\": " << (m_cfg.pdcSoundEnabled ? 1 : 0) << ",\n"
            << "  \"ifr_sound_enabled\": " << (m_cfg.ifrSoundEnabled ? 1 : 0) << ",\n"
            << "  \"send_sound_enabled\": " << (m_cfg.sendSoundEnabled ? 1 : 0) << ",\n"
            << "  \"audio_replay_enabled\": " << (m_cfg.audioReplayEnabled ? 1 : 0) << ",\n"
            << "  \"audio_replay_seconds\": " << m_cfg.audioReplaySeconds << ",\n"
            << "  \"audio_replay_tx_radio_intensity\": " << m_cfg.audioReplayTxRadioIntensity << ",\n"
            << "  \"audio_replay_capture_mode\": \"" << JsonEscape(m_cfg.audioReplayCaptureMode) << "\",\n"
            << "  \"audio_replay_processes\": \"" << JsonEscape(m_cfg.audioReplayProcesses) << "\",\n"
            << "  \"audio_replay_folder\": \"" << JsonEscape(m_cfg.audioReplayFolder) << "\",\n"
            << "  \"audio_replay_save_command\": \"" << JsonEscape(ReplaySaveCommandSuffix()) << "\",\n"
            << "  \"trackaudio_version\": \"" << JsonEscape(m_cfg.trackAudioVersion) << "\",\n"
            << "  \"settings_app_path\": \"" << JsonEscape(m_cfg.settingsAppPath) << "\",\n"
            << "  \"test_mode\": " << (m_cfg.testMode ? 1 : 0) << ",\n"
            << "  \"debug_mode\": " << (m_cfg.debugMode ? 1 : 0) << ",\n"
            << "  \"pdc_request_sound\": \"" << JsonEscape(m_cfg.pdcRequestSound) << "\",\n"
            << "  \"ifr_release_sound\": \"" << JsonEscape(m_cfg.ifrReleaseSound) << "\",\n"
            << "  \"send_sound\": \"" << JsonEscape(m_cfg.sendSound) << "\",\n"
            << "  \"runway_assignments\": {\n"
            << "    \"west\": {\n"
            << "      \"23\": " << JsonArray(m_cfg.duals23Rwy23) << ",\n"
            << "      \"24R\": " << JsonArray(m_cfg.duals23Rwy24R) << "\n"
            << "    },\n"
            << "    \"east\": {\n"
            << "      \"05\": " << JsonArray(m_cfg.duals05Rwy05) << ",\n"
            << "      \"06L\": " << JsonArray(m_cfg.duals05Rwy06L) << "\n"
            << "    }\n"
            << "  }\n"
            << "}\n";
        return out.str();
    }

    bool SaveConfig(std::string &errOut)
    {
        if (m_configPath.empty())
        {
            std::string pluginDir = GetThisDllDir();
            if (pluginDir.empty())
            {
                errOut = "Could not determine plugin DLL directory.";
                return false;
            }
            m_configPath = pluginDir + "PreferredCYYZPdcPlugin.json";
        }

        const std::string tempPath = m_configPath + ".tmp";
        std::ofstream f(tempPath, std::ios::binary | std::ios::trunc);
        if (!f)
        {
            errOut = "Could not open temporary config for writing: " + tempPath;
            return false;
        }

        f << BuildConfigJson();
        if (!f)
        {
            errOut = "Failed writing config: " + tempPath;
            return false;
        }
        f.close();

        if (GetFileAttributesA(m_configPath.c_str()) != INVALID_FILE_ATTRIBUTES)
            CopyFileA(m_configPath.c_str(), (m_configPath + ".bak").c_str(), FALSE);
        if (!MoveFileExA(tempPath.c_str(), m_configPath.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH))
        {
            errOut = "Could not replace config atomically (Windows error " + std::to_string(GetLastError()) + ").";
            DeleteFileA(tempPath.c_str());
            return false;
        }

        m_cfg.dualsAssignmentsLoaded = true;
        WriteAuditLog("config_saved", "path=\"" + m_configPath + "\"");
        return true;
    }

    void LoadConfig(bool startup = true)
    {
        std::string pluginDir = GetThisDllDir();
        if (pluginDir.empty())
        {
            DisplayUserMessage("ZYZTools", "CONFIG ERROR",
                               "Could not determine plugin DLL directory.",
                               true, true, false, false, false);
            return;
        }

        m_configPath = pluginDir + "PreferredCYYZPdcPlugin.json";
        std::ifstream f(m_configPath, std::ios::binary);

        if (!f)
        {
            const std::string legacyPath = pluginDir + "PreferredPDCPlugin.json";
            f.clear();
            f.open(legacyPath, std::ios::binary);
            if (!f)
            {
                DisplayUserMessage("ZYZTools", "CONFIG",
                                   ("Config not found: " + m_configPath).c_str(),
                                   true, true, false, false, false);
                return;
            }
            WriteAuditLog("config_migration", "source=\"" + legacyPath + "\" target=\"" + m_configPath + "\"");
        }

        std::ostringstream buf;
        buf << f.rdbuf();
        const std::string json = buf.str();
        m_lastLoadedConfig = json;

        if (json.empty())
        {
            DisplayUserMessage("ZYZTools", "CONFIG ERROR",
                               "Config file is empty",
                               true, true, false, false, false);
            return;
        }

        JsonStringValue(json, "hoppie_logon_code", m_cfg.logonCode);
        JsonStringValue(json, "station_code", m_cfg.stationCode);
        JsonIntValue(json, "poll_seconds", m_cfg.pollSeconds);
        JsonStringValue(json, "airport_direction", m_cfg.airportDirection);
        JsonStringValue(json, "operation", m_cfg.operation);
        m_cfg.runwayAssignmentConfig = "off";
        JsonStringValue(json, "runway_assignment_config", m_cfg.runwayAssignmentConfig);
        int arrivalEnabled = 0;
        JsonIntValue(json, "arrival_assignment_enabled", arrivalEnabled);
        m_cfg.arrivalAssignmentEnabled = arrivalEnabled == 1;
        m_cfg.arrivalAssignmentFlow = "west";
        JsonStringValue(json, "arrival_assignment_flow", m_cfg.arrivalAssignmentFlow);
        if (m_cfg.arrivalAssignmentFlow != "east" && m_cfg.arrivalAssignmentFlow != "north" && m_cfg.arrivalAssignmentFlow != "south") m_cfg.arrivalAssignmentFlow = "west";
        if (m_cfg.runwayAssignmentConfig != "east" && m_cfg.runwayAssignmentConfig != "west")
            m_cfg.runwayAssignmentConfig = "off";
        else
        {
            m_cfg.airportDirection = Upper(m_cfg.runwayAssignmentConfig);
            m_cfg.operation = "DUALS";
        }
        JsonStringValue(
            json,
            "audio_replay_capture_mode",
            m_cfg.audioReplayCaptureMode);
        JsonStringValue(
            json,
            "audio_replay_processes",
            m_cfg.audioReplayProcesses);
        JsonStringValue(
            json,
            "audio_replay_folder",
            m_cfg.audioReplayFolder);
        JsonStringValue(
            json,
            "audio_replay_save_command",
            m_cfg.audioReplaySaveCommand);
        JsonStringValue(
            json,
            "trackaudio_version",
            m_cfg.trackAudioVersion);
        JsonStringValue(
            json,
            "settings_app_path",
            m_cfg.settingsAppPath);
        JsonIntValue(
            json,
            "audio_replay_seconds",
            m_cfg.audioReplaySeconds);
        JsonIntValue(
            json,
            "audio_replay_tx_radio_intensity",
            m_cfg.audioReplayTxRadioIntensity);
        std::string savedUiTheme;
        if (JsonStringValue(json, "ui_theme", savedUiTheme))
            m_cfg.uiTheme = ParseUiTheme(savedUiTheme);

        int hoppieEnabledInt = 0;
        int confirmEveryPdcInt = 0;
        int pdcSoundEnabledInt = 1;
        int ifrSoundEnabledInt = 1;
        int sendSoundEnabledInt = 1;
        int audioReplayEnabledInt = 1;
        int testModeInt = 0;
        int debugModeInt = 0;
        JsonIntValue(json, "hoppie_enabled", hoppieEnabledInt);
        JsonIntValue(json, "confirm_every_pdc", confirmEveryPdcInt);
        JsonIntValue(json, "pdc_sound_enabled", pdcSoundEnabledInt);
        JsonIntValue(json, "ifr_sound_enabled", ifrSoundEnabledInt);
        JsonIntValue(json, "send_sound_enabled", sendSoundEnabledInt);
        JsonIntValue(
            json,
            "audio_replay_enabled",
            audioReplayEnabledInt);
        JsonIntValue(json, "test_mode", testModeInt);
        JsonIntValue(json, "debug_mode", debugModeInt);

        std::string soundOverride;
        if (JsonStringValue(json, "pdc_request_sound", soundOverride))
            m_cfg.pdcRequestSound = Trim(soundOverride);
        if (JsonStringValue(json, "ifr_release_sound", soundOverride))
            m_cfg.ifrReleaseSound = Trim(soundOverride);
        if (JsonStringValue(json, "send_sound", soundOverride))
            m_cfg.sendSound = Trim(soundOverride);

        LoadDualsAssignmentsFromJson(json);

        m_hoppieMode = (hoppieEnabledInt != 0);
        m_cfg.confirmEveryPdc = (confirmEveryPdcInt != 0);
        m_cfg.pdcSoundEnabled = (pdcSoundEnabledInt != 0);
        m_cfg.ifrSoundEnabled = (ifrSoundEnabledInt != 0);
        m_cfg.sendSoundEnabled = (sendSoundEnabledInt != 0);
        m_cfg.audioReplayEnabled = (audioReplayEnabledInt != 0);
        m_cfg.testMode = (testModeInt != 0);
        m_cfg.debugMode = (debugModeInt != 0);

        m_cfg.stationCode = Upper(Trim(m_cfg.stationCode));
        m_cfg.logonCode = Trim(m_cfg.logonCode);
        m_cfg.pdcRequestSound = Trim(m_cfg.pdcRequestSound);
        m_cfg.ifrReleaseSound = Trim(m_cfg.ifrReleaseSound);
        m_cfg.sendSound = Trim(m_cfg.sendSound);
        m_cfg.airportDirection = Upper(Trim(m_cfg.airportDirection));
        m_cfg.operation = Upper(Trim(m_cfg.operation));
        m_cfg.audioReplayCaptureMode =
            Lower(Trim(m_cfg.audioReplayCaptureMode));
        m_cfg.audioReplayProcesses =
            Trim(m_cfg.audioReplayProcesses);
        m_cfg.audioReplayFolder =
            Trim(m_cfg.audioReplayFolder);
        m_cfg.audioReplaySaveCommand =
            NormalizeReplaySaveCommand(m_cfg.audioReplaySaveCommand);
        m_cfg.trackAudioVersion =
            Lower(Trim(m_cfg.trackAudioVersion));
        if (m_cfg.trackAudioVersion == "1.4.0" ||
            m_cfg.trackAudioVersion == "trackaudio-stable")
            m_cfg.trackAudioVersion = "stable";
        else if (m_cfg.trackAudioVersion == "legacy" ||
                 m_cfg.trackAudioVersion == "legacy-stable" ||
                 m_cfg.trackAudioVersion == "stable133" ||
                 m_cfg.trackAudioVersion == "1.3.3" ||
                 m_cfg.trackAudioVersion == "trackaudio-legacy")
            m_cfg.trackAudioVersion = "legacy133";
        else if (m_cfg.trackAudioVersion == "1.4.0-beta.6" ||
                 m_cfg.trackAudioVersion == "trackaudio-beta")
            m_cfg.trackAudioVersion = "beta";

        if (m_cfg.trackAudioVersion != "stable" &&
            m_cfg.trackAudioVersion != "legacy133" &&
            m_cfg.trackAudioVersion != "beta")
            m_cfg.trackAudioVersion = "auto";
        m_cfg.settingsAppPath =
            Trim(m_cfg.settingsAppPath);

        m_cfg.pollSeconds = std::max(45, std::min(m_cfg.pollSeconds, 75));
        m_cfg.audioReplaySeconds =
            std::max(
                1,
                std::min(
                    10,
                    (std::max(1, m_cfg.audioReplaySeconds) + 59) / 60)) *
            60;
        m_cfg.audioReplayTxRadioIntensity =
            std::max(0, std::min(m_cfg.audioReplayTxRadioIntensity, 100));
        // Audio replay intentionally captures only the VATSIM client process.
        // Legacy "auto" and "system" values are coerced to strict process mode.
        m_cfg.audioReplayCaptureMode = "process";
        if (m_cfg.audioReplayProcesses.empty())
            m_cfg.audioReplayProcesses = "trackaudio.exe";
        if (m_cfg.audioReplayFolder.empty())
            m_cfg.audioReplayFolder = "Recordings";

        if (m_cfg.airportDirection != "WEST" &&
            m_cfg.airportDirection != "EAST" &&
            m_cfg.airportDirection != "NORTH" &&
            m_cfg.airportDirection != "SOUTH")
            m_cfg.airportDirection = "WEST";
        if (m_cfg.operation.empty())
            m_cfg.operation = "DUALS";

        RefreshConfigValidity();
        UpdateHoppieWorkerConfig();

        m_dualsMode = m_cfg.runwayAssignmentConfig == "east" ? DualsMode::Duals05
            : m_cfg.runwayAssignmentConfig == "west" ? DualsMode::Duals23 : DualsMode::Off;
        if (startup)
        {
            m_cfg.runwayAssignmentConfig = "off";
            m_dualsMode = DualsMode::Off;
            std::string error;
            SaveConfig(error);
        }

        DisplayUserMessage("ZYZTools", "CONFIG",
                           (std::string("config=") + m_configPath +
                            " station=" + m_cfg.stationCode +
                            " poll=" + std::to_string(m_cfg.pollSeconds) +
                            " test=" + (m_cfg.testMode ? "ON" : "OFF") +
                            " debug=" + (m_cfg.debugMode ? "ON" : "OFF") +
                            " replay=" + (m_cfg.audioReplayEnabled ? "ON" : "OFF") +
                            " valid=" + (m_cfg.valid ? "YES" : "NO") +
                            " sound=" + m_cfg.pdcRequestSound).c_str(),
                           true, true, false, false, false);
    }
};

class CSettingsScreen final : public CRadarScreen
{
public:
    explicit CSettingsScreen(CZYZToolsPlugin *plugin) : m_plugin(plugin) {}

    void OnAsrContentToBeClosed(void) override
    {
        delete this;
    }

    void OnRefresh(HDC hDC, int Phase) override
    {
        if (!m_plugin || Phase != REFRESH_PHASE_AFTER_LISTS)
            return;
        RefreshTheme();
        if (m_plugin->m_settingsVisible)
        {
            KeepSettingsRectVisible();
            if (!m_loggedVisibleDraw)
            {
                m_plugin->WriteAuditLog(
                    "settings_screen_draw",
                    "phase=" + std::to_string(Phase) +
                        " rect=" + std::to_string(m_plugin->m_settingsRect.left) + "," +
                        std::to_string(m_plugin->m_settingsRect.top) + "," +
                        std::to_string(m_plugin->m_settingsRect.right) + "," +
                        std::to_string(m_plugin->m_settingsRect.bottom));
                m_loggedVisibleDraw = true;
            }
            DrawConsole(hDC);
        }
        else
        {
            m_loggedVisibleDraw = false;
        }
        if (m_plugin->m_sendConfirmation.active)
            DrawSendConfirmation(hDC);
    }

    bool OnCompileCommand(const char *sCommandLine) override
    {
        if (!m_plugin)
            return false;

        m_plugin->WriteAuditLog("settings_screen_command", std::string("command=\"") + (sCommandLine ? sCommandLine : "") + "\"");
        const bool handled = m_plugin->OnCompileCommand(sCommandLine);
        if (handled)
        {
            if (m_plugin->m_settingsVisible)
                KeepSettingsRectVisible();
            RequestRefresh();
        }
        return handled;
    }

    void OnFunctionCall(int FunctionId, const char *sItemString, POINT, RECT) override
    {
        if (m_plugin)
            m_plugin->HandleSettingsEdit(FunctionId, sItemString);
    }

    void OnButtonDownScreenObject(int ObjectType, const char *sObjectId, POINT Pt, RECT, int Button) override
    {
        if (!m_plugin || m_plugin->m_sendConfirmation.active ||
            ObjectType != SCREEN_OBJECT_SETTINGS || Button != BUTTON_LEFT || !sObjectId)
            return;
        const std::string id = sObjectId;
        if (id == "SET_DRAG")
        {
            m_dragOffset.x = Pt.x - m_plugin->m_settingsRect.left;
            m_dragOffset.y = Pt.y - m_plugin->m_settingsRect.top;
        }
        else if (id == "SET_RESIZE")
        {
            m_resizeOffset.x = m_plugin->m_settingsRect.right - Pt.x;
            m_resizeOffset.y = m_plugin->m_settingsRect.bottom - Pt.y;
        }
    }

    void OnMoveScreenObject(int ObjectType, const char *sObjectId, POINT Pt, RECT, bool Released) override
    {
        if (!m_plugin || m_plugin->m_sendConfirmation.active ||
            ObjectType != SCREEN_OBJECT_SETTINGS || !sObjectId)
            return;

        const std::string id = sObjectId;
        const RECT radar = GetRadarArea();
        const int radarLeft = static_cast<int>(radar.left);
        const int radarTop = static_cast<int>(radar.top);
        const int radarRight = static_cast<int>(radar.right);
        const int radarBottom = static_cast<int>(radar.bottom);

        if (id == "SET_DRAG")
        {
            const int width = m_plugin->m_settingsRect.right - m_plugin->m_settingsRect.left;
            const int height = m_plugin->m_settingsRect.bottom - m_plugin->m_settingsRect.top;
            int left = Pt.x - m_dragOffset.x;
            int top = Pt.y - m_dragOffset.y;
            left = std::max(radarLeft, std::min(left, radarRight - width));
            top = std::max(radarTop, std::min(top, radarBottom - height));
            m_plugin->m_settingsRect = RECT{left, top, left + width, top + height};
        }
        else if (id == "SET_RESIZE")
        {
            const int availableWidth = std::max(1, radarRight - static_cast<int>(m_plugin->m_settingsRect.left));
            const int availableHeight = std::max(1, radarBottom - static_cast<int>(m_plugin->m_settingsRect.top));
            const SIZE minimum = MinimumSettingsSize();
            const int minWidth = std::min(static_cast<int>(minimum.cx), availableWidth);
            const int minHeight = std::min(static_cast<int>(minimum.cy), availableHeight);
            const int desiredWidth =
                Pt.x + m_resizeOffset.x - static_cast<int>(m_plugin->m_settingsRect.left);
            const int desiredHeight =
                Pt.y + m_resizeOffset.y - static_cast<int>(m_plugin->m_settingsRect.top);
            const int width = std::max(minWidth, std::min(desiredWidth, availableWidth));
            const int height = std::max(minHeight, std::min(desiredHeight, availableHeight));
            m_plugin->m_settingsRect.right = m_plugin->m_settingsRect.left + width;
            m_plugin->m_settingsRect.bottom = m_plugin->m_settingsRect.top + height;

            if (Released)
            {
                m_plugin->WriteAuditLog(
                    "settings_resized",
                    "width=" + std::to_string(width) +
                        " height=" + std::to_string(height) +
                        " theme=" + UiThemeConfigName(m_plugin->m_cfg.uiTheme));
            }
        }
        else
        {
            return;
        }

        RequestRefresh();
    }

    void OnClickScreenObject(int ObjectType, const char *sObjectId, POINT, RECT Area, int Button) override
    {
        if (!m_plugin || ObjectType != SCREEN_OBJECT_SETTINGS || Button != BUTTON_LEFT || !sObjectId)
            return;

        const std::string id = sObjectId;
        if (m_plugin->m_sendConfirmation.active &&
            id != "CONFIRM_SEND" && id != "CONFIRM_CANCEL")
        {
            return;
        }

        if (id == "CONFIRM_SEND")
        {
            const std::string cs = m_plugin->m_sendConfirmation.callsign;
            m_plugin->WriteAuditLog("pdc_confirmation_accepted", "callsign=" + cs);
            m_plugin->m_sendConfirmation = {};
            m_plugin->ExecutePdcSend(cs);
        }
        else if (id == "CONFIRM_CANCEL")
        {
            m_plugin->WriteAuditLog(
                "pdc_confirmation_cancelled",
                "callsign=" + m_plugin->m_sendConfirmation.callsign);
            m_plugin->m_sendConfirmation = {};
        }
        else if (id == "SET_CLOSE")
            m_plugin->m_settingsVisible = false;
        else if (id == "SET_TAB_OPS")
            m_plugin->m_settingsTab = SettingsTab::Operations;
        else if (id == "SET_TAB_HOPPIE")
            m_plugin->m_settingsTab = SettingsTab::Hoppie;
        else if (id == "SET_TAB_SIDS")
            m_plugin->m_settingsTab = SettingsTab::SidMatrix;
        else if (id == "SET_TAB_RECORDINGS")
            m_plugin->m_settingsTab = SettingsTab::Recordings;
        else if (id == "SET_TAB_STATS")
            m_plugin->m_settingsTab = SettingsTab::Statistics;
        else if (id == "SET_STATS_EXPORT")
            m_plugin->ExportVisibleStatistics(true);
        else if (id == "SET_AUDIO_REPLAY_SAVE")
            m_plugin->SaveAudioReplay(true);
        else if (id == "SET_AUDIO_REPLAY_MINUS")
            m_plugin->AdjustAudioReplayMinutes(-1);
        else if (id == "SET_AUDIO_REPLAY_PLUS")
            m_plugin->AdjustAudioReplayMinutes(1);
        else if (id == "SET_RECORDINGS_STOP")
            m_plugin->StopAudioRecordingPlayback();
        else if (id == "SET_RECORDINGS_PREV")
            m_plugin->m_recordingsPageOffset = std::max(0, m_plugin->m_recordingsPageOffset - 6);
        else if (id == "SET_RECORDINGS_NEXT")
            m_plugin->m_recordingsPageOffset += 6;
        else if (id.rfind("SET_RECORDING_PLAY_", 0) == 0)
        {
            try
            {
                const size_t index = static_cast<size_t>(std::stoul(id.substr(19)));
                m_plugin->PlayAudioRecording(index);
            }
            catch (...)
            {
                m_plugin->DisplayUserMessage(
                    "ZYZTools",
                    "RECORDINGS",
                    "Could not identify that recording row.",
                    true,
                    true,
                    false,
                    false,
                    false);
            }
        }
        else if (id == "SET_THEME_CYCLE")
            m_plugin->CycleUiTheme();
        else if (id == "SET_DIRECTION_CYCLE")
            m_plugin->SetDualsMode(m_plugin->m_dualsMode == DualsMode::Off ? DualsMode::Duals05 : m_plugin->m_dualsMode == DualsMode::Duals05 ? DualsMode::Duals23 : DualsMode::Off, true);
        else if (id == "SET_HOPPIE_TOGGLE")
            m_plugin->SetHoppieMode(!m_plugin->m_hoppieMode, true);
        else if (id == "SET_HOPPIE_START")
        {
            if (!m_plugin->m_hoppieMode)
                m_plugin->SetHoppieMode(true, true);
        }
        else if (id == "SET_HOPPIE_STOP")
        {
            if (m_plugin->m_hoppieMode)
                m_plugin->SetHoppieMode(false, true);
        }
        else if (id == "SET_HOPPIE_LINK_TEST")
            m_plugin->TestHoppieLink();
        else if (id == "SET_DIR_WEST")
            m_plugin->SetDualsMode(DualsMode::Duals23, true);
        else if (id == "SET_DIR_EAST")
            m_plugin->SetDualsMode(DualsMode::Duals05, true);
        else if (id == "SET_DIR_NORTH")
            m_plugin->SetDualsMode(DualsMode::Off, true);
        else if (id == "SET_DIR_SOUTH")
            m_plugin->SetDualsMode(DualsMode::Off, true);
        else if (id == "SET_OPERATION_CYCLE")
            m_plugin->SetDualsMode(m_plugin->m_dualsMode == DualsMode::Off ? DualsMode::Duals05 : m_plugin->m_dualsMode == DualsMode::Duals05 ? DualsMode::Duals23 : DualsMode::Off, true);
        else if (id == "SET_DUALS_OFF")
            m_plugin->SetDualsMode(DualsMode::Off, true);
        else if (id == "SET_DUALS_05")
            m_plugin->SetDualsMode(DualsMode::Duals05, true);
        else if (id == "SET_DUALS_23")
            m_plugin->SetDualsMode(DualsMode::Duals23, true);
        else if (id == "SET_APPLY_DUALS")
            m_plugin->ApplyDualsToExisting(true);
        else if (id == "SET_TEST_PDC")
            m_plugin->TriggerIncomingPdcTest();
        else if (id == "SET_CONFIRM_EVERY")
        {
            m_plugin->m_cfg.confirmEveryPdc = !m_plugin->m_cfg.confirmEveryPdc;
            m_plugin->m_settingsDirty = true;
            m_plugin->WriteAuditLog(
                "config_changed",
                std::string("field=confirm_every_pdc value=") +
                    (m_plugin->m_cfg.confirmEveryPdc ? "1" : "0"));
        }
        else if (id == "SET_PDC_SOUND_TOGGLE")
        {
            m_plugin->m_cfg.pdcSoundEnabled = !m_plugin->m_cfg.pdcSoundEnabled;
            m_plugin->m_settingsDirty = true;
            m_plugin->WriteAuditLog(
                "config_changed",
                std::string("field=pdc_sound_enabled value=") +
                    (m_plugin->m_cfg.pdcSoundEnabled ? "1" : "0"));
        }
        else if (id == "SET_IFR_SOUND_TOGGLE")
        {
            m_plugin->m_cfg.ifrSoundEnabled = !m_plugin->m_cfg.ifrSoundEnabled;
            m_plugin->m_settingsDirty = true;
            m_plugin->WriteAuditLog(
                "config_changed",
                std::string("field=ifr_sound_enabled value=") +
                    (m_plugin->m_cfg.ifrSoundEnabled ? "1" : "0"));
        }
        else if (id == "SET_PDC_SOUND_TEST")
            m_plugin->PlayConfiguredPdcSound(true);
        else if (id == "SET_IFR_SOUND_TEST")
            m_plugin->PlayConfiguredIfrSound(true);
        else if (id == "SET_TEST_MODE")
        {
            m_plugin->m_cfg.testMode = !m_plugin->m_cfg.testMode;
            m_plugin->m_settingsDirty = true;
            m_plugin->WriteAuditLog(
                "config_changed",
                std::string("field=test_mode value=") +
                    (m_plugin->m_cfg.testMode ? "1" : "0"));
        }
        else if (id == "SET_DEBUG_MODE")
        {
            m_plugin->m_cfg.debugMode = !m_plugin->m_cfg.debugMode;
            m_plugin->m_settingsDirty = true;
            m_plugin->WriteAuditLog(
                "config_changed",
                std::string("field=debug_mode value=") +
                    (m_plugin->m_cfg.debugMode ? "1" : "0"));
        }
        else if (id == "SET_SAVE")
        {
            std::string err;
            if (m_plugin->SaveConfig(err))
            {
                m_plugin->m_settingsDirty = false;
                m_plugin->DisplayUserMessage(
                    "ZYZTools", "SETTINGS",
                    ("All settings saved to " + m_plugin->m_configPath).c_str(),
                    true, true, false, false, false);
            }
            else
            {
                m_plugin->DisplayUserMessage(
                    "ZYZTools", "SETTINGS ERROR", err.c_str(),
                    true, true, false, false, false);
            }
        }
        else
        {
            StartEdit(id, Area);
        }
    }

private:
    CZYZToolsPlugin *m_plugin = nullptr;
    POINT m_dragOffset{0, 0};
    POINT m_resizeOffset{0, 0};
    bool m_loggedVisibleDraw = false;

    COLORREF C_BG = 0;
    COLORREF C_PANEL = 0;
    COLORREF C_PANEL_ALT = 0;
    COLORREF C_LINE = 0;
    COLORREF C_TEXT = 0;
    COLORREF C_MUTED = 0;
    COLORREF C_CYAN = 0;
    COLORREF C_GREEN = 0;
    COLORREF C_AMBER = 0;
    COLORREF C_RED = 0;
    COLORREF C_BUTTON = 0;
    COLORREF C_BUTTON_ACTIVE = 0;
    COLORREF C_HEADER = 0;
    COLORREF C_GRID = 0;
    COLORREF C_EDIT = 0;
    COLORREF C_WARNING_HEADER = 0;
    ThemePalette m_theme = GetThemePalette(UiTheme::Current);

    void KeepSettingsRectVisible()
    {
        if (!m_plugin)
            return;

        const RECT radar = GetRadarArea();
        const int radarLeft = static_cast<int>(radar.left);
        const int radarTop = static_cast<int>(radar.top);
        const int radarRight = static_cast<int>(radar.right);
        const int radarBottom = static_cast<int>(radar.bottom);
        const int width = m_plugin->m_settingsRect.right - m_plugin->m_settingsRect.left;
        const int height = m_plugin->m_settingsRect.bottom - m_plugin->m_settingsRect.top;
        if (radarRight <= radarLeft || radarBottom <= radarTop || width <= 0 || height <= 0)
            return;

        const int maxLeft = std::max(radarLeft, radarRight - width);
        const int maxTop = std::max(radarTop, radarBottom - height);
        int left = std::max(radarLeft, std::min(static_cast<int>(m_plugin->m_settingsRect.left), maxLeft));
        int top = std::max(radarTop, std::min(static_cast<int>(m_plugin->m_settingsRect.top), maxTop));
        m_plugin->m_settingsRect = RECT{left, top, left + width, top + height};
    }

    void RefreshTheme()
    {
        m_theme = GetThemePalette(m_plugin ? m_plugin->m_cfg.uiTheme : UiTheme::Current);
        C_BG = m_theme.background;
        C_PANEL = m_theme.panel;
        C_PANEL_ALT = m_theme.panelAlt;
        C_LINE = m_theme.line;
        C_TEXT = m_theme.text;
        C_MUTED = m_theme.muted;
        C_CYAN = m_theme.accent;
        C_GREEN = m_theme.green;
        C_AMBER = m_theme.amber;
        C_RED = m_theme.red;
        C_BUTTON = m_theme.button;
        C_BUTTON_ACTIVE = m_theme.buttonActive;
        C_HEADER = m_theme.header;
        C_GRID = m_theme.grid;
        C_EDIT = m_theme.edit;
        C_WARNING_HEADER = m_theme.warningHeader;
    }

    void FillSolid(HDC hDC, RECT rc, COLORREF color)
    {
        HBRUSH brush = CreateSolidBrush(color);
        FillRect(hDC, &rc, brush);
        DeleteObject(brush);
    }

    void Border(HDC hDC, RECT rc, COLORREF color)
    {
        HBRUSH brush = CreateSolidBrush(color);
        FrameRect(hDC, &rc, brush);
        DeleteObject(brush);
    }

    void Text(HDC hDC, RECT rc, const std::string &text, COLORREF color, UINT format)
    {
        SetBkMode(hDC, TRANSPARENT);
        SetTextColor(hDC, color);
        DrawTextA(hDC, text.c_str(), -1, &rc, format);
    }

    void Button(HDC hDC, RECT rc, const std::string &label, const char *id, bool active = false, COLORREF accent = CLR_INVALID)
    {
        if (accent == CLR_INVALID)
            accent = C_CYAN;
        FillSolid(hDC, rc, active ? C_BUTTON_ACTIVE : C_BUTTON);
        if (m_theme.bevelButtons)
        {
            Border(hDC, rc, C_LINE);
            HPEN light = CreatePen(PS_SOLID, 1, active ? RGB(55, 55, 55) : RGB(140, 140, 140));
            HPEN dark = CreatePen(PS_SOLID, 1, active ? RGB(140, 140, 140) : RGB(55, 55, 55));
            HPEN old = static_cast<HPEN>(SelectObject(hDC, light));
            MoveToEx(hDC, rc.left + 1, rc.bottom - 2, nullptr);
            LineTo(hDC, rc.left + 1, rc.top + 1);
            LineTo(hDC, rc.right - 2, rc.top + 1);
            SelectObject(hDC, dark);
            LineTo(hDC, rc.right - 2, rc.bottom - 2);
            LineTo(hDC, rc.left + 1, rc.bottom - 2);
            SelectObject(hDC, old);
            DeleteObject(light);
            DeleteObject(dark);
        }
        else
        {
            Border(hDC, rc, active ? accent : C_LINE);
        }
        Text(hDC, rc, label, active ? accent : C_TEXT, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        AddScreenObject(SCREEN_OBJECT_SETTINGS, id, rc, false, label.c_str());
    }

    void Lamp(HDC hDC, int x, int y, COLORREF color)
    {
        HBRUSH brush = CreateSolidBrush(color);
        HBRUSH oldBrush = (HBRUSH)SelectObject(hDC, brush);
        HPEN pen = CreatePen(PS_SOLID, 1, color);
        HPEN oldPen = (HPEN)SelectObject(hDC, pen);
        Ellipse(hDC, x, y, x + 10, y + 10);
        SelectObject(hDC, oldPen);
        SelectObject(hDC, oldBrush);
        DeleteObject(pen);
        DeleteObject(brush);
    }

    void SectionTitle(HDC hDC, int y, const std::string &title, const std::string &code)
    {
        RECT panel = m_plugin->m_settingsRect;
        RECT codeRc{panel.left + 24, y, panel.left + 92, y + 22};
        RECT titleRc{panel.left + 96, y, panel.right - 24, y + 22};
        Text(hDC, codeRc, code, C_CYAN, DT_LEFT | DT_SINGLELINE);
        Text(hDC, titleRc, title, C_TEXT, DT_LEFT | DT_SINGLELINE);
    }

    void Field(HDC hDC, int y, const std::string &label, const std::string &value, const char *id, bool secret = false)
    {
        RECT panel = m_plugin->m_settingsRect;
        RECT row{panel.left + 24, y, panel.right - 24, y + 48};
        FillSolid(hDC, row, C_PANEL_ALT);
        Border(hDC, row, C_LINE);

        RECT labelRc{row.left + 14, row.top + 7, row.left + 210, row.bottom - 5};
        Text(hDC, labelRc, label, C_MUTED, DT_LEFT | DT_SINGLELINE);

        std::string shown = value;
        if (secret)
        {
            if (value.empty())
                shown = "(not configured)";
            else
                shown = std::string(std::min<size_t>(value.size(), 18), '*');
        }
        if (shown.empty())
            shown = "(empty)";

        RECT valueRc{row.left + 210, row.top + 7, row.right - 78, row.bottom - 5};
        Text(hDC, valueRc, shown, C_TEXT, DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);

        RECT editRc{row.right - 66, row.top + 9, row.right - 10, row.bottom - 9};
        FillSolid(hDC, editRc, C_EDIT);
        Border(hDC, editRc, C_CYAN);
        Text(hDC, editRc, "EDIT", C_CYAN, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        AddScreenObject(SCREEN_OBJECT_SETTINGS, id, row, false, ("Edit " + label).c_str());
    }

    void SidRow(HDC hDC, int y, const std::string &mode, const std::string &runway, const std::vector<std::string> &sids, const char *id)
    {
        RECT panel = m_plugin->m_settingsRect;
        RECT row{panel.left + 24, y, panel.right - 24, y + 76};
        FillSolid(hDC, row, C_PANEL_ALT);
        Border(hDC, row, C_LINE);

        RECT modeRc{row.left + 14, row.top + 9, row.left + 182, row.top + 31};
        Text(hDC, modeRc, mode + " / RWY " + runway, C_CYAN, DT_LEFT | DT_SINGLELINE);

        std::string joined = JoinSidList(sids);
        if (joined.empty())
            joined = "(no SIDs assigned)";
        RECT listRc{row.left + 14, row.top + 35, row.right - 86, row.bottom - 8};
        Text(hDC, listRc, joined, C_TEXT, DT_LEFT | DT_WORDBREAK | DT_END_ELLIPSIS);

        RECT editRc{row.right - 72, row.top + 22, row.right - 12, row.bottom - 22};
        FillSolid(hDC, editRc, C_EDIT);
        Border(hDC, editRc, C_CYAN);
        Text(hDC, editRc, "EDIT", C_CYAN, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        AddScreenObject(SCREEN_OBJECT_SETTINGS, id, row, false, "Edit SID assignment");
    }

    void DrawSendConfirmation(HDC hDC)
    {
        const RECT radar = GetRadarArea();
        const bool vatcan = m_plugin->m_cfg.uiTheme == UiTheme::Vatcan;
        const bool pluginCore = m_plugin->m_cfg.uiTheme == UiTheme::PluginCore;
        const int width = vatcan ? 430 : pluginCore ? 440 : 520;
        const int height = vatcan ? 190 : pluginCore ? 200 : 230;
        const int left = static_cast<int>(radar.left) + (static_cast<int>(radar.right - radar.left) - width) / 2;
        const int top = static_cast<int>(radar.top) + (static_cast<int>(radar.bottom - radar.top) - height) / 2;
        RECT modal{left, top, left + width, top + height};

        FillSolid(hDC, modal, C_BG);
        Border(hDC, modal, C_AMBER);
        RECT header{
            modal.left,
            modal.top,
            modal.right,
            modal.top + (vatcan ? 25 : pluginCore ? 38 : 50)};
        FillSolid(hDC, header, C_WARNING_HEADER);
        Border(hDC, header, C_AMBER);

        HFONT titleFont = CreateFontA(
            m_theme.titleFontHeight, 0, 0, 0, m_theme.titleWeight, FALSE, FALSE, FALSE, ANSI_CHARSET,
            OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
            DEFAULT_PITCH | FF_DONTCARE, m_theme.fontFace);
        HFONT bodyFont = CreateFontA(
            m_theme.bodyFontHeight, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, ANSI_CHARSET,
            OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
            DEFAULT_PITCH | FF_DONTCARE, m_theme.fontFace);
        HFONT oldFont = titleFont ? (HFONT)SelectObject(hDC, titleFont) : nullptr;

        Text(
            hDC, RECT{
                header.left + (vatcan ? 6 : pluginCore ? 14 : 20),
                header.top + (vatcan ? 3 : pluginCore ? 10 : 13),
                header.right - 20,
                header.bottom - 8},
            "PDC SEND AUTHORIZATION // " + m_plugin->m_sendConfirmation.callsign,
            C_AMBER, vatcan ? DT_CENTER | DT_SINGLELINE : DT_LEFT | DT_SINGLELINE);

        if (bodyFont)
            SelectObject(hDC, bodyFont);
        Text(
            hDC, RECT{
                modal.left + (pluginCore ? 14 : vatcan ? 14 : 24),
                header.bottom + (vatcan ? 14 : pluginCore ? 12 : 22),
                modal.right - 24,
                header.bottom + (vatcan ? 62 : pluginCore ? 62 : 76)},
            "Confirmation required:\n" + m_plugin->m_sendConfirmation.reason,
            C_TEXT, DT_LEFT | DT_WORDBREAK);
        Text(
            hDC, RECT{
                modal.left + (pluginCore ? 14 : vatcan ? 14 : 24),
                modal.bottom - (vatcan ? 64 : pluginCore ? 58 : 98),
                modal.right - 24,
                modal.bottom - (vatcan ? 42 : pluginCore ? 39 : 72)},
            "Verify the flight is still eligible before transmitting.",
            C_MUTED, DT_LEFT | DT_SINGLELINE);

        Button(
            hDC, RECT{
                modal.right - (vatcan ? 154 : pluginCore ? 154 : 224),
                modal.bottom - (vatcan ? 35 : pluginCore ? 35 : 52),
                modal.right - (vatcan ? 82 : pluginCore ? 82 : 124),
                modal.bottom - (vatcan ? 10 : pluginCore ? 8 : 16)},
            "CANCEL", "CONFIRM_CANCEL", false, C_RED);
        Button(
            hDC, RECT{
                modal.right - (vatcan ? 76 : pluginCore ? 76 : 112),
                modal.bottom - (vatcan ? 35 : pluginCore ? 35 : 52),
                modal.right - 16,
                modal.bottom - (vatcan ? 10 : pluginCore ? 8 : 16)},
            "SEND PDC", "CONFIRM_SEND", true, C_GREEN);

        if (oldFont)
            SelectObject(hDC, oldFont);
        if (titleFont)
            DeleteObject(titleFont);
        if (bodyFont)
            DeleteObject(bodyFont);
    }

    void ElectronButton(HDC hDC, RECT rc, const std::string &label, const char *id, bool primary)
    {
        FillSolid(hDC, rc, primary ? C_BUTTON_ACTIVE : C_BUTTON);
        Text(hDC, rc, label, C_TEXT, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        AddScreenObject(SCREEN_OBJECT_SETTINGS, id, rc, false, label.c_str());
    }

    void ElectronCaption(HDC hDC, RECT rc, const std::string &label)
    {
        HFONT captionFont = CreateUiFont(-11, FW_SEMIBOLD);
        HFONT oldFont = captionFont ? static_cast<HFONT>(SelectObject(hDC, captionFont)) : nullptr;
        Text(hDC, rc, Upper(label), RGB(157, 162, 166), DT_LEFT | DT_VCENTER | DT_SINGLELINE);
        if (oldFont)
            SelectObject(hDC, oldFont);
        if (captionFont)
            DeleteObject(captionFont);
    }

    void ElectronCheckbox(HDC hDC, RECT rc, const std::string &label, bool checked, const char *id)
    {
        RECT box{rc.left, rc.top + 2, rc.left + 14, rc.top + 16};
        FillSolid(hDC, box, checked ? C_CYAN : C_EDIT);
        if (checked)
        {
            RECT mark{box.left + 3, box.top + 2, box.right - 2, box.bottom - 1};
            Text(hDC, mark, "x", C_TEXT, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        }
        Text(hDC, RECT{rc.left + 21, rc.top, rc.right, rc.bottom}, label, RGB(201, 203, 204), DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        AddScreenObject(SCREEN_OBJECT_SETTINGS, id, rc, false, label.c_str());
    }

    void ElectronSelect(HDC hDC, RECT rc, const std::string &value, const char *id)
    {
        FillSolid(hDC, rc, C_EDIT);
        Text(hDC, RECT{rc.left + 7, rc.top + 3, rc.right - 22, rc.bottom - 3}, value, RGB(236, 236, 236), DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        Text(hDC, RECT{rc.right - 20, rc.top + 3, rc.right - 6, rc.bottom - 3}, "v", C_MUTED, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        AddScreenObject(SCREEN_OBJECT_SETTINGS, id, rc, false, value.c_str());
    }

    void ElectronField(HDC hDC, RECT rc, const std::string &label, const std::string &value, const char *id, bool secret)
    {
        const int labelWidth = 72;
        Text(hDC, RECT{rc.left, rc.top, rc.left + labelWidth, rc.bottom}, label, RGB(167, 171, 173), DT_LEFT | DT_VCENTER | DT_SINGLELINE);
        RECT input{rc.left + labelWidth, rc.top, rc.right, rc.bottom};
        FillSolid(hDC, input, C_EDIT);
        std::string shown = value;
        if (secret)
            shown = value.empty() ? "" : std::string(std::min<size_t>(value.size(), 18), '*');
        Text(hDC, RECT{input.left + 7, input.top + 3, input.right - 7, input.bottom - 3}, shown, RGB(236, 236, 236), DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        AddScreenObject(SCREEN_OBJECT_SETTINGS, id, input, false, ("Edit " + label).c_str());
    }

    void DrawConsole(HDC hDC)
    {
        if (m_plugin->m_cfg.uiTheme == UiTheme::Vatcan)
            DrawVatcanConsole(hDC);
        else if (m_plugin->m_cfg.uiTheme == UiTheme::PluginCore)
            DrawPluginCoreConsole(hDC);
        else
            DrawCurrentConsole(hDC);
        DrawResizeGrip(hDC);
    }

    void DrawResizeGrip(HDC hDC)
    {
        const RECT panel = m_plugin->m_settingsRect;
        RECT grip{panel.right - 22, panel.bottom - 22, panel.right, panel.bottom};
        FillSolid(hDC, grip, C_HEADER);

        HPEN pen = CreatePen(PS_SOLID, 1, C_MUTED);
        HPEN oldPen = static_cast<HPEN>(SelectObject(hDC, pen));
        for (int offset = 5; offset <= 17; offset += 4)
        {
            MoveToEx(hDC, grip.right - offset, grip.bottom - 2, nullptr);
            LineTo(hDC, grip.right - 2, grip.bottom - offset);
        }
        SelectObject(hDC, oldPen);
        DeleteObject(pen);

        AddScreenObject(
            SCREEN_OBJECT_SETTINGS,
            "SET_RESIZE",
            grip,
            true,
            "Drag to resize settings console");
    }

    SIZE MinimumSettingsSize() const
    {
        if (!m_plugin)
            return SIZE{360, 500};
        if (m_plugin->m_cfg.uiTheme == UiTheme::PluginCore)
            return SIZE{360, 500};
        if (m_plugin->m_cfg.uiTheme == UiTheme::Vatcan)
            return SIZE{500, 500};
        return SIZE{620, 560};
    }

    void DrawStatisticsMetric(
        HDC hDC,
        RECT card,
        const std::string &label,
        const std::string &value,
        COLORREF accent)
    {
        FillSolid(hDC, card, C_PANEL);
        Border(hDC, card, C_LINE);
        Text(
            hDC,
            RECT{card.left + 9, card.top + 7, card.right - 7, card.top + 25},
            label,
            C_MUTED,
            DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
        HFONT valueFont = CreateUiFont(-19, FW_SEMIBOLD);
        HFONT oldFont = valueFont ? static_cast<HFONT>(SelectObject(hDC, valueFont)) : nullptr;
        Text(
            hDC,
            RECT{card.left + 9, card.top + 25, card.right - 7, card.bottom - 6},
            value,
            accent,
            DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        if (oldFont)
            SelectObject(hDC, oldFont);
        if (valueFont)
            DeleteObject(valueFont);
    }

    void DrawStatisticsPage(HDC hDC, RECT content)
    {
        FillSolid(hDC, content, C_BG);
        const auto *session = m_plugin->StatisticsForDisplay();
        const int padding = 10;
        const int left = content.left + padding;
        const int right = content.right - padding;
        int y = content.top + padding;
        const int contentWidth = right - left;
        const bool stackedActions = contentWidth < 520;

        HFONT titleFont = CreateUiFont(-17, FW_SEMIBOLD);
        HFONT oldFont = titleFont ? static_cast<HFONT>(SelectObject(hDC, titleFont)) : nullptr;
        Text(
            hDC,
            RECT{left, y, stackedActions ? right : right - 316, y + 26},
            "SESSION STATISTICS",
            C_TEXT,
            DT_LEFT | DT_VCENTER | DT_SINGLELINE);
        if (oldFont)
            SelectObject(hDC, oldFont);
        if (titleFont)
            DeleteObject(titleFont);

        if (stackedActions)
        {
            y += 30;
            Button(
                hDC,
                RECT{left, y, right, y + 27},
                "EXPORT SPREADSHEET",
                "SET_STATS_EXPORT",
                false,
                C_GREEN);
        }
        else
        {
            Button(
                hDC,
                RECT{right - 154, y, right, y + 27},
                "EXPORT SPREADSHEET",
                "SET_STATS_EXPORT",
                false,
                C_GREEN);
        }
        y += 33;

        if (!session)
        {
            Text(
                hDC,
                RECT{left, y + 24, right, y + 100},
                "No network statistics session has been recorded yet.\n"
                "Recording starts automatically when EuroScope connects to the network.",
                C_MUTED,
                DT_CENTER | DT_WORDBREAK);
            return;
        }

        const std::time_t sessionEnd =
            session->active ? std::time(nullptr) : session->endedAt;
        const std::string status =
            std::string(session->active ? "RECORDING" : "SESSION COMPLETE") +
            "  //  " + FormatLocalTime(session->startedAt, "%H:%M") +
            " - " + FormatLocalTime(sessionEnd, "%H:%M") +
            "  //  " + (session->controller.empty() ? "UNKNOWN" : session->controller);
        Text(
            hDC,
            RECT{left, y, right, y + 18},
            status,
            session->active ? C_GREEN : C_MUTED,
            DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
        y += 24;

        std::ostringstream average;
        average << std::fixed << std::setprecision(1)
                << m_plugin->StatisticsMovementsPerHour(*session);
        const int width = right - left;
        const int cardGap = 6;
        const bool twoRows = width < 520;
        const int cardHeight = 56;
        if (!twoRows)
        {
            const int cardWidth = (width - cardGap * 3) / 4;
            DrawStatisticsMetric(hDC, RECT{left, y, left + cardWidth, y + cardHeight}, "AIRCRAFT CLEARED", std::to_string(session->cleared), C_CYAN);
            DrawStatisticsMetric(hDC, RECT{left + cardWidth + cardGap, y, left + cardWidth * 2 + cardGap, y + cardHeight}, "TAKEOFFS", std::to_string(session->departures), C_GREEN);
            DrawStatisticsMetric(hDC, RECT{left + cardWidth * 2 + cardGap * 2, y, left + cardWidth * 3 + cardGap * 2, y + cardHeight}, "LANDINGS", std::to_string(session->landings), m_theme.rx);
            DrawStatisticsMetric(hDC, RECT{left + cardWidth * 3 + cardGap * 3, y, right, y + cardHeight}, "MOVEMENTS / HR", average.str(), C_AMBER);
            y += cardHeight + 12;
        }
        else
        {
            const int cardWidth = (width - cardGap) / 2;
            DrawStatisticsMetric(hDC, RECT{left, y, left + cardWidth, y + cardHeight}, "AIRCRAFT CLEARED", std::to_string(session->cleared), C_CYAN);
            DrawStatisticsMetric(hDC, RECT{left + cardWidth + cardGap, y, right, y + cardHeight}, "TAKEOFFS", std::to_string(session->departures), C_GREEN);
            y += cardHeight + cardGap;
            DrawStatisticsMetric(hDC, RECT{left, y, left + cardWidth, y + cardHeight}, "LANDINGS", std::to_string(session->landings), m_theme.rx);
            DrawStatisticsMetric(hDC, RECT{left + cardWidth + cardGap, y, right, y + cardHeight}, "MOVEMENTS / HR", average.str(), C_AMBER);
            y += cardHeight + 12;
        }

        const int available = content.bottom - padding - y;
        const int chartHeight = std::max(100, std::min(190, available * 3 / 5));
        RECT chart{left, y, right, y + chartHeight};
        FillSolid(hDC, chart, C_PANEL);
        Border(hDC, chart, C_LINE);
        Text(
            hDC,
            RECT{chart.left + 9, chart.top + 6, chart.right - 9, chart.top + 24},
            "TRAFFIC VOLUME // 15 MINUTE INTERVALS",
            C_MUTED,
            DT_LEFT | DT_SINGLELINE);

        const int plotLeft = chart.left + 10;
        const int plotRight = chart.right - 10;
        const int plotTop = chart.top + 29;
        const int plotBottom = chart.bottom - 20;
        const size_t bucketCount = std::min<size_t>(12, session->buckets.size());
        int maxMovements = 1;
        for (size_t i = session->buckets.size() - bucketCount; i < session->buckets.size(); ++i)
        {
            const auto &bucket = session->buckets[i];
            maxMovements = std::max(maxMovements, bucket.departures + bucket.landings);
        }
        if (bucketCount > 0)
        {
            const int barSpace = std::max(1, (plotRight - plotLeft) / static_cast<int>(bucketCount));
            const int barWidth = std::max(3, barSpace - 5);
            const size_t first = session->buckets.size() - bucketCount;
            for (size_t visible = 0; visible < bucketCount; ++visible)
            {
                const auto &bucket = session->buckets[first + visible];
                const int total = bucket.departures + bucket.landings;
                const int fullHeight =
                    (plotBottom - plotTop) * total / maxMovements;
                const int departureHeight =
                    total > 0 ? fullHeight * bucket.departures / total : 0;
                const int x = plotLeft + static_cast<int>(visible) * barSpace + 2;
                RECT landingBar{x, plotBottom - fullHeight, x + barWidth, plotBottom - departureHeight};
                RECT departureBar{x, plotBottom - departureHeight, x + barWidth, plotBottom};
                if (landingBar.bottom > landingBar.top)
                    FillSolid(hDC, landingBar, m_theme.rx);
                if (departureBar.bottom > departureBar.top)
                    FillSolid(hDC, departureBar, C_GREEN);
                const std::time_t bucketStart =
                    session->startedAt + static_cast<std::time_t>((first + visible) * 15 * 60);
                Text(
                    hDC,
                    RECT{x - 3, plotBottom + 2, x + barWidth + 7, chart.bottom - 2},
                    FormatLocalTime(bucketStart, "%H:%M"),
                    C_MUTED,
                    DT_CENTER | DT_SINGLELINE);
            }
        }
        y = chart.bottom + 8;

        if (content.bottom - y > 34)
        {
            Text(
                hDC,
                RECT{left, y, right, y + 18},
                "RECENT EVENTS",
                C_MUTED,
                DT_LEFT | DT_SINGLELINE);
            y += 19;
            const int maxRows =
                std::max(1, static_cast<int>(content.bottom - padding - y) / 18);
            int shown = 0;
            for (auto it = session->events.rbegin(); it != session->events.rend() && shown < maxRows; ++it, ++shown)
            {
                const std::string line =
                    FormatLocalTime(it->timestamp, "%H:%M:%S") + "  " +
                    m_plugin->StatisticsEventName(it->type) + "  " +
                    it->callsign + "  " +
                    (it->runway.empty() ? "-" : it->runway);
                Text(
                    hDC,
                    RECT{left, y, right, y + 17},
                    line,
                    it->type == CZYZToolsPlugin::StatisticsEventType::Departed ? C_GREEN
                    : it->type == CZYZToolsPlugin::StatisticsEventType::Landed ? m_theme.rx
                                                                                   : C_TEXT,
                    DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
                y += 18;
            }
        }
    }

    void DrawRecordingsPage(HDC hDC, RECT content)
    {
        FillSolid(hDC, content, C_BG);
        const int padding = 10;
        const int left = content.left + padding;
        const int right = content.right - padding;
        const int width = right - left;
        int y = content.top + padding;
        const bool compact = width < 540;

        HFONT titleFont = CreateUiFont(-17, FW_SEMIBOLD);
        HFONT oldFont = titleFont ? static_cast<HFONT>(SelectObject(hDC, titleFont)) : nullptr;
        Text(
            hDC,
            RECT{left, y, right, y + 26},
            "RADIO RECORDINGS",
            C_TEXT,
            DT_LEFT | DT_VCENTER | DT_SINGLELINE);
        if (oldFont)
            SelectObject(hDC, oldFont);
        if (titleFont)
            DeleteObject(titleFont);
        y += 31;

        if (compact)
        {
            Button(
                hDC,
                RECT{left, y, right, y + 27},
                "SAVE RADIO REPLAY NOW",
                "SET_AUDIO_REPLAY_SAVE",
                false,
                C_CYAN);
            y += 33;
            Button(
                hDC,
                RECT{left, y, right, y + 27},
                "STOP PLAYBACK",
                "SET_RECORDINGS_STOP",
                false,
                C_RED);
            y += 35;
        }
        else
        {
            const int actionWidth = (width - 8) / 2;
            Button(
                hDC,
                RECT{left, y, left + actionWidth, y + 27},
                "SAVE RADIO REPLAY NOW",
                "SET_AUDIO_REPLAY_SAVE",
                false,
                C_CYAN);
            Button(
                hDC,
                RECT{left + actionWidth + 8, y, right, y + 27},
                "STOP PLAYBACK",
                "SET_RECORDINGS_STOP",
                false,
                C_RED);
            y += 35;
        }

        const int replayMinutes = m_plugin->AudioReplayMinutes();
        const std::string replayLengthLabel =
            "BUFFER: " + std::to_string(replayMinutes) +
            (replayMinutes == 1 ? " MIN" : " MINS");
        const int lengthButtonWidth = std::min(176, std::max(112, width - 172));
        Button(
            hDC,
            RECT{left, y, left + 72, y + 27},
            "-1 MIN",
            "SET_AUDIO_REPLAY_MINUS",
            false,
            C_AMBER);
        Button(
            hDC,
            RECT{left + 78, y, std::min(right - 78, left + 78 + lengthButtonWidth), y + 27},
            replayLengthLabel,
            "SET_EDIT_AUDIO_REPLAY_MINUTES",
            true,
            C_CYAN);
        Button(
            hDC,
            RECT{right - 72, y, right, y + 27},
            "+1 MIN",
            "SET_AUDIO_REPLAY_PLUS",
            false,
            C_AMBER);
        y += 34;

        Text(
            hDC,
            RECT{left, y + 2, left + 128, y + 24},
            "SAVE COMMAND",
            C_MUTED,
            DT_LEFT | DT_VCENTER | DT_SINGLELINE);
        RECT dotBox{left + 132, y, left + 158, y + 27};
        FillSolid(hDC, dotBox, C_PANEL_ALT);
        Border(hDC, dotBox, C_LINE);
        Text(hDC, dotBox, ".", C_CYAN, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        Button(
            hDC,
            RECT{dotBox.right + 4, y, right, y + 27},
            m_plugin->ReplaySaveCommandSuffix(),
            "SET_EDIT_REPLAY_SAVE_COMMAND",
            true,
            C_CYAN);
        y += 32;

        const std::string audioStatus =
            "AUDIO REPLAY // " +
            std::to_string(replayMinutes) +
            (replayMinutes == 1 ? " MIN // " : " MINS // ") +
            m_plugin->m_audioReplayStatus;
        Text(
            hDC,
            RECT{left, y, right, y + 18},
            audioStatus,
            m_plugin->m_cfg.audioReplayEnabled ? C_CYAN : C_MUTED,
            DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
        y += 22;

        if (!m_plugin->m_playingRecording.empty())
        {
            Text(
                hDC,
                RECT{left, y, right, y + 18},
                "PLAYING // " + m_plugin->m_playingRecording,
                C_GREEN,
                DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
            y += 22;
        }

        const auto recordings = m_plugin->ListAudioRecordings();
        const int rowHeight = 39;
        const int listBottom = content.bottom - padding - 32;
        const int maxRows = std::max(1, (listBottom - y) / rowHeight);
        const int total = static_cast<int>(recordings.size());
        const int maxOffset = std::max(0, total - maxRows);
        m_plugin->m_recordingsPageOffset =
            std::max(0, std::min(m_plugin->m_recordingsPageOffset, maxOffset));

        Text(
            hDC,
            RECT{left, y, right, y + 18},
            "SAVED RECORDINGS // " + std::to_string(total) + " FILES",
            C_MUTED,
            DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
        y += 22;

        if (recordings.empty())
        {
            RECT empty{left, y + 10, right, std::min(static_cast<int>(content.bottom) - padding, y + 94)};
            FillSolid(hDC, empty, C_PANEL);
            Border(hDC, empty, C_LINE);
            Text(
                hDC,
                RECT{empty.left + 12, empty.top + 10, empty.right - 12, empty.bottom - 10},
                std::string("No recordings saved yet.\nUse the save button here or type ") + m_plugin->ReplaySaveCommandDisplay() + ".",
                C_MUTED,
                DT_CENTER | DT_VCENTER | DT_WORDBREAK);
        }
        else
        {
            const int start = m_plugin->m_recordingsPageOffset;
            const int end = std::min(total, start + maxRows);
            for (int i = start; i < end; ++i)
            {
                RECT row{left, y, right, y + rowHeight - 4};
                FillSolid(hDC, row, C_PANEL);
                Border(hDC, row, recordings[i].name == m_plugin->m_playingRecording ? C_GREEN : C_LINE);
                Text(
                    hDC,
                    RECT{row.left + 9, row.top + 4, row.right - 82, row.top + 21},
                    recordings[i].name,
                    C_TEXT,
                    DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
                Text(
                    hDC,
                    RECT{row.left + 9, row.top + 21, row.right - 82, row.bottom - 3},
                    m_plugin->FormatRecordingSize(recordings[i].sizeBytes),
                    C_MUTED,
                    DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
                const std::string playId = "SET_RECORDING_PLAY_" + std::to_string(i);
                Button(
                    hDC,
                    RECT{row.right - 72, row.top + 5, row.right - 8, row.bottom - 5},
                    "PLAY",
                    playId.c_str(),
                    recordings[i].name == m_plugin->m_playingRecording,
                    C_GREEN);
                y += rowHeight;
            }
        }

        const int footerY = content.bottom - padding - 27;
        if (footerY > y + 4)
        {
            const bool hasPrev = m_plugin->m_recordingsPageOffset > 0;
            const bool hasNext = m_plugin->m_recordingsPageOffset < maxOffset;
            Button(
                hDC,
                RECT{left, footerY, left + 84, footerY + 27},
                "PREV",
                "SET_RECORDINGS_PREV",
                hasPrev,
                C_CYAN);
            Button(
                hDC,
                RECT{left + 92, footerY, left + 176, footerY + 27},
                "NEXT",
                "SET_RECORDINGS_NEXT",
                hasNext,
                C_CYAN);
            Text(
                hDC,
                RECT{left + 188, footerY + 3, right, footerY + 27},
                "Folder: " + m_plugin->AudioReplayOutputFolder(),
                C_MUTED,
                DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
        }
    }

    void DrawCurrentConsole(HDC hDC)
    {
        RECT panel = m_plugin->m_settingsRect;
        FillSolid(hDC, panel, C_BG);
        Border(hDC, panel, C_CYAN);

        HPEN gridPen = CreatePen(PS_SOLID, 1, C_GRID);
        HPEN oldPen = (HPEN)SelectObject(hDC, gridPen);
        for (int y = panel.top + 110; y < panel.bottom - 58; y += 28)
        {
            MoveToEx(hDC, panel.left + 1, y, nullptr);
            LineTo(hDC, panel.right - 1, y);
        }
        SelectObject(hDC, oldPen);
        DeleteObject(gridPen);

        HFONT titleFont = CreateFontA(m_theme.titleFontHeight, 0, 0, 0, m_theme.titleWeight, FALSE, FALSE, FALSE, ANSI_CHARSET,
                                      OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                      DEFAULT_PITCH | FF_DONTCARE, m_theme.fontFace);
        HFONT bodyFont = CreateFontA(m_theme.bodyFontHeight, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, ANSI_CHARSET,
                                     OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                     DEFAULT_PITCH | FF_DONTCARE, m_theme.fontFace);
        HFONT oldFont = titleFont ? (HFONT)SelectObject(hDC, titleFont) : nullptr;

        RECT header{panel.left, panel.top, panel.right, panel.top + 58};
        FillSolid(hDC, header, C_HEADER);
        Border(hDC, header, C_LINE);
        RECT dragRc{header.left, header.top, header.right - 70, header.bottom};
        AddScreenObject(SCREEN_OBJECT_SETTINGS, "SET_DRAG", dragRc, true, "Drag settings console");

        Lamp(hDC, panel.left + 20, panel.top + 22, m_plugin->m_hoppieMode ? C_GREEN : C_RED);
        RECT titleRc{panel.left + 42, panel.top + 10, panel.right - 90, panel.top + 35};
        Text(hDC, titleRc,
             (m_plugin->m_cfg.stationCode.empty() ? "ATC" : m_plugin->m_cfg.stationCode) + " PDC // OPERATIONS CONTROL",
             C_TEXT, DT_LEFT | DT_SINGLELINE);
        RECT subRc{panel.left + 42, panel.top + 34, panel.right - 90, panel.top + 53};
        Text(hDC, subRc, m_plugin->m_settingsDirty ? "CONFIG MODIFIED // SAVE REQUIRED" : "CONFIG SYNCHRONIZED", m_plugin->m_settingsDirty ? C_AMBER : C_MUTED, DT_LEFT | DT_SINGLELINE);

        RECT closeRc{panel.right - 54, panel.top + 14, panel.right - 18, panel.top + 44};
        Button(hDC, closeRc, "X", "SET_CLOSE", false, C_RED);

        if (bodyFont)
            SelectObject(hDC, bodyFont);

        const int tabTop = panel.top + 66;
        const int tabLeft = panel.left + 24;
        const int tabRight = panel.right - 24;
        const int tabGap = 6;
        const int tabWidth = (tabRight - tabLeft - tabGap * 5) / 6;
        Button(hDC, RECT{tabLeft, tabTop, tabLeft + tabWidth, tabTop + 34}, "OPS", "SET_TAB_OPS", m_plugin->m_settingsTab == SettingsTab::Operations);
        Button(hDC, RECT{tabLeft + (tabWidth + tabGap), tabTop, tabLeft + tabWidth * 2 + tabGap, tabTop + 34}, "HOPPIE", "SET_TAB_HOPPIE", m_plugin->m_settingsTab == SettingsTab::Hoppie);
        Button(hDC, RECT{tabLeft + (tabWidth + tabGap) * 2, tabTop, tabLeft + tabWidth * 3 + tabGap * 2, tabTop + 34}, "SID MATRIX", "SET_TAB_SIDS", m_plugin->m_settingsTab == SettingsTab::SidMatrix);
        Button(hDC, RECT{tabLeft + (tabWidth + tabGap) * 3, tabTop, tabLeft + tabWidth * 4 + tabGap * 3, tabTop + 34}, "RECORDINGS", "SET_TAB_RECORDINGS", m_plugin->m_settingsTab == SettingsTab::Recordings);
        Button(hDC, RECT{tabLeft + (tabWidth + tabGap) * 4, tabTop, tabLeft + tabWidth * 5 + tabGap * 4, tabTop + 34}, "STATS", "SET_TAB_STATS", m_plugin->m_settingsTab == SettingsTab::Statistics);
        Button(hDC, RECT{tabLeft + (tabWidth + tabGap) * 5, tabTop, tabRight, tabTop + 34}, UiThemeDisplayName(m_plugin->m_cfg.uiTheme), "SET_THEME_CYCLE", true, C_CYAN);

        if (m_plugin->m_settingsTab == SettingsTab::Operations)
            DrawOperations(hDC, panel.top + 116);
        else if (m_plugin->m_settingsTab == SettingsTab::Hoppie)
            DrawHoppie(hDC, panel.top + 116);
        else if (m_plugin->m_settingsTab == SettingsTab::SidMatrix)
            DrawSidMatrix(hDC, panel.top + 116);
        else if (m_plugin->m_settingsTab == SettingsTab::Recordings)
            DrawRecordingsPage(hDC, RECT{panel.left + 14, panel.top + 110, panel.right - 14, panel.bottom - 58});
        else
            DrawStatisticsPage(hDC, RECT{panel.left + 14, panel.top + 110, panel.right - 14, panel.bottom - 58});

        RECT footer{panel.left, panel.bottom - 58, panel.right, panel.bottom};
        FillSolid(hDC, footer, C_HEADER);
        Border(hDC, footer, C_LINE);
        RECT pathRc{footer.left + 20, footer.top + 10, footer.right - 190, footer.bottom - 8};
        Text(hDC, pathRc, m_plugin->m_configPath.empty() ? "NO CONFIG PATH" : m_plugin->m_configPath, C_MUTED, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        RECT saveRc{footer.right - 170, footer.top + 10, footer.right - 20, footer.bottom - 10};
        Button(hDC, saveRc, m_plugin->m_settingsDirty ? "SAVE CHANGES" : "SAVE CONFIG", "SET_SAVE", m_plugin->m_settingsDirty, C_GREEN);

        if (oldFont)
            SelectObject(hDC, oldFont);
        if (titleFont)
            DeleteObject(titleFont);
        if (bodyFont)
            DeleteObject(bodyFont);
    }

    HFONT CreateUiFont(int height, int weight = FW_NORMAL)
    {
        return CreateFontA(
            height, 0, 0, 0, weight, FALSE, FALSE, FALSE, ANSI_CHARSET,
            OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
            DEFAULT_PITCH | FF_DONTCARE, m_theme.fontFace);
    }

    void FieldAt(
        HDC hDC,
        RECT row,
        const std::string &label,
        const std::string &value,
        const char *id,
        bool secret,
        bool cardStyle)
    {
        FillSolid(hDC, row, C_PANEL_ALT);
        Border(hDC, row, C_LINE);

        std::string shown = value;
        if (secret)
            shown = value.empty() ? "(not configured)" : std::string(std::min<size_t>(value.size(), 18), '*');
        if (shown.empty())
            shown = "(empty)";

        if (cardStyle)
        {
            Text(hDC, RECT{row.left + 14, row.top + 8, row.right - 70, row.top + 28}, label, C_MUTED, DT_LEFT | DT_SINGLELINE);
            Text(hDC, RECT{row.left + 14, row.top + 29, row.right - 70, row.bottom - 8}, shown, C_TEXT, DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
            Button(hDC, RECT{row.right - 60, row.top + 12, row.right - 12, row.bottom - 12}, "EDIT", id, false, C_CYAN);
        }
        else
        {
            Text(hDC, RECT{row.left + 8, row.top + 3, row.left + 165, row.bottom - 3}, label, C_MUTED, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
            Text(hDC, RECT{row.left + 170, row.top + 3, row.right - 52, row.bottom - 3}, shown, C_TEXT, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
            Button(hDC, RECT{row.right - 46, row.top + 4, row.right - 4, row.bottom - 4}, "EDIT", id, false, C_CYAN);
        }
    }

    void SidCardAt(
        HDC hDC,
        RECT card,
        const std::string &mode,
        const std::string &runway,
        const std::vector<std::string> &sids,
        const char *id,
        bool compact)
    {
        FillSolid(hDC, card, C_PANEL_ALT);
        Border(hDC, card, C_LINE);
        Text(
            hDC,
            RECT{card.left + 12, card.top + 8, card.right - 70, card.top + 31},
            mode + " / RWY " + runway,
            C_CYAN,
            DT_LEFT | DT_SINGLELINE);
        std::string joined = JoinSidList(sids);
        if (joined.empty())
            joined = "(no SIDs assigned)";
        Text(
            hDC,
            RECT{card.left + 12, card.top + 35, card.right - 12, card.bottom - (compact ? 8 : 48)},
            joined,
            C_TEXT,
            DT_LEFT | DT_WORDBREAK | DT_END_ELLIPSIS);
        if (compact)
            Button(hDC, RECT{card.right - 58, card.top + 5, card.right - 6, card.top + 29}, "EDIT", id, false, C_CYAN);
        else
            Button(hDC, RECT{card.right - 76, card.bottom - 39, card.right - 12, card.bottom - 10}, "EDIT", id, false, C_CYAN);
    }

    void DrawVatcanConsole(HDC hDC)
    {
        RECT panel = m_plugin->m_settingsRect;
        FillSolid(hDC, panel, C_PANEL_ALT);
        Border(hDC, panel, RGB(140, 140, 140));
        RECT inner = panel;
        InflateRect(&inner, -3, -3);
        Border(hDC, inner, RGB(55, 55, 55));

        HFONT titleFont = CreateUiFont(-14, FW_NORMAL);
        HFONT bodyFont = CreateUiFont(-12, FW_NORMAL);
        HFONT oldFont = static_cast<HFONT>(SelectObject(hDC, titleFont));

        RECT titleBar{panel.left + 4, panel.top + 4, panel.right - 4, panel.top + 29};
        FillSolid(hDC, titleBar, C_BUTTON);
        Border(hDC, titleBar, C_LINE);
        Text(
            hDC, titleBar,
            (m_plugin->m_cfg.stationCode.empty() ? "ATC" : m_plugin->m_cfg.stationCode) + " PDC OPERATIONS",
            C_TEXT, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        AddScreenObject(SCREEN_OBJECT_SETTINGS, "SET_DRAG", titleBar, true, "Drag settings console");

        if (bodyFont)
            SelectObject(hDC, bodyFont);

        const int navLeft = panel.left + 8;
        const int navRight = panel.left + 130;
        int navY = panel.top + 38;
        Button(hDC, RECT{navLeft, navY, navRight, navY + 25}, "OPS", "SET_TAB_OPS", m_plugin->m_settingsTab == SettingsTab::Operations);
        navY += 28;
        Button(hDC, RECT{navLeft, navY, navRight, navY + 25}, "HOPPIE", "SET_TAB_HOPPIE", m_plugin->m_settingsTab == SettingsTab::Hoppie);
        navY += 28;
        Button(hDC, RECT{navLeft, navY, navRight, navY + 25}, "SID MATRIX", "SET_TAB_SIDS", m_plugin->m_settingsTab == SettingsTab::SidMatrix);
        navY += 28;
        Button(hDC, RECT{navLeft, navY, navRight, navY + 25}, "RECORDINGS", "SET_TAB_RECORDINGS", m_plugin->m_settingsTab == SettingsTab::Recordings);
        navY += 28;
        Button(hDC, RECT{navLeft, navY, navRight, navY + 25}, "STATISTICS", "SET_TAB_STATS", m_plugin->m_settingsTab == SettingsTab::Statistics);
        navY += 40;
        Text(hDC, RECT{navLeft, navY, navRight, navY + 18}, "DISPLAY", C_MUTED, DT_CENTER | DT_SINGLELINE);
        navY += 20;
        Button(
            hDC, RECT{navLeft, navY, navRight, navY + 44},
            std::string("THEME ") + UiThemeDisplayName(m_plugin->m_cfg.uiTheme),
            "SET_THEME_CYCLE", true, C_CYAN);

        RECT content{panel.left + 140, panel.top + 38, panel.right - 10, panel.bottom - 48};
        FillSolid(hDC, content, C_PANEL);
        Border(hDC, content, C_LINE);

        if (m_plugin->m_settingsTab == SettingsTab::Operations)
            DrawVatcanOperations(hDC, content);
        else if (m_plugin->m_settingsTab == SettingsTab::Hoppie)
            DrawVatcanHoppie(hDC, content);
        else if (m_plugin->m_settingsTab == SettingsTab::SidMatrix)
            DrawVatcanSidMatrix(hDC, content);
        else if (m_plugin->m_settingsTab == SettingsTab::Recordings)
            DrawRecordingsPage(hDC, RECT{content.left + 2, content.top + 2, content.right - 2, content.bottom - 2});
        else
            DrawStatisticsPage(hDC, RECT{content.left + 2, content.top + 2, content.right - 2, content.bottom - 2});

        Button(hDC, RECT{navLeft, panel.bottom - 72, navRight, panel.bottom - 45}, m_plugin->m_settingsDirty ? "SAVE*" : "SAVE", "SET_SAVE", m_plugin->m_settingsDirty, C_GREEN);
        Button(hDC, RECT{navLeft, panel.bottom - 40, navRight, panel.bottom - 13}, "CLOSE", "SET_CLOSE", false, C_RED);
        Text(
            hDC, RECT{content.left + 6, panel.bottom - 39, content.right - 6, panel.bottom - 13},
            m_plugin->m_configPath, C_MUTED, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);

        if (oldFont)
            SelectObject(hDC, oldFont);
        if (titleFont)
            DeleteObject(titleFont);
        if (bodyFont)
            DeleteObject(bodyFont);
    }

    void DrawVatcanOperations(HDC hDC, RECT content)
    {
        int x = content.left + 10;
        int y = content.top + 8;
        int width = content.right - content.left - 20;
        Text(hDC, RECT{x, y, x + width, y + 20}, "OPERATIONS / SYSTEM STATUS", C_TEXT, DT_LEFT | DT_SINGLELINE);
        y += 25;

        int half = (width - 8) / 2;
        RECT hop{x, y, x + half, y + 50};
        RECT auth{x + half + 8, y, x + width, y + 50};
        FillSolid(hDC, hop, C_BUTTON);
        FillSolid(hDC, auth, C_BUTTON);
        Border(hDC, hop, m_plugin->m_hoppieMode ? C_GREEN : C_RED);
        Border(hDC, auth, m_plugin->m_cfg.valid ? C_GREEN : C_AMBER);
        Text(hDC, RECT{hop.left + 8, hop.top + 5, hop.right - 8, hop.bottom - 5}, m_plugin->m_hoppieMode ? "HOPPIE\nONLINE / POLLING" : "HOPPIE\nOFFLINE", C_TEXT, DT_LEFT | DT_VCENTER);
        Text(hDC, RECT{auth.left + 8, auth.top + 5, auth.right - 8, auth.bottom - 5}, m_plugin->m_cfg.valid ? "CONFIG\nAUTH READY" : "CONFIG\nCREDENTIALS REQUIRED", C_TEXT, DT_LEFT | DT_VCENTER);
        y += 61;

        int third = (width - 12) / 3;
        Button(hDC, RECT{x, y, x + third, y + 27}, m_plugin->m_hoppieMode ? "HOPPIE ON" : "HOPPIE OFF", "SET_HOPPIE_TOGGLE", m_plugin->m_hoppieMode, C_GREEN);
        Button(hDC, RECT{x + third + 6, y, x + third * 2 + 6, y + 27}, "TEST PDC", "SET_TEST_PDC", false, C_AMBER);
        Button(hDC, RECT{x + third * 2 + 12, y, x + width, y + 27}, m_plugin->m_cfg.confirmEveryPdc ? "CONFIRM ON" : "CONFIRM OFF", "SET_CONFIRM_EVERY", m_plugin->m_cfg.confirmEveryPdc, C_AMBER);
        y += 42;

        Text(hDC, RECT{x, y, x + width, y + 18}, "CYYZ RUNWAY CONFIGURATION", C_TEXT, DT_LEFT | DT_SINGLELINE);
        y += 21;
        int quarter = (width - 12) / 4;
        Button(hDC, RECT{x, y, x + quarter, y + 27}, "WEST", "SET_DIR_WEST", m_plugin->m_cfg.airportDirection == "WEST", C_GREEN);
        Button(hDC, RECT{x + quarter + 4, y, x + quarter * 2 + 4, y + 27}, "EAST", "SET_DIR_EAST", m_plugin->m_cfg.airportDirection == "EAST", C_GREEN);
        Button(hDC, RECT{x + quarter * 2 + 8, y, x + quarter * 3 + 8, y + 27}, "OFF", "SET_DUALS_OFF", m_plugin->m_cfg.runwayAssignmentConfig == "off", C_GREEN);
        y += 34;
        Button(hDC, RECT{x, y, x + width - 142, y + 29}, "CONFIG: " + m_plugin->m_cfg.runwayAssignmentConfig, "SET_OPERATION_CYCLE", true, C_CYAN);
        y += 36;
        Button(hDC, RECT{x, y, x + 116, y + 27}, "APPLY NOW", "SET_APPLY_DUALS", false, C_AMBER);

        std::ostringstream memory;
        memory << "DEP " << m_plugin->m_departureListLastSeen.size()
               << "  CACHE " << m_plugin->m_departureReconnectSnapshots.size()
               << "  RX " << m_plugin->m_pendingRequestId.size();
        Text(hDC, RECT{x + 130, y, x + width, y + 27}, memory.str(), C_CYAN, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    }

    void DrawVatcanHoppie(HDC hDC, RECT content)
    {
        int x = content.left + 10;
        int y = content.top + 8;
        int width = content.right - content.left - 20;
        Text(hDC, RECT{x, y, x + width, y + 20}, "HOPPIE DATA LINK", C_TEXT, DT_LEFT | DT_SINGLELINE);
        y += 25;

        int quarter = (width - 12) / 4;
        Button(hDC, RECT{x, y, x + quarter, y + 27}, m_plugin->m_hoppieMode ? "LINK ON" : "LINK OFF", "SET_HOPPIE_TOGGLE", m_plugin->m_hoppieMode, C_GREEN);
        Button(hDC, RECT{x + quarter + 4, y, x + quarter * 2 + 4, y + 27}, m_plugin->m_cfg.testMode ? "TEST ON" : "TEST OFF", "SET_TEST_MODE", m_plugin->m_cfg.testMode, C_AMBER);
        Button(hDC, RECT{x + quarter * 2 + 8, y, x + quarter * 3 + 8, y + 27}, m_plugin->m_cfg.debugMode ? "DEBUG ON" : "DEBUG OFF", "SET_DEBUG_MODE", m_plugin->m_cfg.debugMode, C_AMBER);
        Button(hDC, RECT{x + quarter * 3 + 12, y, x + width, y + 27}, "PING", "SET_HOPPIE_LINK_TEST", false, C_CYAN);
        y += 34;
        Button(hDC, RECT{x, y, x + quarter, y + 27}, m_plugin->m_cfg.pdcSoundEnabled ? "PDC SND ON" : "PDC SND OFF", "SET_PDC_SOUND_TOGGLE", m_plugin->m_cfg.pdcSoundEnabled, C_GREEN);
        Button(hDC, RECT{x + quarter + 4, y, x + quarter * 2 + 4, y + 27}, "TEST PDC", "SET_PDC_SOUND_TEST", false, C_AMBER);
        Button(hDC, RECT{x + quarter * 2 + 8, y, x + quarter * 3 + 8, y + 27}, m_plugin->m_cfg.ifrSoundEnabled ? "IFR SND ON" : "IFR SND OFF", "SET_IFR_SOUND_TOGGLE", m_plugin->m_cfg.ifrSoundEnabled, C_GREEN);
        Button(hDC, RECT{x + quarter * 3 + 12, y, x + width, y + 27}, "TEST IFR", "SET_IFR_SOUND_TEST", false, C_AMBER);
        y += 39;
        FieldAt(hDC, RECT{x, y, x + width, y + 34}, "HOPPIE LOGON", m_plugin->m_cfg.logonCode, "SET_EDIT_LOGON", true, false);
        y += 38;
        FieldAt(hDC, RECT{x, y, x + width, y + 34}, "STATION", m_plugin->m_cfg.stationCode, "SET_EDIT_STATION", false, false);
        y += 38;
        FieldAt(hDC, RECT{x, y, x + width, y + 34}, "POLL SECONDS", std::to_string(m_plugin->m_cfg.pollSeconds), "SET_EDIT_POLL", false, false);
        y += 38;
        FieldAt(hDC, RECT{x, y, x + width, y + 34}, "PDC SOUND", m_plugin->m_cfg.pdcRequestSound, "SET_EDIT_PDC_SOUND", false, false);
        y += 38;
        FieldAt(hDC, RECT{x, y, x + width, y + 34}, "IFR SOUND", m_plugin->m_cfg.ifrReleaseSound, "SET_EDIT_IFR_SOUND", false, false);
    }

    void DrawVatcanSidMatrix(HDC hDC, RECT content)
    {
        int x = content.left + 10;
        int y = content.top + 8;
        int width = content.right - content.left - 20;
        Text(hDC, RECT{x, y, x + width, y + 20}, "SID / RUNWAY MATRIX", C_TEXT, DT_LEFT | DT_SINGLELINE);
        y += 25;
        SidCardAt(hDC, RECT{x, y, x + width, y + 94}, "WEST", "23", m_plugin->m_cfg.duals23Rwy23, "SET_SID_D23_23", true);
        y += 100;
        SidCardAt(hDC, RECT{x, y, x + width, y + 94}, "WEST", "24R", m_plugin->m_cfg.duals23Rwy24R, "SET_SID_D23_24R", true);
        y += 100;
        SidCardAt(hDC, RECT{x, y, x + width, y + 94}, "EAST", "05", m_plugin->m_cfg.duals05Rwy05, "SET_SID_D05_05", true);
        y += 100;
        SidCardAt(hDC, RECT{x, y, x + width, y + 94}, "EAST", "06L", m_plugin->m_cfg.duals05Rwy06L, "SET_SID_D05_06L", true);
    }

    void DrawPluginCoreConsole(HDC hDC)
    {
        RECT panel = m_plugin->m_settingsRect;
        FillSolid(hDC, panel, C_BG);
        Border(hDC, panel, C_LINE);

        HFONT titleFont = CreateUiFont(m_theme.titleFontHeight, m_theme.titleWeight);
        HFONT bodyFont = CreateUiFont(m_theme.bodyFontHeight, FW_NORMAL);
        HFONT smallFont = CreateUiFont(-11, FW_SEMIBOLD);
        HFONT oldFont = static_cast<HFONT>(SelectObject(hDC, titleFont));

        RECT dragRc{panel.left, panel.top, panel.right - 136, panel.top + 42};
        AddScreenObject(SCREEN_OBJECT_SETTINGS, "SET_DRAG", dragRc, true, "Drag settings console");
        Text(
            hDC, RECT{panel.left + 14, panel.top + 10, panel.left + 92, panel.top + 32},
            "CYYZ PDC",
            C_TEXT, DT_LEFT | DT_SINGLELINE);

        if (smallFont)
            SelectObject(hDC, smallFont);
        Text(
            hDC, RECT{panel.left + 92, panel.top + 13, panel.left + 190, panel.top + 31},
            "controller utility",
            C_MUTED, DT_LEFT | DT_SINGLELINE);
        Text(
            hDC, RECT{panel.right - 166, panel.top + 13, panel.right - 94, panel.top + 31},
            m_plugin->m_hoppieMode ? "BRIDGE ON" : "BRIDGE OFF",
            m_plugin->m_hoppieMode ? C_GREEN : C_MUTED, DT_RIGHT | DT_SINGLELINE);

        if (bodyFont)
            SelectObject(hDC, bodyFont);
        ElectronButton(hDC, RECT{panel.right - 88, panel.top + 8, panel.right - 32, panel.top + 35}, "THEME", "SET_THEME_CYCLE", false);
        ElectronButton(hDC, RECT{panel.right - 28, panel.top + 8, panel.right - 8, panel.top + 35}, "X", "SET_CLOSE", false);

        RECT status{panel.left + 14, panel.top + 47, panel.right - 14, panel.top + 77};
        COLORREF statusBackground = C_PANEL;
        COLORREF statusText = RGB(184, 189, 193);
        std::string statusMessage = "Ready.";
        if (!m_plugin->m_cfg.valid)
        {
            statusBackground = RGB(58, 40, 40);
            statusText = C_RED;
            statusMessage = "Hoppie station and logon code are not configured.";
        }
        else if (m_plugin->m_settingsDirty)
        {
            statusMessage = "Configuration modified. Save changes to persist it.";
        }
        else if (m_plugin->m_hoppieMode)
        {
            statusBackground = RGB(38, 53, 42);
            statusText = RGB(168, 213, 173);
            statusMessage = "Ready. Hoppie bridge is active.";
        }
        FillSolid(hDC, status, statusBackground);
        Text(hDC, RECT{status.left + 9, status.top + 6, status.right - 9, status.bottom - 5}, statusMessage, statusText, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);

        RECT content{panel.left + 28, panel.top + 140, panel.right - 24, panel.bottom - 72};
        if (m_plugin->m_settingsTab == SettingsTab::Operations)
            DrawPluginCoreOperations(hDC, content);
        else if (m_plugin->m_settingsTab == SettingsTab::Hoppie)
            DrawPluginCoreHoppie(hDC, content);
        else if (m_plugin->m_settingsTab == SettingsTab::SidMatrix)
            DrawPluginCoreSidMatrix(hDC, content);
        else if (m_plugin->m_settingsTab == SettingsTab::Recordings)
            DrawRecordingsPage(hDC, RECT{panel.left + 4, panel.top + 82, panel.right - 4, panel.bottom - 26});
        else
            DrawStatisticsPage(hDC, RECT{panel.left + 4, panel.top + 82, panel.right - 4, panel.bottom - 26});

        if (oldFont)
            SelectObject(hDC, oldFont);
        if (titleFont)
            DeleteObject(titleFont);
        if (bodyFont)
            DeleteObject(bodyFont);
    }

    void DrawPluginCoreOperations(HDC hDC, RECT content)
    {
        RECT panel = m_plugin->m_settingsRect;
        const int left = panel.left + 14;
        const int right = panel.right - 14;
        int y = panel.top + 91;

        ElectronCaption(hDC, RECT{left, y, right, y + 16}, "Departure configuration");
        y += 22;
        ElectronSelect(hDC, RECT{left, y, left + 112, y + 27}, m_plugin->m_cfg.runwayAssignmentConfig, "SET_DIRECTION_CYCLE");
        y += 34;
        y += 23;
        const std::string active =
            "Active departure configuration: " + m_plugin->m_cfg.runwayAssignmentConfig;
        Text(hDC, RECT{left, y, right, y + 16}, active, C_MUTED, DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
        y += 22;
        ElectronButton(hDC, RECT{left, y, right, y + 27}, "Update all uncleared runways", "SET_APPLY_DUALS", true);
        y += 34;
        const int configGap = 6;
        const int configWidth = (right - left - configGap * 4) / 5;
        ElectronButton(hDC, RECT{left, y, left + configWidth, y + 27}, "Save configuration", "SET_SAVE", true);
        ElectronButton(hDC, RECT{left + configWidth + configGap, y, left + configWidth * 2 + configGap, y + 27}, "Hoppie details", "SET_TAB_HOPPIE", false);
        ElectronButton(hDC, RECT{left + configWidth * 2 + configGap * 2, y, left + configWidth * 3 + configGap * 2, y + 27}, "SID matrix", "SET_TAB_SIDS", false);
        ElectronButton(hDC, RECT{left + configWidth * 3 + configGap * 3, y, left + configWidth * 4 + configGap * 3, y + 27}, "Recordings", "SET_TAB_RECORDINGS", false);
        ElectronButton(hDC, RECT{left + configWidth * 4 + configGap * 4, y, right, y + 27}, "Statistics", "SET_TAB_STATS", false);

        y += 41;
        ElectronCaption(hDC, RECT{left, y, right, y + 16}, "Hoppie");
        y += 22;
        ElectronCheckbox(hDC, RECT{left, y, right, y + 18}, "Enable Hoppie bridge", m_plugin->m_hoppieMode, "SET_HOPPIE_TOGGLE");
        y += 22;
        ElectronField(hDC, RECT{left, y, right, y + 27}, "Station", m_plugin->m_cfg.stationCode, "SET_EDIT_STATION", false);
        y += 33;
        ElectronField(hDC, RECT{left, y, right, y + 27}, "Logon code", m_plugin->m_cfg.logonCode, "SET_EDIT_LOGON", true);
        y += 33;
        ElectronField(hDC, RECT{left, y, right, y + 27}, "Poll (sec)", std::to_string(m_plugin->m_cfg.pollSeconds), "SET_EDIT_POLL", false);
        y += 34;
        const int actionGap = 6;
        const int actionWidth = (right - left - actionGap * 4) / 5;
        ElectronButton(hDC, RECT{left, y, left + actionWidth, y + 27}, "Save settings", "SET_SAVE", true);
        ElectronButton(hDC, RECT{left + (actionWidth + actionGap), y, left + actionWidth * 2 + actionGap, y + 27}, "Start", "SET_HOPPIE_START", false);
        ElectronButton(hDC, RECT{left + (actionWidth + actionGap) * 2, y, left + actionWidth * 3 + actionGap * 2, y + 27}, "Stop", "SET_HOPPIE_STOP", false);
        ElectronButton(hDC, RECT{left + (actionWidth + actionGap) * 3, y, left + actionWidth * 4 + actionGap * 3, y + 27}, "Test link", "SET_HOPPIE_LINK_TEST", false);
        ElectronButton(hDC, RECT{left + (actionWidth + actionGap) * 4, y, right, y + 27}, "Test RX", "SET_TEST_PDC", false);

        y += 41;
        ElectronCaption(hDC, RECT{left, y, right, y + 16}, "Hoppie requests");
        y += 22;
        DrawPluginCoreRequestTable(hDC, RECT{left, y, right, panel.bottom - 38});

        Text(hDC, RECT{left, panel.bottom - 27, right, panel.bottom - 10}, "Made by Charlie and Elliot", RGB(104, 109, 113), DT_RIGHT | DT_SINGLELINE);
    }

    void DrawPluginCoreHoppie(HDC hDC, RECT content)
    {
        RECT panel = m_plugin->m_settingsRect;
        const int left = panel.left + 14;
        const int right = panel.right - 14;
        int y = panel.top + 91;

        ElectronCaption(hDC, RECT{left, y, right, y + 16}, "Hoppie settings");
        y += 22;
        ElectronCheckbox(hDC, RECT{left, y, right, y + 18}, "Enable Hoppie bridge", m_plugin->m_hoppieMode, "SET_HOPPIE_TOGGLE");
        y += 24;
        ElectronField(hDC, RECT{left, y, right, y + 27}, "Station", m_plugin->m_cfg.stationCode, "SET_EDIT_STATION", false);
        y += 33;
        ElectronField(hDC, RECT{left, y, right, y + 27}, "Logon code", m_plugin->m_cfg.logonCode, "SET_EDIT_LOGON", true);
        y += 33;
        ElectronField(hDC, RECT{left, y, right, y + 27}, "Poll (sec)", std::to_string(m_plugin->m_cfg.pollSeconds), "SET_EDIT_POLL", false);
        y += 33;
        ElectronField(hDC, RECT{left, y, right, y + 27}, "PDC sound", m_plugin->m_cfg.pdcRequestSound, "SET_EDIT_PDC_SOUND", false);
        y += 33;
        ElectronField(hDC, RECT{left, y, right, y + 27}, "IFR sound", m_plugin->m_cfg.ifrReleaseSound, "SET_EDIT_IFR_SOUND", false);

        y += 39;
        ElectronCaption(hDC, RECT{left, y, right, y + 16}, "Sound and controller options");
        y += 22;
        ElectronCheckbox(hDC, RECT{left, y, left + 196, y + 18}, "PDC request sound", m_plugin->m_cfg.pdcSoundEnabled, "SET_PDC_SOUND_TOGGLE");
        ElectronCheckbox(hDC, RECT{left + 208, y, right, y + 18}, "IFR release sound", m_plugin->m_cfg.ifrSoundEnabled, "SET_IFR_SOUND_TOGGLE");
        y += 25;
        const int half = (right - left - 6) / 2;
        ElectronButton(hDC, RECT{left, y, left + half, y + 27}, "Test PDC request sound", "SET_PDC_SOUND_TEST", false);
        ElectronButton(hDC, RECT{left + half + 6, y, right, y + 27}, "Test IFR release sound", "SET_IFR_SOUND_TEST", false);
        y += 34;
        const int third = (right - left - 12) / 3;
        ElectronButton(hDC, RECT{left, y, left + third, y + 27}, m_plugin->m_cfg.testMode ? "Test mode on" : "Test mode off", "SET_TEST_MODE", m_plugin->m_cfg.testMode);
        ElectronButton(hDC, RECT{left + third + 6, y, left + third * 2 + 6, y + 27}, m_plugin->m_cfg.debugMode ? "Debug on" : "Debug off", "SET_DEBUG_MODE", m_plugin->m_cfg.debugMode);
        ElectronButton(hDC, RECT{left + third * 2 + 12, y, right, y + 27}, m_plugin->m_cfg.confirmEveryPdc ? "Confirm all on" : "Confirm all off", "SET_CONFIRM_EVERY", m_plugin->m_cfg.confirmEveryPdc);
        y += 40;
        ElectronButton(hDC, RECT{left, y, left + 130, y + 27}, "Save settings", "SET_SAVE", true);
        ElectronButton(hDC, RECT{left + 136, y, left + 250, y + 27}, "Test link", "SET_HOPPIE_LINK_TEST", false);
        ElectronButton(hDC, RECT{left + 256, y, right, y + 27}, "Back to dashboard", "SET_TAB_OPS", false);

        y += 42;
        ElectronCaption(hDC, RECT{left, y, right, y + 16}, "Hoppie requests");
        y += 22;
        DrawPluginCoreRequestTable(hDC, RECT{left, y, right, panel.bottom - 38});
        Text(hDC, RECT{left, panel.bottom - 27, right, panel.bottom - 10}, "Made by Charlie and Elliot", RGB(104, 109, 113), DT_RIGHT | DT_SINGLELINE);
    }

    void DrawPluginCoreSidMatrix(HDC hDC, RECT content)
    {
        RECT panel = m_plugin->m_settingsRect;
        const int left = panel.left + 14;
        const int right = panel.right - 14;
        int y = panel.top + 91;

        ElectronCaption(hDC, RECT{left, y, right, y + 16}, "SID / runway matrix");
        y += 22;
        Text(hDC, RECT{left, y, right, y + 34}, "Base SID names only. Separate entries with spaces or commas.", C_MUTED, DT_LEFT | DT_WORDBREAK);
        y += 42;
        ElectronSidRow(hDC, RECT{left, y, right, y + 76}, "WEST", "23", m_plugin->m_cfg.duals23Rwy23, "SET_SID_D23_23");
        y += 83;
        ElectronSidRow(hDC, RECT{left, y, right, y + 76}, "WEST", "24R", m_plugin->m_cfg.duals23Rwy24R, "SET_SID_D23_24R");
        y += 83;
        ElectronSidRow(hDC, RECT{left, y, right, y + 76}, "EAST", "05", m_plugin->m_cfg.duals05Rwy05, "SET_SID_D05_05");
        y += 83;
        ElectronSidRow(hDC, RECT{left, y, right, y + 76}, "EAST", "06L", m_plugin->m_cfg.duals05Rwy06L, "SET_SID_D05_06L");
        y += 88;
        ElectronButton(hDC, RECT{left, y, left + 130, y + 27}, "Save configuration", "SET_SAVE", true);
        ElectronButton(hDC, RECT{left + 136, y, right, y + 27}, "Back to dashboard", "SET_TAB_OPS", false);
        Text(hDC, RECT{left, panel.bottom - 27, right, panel.bottom - 10}, "Made by Charlie and Elliot", RGB(104, 109, 113), DT_RIGHT | DT_SINGLELINE);
    }

    void DrawPluginCoreRequestTable(HDC hDC, RECT table)
    {
        const int acidRight = table.left + 64;
        const int statusRight = acidRight + 42;
        const int utcRight = statusRight + 56;
        Text(hDC, RECT{table.left + 5, table.top, acidRight, table.top + 18}, "ACID", C_MUTED, DT_LEFT | DT_SINGLELINE);
        Text(hDC, RECT{acidRight + 5, table.top, statusRight, table.top + 18}, "ST", C_MUTED, DT_LEFT | DT_SINGLELINE);
        Text(hDC, RECT{statusRight + 5, table.top, utcRight, table.top + 18}, "UTC", C_MUTED, DT_LEFT | DT_SINGLELINE);
        Text(hDC, RECT{utcRight + 5, table.top, table.right, table.top + 18}, "MSG", C_MUTED, DT_LEFT | DT_SINGLELINE);

        std::vector<std::pair<std::string, std::string>> requests;
        requests.reserve(m_plugin->m_pendingRequestId.size());
        for (const auto &request : m_plugin->m_pendingRequestId)
            requests.emplace_back(request.first, request.second);
        std::sort(requests.begin(), requests.end());

        const int firstRow = table.top + 19;
        if (requests.empty())
        {
            Text(hDC, RECT{table.left + 5, firstRow + 4, table.right - 5, firstRow + 24}, "No requests.", RGB(115, 120, 124), DT_LEFT | DT_SINGLELINE);
            return;
        }

        const int maxRows = std::max(1, static_cast<int>(table.bottom - firstRow) / 22);
        for (int i = 0; i < static_cast<int>(requests.size()) && i < maxRows; ++i)
        {
            RECT row{table.left, firstRow + i * 22, table.right, firstRow + (i + 1) * 22};
            if ((i % 2) == 0)
                FillSolid(hDC, row, C_GRID);
            Text(hDC, RECT{row.left + 5, row.top + 3, acidRight, row.bottom - 2}, requests[i].first, C_TEXT, DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
            Text(hDC, RECT{acidRight + 5, row.top + 3, statusRight, row.bottom - 2}, "RX", m_theme.rx, DT_LEFT | DT_SINGLELINE);
            Text(hDC, RECT{statusRight + 5, row.top + 3, utcRight, row.bottom - 2}, "--", C_MUTED, DT_LEFT | DT_SINGLELINE);
            Text(hDC, RECT{utcRight + 5, row.top + 3, row.right - 5, row.bottom - 2}, requests[i].second, C_TEXT, DT_LEFT | DT_SINGLELINE | DT_END_ELLIPSIS);
        }
    }

    void ElectronSidRow(
        HDC hDC,
        RECT row,
        const std::string &direction,
        const std::string &runway,
        const std::vector<std::string> &sids,
        const char *id)
    {
        FillSolid(hDC, row, C_PANEL);
        Text(hDC, RECT{row.left + 9, row.top + 7, row.right - 72, row.top + 27}, direction + " / RWY " + runway, RGB(157, 162, 166), DT_LEFT | DT_SINGLELINE);
        std::string joined = JoinSidList(sids);
        if (joined.empty())
            joined = "(no SIDs assigned)";
        Text(hDC, RECT{row.left + 9, row.top + 31, row.right - 72, row.bottom - 7}, joined, C_TEXT, DT_LEFT | DT_WORDBREAK | DT_END_ELLIPSIS);
        ElectronButton(hDC, RECT{row.right - 63, row.top + 24, row.right - 9, row.top + 51}, "Edit", id, false);
    }

    void DrawOperations(HDC hDC, int y)
    {
        RECT panel = m_plugin->m_settingsRect;
        SectionTitle(hDC, y, "LIVE SYSTEM STATE", "01");
        y += 30;

        RECT hopCard{panel.left + 24, y, panel.left + 350, y + 76};
        RECT cfgCard{panel.left + 366, y, panel.right - 24, y + 76};
        FillSolid(hDC, hopCard, C_PANEL);
        FillSolid(hDC, cfgCard, C_PANEL);
        Border(hDC, hopCard, m_plugin->m_hoppieMode ? C_GREEN : C_RED);
        Border(hDC, cfgCard, m_plugin->m_cfg.valid ? C_GREEN : C_AMBER);
        Lamp(hDC, hopCard.left + 16, hopCard.top + 16, m_plugin->m_hoppieMode ? C_GREEN : C_RED);
        Lamp(hDC, cfgCard.left + 16, cfgCard.top + 16, m_plugin->m_cfg.valid ? C_GREEN : C_AMBER);
        Text(hDC, RECT{hopCard.left + 36, hopCard.top + 9, hopCard.right - 10, hopCard.top + 31}, "HOPPIE LINK", C_MUTED, DT_LEFT | DT_SINGLELINE);
        Text(hDC, RECT{hopCard.left + 16, hopCard.top + 39, hopCard.right - 10, hopCard.bottom - 8}, m_plugin->m_hoppieMode ? "ONLINE / POLLING" : "OFFLINE", m_plugin->m_hoppieMode ? C_GREEN : C_RED, DT_LEFT | DT_SINGLELINE);
        Text(hDC, RECT{cfgCard.left + 36, cfgCard.top + 9, cfgCard.right - 10, cfgCard.top + 31}, "CONFIG AUTH", C_MUTED, DT_LEFT | DT_SINGLELINE);
        Text(hDC, RECT{cfgCard.left + 16, cfgCard.top + 39, cfgCard.right - 10, cfgCard.bottom - 8}, m_plugin->m_cfg.valid ? "LOGON READY" : "CREDENTIALS REQUIRED", m_plugin->m_cfg.valid ? C_GREEN : C_AMBER, DT_LEFT | DT_SINGLELINE);

        y += 96;
        SectionTitle(hDC, y, "HOPPIE CONTROL", "02");
        y += 30;
        Button(hDC, RECT{panel.left + 24, y, panel.left + 250, y + 42}, m_plugin->m_hoppieMode ? "HOPPIE: ENABLED" : "HOPPIE: DISABLED", "SET_HOPPIE_TOGGLE", m_plugin->m_hoppieMode, C_GREEN);
        Button(hDC, RECT{panel.left + 266, y, panel.left + 492, y + 42}, "TEST INCOMING PDC", "SET_TEST_PDC", false, C_AMBER);
        Button(hDC, RECT{panel.left + 508, y, panel.right - 24, y + 42}, m_plugin->m_cfg.confirmEveryPdc ? "CONFIRM ALL: ON" : "CONFIRM ALL: OFF", "SET_CONFIRM_EVERY", m_plugin->m_cfg.confirmEveryPdc, C_AMBER);

        y += 68;
        SectionTitle(hDC, y, "CYYZ AIRPORT OPERATION", "03");
        y += 30;
        Button(hDC, RECT{panel.left + 24, y, panel.left + 154, y + 38}, "WEST", "SET_DIR_WEST", m_plugin->m_cfg.airportDirection == "WEST", C_GREEN);
        Button(hDC, RECT{panel.left + 166, y, panel.left + 296, y + 38}, "EAST", "SET_DIR_EAST", m_plugin->m_cfg.airportDirection == "EAST", C_GREEN);
        Button(hDC, RECT{panel.left + 308, y, panel.left + 438, y + 38}, "OFF", "SET_DUALS_OFF", m_plugin->m_cfg.runwayAssignmentConfig == "off", C_GREEN);
        Button(hDC, RECT{panel.left + 592, y, panel.right - 24, y + 38}, "APPLY", "SET_APPLY_DUALS", false, C_AMBER);
        y += 48;
        Button(
            hDC, RECT{panel.left + 24, y, panel.left + 390, y + 38},
            "CONFIG: " + m_plugin->m_cfg.runwayAssignmentConfig,
            "SET_OPERATION_CYCLE", true, C_CYAN);

        y += 58;
        SectionTitle(hDC, y, "TRAFFIC MEMORY", "04");
        y += 30;
        RECT info{panel.left + 24, y, panel.right - 24, y + 64};
        FillSolid(hDC, info, C_PANEL);
        Border(hDC, info, C_LINE);
        std::ostringstream summary;
        summary << "DEPARTURE TRACKS " << m_plugin->m_departureListLastSeen.size()
                << "   RECONNECT CACHE " << m_plugin->m_departureReconnectSnapshots.size()
                << "   PENDING PDC " << m_plugin->m_pendingRequestId.size();
        Text(hDC, RECT{info.left + 16, info.top + 12, info.right - 16, info.bottom - 8}, summary.str(), C_CYAN, DT_LEFT | DT_SINGLELINE);
        Text(hDC, RECT{info.left + 16, info.top + 36, info.right - 16, info.bottom - 6}, "10 SEC SNAPSHOT // 20 MIN RESTORE WINDOW", C_MUTED, DT_LEFT | DT_SINGLELINE);
    }

    void DrawHoppie(HDC hDC, int y)
    {
        RECT panel = m_plugin->m_settingsRect;
        SectionTitle(hDC, y, "HOPPIE DATA LINK", "H1");
        y += 30;
        Button(hDC, RECT{panel.left + 24, y, panel.left + 250, y + 40}, m_plugin->m_hoppieMode ? "LINK ENABLED" : "LINK DISABLED", "SET_HOPPIE_TOGGLE", m_plugin->m_hoppieMode, C_GREEN);
        Button(hDC, RECT{panel.left + 266, y, panel.left + 430, y + 40}, m_plugin->m_cfg.testMode ? "TEST MODE ON" : "TEST MODE OFF", "SET_TEST_MODE", m_plugin->m_cfg.testMode, C_AMBER);
        Button(hDC, RECT{panel.left + 446, y, panel.left + 590, y + 40}, m_plugin->m_cfg.debugMode ? "DEBUG ON" : "DEBUG OFF", "SET_DEBUG_MODE", m_plugin->m_cfg.debugMode, C_AMBER);
        Button(hDC, RECT{panel.left + 606, y, panel.right - 24, y + 40}, "LINK TEST", "SET_HOPPIE_LINK_TEST", false, C_CYAN);

        y += 56;
        Button(hDC, RECT{panel.left + 24, y, panel.left + 190, y + 40}, m_plugin->m_cfg.pdcSoundEnabled ? "PDC SOUND ON" : "PDC SOUND MUTED", "SET_PDC_SOUND_TOGGLE", m_plugin->m_cfg.pdcSoundEnabled, C_GREEN);
        Button(hDC, RECT{panel.left + 202, y, panel.left + 332, y + 40}, "TEST PDC", "SET_PDC_SOUND_TEST", false, C_AMBER);
        Button(hDC, RECT{panel.left + 344, y, panel.left + 510, y + 40}, m_plugin->m_cfg.ifrSoundEnabled ? "IFR SOUND ON" : "IFR SOUND MUTED", "SET_IFR_SOUND_TOGGLE", m_plugin->m_cfg.ifrSoundEnabled, C_GREEN);
        Button(hDC, RECT{panel.left + 522, y, panel.left + 652, y + 40}, "TEST IFR", "SET_IFR_SOUND_TEST", false, C_AMBER);

        y += 56;
        Field(hDC, y, "HOPPIE LOGON CODE", m_plugin->m_cfg.logonCode, "SET_EDIT_LOGON", true);
        y += 56;
        Field(hDC, y, "STATION / LOGON", m_plugin->m_cfg.stationCode, "SET_EDIT_STATION");
        y += 56;
        Field(hDC, y, "POLL INTERVAL (SEC)", std::to_string(m_plugin->m_cfg.pollSeconds), "SET_EDIT_POLL");
        y += 56;
        Field(hDC, y, "PDC REQUEST SOUND", m_plugin->m_cfg.pdcRequestSound, "SET_EDIT_PDC_SOUND");
        y += 56;
        Field(hDC, y, "IFR RELEASE SOUND", m_plugin->m_cfg.ifrReleaseSound, "SET_EDIT_IFR_SOUND");

        RECT stateRc{panel.left + 24, y + 62, panel.right - 24, y + 91};
        Text(hDC, stateRc, m_plugin->m_cfg.valid ? "AUTH STATE: READY" : "AUTH STATE: LOGON CODE AND STATION REQUIRED", m_plugin->m_cfg.valid ? C_GREEN : C_AMBER, DT_LEFT | DT_SINGLELINE);
    }

    void DrawSidMatrix(HDC hDC, int y)
    {
        SectionTitle(hDC, y, "JSON-BACKED CYYZ SID / RUNWAY MATRIX", "S1");
        y += 30;
        SidRow(hDC, y, "WEST", "23", m_plugin->m_cfg.duals23Rwy23, "SET_SID_D23_23");
        y += 84;
        SidRow(hDC, y, "WEST", "24R", m_plugin->m_cfg.duals23Rwy24R, "SET_SID_D23_24R");
        y += 84;
        SidRow(hDC, y, "EAST", "05", m_plugin->m_cfg.duals05Rwy05, "SET_SID_D05_05");
        y += 84;
        SidRow(hDC, y, "EAST", "06L", m_plugin->m_cfg.duals05Rwy06L, "SET_SID_D05_06L");

        RECT note{m_plugin->m_settingsRect.left + 24, y + 92, m_plugin->m_settingsRect.right - 24, y + 122};
        Text(hDC, note, "BASE SID NAMES ONLY // SPACE OR COMMA SEPARATED // SAVE CONFIG TO COMMIT", C_MUTED, DT_LEFT | DT_SINGLELINE);
    }

    void StartEdit(const std::string &id, RECT area)
    {
        int functionId = 0;
        std::string initial;

        if (id == "SET_EDIT_LOGON")
        {
            functionId = FUNC_SETTINGS_EDIT_HOPPIE_LOGON;
            initial = m_plugin->m_cfg.logonCode;
        }
        else if (id == "SET_EDIT_STATION")
        {
            functionId = FUNC_SETTINGS_EDIT_STATION_CODE;
            initial = m_plugin->m_cfg.stationCode;
        }
        else if (id == "SET_EDIT_POLL")
        {
            functionId = FUNC_SETTINGS_EDIT_POLL_SECONDS;
            initial = std::to_string(m_plugin->m_cfg.pollSeconds);
        }
        else if (id == "SET_EDIT_AUDIO_REPLAY_MINUTES")
        {
            functionId = FUNC_SETTINGS_EDIT_AUDIO_REPLAY_MINUTES;
            initial = std::to_string(m_plugin->AudioReplayMinutes());
        }
        else if (id == "SET_EDIT_REPLAY_SAVE_COMMAND")
        {
            functionId = FUNC_SETTINGS_EDIT_REPLAY_SAVE_COMMAND;
            initial = m_plugin->ReplaySaveCommandSuffix();
        }
        else if (id == "SET_EDIT_PDC_SOUND")
        {
            functionId = FUNC_SETTINGS_EDIT_PDC_SOUND;
            initial = m_plugin->m_cfg.pdcRequestSound;
        }
        else if (id == "SET_EDIT_IFR_SOUND")
        {
            functionId = FUNC_SETTINGS_EDIT_IFR_SOUND;
            initial = m_plugin->m_cfg.ifrReleaseSound;
        }
        else if (id == "SET_SID_D23_23")
        {
            functionId = FUNC_SIDS_EDIT_DUALS23_23;
            initial = JoinSidList(m_plugin->m_cfg.duals23Rwy23);
        }
        else if (id == "SET_SID_D23_24R")
        {
            functionId = FUNC_SIDS_EDIT_DUALS23_24R;
            initial = JoinSidList(m_plugin->m_cfg.duals23Rwy24R);
        }
        else if (id == "SET_SID_D05_05")
        {
            functionId = FUNC_SIDS_EDIT_DUALS05_05;
            initial = JoinSidList(m_plugin->m_cfg.duals05Rwy05);
        }
        else if (id == "SET_SID_D05_06L")
        {
            functionId = FUNC_SIDS_EDIT_DUALS05_06L;
            initial = JoinSidList(m_plugin->m_cfg.duals05Rwy06L);
        }

        if (functionId != 0)
        {
            const bool multiline =
                functionId == FUNC_SIDS_EDIT_DUALS23_23 ||
                functionId == FUNC_SIDS_EDIT_DUALS23_24R ||
                functionId == FUNC_SIDS_EDIT_DUALS05_05 ||
                functionId == FUNC_SIDS_EDIT_DUALS05_06L;
            std::string edited;
            const ThemePalette theme = GetThemePalette(m_plugin->m_cfg.uiTheme);
            if (ShowDarkTextEditor("ATC CONFIG EDIT", initial, multiline, m_plugin->m_cfg.uiTheme, theme, edited))
                m_plugin->HandleSettingsEdit(functionId, edited.c_str());
        }
    }
};

CRadarScreen *CZYZToolsPlugin::OnRadarScreenCreated(const char *, bool, bool, bool, bool)
{
    WriteAuditLog("settings_screen_created", "result=ready");
    return new CSettingsScreen(this);
}

static CZYZToolsPlugin *g_plugin = nullptr;

void __declspec(dllexport) EuroScopePlugInInit(EuroScopePlugIn::CPlugIn **ppPlugInInstance)
{
    if (!ppPlugInInstance)
        return;
    g_plugin = new CZYZToolsPlugin();
    *ppPlugInInstance = g_plugin;
}

void __declspec(dllexport) EuroScopePlugInExit(void)
{
    delete g_plugin;
    g_plugin = nullptr;
}
