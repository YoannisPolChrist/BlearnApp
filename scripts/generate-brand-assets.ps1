$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
  param(
    [double]$X,
    [double]$Y,
    [double]$Width,
    [double]$Height,
    [double]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = [double]($Radius * 2)

  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  return $path
}

function Map-Unit {
  param(
    [double]$Value,
    [double]$CanvasSize
  )

  return [single](($Value / 88.0) * $CanvasSize)
}

function Draw-Blearn-Mark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$CanvasSize,
    [bool]$ForegroundOnly = $false
  )

  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if (-not $ForegroundOnly) {
    $outerPath = New-RoundedRectPath (Map-Unit 6 $CanvasSize) (Map-Unit 6 $CanvasSize) (Map-Unit 76 $CanvasSize) (Map-Unit 76 $CanvasSize) (Map-Unit 24 $CanvasSize)
    $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      ([System.Drawing.PointF]::new((Map-Unit 12 $CanvasSize), (Map-Unit 10 $CanvasSize))),
      ([System.Drawing.PointF]::new((Map-Unit 78 $CanvasSize), (Map-Unit 78 $CanvasSize))),
      ([System.Drawing.Color]::FromArgb(255, 18, 56, 75)),
      ([System.Drawing.Color]::FromArgb(255, 216, 138, 45))
    )
    $blend = New-Object System.Drawing.Drawing2D.ColorBlend
    $blend.Colors = @(
      [System.Drawing.Color]::FromArgb(255, 18, 56, 75),
      [System.Drawing.Color]::FromArgb(255, 30, 109, 115),
      [System.Drawing.Color]::FromArgb(255, 216, 138, 45)
    )
    $blend.Positions = @(0.0, 0.58, 1.0)
    $backgroundBrush.InterpolationColors = $blend
    $Graphics.FillPath($backgroundBrush, $outerPath)

    $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(52, 255, 255, 255))
    $Graphics.FillEllipse(
      $glowBrush,
      (Map-Unit 14 $CanvasSize),
      (Map-Unit 10 $CanvasSize),
      (Map-Unit 34 $CanvasSize),
      (Map-Unit 28 $CanvasSize)
    )

    $backgroundBrush.Dispose()
    $glowBrush.Dispose()
    $outerPath.Dispose()
  }

  $strokeColor = [System.Drawing.Color]::FromArgb(255, 255, 248, 237)
  $strokeWidth = [single](($CanvasSize / 88.0) * 12.0)
  $pen = New-Object System.Drawing.Pen($strokeColor, $strokeWidth)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $Graphics.DrawLine(
    $pen,
    (Map-Unit 28 $CanvasSize),
    (Map-Unit 18 $CanvasSize),
    (Map-Unit 28 $CanvasSize),
    (Map-Unit 70 $CanvasSize)
  )

  $topPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $topPath.AddLine((Map-Unit 28 $CanvasSize), (Map-Unit 20 $CanvasSize), (Map-Unit 44 $CanvasSize), (Map-Unit 20 $CanvasSize))
  $topPath.AddBezier(
    (Map-Unit 44 $CanvasSize), (Map-Unit 20 $CanvasSize),
    (Map-Unit 54 $CanvasSize), (Map-Unit 20 $CanvasSize),
    (Map-Unit 60 $CanvasSize), (Map-Unit 25.6 $CanvasSize),
    (Map-Unit 60 $CanvasSize), (Map-Unit 34 $CanvasSize)
  )
  $topPath.AddBezier(
    (Map-Unit 60 $CanvasSize), (Map-Unit 34 $CanvasSize),
    (Map-Unit 60 $CanvasSize), (Map-Unit 42.4 $CanvasSize),
    (Map-Unit 54 $CanvasSize), (Map-Unit 48 $CanvasSize),
    (Map-Unit 44 $CanvasSize), (Map-Unit 48 $CanvasSize)
  )
  $topPath.AddLine((Map-Unit 44 $CanvasSize), (Map-Unit 48 $CanvasSize), (Map-Unit 28 $CanvasSize), (Map-Unit 48 $CanvasSize))
  $Graphics.DrawPath($pen, $topPath)

  $bottomPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $bottomPath.AddLine((Map-Unit 28 $CanvasSize), (Map-Unit 48 $CanvasSize), (Map-Unit 46 $CanvasSize), (Map-Unit 48 $CanvasSize))
  $bottomPath.AddBezier(
    (Map-Unit 46 $CanvasSize), (Map-Unit 48 $CanvasSize),
    (Map-Unit 56.6 $CanvasSize), (Map-Unit 48 $CanvasSize),
    (Map-Unit 62 $CanvasSize), (Map-Unit 53.8 $CanvasSize),
    (Map-Unit 62 $CanvasSize), (Map-Unit 62 $CanvasSize)
  )
  $bottomPath.AddBezier(
    (Map-Unit 62 $CanvasSize), (Map-Unit 62 $CanvasSize),
    (Map-Unit 62 $CanvasSize), (Map-Unit 70.2 $CanvasSize),
    (Map-Unit 56.6 $CanvasSize), (Map-Unit 70 $CanvasSize),
    (Map-Unit 46 $CanvasSize), (Map-Unit 70 $CanvasSize)
  )
  $bottomPath.AddLine((Map-Unit 46 $CanvasSize), (Map-Unit 70 $CanvasSize), (Map-Unit 28 $CanvasSize), (Map-Unit 70 $CanvasSize))
  $Graphics.DrawPath($pen, $bottomPath)

  $dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 248, 194, 106))
  $dotRadius = Map-Unit 5 $CanvasSize
  $Graphics.FillEllipse(
    $dotBrush,
    (Map-Unit 66 $CanvasSize) - $dotRadius,
    (Map-Unit 24 $CanvasSize) - $dotRadius,
    $dotRadius * 2,
    $dotRadius * 2
  )

  $pen.Dispose()
  $topPath.Dispose()
  $bottomPath.Dispose()
  $dotBrush.Dispose()
}

