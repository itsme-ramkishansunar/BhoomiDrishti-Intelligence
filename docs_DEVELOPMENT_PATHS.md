# BHOOMIDHRISHTI Development Paths — Upgrade 44

## Project root

All application-relative paths are resolved from `<PROJECT_ROOT>`. The project can live anywhere on Windows, Linux, or macOS. Do not hard-code a developer username, Downloads path, drive letter, or historical upgrade directory in application code.

## Canonical runtime tree

```text
<PROJECT_ROOT>/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── runtime-paths.cjs
│   └── data/
│       ├── bhoomidrishti.sqlite
│       ├── incoming/
│       ├── forensics/
│       └── intake/tmp/
├── database/migrations/
├── scripts/
└── src/
```

`BHOOMI_DATA_DIR` defaults to `backend/data`. It may be set to an explicitly managed absolute path for deployments that keep runtime data outside the source tree.

`BHOOMI_DB_PATH` defaults to `<BHOOMI_DATA_DIR>/bhoomidrishti.sqlite`. Relative overrides are resolved from the project root; absolute overrides are preserved. `BHOOMI_BACKEND_ORIGIN` controls the Vite `/api` proxy target when the frontend runs in development.

## Dataset separation

Use `backend/data/incoming/` for a local authorized dataset copy. For a large or centrally managed dataset, use `BHOOMI_FORENSICS_INPUT` to point at a controlled external location. Do not commit source datasets, database files, uploaded documents, or generated forensic reports.

## Environment setup

Preferred:

```powershell
$env:BHOOMI_ENV_SOURCE = 'D:\BHOOMIDHRISHTI_SECRETS\.env'
npm.cmd run setup:local
```

For a fresh local development environment, leaving `BHOOMI_ENV_SOURCE` blank lets `setup:local` create `.env` from `.env.example`. Legacy Upgrade 15 discovery is disabled unless `BHOOMI_LEGACY_ENV_DISCOVERY=true` is explicitly provided.

## Canonical Windows commands

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm.cmd install
npm.cmd run setup:local
npm.cmd run doctor
npm.cmd run configure:ai
npm.cmd run validate:all
```

Run the backend and frontend in separate PowerShell windows:

```powershell
npm.cmd run backend
```

```powershell
npm.cmd run dev
```

The default local endpoints are `http://localhost:8787` and `http://localhost:5173`.

## Safety rule

U44 and later checkpoints are copied branches. Never overwrite a frozen checkpoint while developing. Keep `.env`, runtime data, API keys, and databases outside Git.
