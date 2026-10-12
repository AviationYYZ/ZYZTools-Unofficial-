$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$fixture = Join-Path $workspace ('.temp/side-by-side-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $fixture | Out-Null
$originalRoaming = $env:APPDATA
$originalLocal = $env:LOCALAPPDATA
$launched = @()
try {
  $env:APPDATA = Join-Path $fixture 'roaming'
  $env:LOCALAPPDATA = Join-Path $fixture 'local'
  New-Item -ItemType Directory -Force -Path $env:APPDATA,$env:LOCALAPPDATA | Out-Null
  foreach($kind in @('production','test')) {
    $exe = if($kind -eq 'test') {'ZYZTools test.exe'} else {'ZYZTools.exe'}
    $folder = if($kind -eq 'test') {'ZYZTools-test'} else {'PreferredCYYZPdcPlugin'}
    $appFile = Join-Path $workspace "installer/dist/$kind/win-ia32-unpacked/$exe"
    $pluginFolder = Join-Path $fixture "plugins/$folder"
    $launched += Start-Process -FilePath $appFile -ArgumentList @('--plugin-dir',('"' + $pluginFolder + '"')) -WindowStyle Hidden -PassThru
  }
  $prodConfig = Join-Path $env:APPDATA 'PreferredCYYZPdcPlugin/PreferredCYYZPdcPlugin.json'
  $testConfig = Join-Path $env:APPDATA 'ZYZTools-test/PreferredCYYZPdcPlugin.json'
  for($attempt = 0; $attempt -lt 100; $attempt++) {
    if((Test-Path -LiteralPath $prodConfig) -and (Test-Path -LiteralPath $testConfig)) { break }
    Start-Sleep -Milliseconds 200
  }
  if(!(Test-Path -LiteralPath $prodConfig) -or !(Test-Path -LiteralPath $testConfig)) { throw 'Both packaged apps must initialize their own settings.' }
  foreach($process in $launched) {
    $process.Refresh()
    if($process.HasExited) { throw 'An app closed while the other channel was running.' }
  }
  Write-Output 'PASS: packaged production and test apps both run concurrently, using separate scratch settings.'
  $launched | ForEach-Object { Get-Process -Id $_.Id | Select-Object Id,ProcessName,MainWindowTitle }
} finally {
  $env:APPDATA = $originalRoaming
  $env:LOCALAPPDATA = $originalLocal
  $owned = @($launched | ForEach-Object { $_.Id })
  $processes = @(Get-CimInstance Win32_Process)
  for($depth = 0; $depth -lt 5; $depth++) {
    foreach($process in $processes) {
      if($owned -contains $process.ParentProcessId -and $owned -notcontains $process.ProcessId) { $owned += $process.ProcessId }
    }
  }
  foreach($processId in $owned) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue }
}
