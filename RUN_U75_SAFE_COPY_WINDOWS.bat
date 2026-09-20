@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (call npm.cmd install --no-audit --no-fund)
call npm.cmd run doctor:u75-runtime
call npm.cmd run smoke:u75-bulk-integration
call npm.cmd run build
call npm.cmd run start:all
