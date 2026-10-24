$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
$vswhere=Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$vs=& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
$vcvars=Join-Path $vs 'VC/Auxiliary/Build/vcvarsall.bat'
$output=Join-Path $root 'build/conflict-tests'
New-Item -ItemType Directory -Force -Path $output | Out-Null
foreach($test in @('EngineTests','RenderTests','SequencingTests')){
  $extra=if($test -eq 'RenderTests'){'src\conflict\SituDraw.cpp'}elseif($test -eq 'SequencingTests'){'src\conflict\Sequencing.cpp'}else{''}
  $command='call "'+$vcvars+'" x86 && cl /nologo /EHsc /std:c++17 /I src\conflict /Fo"'+$output+'\\" src\conflict\tests\'+$test+'.cpp src\conflict\Engine.cpp '+$extra+' /link User32.lib Gdi32.lib /OUT:"'+$output+'\'+$test+'.exe"'
  & $env:COMSPEC /d /s /c $command
  if($LASTEXITCODE -ne 0){throw "Conflict test compile failed: $test"}
  Push-Location -LiteralPath $output
  try{& (Join-Path $output "$test.exe");if($LASTEXITCODE -ne 0){throw "Conflict test failed: $test"}}finally{Pop-Location}
}
