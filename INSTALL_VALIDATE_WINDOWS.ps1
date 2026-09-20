$ErrorActionPreference = "Stop"
Write-Host "BHOOMIDHRISHTI U68 - install + functional validation" -ForegroundColor Cyan
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw "npm.cmd was not found. Install Node.js LTS first." }

npm.cmd install --no-audit --no-fund
npm.cmd run repair:local-access
npm.cmd run smoke:local-access
npm.cmd run smoke:u68-full-functional
npm.cmd run build
npm.cmd run validate:all

Write-Host "U68 install, functional smoke, build and validation completed successfully." -ForegroundColor Green
Write-Host "Next: npm.cmd run start:all" -ForegroundColor Yellow