function Save-Png {
  param(
    [string]$Path,
    [int]$Size,
    [bool]$ForegroundOnly = $false
  )

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  Draw-Blearn-Mark -Graphics $graphics -CanvasSize $Size -ForegroundOnly:$ForegroundOnly
  $directory = Split-Path -Parent $Path
  if ($directory) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Save-IcoFromPng {
  param(
    [string]$PngPath,
    [string]$IcoPath
  )

  $pngBytes = [System.IO.File]::ReadAllBytes($PngPath)
  $memory = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter($memory)

  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]1)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$pngBytes.Length)
  $writer.Write([UInt32]22)
  $writer.Write($pngBytes)
  $writer.Flush()

  [System.IO.File]::WriteAllBytes($IcoPath, $memory.ToArray())

  $writer.Dispose()
  $memory.Dispose()
}

function Save-Splash {
  param(
    [string]$Path,
    [int]$Width,
    [int]$Height
  )

  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.Color]::FromArgb(255, 15, 23, 34))

  $haloBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 41, 171, 180))
  $haloSize = [int]([Math]::Min($Width, $Height) * 0.46)
  $haloX = [int](($Width - $haloSize) / 2)
  $haloY = [int](($Height - $haloSize) / 2)
  $graphics.FillEllipse($haloBrush, $haloX, $haloY, $haloSize, $haloSize)

  $iconSize = [int]([Math]::Min($Width, $Height) * 0.26)
  $iconBitmap = New-Object System.Drawing.Bitmap $iconSize, $iconSize
  $iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
  $iconGraphics.Clear([System.Drawing.Color]::Transparent)
  Draw-Blearn-Mark -Graphics $iconGraphics -CanvasSize $iconSize -ForegroundOnly:$false
  $iconGraphics.Dispose()

  $iconX = [int](($Width - $iconSize) / 2)
  $iconY = [int](($Height - $iconSize) / 2)
  $graphics.DrawImage($iconBitmap, $iconX, $iconY, $iconSize, $iconSize)

  $directory = Split-Path -Parent $Path
  if ($directory) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $haloBrush.Dispose()
  $iconBitmap.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')

$webIcons = @(
  @{ Path = (Join-Path $root 'public\\favicon.png'); Size = 256; ForegroundOnly = $false },
  @{ Path = (Join-Path $root 'public\\pwa-192x192.png'); Size = 192; ForegroundOnly = $false },
  @{ Path = (Join-Path $root 'public\\pwa-512x512.png'); Size = 512; ForegroundOnly = $false },
  @{ Path = (Join-Path $root 'src\\assets\\logo.png'); Size = 512; ForegroundOnly = $false }
)

foreach ($icon in $webIcons) {
  Save-Png -Path $icon.Path -Size $icon.Size -ForegroundOnly:$icon.ForegroundOnly
}

Save-IcoFromPng -PngPath (Join-Path $root 'public\\favicon.png') -IcoPath (Join-Path $root 'public\\favicon.ico')

$androidSizes = @{
  'mipmap-mdpi' = @{ Icon = 48; Foreground = 108 }
  'mipmap-hdpi' = @{ Icon = 72; Foreground = 162 }
  'mipmap-xhdpi' = @{ Icon = 96; Foreground = 216 }
  'mipmap-xxhdpi' = @{ Icon = 144; Foreground = 324 }
  'mipmap-xxxhdpi' = @{ Icon = 192; Foreground = 432 }
}

foreach ($folder in $androidSizes.Keys) {
  $base = Join-Path $root ("android\\app\\src\\main\\res\\$folder")
  Save-Png -Path (Join-Path $base 'ic_launcher.png') -Size $androidSizes[$folder].Icon -ForegroundOnly:$false
  Save-Png -Path (Join-Path $base 'ic_launcher_round.png') -Size $androidSizes[$folder].Icon -ForegroundOnly:$false
  Save-Png -Path (Join-Path $base 'ic_launcher_foreground.png') -Size $androidSizes[$folder].Foreground -ForegroundOnly:$true
}

$splashes = @(
  @{ Path = 'android\\app\\src\\main\\res\\drawable\\splash.png'; Width = 480; Height = 320 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-land-mdpi\\splash.png'; Width = 480; Height = 320 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-land-hdpi\\splash.png'; Width = 800; Height = 480 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-land-xhdpi\\splash.png'; Width = 1280; Height = 720 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-land-xxhdpi\\splash.png'; Width = 1600; Height = 960 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-land-xxxhdpi\\splash.png'; Width = 1920; Height = 1280 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-port-mdpi\\splash.png'; Width = 320; Height = 480 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-port-hdpi\\splash.png'; Width = 480; Height = 800 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-port-xhdpi\\splash.png'; Width = 720; Height = 1280 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-port-xxhdpi\\splash.png'; Width = 960; Height = 1600 },
  @{ Path = 'android\\app\\src\\main\\res\\drawable-port-xxxhdpi\\splash.png'; Width = 1280; Height = 1920 }
)

foreach ($splash in $splashes) {
  Save-Splash -Path (Join-Path $root $splash.Path) -Width $splash.Width -Height $splash.Height
}

Write-Output 'Brand assets generated.'
