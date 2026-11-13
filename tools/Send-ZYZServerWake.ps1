[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{12}$')]
    [string]$MacAddress,
    [string]$Broadcast = '255.255.255.255',
    [ValidateRange(1,65535)][int]$Port = 9,
    [switch]$Preview
)
$ip = [System.Net.IPAddress]::Parse($Broadcast)
if ($ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'Use an IPv4 LAN broadcast address.'
}
$hex = $MacAddress -replace '[:-]', ''
[byte[]]$mac = for ($i = 0; $i -lt 12; $i += 2) { [Convert]::ToByte($hex.Substring($i, 2), 16) }
if (($mac[0] -band 1) -ne 0 -or -not ($mac | Where-Object { $_ -ne 0 })) {
    throw 'Enter the wired Ethernet adapter MAC address of the server PC.'
}
[byte[]]$packet = [byte[]]::new(102)
for ($i = 0; $i -lt 6; $i++) { $packet[$i] = 255 }
for ($i = 0; $i -lt 16; $i++) { [Array]::Copy($mac, 0, $packet, 6 + 6 * $i, 6) }
if ($Preview) { return [BitConverter]::ToString($packet).Replace('-', '') }
$udp = [System.Net.Sockets.UdpClient]::new()
try {
    $udp.EnableBroadcast = $true
    $endpoint = [System.Net.IPEndPoint]::new($ip, $Port)
    for ($i = 0; $i -lt 3; $i++) {
        [void]$udp.Send($packet, $packet.Length, $endpoint)
        if ($i -lt 2) { Start-Sleep -Milliseconds 150 }
    }
    Write-Output "Wake packet sent to $($ip.IPAddressToString):$Port. This does not confirm that the PC powered on."
} finally { $udp.Dispose() }
