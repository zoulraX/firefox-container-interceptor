
Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\Samet\.gemini\antigravity\scratch\Firefox Extension\icon.png"
$sizes = @(48, 96)

$image = [System.Drawing.Image]::FromFile($sourcePath)

foreach ($size in $sizes) {
    $targetPath = "c:\Users\Samet\.gemini\antigravity\scratch\Firefox Extension\icon-$size.png"
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graph = [System.Drawing.Graphics]::FromImage($bitmap)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.DrawImage($image, 0, 0, $size, $size)
    $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $bitmap.Dispose()
    Write-Host "Created $targetPath"
}

$image.Dispose()
