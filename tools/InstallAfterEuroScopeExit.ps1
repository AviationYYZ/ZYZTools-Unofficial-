param(
    [Parameter(Mandatory = $true)]
    [int]$EuroScopePid,

    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,

    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = 'Stop'

$sourceRootResolved = [IO.Path]::GetFullPath($SourceRoot)
$destinationResolved = [IO.Path]::GetFullPath($Destination)

$euroScope = Get-Process -Id $EuroScopePid -ErrorAction SilentlyContinue
if ($euroScope) {
    $euroScope.WaitForExit()
}

$deadline = (Get-Date).AddSeconds(15)
do {
    $runtimeProcesses = Get-Process PreferredCYYZAudioReplay, PreferredCYYZPdcBridge -ErrorAction SilentlyContinue
    if (-not $runtimeProcesses) {
        break
    }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)

$files = @(
    @('build\PreferredCYYZPdcPlugin.dll', 'PreferredCYYZPdcPlugin.dll'),
    @('build\PreferredCYYZPdcBridge.exe', 'PreferredCYYZPdcBridge.exe'),
    @('build\PreferredCYYZAudioReplay.exe', 'PreferredCYYZAudioReplay.exe'),
    @('build\EuroScopePlugInDll.dll', 'EuroScopePlugInDll.dll'),
    @('build\pdc_request.wav', 'pdc_request.wav'),
    @('build\cpdlc_rx.wav', 'cpdlc_rx.wav'),
    @('build\IFR_release.wav', 'IFR_release.wav'),
    @('build\DEPARTURE_LIST_SETUP.md', 'DEPARTURE_LIST_SETUP.md'),
    @('README.md', 'README.md'),
    @('installer\CHANGELOG.md', 'CHANGELOG.md')
)

$results = foreach ($file in $files) {
    $source = Join-Path $sourceRootResolved $file[0]
    $target = Join-Path $destinationResolved $file[1]
    Copy-Item -LiteralPath $source -Destination $target -Force
    [pscustomobject]@{
        File = $file[1]
        SHA256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    }
}

$logPath = Join-Path $destinationResolved 'PreferredCYYZPdcPlugin-update.log'
$results |
    Format-Table -AutoSize |
    Out-String |
    Set-Content -LiteralPath $logPath -Encoding UTF8
