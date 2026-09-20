Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root 'package.json'))) { throw 'Run this from the BHOOMIDHRISHTI release root containing package.json.' }
Write-Host '=== STOP ALL BHOOMIDHRISHTI SERVERS BEFORE MIGRATION ==='
Write-Host 'If a BHOOMIDHRISHTI terminal is running, press Ctrl+C there first.'
Write-Host ''
Write-Host '=== MIGRATING TO ONE SHARED PERSISTENT STORE ==='
npm.cmd run migrate:persistent-store
if ($LASTEXITCODE -ne 0) { throw 'Persistent-store migration failed. No source release was modified.' }
Write-Host ''
Write-Host '=== VERIFYING PERSISTENT STORE ==='
npm.cmd run verify:persistent-store
if ($LASTEXITCODE -ne 0) { throw 'Persistent-store verification failed.' }
Write-Host ''
Write-Host 'PERSISTENT STORE READY.'
