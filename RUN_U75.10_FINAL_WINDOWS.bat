@echo off
setlocal
title BHOOMIDHRISHTI Final Deployment Release
cd /d "%~dp0"

echo.
echo ============================================================
echo BHOOMIDHRISHTI FINAL DEPLOYMENT RELEASE GATE
echo ============================================================
echo.

call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto :fail

call npm.cmd run doctor:u75-runtime
if errorlevel 1 goto :fail

call npm.cmd run smoke:u75.10-bulk-closure
if errorlevel 1 goto :fail

call npm.cmd run smoke:public-ui-integrity
if errorlevel 1 goto :fail

call npm.cmd run smoke:public-demo-deployment
if errorlevel 1 goto :fail

call npm.cmd run release:production
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo RELEASE GATE PASSED
echo ============================================================
echo.
echo Start the verified local stack with:
echo   npm.cmd run start:all
echo.
echo Then open:
echo   http://localhost:5173
echo.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo RELEASE GATE FAILED
echo ============================================================
echo Fix the first failing check before using this build.
pause
exit /b 1
