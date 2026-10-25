$ErrorActionPreference='Stop'
function FileHash([string]$file) {
    $stream=[IO.File]::OpenRead($file); $sha=[Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() } finally { $stream.Dispose(); $sha.Dispose() }
}
function Download([string]$url,[string]$file) {
    $client=New-Object Net.WebClient
    try { $client.DownloadFile($url,$file) } finally { $client.Dispose() }
}
$root=Split-Path -Parent $PSScriptRoot
$release=Get-Content -Raw -LiteralPath (Join-Path $root 'electron-app/src/training-tunnel-release.json') | ConvertFrom-Json
$folder=Join-Path $root 'build/Tunnel'
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$target=Join-Path $folder $release.file
if (!(Test-Path -LiteralPath $target) -or (FileHash $target) -ne $release.sha256) {
    $temp=Join-Path $folder 'cloudflared.download'
    Download $release.url $temp
    if ((FileHash $temp) -ne $release.sha256) { throw 'Bundled tunnel helper checksum mismatch; no executable was installed.' }
    Move-Item -LiteralPath $temp -Destination $target -Force
}
$license=Join-Path $folder 'LICENSE-cloudflared.txt'
if (!(Test-Path -LiteralPath $license)) { Download ('https://raw.githubusercontent.com/cloudflare/cloudflared/'+$release.version+'/LICENSE') $license }
Write-Output ('Verified bundled cloudflared '+$release.version+' (SHA256 pinned); nothing published.')
