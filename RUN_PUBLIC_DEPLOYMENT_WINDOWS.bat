@echo off
setlocal
cd /d "%~dp0"
title BHOOMIDHRISHTI Final Public Deployment Gate

echo ============================================================
echo BHOOMIDHRISHTI 1.0.32 FINAL PUBLIC DEPLOYMENT GATE
echo ============================================================
echo.

call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto :fail

call npm.cmd run doctor:u75-runtime
if errorlevel 1 goto :fail

call npm.cmd run smoke:public-ui-integrity
if errorlevel 1 goto :fail

call npm.cmd run release:production
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo RELEASE VERIFIED
echo ============================================================
echo.
echo Start locally for browser verification:
echo   npm.cmd run start:all
echo.
echo Then open:
echo   http://localhost:5173
echo.
echo Public-demo production deployment must use HTTPS and a separate persistent volume.
echo Public mode: synthetic_demo only; no authoritative/private data.
echo.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo RELEASE GATE FAILED
echo ============================================================
echo Fix the first failing command. Do not publish this build.
echo.
pause
exit /b 1
