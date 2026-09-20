# BHOOMIDHRISHTI — Upgrade 44

## Purpose
Path and runtime hardening without changing frozen U41/U42/U43 checkpoints.

## Changes
- Added a single runtime-path module at `backend/runtime-paths.cjs`.
- Standardized the default runtime data tree under `backend/data/`.
- Standardized forensic input/output defaults with `BHOOMI_DATA_DIR`.
- Made legacy Upgrade 15 `.env` discovery opt-in via `BHOOMI_LEGACY_ENV_DISCOVERY`.
- Added `smoke:path-contract`.
- Added isolated `smoke:runtime` using a temporary database/data root; it never touches the developer's persistent DB.
- Added a global React error boundary to prevent blank-screen failures from rendering without a recovery UI.
- Extended validation ordering so path/runtime checks occur before the final build.

## Safety
No persistent user database, production secret, or existing checkpoint is modified. U44 is a new copy from U43.

## Validation target
`npm.cmd run validate:all` must end with `BHOOMIDHRISHTI validation-all PASSED.`


## Runtime hardening follow-up

- Vite `/api` proxy now follows `BHOOMI_BACKEND_ORIGIN` / `BACKEND_PORT` instead of a hard-coded port.
- Runtime smoke uses an isolated administrator credential and temporary database, so it does not depend on the demo password or user data.
- Public health output no longer exposes the absolute database filesystem path or provider configuration details.
- `.env.example` documents the development backend origin explicitly.
