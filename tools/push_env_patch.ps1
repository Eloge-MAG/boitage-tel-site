
# Requires: git in PATH
# Usage: run in PowerShell 5.1
Param(
  [string]$RepoPath = "C:\ServerTools\Temp\ElogeMAG\boitage-tel",
  [string]$Msg = "fix: enveloppe A4 paysage centree + police Segment"
)
if (-not (Test-Path $RepoPath)) { Write-Error "RepoPath introuvable: $RepoPath"; exit 1 }
$git = "git"
& $git -C $RepoPath add -A
if ($LASTEXITCODE -ne 0) { Write-Error "git add a echoue"; exit 1 }
& $git -C $RepoPath commit -m $Msg
# Ne pas echouer si aucun changement
if ($LASTEXITCODE -ne 0) { Write-Host "Note: aucun commit (pas de changements)"; }
& $git -C $RepoPath push
