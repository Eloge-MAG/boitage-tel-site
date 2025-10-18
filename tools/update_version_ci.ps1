# tools/update_version_ci.ps1 (GitHub Actions - PowerShell Core)
$ErrorActionPreference = "Stop"
$ver = (Get-Date).ToString('yyyy.MM.dd-HH.mm.ss')
$files = @('index.html','envelope_a4.html') | Where-Object { Test-Path $_ }

foreach($f in $files){
  $txt  = Get-Content $f -Raw -Encoding UTF8
  $orig = $txt
  if($txt -match '<meta\s+name=["'']app-version["'']'){
    $txt = [regex]::Replace($txt,
      '<meta\s+name=["'']app-version["'']\s+content=["''][^"''>]*["'']\s*/?>',
      '<meta name="app-version" content="'+$ver+'">',
      [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  } else {
    $txt = [regex]::Replace($txt,
      '(<meta\s+charset=["''][^"'']+["'']\s*/?>)',
      '$1`r`n  <meta name="app-version" content="'+$ver+'">',
      [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  }
  $rx = '<link[^>]+rel=["'']stylesheet["''][^>]*href=["'']([^"'']+)["''][^>]*>'
  $m  = [regex]::Matches($txt, $rx, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  foreach($g in $m){
    $url = $g.Groups[1].Value
    $urlNoV = [regex]::Replace($url, '\?v=.*$', '')
    $newUrl = $urlNoV + '?v=' + $ver
    if($newUrl -ne $url){ $txt = $txt.Replace($url, $newUrl) }
  }
  if($txt -ne $orig){
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($f, $txt, $utf8NoBom)
    Write-Host "updated $f -> $ver"
  } else {
    Write-Host "no change in $f"
  }
}
Write-Host "app-version = $ver"
