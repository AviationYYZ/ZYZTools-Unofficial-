param([Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force -Path $Output | Out-Null
foreach($kind in @('caution','urgent')) {
  $rate=22050
  $duration=if($kind -eq 'urgent'){0.75}else{0.4}
  $count=[int]($rate*$duration)
  $memory=[IO.MemoryStream]::new()
  $writer=[IO.BinaryWriter]::new($memory)
  $writer.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
  $writer.Write([int](36+2*$count))
  $writer.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
  $writer.Write([int]16);$writer.Write([int16]1);$writer.Write([int16]1)
  $writer.Write([int]$rate);$writer.Write([int]($rate*2));$writer.Write([int16]2);$writer.Write([int16]16)
  $writer.Write([Text.Encoding]::ASCII.GetBytes('data'));$writer.Write([int]($count*2))
  for($i=0;$i -lt $count;$i++){
    $t=$i/$rate
    $frequency=if($kind -eq 'urgent'){if(([int]($t/0.15)%2) -eq 0){880}else{660}}else{660}
    $gain=if($kind -eq 'urgent'){0.22}else{0.12}
    $envelope=[Math]::Min(1,$t/0.015)*[Math]::Min(1,($duration-$t)/0.03)
    $writer.Write([int16](32767*$gain*$envelope*[Math]::Sin(2*[Math]::PI*$frequency*$t)))
  }
  $writer.Flush()
  $name=if($kind -eq 'urgent'){'urgent_alert.wav'}else{'caution_chime.wav'}
  [IO.File]::WriteAllBytes((Join-Path $Output $name),$memory.ToArray())
  $writer.Dispose();$memory.Dispose()
}
