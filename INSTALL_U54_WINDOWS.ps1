Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
Write-Host "=== BHOOMIDHRISHTI U54 SAFE INSTALL ==="
if(-not (Test-Path ".\package.json")){throw "package.json not found. Run from U54 application root."}
foreach($port in @(8787,5173)){if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Port $port is in use. Stop BHOOMIDHRISHTI first."}}
$oldRoots=@(
  (Join-Path $env:USERPROFILE "Downloads\BHOOMIDHRISHTI_UPGRADE_53_1_SHARED_PERSISTENT_STORE_RUNTIME_HARDENED"),
  (Join-Path $env:USERPROFILE "Downloads\BHOOMIDHRISHTI_UPGRADE_53_SHARED_PERSISTENT_STORE")
)
$envSource=$null
if(Test-Path ".\.env"){ $envSource=(Resolve-Path ".\.env").Path }
foreach($r in $oldRoots){
  if($envSource){break}
  if(Test-Path $r){$envSource=Get-ChildItem $r -Force -Recurse -File -Filter ".env" -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object {$_.FullName}}
}
if($envSource){Copy-Item $envSource ".\.env" -Force;Write-Host ".env copied without printing secrets."}
if(-not(Test-Path ".\.env")){throw ".env not found. Refusing to continue."}
Write-Host "=== DEPENDENCIES ==="
npm.cmd install --no-audit --no-fund
if($LASTEXITCODE -ne 0){throw "npm install failed."}
Write-Host "=== PERSISTENT STORE MIGRATION/REPAIR ==="
npm.cmd run storage:migrate
if($LASTEXITCODE -ne 0){throw "Persistent store migration failed."}
npm.cmd run storage:repair
if($LASTEXITCODE -ne 0){throw "Persistent store repair failed."}
npm.cmd run storage:verify
if($LASTEXITCODE -ne 0){throw "Persistent store verification failed."}
Write-Host "=== TARGETED SANITY CHECKS ==="
npm.cmd run smoke:validation-isolation
if($LASTEXITCODE -ne 0){throw "Validation isolation check failed."}
npm.cmd run smoke:persistent-store-io
if($LASTEXITCODE -ne 0){throw "Persistent-store I/O validation failed."}
npm.cmd run smoke:gis-integrity
if($LASTEXITCODE -ne 0){throw "GIS integrity validation failed."}
npm.cmd run smoke:gis-e2e
if($LASTEXITCODE -ne 0){throw "GIS E2E validation failed."}
Write-Host "=== VALIDATION ==="
npm.cmd run validate:all
if($LASTEXITCODE -ne 0){throw "VALIDATION FAILED. APPLICATION WILL NOT START."}
Write-Host "=== FINAL DATABASE CHECK ==="
npm.cmd run verify:persistent-store
if($LASTEXITCODE -ne 0){throw "Final persistent-store verification failed."}
Write-Host "=== STARTING ==="
npm.cmd run start:all
