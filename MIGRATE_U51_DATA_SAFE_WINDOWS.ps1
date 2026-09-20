Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$u52 = (Get-Location).Path
$u51 = Join-Path $env:USERPROFILE 'Downloads\BHOOMIDHRISHTI_UPGRADE_51_UNIFIED_DATA_BACKBONE'
$src = Join-Path $u51 'backend\data'
$dst = Join-Path $u52 'backend\data'

if (-not (Test-Path (Join-Path $u52 'package.json'))) { throw 'Run this from the U52.2 project root.' }
if (-not (Test-Path $src)) { throw "U51 data directory not found: $src" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $u52 "backend\data_before_u51_migration_$stamp"

if (Test-Path $dst) {
    Copy-Item $dst $backup -Recurse -Force
    Write-Host "Existing U52.2 data backed up to: $backup"
}

New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item (Join-Path $src '*') $dst -Recurse -Force
Write-Host 'U51 data copied into U52.2 working data tree.'
Write-Host 'U51 was not modified.'
Write-Host 'Stop U51 before running this script so SQLite WAL state is clean.'
