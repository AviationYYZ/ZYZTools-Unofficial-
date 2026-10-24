#pragma once
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include "Engine.h"
#include <functional>
namespace draw {
using Lookup=std::function<ca::Stage(const std::string&)>;
void setLookup(Lookup lookup);
bool install(HMODULE module);
void uninstall();
bool installed();
int WINAPI render(HDC,LPCSTR,int,LPRECT,UINT);
}
