$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'Prepare-Tunnel.ps1')
$output=Join-Path $root 'installer/dist/room-server'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw '.NET Framework C# compiler not found.' }
$arguments=@('/nologo','/target:winexe','/platform:x86','/optimize+','/r:System.Core.dll','/r:System.Security.dll','/r:System.ServiceProcess.dll','/r:System.Configuration.Install.dll','/r:System.Web.Extensions.dll','/r:System.Windows.Forms.dll','/r:System.Drawing.dll',('/out:'+(Join-Path $output 'ZYZTools-Room-Server-Setup-0.1.0.exe')),('/resource:'+(Join-Path $root 'build/Tunnel/cloudflared.exe')+',cloudflared'),('/resource:'+(Join-Path $root 'build/Tunnel/LICENSE-cloudflared.txt')+',cloudflare-license'),(Join-Path $root 'tools/RoomServer/RoomDirectory.cs'),(Join-Path $root 'tools/RoomServer/Program.cs'))
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'Room server compilation failed.' }
Write-Output ('Built standalone room server setup: '+(Join-Path $output 'ZYZTools-Room-Server-Setup-0.1.0.exe')+'; not installed or published.')
