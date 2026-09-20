# U68 — Full Functional Hardening

## Purpose
U68 is a controlled hardening release based on U67. It addresses observed end-to-end usability gaps without changing the persistent database schema.

## Changes
- Aligns local demo credentials in `.env` with the deterministic local access repair script so server startup no longer overwrites repaired role passwords with stale values.
- Adds HTTP authentication smoke coverage for all five local roles.
- Improves dataset upload UX so clicking upload without selecting a file gives a clear client-side message rather than a confusing multipart parser error.
- Adds interactive selection/details for predictive trajectory and predictive-driver charts.
- Adds interactive stage-pressure rows in National Intelligence with selected-stage detail.
- Preserves GIS trust boundaries: no invented project coordinates, India coordinate validation, explicit approximate/geocoded/centroid labels, unresolved records remain unresolved until a location is supplied or safely geocoded.
- Keeps production ML promotion blocked until authorised historical outcomes and governance gates are satisfied.

## Local credentials
See `LOCAL_DEMO_CREDENTIALS_U68.txt`. These are local development/demo credentials only.

## Validation
Run on Windows after installing dependencies:

```powershell
npm.cmd install --no-audit --no-fund
npm.cmd run repair:local-access
npm.cmd run smoke:local-access
npm.cmd run start:all
npm.cmd run smoke:local-auth-http
npm.cmd run smoke:u67-functional-reliability
npm.cmd run build
npm.cmd run validate:all
```

No U68 database migration is introduced.
