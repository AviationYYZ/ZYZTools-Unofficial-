Add-Type -AssemblyName System.Drawing
$bmp = [Drawing.Bitmap]::new(512,512)
$g = [Drawing.Graphics]::FromImage($bmp)
$ring = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#295263'),9)
$arrow = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#64e2cb'),24)
try {
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([Drawing.ColorTranslator]::FromHtml('#101e29'))
    $g.DrawEllipse($ring,85,85,342,342)
    $g.DrawEllipse($ring,139,139,234,234)
    $g.DrawLine($ring,256,85,256,427)
    $g.DrawLine($ring,85,256,427,256)
    $arrow.StartCap = [Drawing.Drawing2D.LineCap]::Round
    $arrow.EndCap = [Drawing.Drawing2D.LineCap]::Round
    $arrow.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
    $g.DrawLines($arrow,[Drawing.Point[]]@([Drawing.Point]::new(122,350),[Drawing.Point]::new(220,254),[Drawing.Point]::new(271,292),[Drawing.Point]::new(373,162)))
    $g.DrawLines($arrow,[Drawing.Point[]]@([Drawing.Point]::new(304,162),[Drawing.Point]::new(373,162),[Drawing.Point]::new(373,234)))
    $bmp.Save((Join-Path $PSScriptRoot 'icon.png'),[Drawing.Imaging.ImageFormat]::Png)
    $small=[Drawing.Bitmap]::new($bmp,192,192)
    try { $small.Save((Join-Path $PSScriptRoot 'icon-192.png'),[Drawing.Imaging.ImageFormat]::Png) } finally { $small.Dispose() }
} finally {
    $arrow.Dispose(); $ring.Dispose(); $g.Dispose(); $bmp.Dispose()
}
