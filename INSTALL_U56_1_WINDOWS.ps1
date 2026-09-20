$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Write-Host 'BHOOMIDHRISHTI U56.1 installer' -ForegroundColor Cyan
if (-not (Test-Path '.\package.json')) { throw 'Run this script from the extracted U56.1 project folder.' }
Write-Host 'Installing dependencies...' -ForegroundColor Yellow
npm.cmd install --no-audit --no-fund
Write-Host 'Backing up shared persistent store...' -ForegroundColor Yellow
npm.cmd run backup:persistent-store
Write-Host 'Applying safe migrations...' -ForegroundColor Yellow
npm.cmd run storage:migrate
npm.cmd run storage:repair
npm.cmd run storage:verify
Write-Host 'Initializing existing projects...' -ForegroundColor Yellow
npm.cmd run initialize:all
Write-Host 'Initializing bulk feature registry...' -ForegroundColor Yellow
npm.cmd run initialize:features
Write-Host 'Running feature smoke test...' -ForegroundColor Yellow
npm.cmd run smoke:bulk-features
Write-Host 'Running full validation...' -ForegroundColor Yellow
npm.cmd run validate:all
Write-Host 'Building production frontend...' -ForegroundColor Yellow
npm.cmd run build
Write-Host 'Final persistent-store verification...' -ForegroundColor Yellow
npm.cmd run verify:persistent-store
Write-Host 'U56.1 installation and validation completed.' -ForegroundColor Green
