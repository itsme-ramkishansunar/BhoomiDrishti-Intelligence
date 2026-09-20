Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$root = (Get-Location).Path

if (-not (Test-Path (Join-Path $root 'package.json'))) {
    throw 'Run this script from the U53 release root containing package.json.'
}

Write-Host '=================================================='
Write-Host ' BHOOMIDHRISHTI U53 WINDOWS INSTALL / DATA SETUP'
Write-Host '=================================================='

Write-Host '=== ENVIRONMENT ==='
$envPath = Join-Path $root '.env'
if (-not (Test-Path $envPath)) {
    $u51 = Join-Path $env:USERPROFILE 'Downloads\BHOOMIDHRISHTI_UPGRADE_51_UNIFIED_DATA_BACKBONE'
    $envSource = $null
    if (Test-Path $u51) {
        $envSource = Get-ChildItem $u51 -Force -Recurse -File -Filter '.env' -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { $_.FullName }
    }
    if (-not $envSource) {
        $envSource = Get-ChildItem (Join-Path $env:USERPROFILE 'Downloads') -Force -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like 'BHOOMIDHRISHTI_UPGRADE_*' } |
            Sort-Object LastWriteTime -Descending |
            ForEach-Object { Get-ChildItem $_.FullName -Force -Recurse -File -Filter '.env' -ErrorAction SilentlyContinue | Select-Object -First 1 } |
            Select-Object -First 1 |
            ForEach-Object { $_.FullName }
    }
    if ($envSource) {
        Copy-Item $envSource $envPath -Force
        Write-Host 'Copied an existing local .env into U53. Secrets were not printed.'
    } elseif (Test-Path (Join-Path $root '.env.example')) {
        Copy-Item (Join-Path $root '.env.example') $envPath -Force
        Write-Host 'Created .env from .env.example. Configure approved secrets before provider-backed AI use.'
    } else {
        throw 'Neither an existing .env nor .env.example was found.'
    }
}

Write-Host '=== DEPENDENCIES ==='
npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

Write-Host '=== PERSISTENT STORE MIGRATION ==='
npm.cmd run migrate:persistent-store
if ($LASTEXITCODE -ne 0) { throw 'Persistent-store migration failed. No legacy release was modified.' }

Write-Host '=== PERSISTENT STORE REPAIR / PREFLIGHT ==='
npm.cmd run repair:persistent-store
if ($LASTEXITCODE -ne 0) { throw 'Persistent-store repair/preflight failed. No application start was attempted.' }

Write-Host '=== DOCTOR ==='
npm.cmd run doctor
if ($LASTEXITCODE -ne 0) { throw 'Environment doctor failed.' }

Write-Host '=== PERSISTENCE CONTRACT ==='
npm.cmd run smoke:persistent-store
if ($LASTEXITCODE -ne 0) { throw 'Persistent-store contract failed.' }

Write-Host ''
Write-Host 'U53 storage is configured as one shared repository outside the release folder.'
Write-Host 'Run npm.cmd run validate:all next. The validation script stops on the first real failure.'
Write-Host 'Do not delete the older release until the project count has been verified in U53.'
