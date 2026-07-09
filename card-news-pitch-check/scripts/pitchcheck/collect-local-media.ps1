param(
  [string]$Downloads = (Join-Path $env:USERPROFILE "Downloads"),
  [string]$OutDir = "",
  [int]$VideoFrameSeconds = 10
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = Join-Path $Root "assets\reference\pitchcheck-local"
}

$OutDir = [System.IO.Path]::GetFullPath($OutDir)
if (-not $OutDir.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutDir must stay inside the project root: $Root"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Add-Type -AssemblyName System.Drawing

function Convert-ToSafeName {
  param([string]$Value)
  $name = [System.IO.Path]::GetFileNameWithoutExtension($Value)
  $name = $name -replace '[^A-Za-z0-9_.-]+', '-'
  $name = $name.Trim('-')
  if ([string]::IsNullOrWhiteSpace($name)) { return "media" }
  return $name
}

function Get-ImageSize {
  param([string]$Path)
  try {
    $image = [System.Drawing.Image]::FromFile($Path)
    try {
      return @{ width = $image.Width; height = $image.Height }
    } finally {
      $image.Dispose()
    }
  } catch {
    return @{ width = $null; height = $null }
  }
}

function Get-RepoPath {
  param([string]$Path)
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  return $fullPath.Substring($Root.Length + 1).Replace("\", "/")
}

$items = New-Object System.Collections.Generic.List[object]

function Add-MediaItem {
  param(
    [string]$Id,
    [string]$Type,
    [string]$Usage,
    [string]$Source,
    [string]$FilePath
  )

  if (-not (Test-Path -LiteralPath $FilePath)) { return }
  $size = Get-ImageSize -Path $FilePath
  $repoPath = Get-RepoPath -Path $FilePath
  $items.Add([ordered]@{
    id = $Id
    type = $Type
    usage = $Usage
    source = $Source
    file = [System.IO.Path]::GetFullPath($FilePath)
    repoPath = $repoPath
    samplePath = "../../$repoPath"
    width = $size.width
    height = $size.height
  })
}

function Copy-MediaFile {
  param(
    [System.IO.FileInfo]$File,
    [string]$DestDir,
    [string]$Prefix,
    [string]$Type,
    [string]$Usage
  )

  New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
  $safeName = Convert-ToSafeName -Value $File.Name
  $target = Join-Path $DestDir "$safeName$($File.Extension.ToLowerInvariant())"
  Copy-Item -LiteralPath $File.FullName -Destination $target -Force
  $index = @($items | Where-Object { $_["type"] -eq $Type }).Count + 1
  Add-MediaItem -Id ("{0}-{1:000}" -f $Prefix, $index) -Type $Type -Usage $Usage -Source $File.FullName -FilePath $target
}

$imageExts = @(".jpg", ".jpeg", ".png", ".webp")

$zipDir = Join-Path $OutDir "chuk9-zip-extracted"
Get-ChildItem -LiteralPath $Downloads -File -Filter "chuk9__check_*.zip" -ErrorAction SilentlyContinue |
  Sort-Object Name |
  ForEach-Object {
    $zipBase = Convert-ToSafeName -Value $_.Name
    $dest = Join-Path $zipDir $zipBase
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Expand-Archive -LiteralPath $_.FullName -DestinationPath $dest -Force

    Get-ChildItem -LiteralPath $dest -File -Recurse |
      Where-Object { $imageExts -contains $_.Extension.ToLowerInvariant() } |
      Sort-Object FullName |
      ForEach-Object {
        $index = @($items | Where-Object { $_["type"] -eq "football-reference" }).Count + 1
        Add-MediaItem `
          -Id ("football-ref-{0:000}" -f $index) `
          -Type "football-reference" `
          -Usage "Chuk9 Check design/reference carousel image" `
          -Source $_.FullName `
          -FilePath $_.FullName
      }
  }

$directRefDir = Join-Path $OutDir "chuk9-card-refs"
Get-ChildItem -LiteralPath $Downloads -File -Filter "chuk9__check_*.jpg" -ErrorAction SilentlyContinue |
  Sort-Object Name |
  ForEach-Object {
    Copy-MediaFile `
      -File $_ `
      -DestDir $directRefDir `
      -Prefix "chuk9-card" `
      -Type "football-reference" `
      -Usage "Chuk9 Check visual style reference"
  }

$pitchcheckDir = Join-Path $OutDir "pitchcheck-screens"
Get-ChildItem -LiteralPath $Downloads -File -Filter "*pitchcheck*.png" -ErrorAction SilentlyContinue |
  Sort-Object Name |
  ForEach-Object {
    Copy-MediaFile `
      -File $_ `
      -DestDir $pitchcheckDir `
      -Prefix "pitchcheck-screen" `
      -Type "pitchcheck-screen" `
      -Usage "Existing PitchCheck card or app promo screen"
  }

$videoName = -join ([int[]](
  0xD53C, 0xCE58, 0xCCB4, 0xD06C, 0x0020,
  0xC0AC, 0xC6A9, 0x0020,
  0xC601, 0xC0C1, 0x002E, 0x006D, 0x0070, 0x0034
) | ForEach-Object { [char]$_ })
$videoPath = Join-Path $Downloads $videoName
$video = $null
if (Test-Path -LiteralPath $videoPath) {
  $video = Get-Item -LiteralPath $videoPath
} else {
  $video = Get-ChildItem -LiteralPath $Downloads -File -Filter "*.mp4" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*pitchcheck*" -or $_.Length -gt 50000000 } |
    Sort-Object Length -Descending |
    Select-Object -First 1
}
if ($video) {
  $ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($ffmpeg) {
    $frameDir = Join-Path $OutDir "pitchcheck-video\frames"
    New-Item -ItemType Directory -Force -Path $frameDir | Out-Null
    $pattern = Join-Path $frameDir "frame-%03d.jpg"
    $vf = "fps=1/$VideoFrameSeconds,scale=540:-2"
    & $ffmpeg.Source -hide_banner -loglevel error -y -i $video.FullName -vf $vf -q:v 3 $pattern

    Get-ChildItem -LiteralPath $frameDir -File -Filter "frame-*.jpg" |
      Sort-Object Name |
      ForEach-Object {
        $index = @($items | Where-Object { $_["type"] -eq "pitchcheck-video-frame" }).Count + 1
        Add-MediaItem `
          -Id ("pitchcheck-video-{0:000}" -f $index) `
          -Type "pitchcheck-video-frame" `
          -Usage "Frame extracted from local PitchCheck usage video" `
          -Source $video.FullName `
          -FilePath $_.FullName
      }
  } else {
    Write-Warning "ffmpeg was not found. Video frames were skipped."
  }
}

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  downloads = [System.IO.Path]::GetFullPath($Downloads)
  root = $Root
  outDir = $OutDir
  notes = @(
    "Local user-provided media collection for PitchCheck CTA rendering.",
    "Publishing rights still need owner confirmation before external posting."
  )
  counts = [ordered]@{}
  items = $items
}

$items | ForEach-Object { $_["type"] } | Group-Object | Sort-Object Name | ForEach-Object {
  $manifest.counts[$_.Name] = $_.Count
}

$manifestPath = Join-Path $OutDir "media-manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host "Collected $($items.Count) media files"
Write-Host "Manifest: $manifestPath"
