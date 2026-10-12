@echo off
setlocal EnableExtensions

cd /d "%~dp0"

REM Open the "x86 Native Tools Command Prompt for VS" before running this.
REM Put the EuroScope SDK files into .\SDK first:
REM   - EuroScopePlugIn.h
REM   - EuroScopePlugInDll.dll
REM   - EuroScopePlugInDll.lib

where cl.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: cl.exe not found.
  echo Run this from the x86 Native Tools Command Prompt for Visual Studio.
  echo.
  pause
  exit /b 1
)

if not exist "SDK\EuroScopePlugIn.h" (
  echo ERROR: Missing SDK\EuroScopePlugIn.h
  echo.
  pause
  exit /b 1
)

if not exist "SDK\EuroScopePlugInDll.lib" (
  echo ERROR: Missing SDK\EuroScopePlugInDll.lib
  echo.
  pause
  exit /b 1
)

if not exist "assets\sounds\pdc_request.wav" (
  echo ERROR: Missing assets\sounds\pdc_request.wav
  echo.
  pause
  exit /b 1
)

if not exist "assets\sounds\IFR_release.wav" (
  echo ERROR: Missing assets\sounds\IFR_release.wav
  echo.
  pause
  exit /b 1
)

if not exist "docs\DEPARTURE_LIST_SETUP.md" (
  echo ERROR: Missing docs\DEPARTURE_LIST_SETUP.md
  echo.
  pause
  exit /b 1
)

if not exist build mkdir build

del /q "build\PreferredCYYZPdcPlugin.dll" 2>nul
del /q "build\PreferredCYYZPdcPlugin.lib" 2>nul
del /q "build\PreferredCYYZPdcPlugin.exp" 2>nul
del /q "build\PreferredCYYZPdcPlugin.obj" 2>nul
del /q "build\PreferredCYYZPdcPlugin.pdb" 2>nul
del /q "build\PreferredCYYZPdcBridge.exe" 2>nul
del /q "build\PreferredCYYZPdcBridge.obj" 2>nul
del /q "build\PreferredCYYZPdcBridge.pdb" 2>nul
del /q "build\PreferredCYYZAudioReplay.exe" 2>nul
del /q "build\PreferredCYYZAudioReplay.obj" 2>nul
del /q "build\PreferredCYYZAudioReplay.pdb" 2>nul

cl /nologo /LD /EHsc /MD /std:c++17 ^
  /I "SDK" ^
  /Fo"build\PreferredCYYZPdcPlugin.obj" ^
  src\ZYZToolsPlugin.cpp ^
  /link ^
  /LIBPATH:"SDK" ^
  EuroScopePlugInDll.lib ^
  Winhttp.lib ^
  Winmm.lib ^
  Gdi32.lib ^
  User32.lib ^
  /OUT:"build\PreferredCYYZPdcPlugin.dll" ^
  /IMPLIB:"build\PreferredCYYZPdcPlugin.lib"

if errorlevel 1 (
  echo.
  echo BUILD FAILED.
  echo.
  pause
  exit /b 1
)

cl /nologo /EHsc /MD /std:c++17 ^
  /Fo"build\PreferredCYYZPdcBridge.obj" ^
  tools\PDCBridge\PDCBridge.cpp ^
  /link ^
  User32.lib ^
  /OUT:"build\PreferredCYYZPdcBridge.exe"

if errorlevel 1 (
  echo.
  echo BUILD FAILED: PreferredCYYZPdcBridge.exe did not compile.
  echo.
  pause
  exit /b 1
)

set "VCVARSALL_X64="
if defined VCINSTALLDIR if exist "%VCINSTALLDIR%Auxiliary\Build\vcvarsall.bat" set "VCVARSALL_X64=%VCINSTALLDIR%Auxiliary\Build\vcvarsall.bat"
if not defined VCVARSALL_X64 if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" (
  for /f "usebackq delims=" %%I in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSINSTALLDIR_DETECTED=%%I"
  if defined VSINSTALLDIR_DETECTED if exist "%VSINSTALLDIR_DETECTED%\VC\Auxiliary\Build\vcvarsall.bat" set "VCVARSALL_X64=%VSINSTALLDIR_DETECTED%\VC\Auxiliary\Build\vcvarsall.bat"
)
if not defined VCVARSALL_X64 (
  echo.
  echo BUILD FAILED: could not find vcvarsall.bat to build the x64 audio replay helper.
  echo.
  pause
  exit /b 1
)

