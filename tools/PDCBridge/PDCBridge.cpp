#include "../../src/BuildChannel.h"
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

#include <cstdio>
#include <cstring>
#include <string>
#include <sstream>

static std::string ExecutableDirectory()
{
    char path[MAX_PATH]{};
    const DWORD length = GetModuleFileNameA(nullptr, path, MAX_PATH);
    if (length == 0 || length >= MAX_PATH)
        return "";
    std::string full(path, length);
    const size_t slash = full.find_last_of("\\/");
    return slash == std::string::npos ? "" : full.substr(0, slash + 1);
}

static std::string LoadOpenChatCommand()
{
    const std::string iniPath = ExecutableDirectory() + "PDCBridge.ini";
    char value[512]{};
    GetPrivateProfileStringA(
        "pdcbridge", "open_chat_command", ".chat {CALLSIGN}",
        value, static_cast<DWORD>(sizeof(value)), iniPath.c_str());
    return value;
}

static std::string ExpandCallsign(std::string command, const std::string &callsign)
{
    const std::string token = "{CALLSIGN}";
    const size_t position = command.find(token);
    if (position == std::string::npos)
        return command + " " + callsign;
    command.replace(position, token.size(), callsign);
    return command;
}

// Very small JSON-ish parser for: {"callsign":"...","pdc":"..."}\n
static bool ExtractField(const std::string &s, const char *key, std::string &out)
{
    std::string k = std::string("\"") + key + "\":\"";
    auto p = s.find(k);
    if (p == std::string::npos)
        return false;
    p += k.size();
    std::string v;
    while (p < s.size())
    {
        char c = s[p++];
        if (c == '\\')
        {
            if (p >= s.size())
                break;
            char n = s[p++];
            if (n == 'n')
                v.push_back('\n');
            else
                v.push_back(n);
        }
        else if (c == '"')
        {
            break;
        }
        else
        {
            v.push_back(c);
        }
    }
    out = v;
    return true;
}

static void CopyToClipboard(const std::string &text)
{
    if (!OpenClipboard(nullptr))
        return;
    EmptyClipboard();

    HGLOBAL h = GlobalAlloc(GMEM_MOVEABLE, text.size() + 1);
    if (!h)
    {
        CloseClipboard();
        return;
    }

    char *p = (char *)GlobalLock(h);
    memcpy(p, text.c_str(), text.size() + 1);
    GlobalUnlock(h);

    SetClipboardData(CF_TEXT, h);
    CloseClipboard();
}

// Types into the focused window (EuroScope) without pressing Enter.
static void TypeText(const std::string &text)
{
    for (char ch : text)
    {
        SHORT vk = VkKeyScanA(ch);
        BYTE vkCode = LOBYTE(vk);
        BYTE shift = HIBYTE(vk);

        // Handle shift
        if (shift & 1)
            keybd_event(VK_SHIFT, 0, 0, 0);

        keybd_event((BYTE)vkCode, 0, 0, 0);
        keybd_event((BYTE)vkCode, 0, KEYEVENTF_KEYUP, 0);

        if (shift & 1)
            keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, 0);

        Sleep(2);
    }
}

static void ResetEuroScopeCommandLine()
{
    // Escape clears/cancels the active EuroScope command without editing text.
    keybd_event(VK_ESCAPE, 0, 0, 0);
    keybd_event(VK_ESCAPE, 0, KEYEVENTF_KEYUP, 0);
    Sleep(40);
}

int main()
{
    HANDLE singleton = CreateMutexA(nullptr, TRUE, ZYZTOOLS_BRIDGE_MUTEX);
    if (!singleton)
        return 1;
    if (GetLastError() == ERROR_ALREADY_EXISTS)
    {
        CloseHandle(singleton);
        return 0;
    }

    const char *pipeName = ZYZTOOLS_BRIDGE_PIPE;
    const std::string openChatCommand = LoadOpenChatCommand();
    printf("Preferred CYYZ PDC Bridge running. Pipe: %s\n", pipeName);
    printf("Chat command template: %s\n", openChatCommand.c_str());
    printf("Keep EuroScope focused when you click the PDC flag.\n\n");

    bool running = true;
    while (running)
    {
        HANDLE hPipe = CreateNamedPipeA(
            pipeName,
            PIPE_ACCESS_INBOUND,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
            1, 4096, 4096, 0, nullptr);

        if (hPipe == INVALID_HANDLE_VALUE)
        {
            printf("CreateNamedPipe failed.\n");
            return 1;
        }

        BOOL connected = ConnectNamedPipe(hPipe, nullptr) ? TRUE : (GetLastError() == ERROR_PIPE_CONNECTED);
        if (!connected)
        {
            CloseHandle(hPipe);
            continue;
        }

        std::string buf;
        buf.resize(8192);
        DWORD read = 0;
        if (ReadFile(hPipe, buf.data(), (DWORD)buf.size() - 1, &read, nullptr) && read > 0)
        {
            buf[read] = 0;
            std::string line = buf.c_str();

            if (line.find("\"command\":\"shutdown\"") != std::string::npos)
            {
                printf("Shutdown requested by EuroScope plugin.\n");
                running = false;
            }

            std::string callsign, pdc;
            if (running &&
                ExtractField(line, "callsign", callsign) &&
                ExtractField(line, "pdc", pdc))
            {
                // Always use the NEW callsign from the message.
                CopyToClipboard(pdc);

                const std::string openCmd = ExpandCallsign(openChatCommand, callsign);

                // Cancel any unfinished EuroScope command before opening chat.
                ResetEuroScopeCommandLine();

                // Type open command, press Enter, then paste the PDC.
                TypeText(openCmd);
                keybd_event(VK_RETURN, 0, 0, 0);
                keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, 0);

                Sleep(80);

                // Ctrl+V
                keybd_event(VK_CONTROL, 0, 0, 0);
                keybd_event('V', 0, 0, 0);
                keybd_event('V', 0, KEYEVENTF_KEYUP, 0);
                keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
                Sleep(50); // small delay to ensure paste completes

                // Press Enter to send the message
                keybd_event(VK_RETURN, 0, 0, 0);
                keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, 0);

                printf("OK: %s PDC sent\n", callsign.c_str());
            }
            else if (running)
            {
                printf("Bad payload: %s\n", line.c_str());
            }
        }

        DisconnectNamedPipe(hPipe);
        CloseHandle(hPipe);
    }

    CloseHandle(singleton);
}
