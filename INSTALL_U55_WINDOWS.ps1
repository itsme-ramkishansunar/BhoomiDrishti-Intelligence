Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
Write-Host "=== BHOOMIDHRISHTI U55 BULK INITIALIZED INSTALL ==="
if(-not (Test-Path ".\package.json")){throw "package.json not found. Run from U55 application root."}
foreach($port in @(8787,5173)){if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Port $port is in use. Stop BHOOMIDHRISHTI first."}}
$envSource=$null
$roots=@(
  (Join-Path $env:USERPROFILE "Downloads\BHOOMIDHRISHTI_U54_1_UNIFIED_PERSISTENT_GIS_RUNTIME_STABLE"),
  (Join-Path $env:USERPROFILE "Downloads\BHOOMIDHRISHTI_U54_UNIFIED_PERSISTENT_GIS_STABLE"),
  (Join-Path $env:USERPROFILE "Downloads\BHOOMIDHRISHTI_UPGRADE_53_1_SHARED_PERSISTENT_STORE_RUNTIME_HARDENED")
)
if(Test-Path ".\.env"){ $envSource=(Resolve-Path ".\.env").Path }
foreach($r in $roots){
  if($envSource){break}
  if(Test-Path $r){$envSource=Get-ChildItem $r -Force -Recurse -File -Filter ".env" -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object {$_.FullName}}
}
if($envSource){Copy-Item $envSource ".\.env" -Force;Write-Host ".env copied without printing secrets."}
if(-not(Test-Path ".\.env")){throw ".env not found. Refusing to continue."}
Write-Host "=== DEPENDENCIES ==="
npm.cmd install --no-audit --no-fund
if($LASTEXITCODE -ne 0){throw "npm install failed."}
Write-Host "=== SHARED STORE ==="
npm.cmd run storage:migrate
if($LASTEXITCODE -ne 0){throw "Persistent store migration failed."}
npm.cmd run storage:repair
if($LASTEXITCODE -ne 0){throw "Persistent store repair failed."}
npm.cmd run storage:verify
if($LASTEXITCODE -ne 0){throw "Persistent store verification failed."}
Write-Host "=== BULK INITIALIZATION ==="
npm.cmd run initialize:all
if($LASTEXITCODE -ne 0){throw "Bulk initialization failed. No application start."}
npm.cmd run verify:persistent-store
if($LASTEXITCODE -ne 0){throw "Post-initialization verification failed."}
Write-Host "=== VALIDATION ==="
npm.cmd run validate:all
if($LASTEXITCODE -ne 0){throw "VALIDATION FAILED. APPLICATION WILL NOT START."}
Write-Host "=== FINAL PERSISTENCE CHECK ==="
npm.cmd run verify:persistent-store
if($LASTEXITCODE -ne 0){throw "Final persistent-store verification failed."}
Write-Host "=== STARTING ==="
npm.cmd run start:all
