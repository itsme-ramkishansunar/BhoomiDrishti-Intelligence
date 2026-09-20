$ErrorActionPreference = "Stop"
Write-Host "BHOOMIDHRISHTI U68 - start + live authentication smoke" -ForegroundColor Cyan
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw "npm.cmd was not found. Install Node.js LTS first." }
Write-Host "Start the stack in another terminal with: npm.cmd run start:all" -ForegroundColor Yellow
Write-Host "After the backend is listening on 8787, run: npm.cmd run smoke:local-auth-http" -ForegroundColor Yellow
Write-Host "Then open: http://localhost:5173" -ForegroundColor Green
