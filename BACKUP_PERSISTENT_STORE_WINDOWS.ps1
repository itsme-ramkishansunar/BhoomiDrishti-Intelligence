Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root 'package.json'))) { throw 'Run this from the BHOOMIDHRISHTI release root.' }
npm.cmd run verify:persistent-store
if ($LASTEXITCODE -ne 0) { throw 'Persistent store is not currently readable; backup aborted.' }

$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^BHOOMI_PERSISTENT_ROOT=' } | Select-Object -First 1
    if ($line) { $configured = ($line -replace '^BHOOMI_PERSISTENT_ROOT=','').Trim() }
}
if ($configured) { $src = [System.IO.Path]::GetFullPath($configured) }
else { $src = Join-Path $env:LOCALAPPDATA 'BhoomiDrishti\data' }
if (-not (Test-Path $src)) { throw "Persistent data root not found: $src" }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dst = Join-Path (Split-Path $src -Parent) ("BhoomiDrishti_data_backup_$stamp")
Copy-Item $src $dst -Recurse -Force
Write-Host "Persistent-store backup created: $dst"
