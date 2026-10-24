param([ValidateSet('test','production')][string]$Channel='test')
$ErrorActionPreference = 'Stop'
$runtime = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime.json') -Raw | ConvertFrom-Json).executable
if (-not (Test-Path -LiteralPath $runtime -PathType Leaf)) { throw 'ZYZTools runtime is missing. Use Set up / repair pilot plugin in ZYZTools.' }
$env:ELECTRON_RUN_AS_NODE = '1'
& $runtime (Join-Path $PSScriptRoot 'server.cjs') $Channel
exit $LASTEXITCODE
