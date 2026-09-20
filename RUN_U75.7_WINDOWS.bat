@echo off
setlocal
cd /d "%~dp0"
echo === BHOOMIDHRISHTI U75.7 BULK RELIABILITY ===
npm.cmd install --no-audit --no-fund
if errorlevel 1 exit /b 1
npm.cmd run smoke:u75.7-bulk-reliability
if errorlevel 1 exit /b 1
npm.cmd run smoke:u75.6-interactive-command-center
if errorlevel 1 exit /b 1
npm.cmd run smoke:u75.5-evidence-promotion
if errorlevel 1 exit /b 1
npm.cmd run smoke:u75.2-4-bulk-intelligence
if errorlevel 1 exit /b 1
npm.cmd run smoke:u75.1-full-integration
if errorlevel 1 exit /b 1
npm.cmd run smoke:u75-bulk-integration
if errorlevel 1 exit /b 1
npm.cmd run smoke:u74-final-product
if errorlevel 1 exit /b 1
npm.cmd run build
if errorlevel 1 exit /b 1
echo.
echo RELEASE VERIFICATION PASSED.
echo Then run: npm.cmd run start:all
echo Open: http://localhost:5173
endlocal
