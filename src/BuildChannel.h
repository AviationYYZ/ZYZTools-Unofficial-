#pragma once
#ifdef ZYZTOOLS_TEST_BUILD
#define ZYZTOOLS_PLUGIN_NAME "ZYZTools test"
#define ZYZTOOLS_APP_EXE "ZYZTools test.exe"
#define ZYZTOOLS_BRIDGE_PIPE R"(\\.\pipe\PreferredCYYZPdcBridge.Test)"
#define ZYZTOOLS_REPLAY_PIPE R"(\\.\pipe\PreferredCYYZAudioReplay.Test)"
#define ZYZTOOLS_BRIDGE_MUTEX "Local\\PreferredCYYZPdcBridge.Test.Singleton"
#define ZYZTOOLS_REPLAY_MUTEX L"Local\\PreferredCYYZAudioReplay.Test.Singleton"
#define ZYZTOOLS_CHANNEL "test"
#else
#define ZYZTOOLS_PLUGIN_NAME "ZYZTools"
#define ZYZTOOLS_APP_EXE "ZYZTools.exe"
#define ZYZTOOLS_BRIDGE_PIPE R"(\\.\pipe\PreferredCYYZPdcBridge)"
#define ZYZTOOLS_REPLAY_PIPE R"(\\.\pipe\PreferredCYYZAudioReplay)"
#define ZYZTOOLS_BRIDGE_MUTEX "Local\\PreferredCYYZPdcBridge.Singleton"
#define ZYZTOOLS_REPLAY_MUTEX L"Local\\PreferredCYYZAudioReplay.Singleton"
#define ZYZTOOLS_CHANNEL "production"
#endif
