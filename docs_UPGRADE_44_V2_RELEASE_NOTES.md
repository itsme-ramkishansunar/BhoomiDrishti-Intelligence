# Upgrade 44 V2 — Runtime Blocker Fixes

This checkpoint is a copy of Upgrade 44 Path + Runtime Hardened.

## Fixes

1. Removed the stray closing `</AppErrorBoundary>` from `src/App.jsx`, which caused the Vite pre-transform JSX error at line 312.
2. Updated `vite.config.js` so process environment variables (`BHOOMI_BACKEND_ORIGIN`, `BACKEND_ORIGIN`, `BACKEND_PORT`) take precedence over `.env` values loaded by Vite. This makes isolated runtime smoke correctly proxy to its ephemeral backend port.

## Safety

Earlier Upgrade 44 checkpoints remain untouched. No `.env`, API keys, or runtime SQLite database are packaged.
