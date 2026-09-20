@echo off
setlocal
cd /d "%~dp0"
echo ===============================================
echo BHOOMIDHRISHTI U75.1 FULL INTEGRATION
 echo ===============================================
call npm.cmd install --no-audit --no-fund
if errorlevel 1 exit /b 1
call npm.cmd run doctor:u75-runtime
if errorlevel 1 exit /b 1
call npm.cmd run smoke:u75.1-full-integration
if errorlevel 1 exit /b 1
call npm.cmd run build
if errorlevel 1 exit /b 1
call npm.cmd run start:all