echo Switching to x64 tools for PreferredCYYZAudioReplay.exe...
call "%VCVARSALL_X64%" x64
if errorlevel 1 (
  echo.
  echo BUILD FAILED: could not initialize the x64 Visual C++ toolchain.
  echo.
  pause
  exit /b 1
)

cl /nologo /EHsc /MD /std:c++17 ^
  /Fo"build\PreferredCYYZAudioReplay.obj" ^
  tools\AudioReplay\AudioReplay.cpp ^
  /link ^
  Ole32.lib ^
  Mmdevapi.lib ^
  Shell32.lib ^
  Version.lib ^
  /OUT:"build\PreferredCYYZAudioReplay.exe"

if errorlevel 1 (
  echo.
  echo BUILD FAILED: PreferredCYYZAudioReplay.exe did not compile.
  echo.
  pause
  exit /b 1
)

if not exist "build\PreferredCYYZPdcPlugin.dll" (
  echo.
  echo BUILD FAILED: compiler finished but build\PreferredCYYZPdcPlugin.dll was not created.
  echo.
  pause
  exit /b 1
)

if not exist "build\PreferredCYYZPdcBridge.exe" (
  echo.
  echo BUILD FAILED: compiler finished but build\PreferredCYYZPdcBridge.exe was not created.
  echo.
  pause
  exit /b 1
)

if not exist "build\PreferredCYYZAudioReplay.exe" (
  echo.
  echo BUILD FAILED: compiler finished but build\PreferredCYYZAudioReplay.exe was not created.
  echo.
  pause
  exit /b 1
)

if exist "SDK\EuroScopePlugInDll.dll" copy /Y "SDK\EuroScopePlugInDll.dll" "build\" >nul
if exist "PreferredCYYZPdcPlugin.json" copy /Y "PreferredCYYZPdcPlugin.json" "build\" >nul
if exist "tools\PDCBridge\PDCBridge.ini" copy /Y "tools\PDCBridge\PDCBridge.ini" "build\" >nul
if exist "assets\sounds\pdc_request.wav" copy /Y "assets\sounds\pdc_request.wav" "build\" >nul
if exist "assets\sounds\pdc_request.wav" copy /Y "assets\sounds\pdc_request.wav" "build\cpdlc_rx.wav" >nul
if exist "assets\sounds\IFR_release.wav" copy /Y "assets\sounds\IFR_release.wav" "build\" >nul
if exist "docs\DEPARTURE_LIST_SETUP.md" copy /Y "docs\DEPARTURE_LIST_SETUP.md" "build\" >nul

if not exist "build\pdc_request.wav" (
  echo.
  echo BUILD FAILED: pdc_request.wav was not copied.
  echo.
  pause
  exit /b 1
)

if not exist "build\IFR_release.wav" (
  echo.
  echo BUILD FAILED: IFR_release.wav was not copied.
  echo.
  pause
  exit /b 1
)

if not exist "build\DEPARTURE_LIST_SETUP.md" (
  echo.
  echo BUILD FAILED: departure-list guide was not copied.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo BUILD SUCCESS
echo ============================================================
echo Plugin DLL:
echo   %CD%\build\PreferredCYYZPdcPlugin.dll
echo PDC Bridge:
echo   %CD%\build\PreferredCYYZPdcBridge.exe
echo Audio replay helper:
echo   %CD%\build\PreferredCYYZAudioReplay.exe
echo Included sounds:
echo   %CD%\build\pdc_request.wav
echo   %CD%\build\IFR_release.wav
echo Departure-list guide:
echo   %CD%\build\DEPARTURE_LIST_SETUP.md
echo.
echo Config copied:
if exist "build\PreferredCYYZPdcPlugin.json" (
  echo   %CD%\build\PreferredCYYZPdcPlugin.json
) else (
  echo   WARNING: PreferredCYYZPdcPlugin.json was not found to copy.
)
echo.
echo Load the DLL from the build folder in EuroScope so it finds PreferredCYYZPdcPlugin.json beside it.
echo.
pause

endlocal
