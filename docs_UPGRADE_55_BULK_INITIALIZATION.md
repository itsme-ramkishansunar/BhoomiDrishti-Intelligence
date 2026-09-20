# U55 — Bulk Project Intelligence Initialization

BHOOMIDHRISHTI U55 adds an idempotent bulk initialization layer over the unified persistent repository. It ensures every project can have normalized facts, a current unified intelligence snapshot, a candidate prediction record, lifecycle bootstrap state, and the operational recommendation/alert scaffolding required by the existing product loop. Existing populated records are skipped; only missing or stale components are initialized.

## Persistent model

The release contains application code. Project data remains in the shared persistent store outside the release folder.

## Safety

The initializer never fabricates government data. User-uploaded/source labels retain their existing provenance. Candidate predictions remain governed as NOT_VALIDATED until authorized historical outcome data passes temporal, leakage, calibration, OOD, and approval gates.

## Commands

`npm.cmd run initialize:all`

`npm.cmd run validate:all`

The administrator Data Health page also exposes an idempotent **Bulk initialize** control. Startup performs missing-only initialization by default and can be disabled with `BHOOMI_AUTO_INITIALIZE_ON_STARTUP=false`.
