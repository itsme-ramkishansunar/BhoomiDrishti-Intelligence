Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$root = (Get-Location).Path

if (-not (Test-Path (Join-Path $root 'package.json'))) { throw 'Run this script from the U52.2 project root (the folder containing package.json).' }

Write-Host '=== BHOOMIDHRISHTI U52.2 SAFE SETUP ==='
Write-Host "Project root: $root"

if (-not (Test-Path (Join-Path $root '.env'))) {
    $u51 = Join-Path $env:USERPROFILE 'Downloads\BHOOMIDHRISHTI_UPGRADE_51_UNIFIED_DATA_BACKBONE'
    $source = Join-Path $u51 '.env'
    if (-not (Test-Path $source)) {
        $source = Get-ChildItem $u51 -Force -Recurse -File -Filter '.env' -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { $_.FullName }
    }
    if (-not $source) { throw 'A working U51 .env was not found. Copy the .env manually; never paste its secret values into the console.' }
    Copy-Item $source (Join-Path $root '.env') -Force
    Write-Host '.env copied from U51.'
}

npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

npm.cmd run smoke:frontend-symbols
if ($LASTEXITCODE -ne 0) { throw 'Frontend symbol validation failed.' }

npm.cmd run smoke:mapping
if ($LASTEXITCODE -ne 0) { throw 'GIS mapping smoke failed.' }

npm.cmd run validate:all
if ($LASTEXITCODE -ne 0) { throw 'FULL VALIDATION FAILED. Application will not be started.' }

Write-Host '=== U52.2 VALIDATION PASSED ==='
Write-Host 'Start with: npm.cmd run start:all'
