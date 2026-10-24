param([ValidateSet('test','production')][string]$Channel = 'test')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $workspace
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$visualStudio = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$visualStudio) { throw 'Visual Studio C++ tools are required.' }
$vcvars = Join-Path $visualStudio 'VC/Auxiliary/Build/vcvarsall.bat'
$output = Join-Path $workspace "build/channels/$Channel/plugin"
New-Item -ItemType Directory -Force -Path $output | Out-Null
$payload = @('PreferredCYYZPdcPlugin.json','EuroScopePlugInDll.dll','PDCBridge.ini','pdc_request.wav','cpdlc_rx.wav','IFR_release.wav','DEPARTURE_LIST_SETUP.md')
foreach($file in $payload) { Copy-Item -LiteralPath (Join-Path $workspace "build/$file") -Destination (Join-Path $output $file) }
$define = if($Channel -eq 'test') {'/DZYZTOOLS_TEST_BUILD'} else {''}
function Compile([string]$architecture, [string]$arguments) {
  $command = 'call "' + $vcvars + '" ' + $architecture + ' && cl /nologo /EHsc /MD /std:c++17 ' + $define + ' ' + $arguments
  & $env:COMSPEC /d /s /c $command
  if($LASTEXITCODE -ne 0) { throw "Native $Channel build failed." }
}
Get-ChildItem -LiteralPath (Join-Path $workspace 'assets/conflict') -File | Copy-Item -Destination $output
& (Join-Path $workspace 'tools/Build-ConflictSounds.ps1') -Output $output
Compile 'x86' ('/LD /I SDK /Fo"' + $output + '\\" src\ZYZToolsPlugin.cpp src\conflict\Engine.cpp src\conflict\SituDraw.cpp src\conflict\Sequencing.cpp /link /LIBPATH:SDK EuroScopePlugInDll.lib Winhttp.lib Winmm.lib Gdi32.lib User32.lib /OUT:"' + $output + '\PreferredCYYZPdcPlugin.dll" /IMPLIB:"' + $output + '\Plugin.lib"')
Compile 'x86' ('/Fo"' + $output + '\Bridge.obj" tools\PDCBridge\PDCBridge.cpp /link User32.lib /OUT:"' + $output + '\PreferredCYYZPdcBridge.exe"')
Compile 'x64' ('/Fo"' + $output + '\Replay.obj" tools\AudioReplay\AudioReplay.cpp /link Ole32.lib Mmdevapi.lib Shell32.lib Version.lib /OUT:"' + $output + '\PreferredCYYZAudioReplay.exe"')
Write-Output "Built isolated native $Channel payload."
