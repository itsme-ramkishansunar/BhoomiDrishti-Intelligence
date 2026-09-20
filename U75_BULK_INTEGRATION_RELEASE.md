# BHOOMIDHRISHTI U75 — Bulk Integration Release

This is an additive safe-copy release built from the U74 final-product source baseline.

## Preserved U74 contracts

- Persistent shared SQLite storage model; no destructive database migration was added.
- U73 language-integrity safeguards.
- U72.4.2 project initialization, field-review, RBAC and governance safeguards.
- U74 evidence-pack export, scope authorization and audit boundary.
- Existing entity resolution, provenance, unified data backbone, GIS, bulk initialization/features and ML governance modules.

## Added U75 contracts

- Governed source classification: `LIVE_AUTHORIZED`, `PUBLIC_SNAPSHOT`, `USER_UPLOAD`, `SYNTHETIC`, `UNAVAILABLE`.
- Bulk intake lifecycle: `RECEIVED`, `PROFILED`, `VALIDATION_REQUIRED`, `VALIDATED`, `PARTIALLY_ACCEPTED`, `REJECTED`, `VERIFIED`, `PROMOTED`.
- Dataset profiling: row/column counts, missingness, duplicates and distinct values.
- Deterministic validation preview with required-column and status checks.
- Safe project-match preview using project ID/code first, then name/state/district/department evidence.
- Conflict state when candidate matches are too close to distinguish automatically.
- Admin-only U75 status/profile/validate/match-preview API contracts.
- Existing dataset upload now returns U75 source and ingestion-state metadata without changing its storage or promotion behavior.
- Runtime doctor fixed to report the actual persistent DB path and port state.

## Release safety

No U75 migration drops, deletes, resets or reseeds the shared persistent database.
The U74 smoke gate accepts the U74 baseline version or the exact U75 safe-copy version while retaining all U74 checks.

## Validation performed in the build workspace

- `node --check backend/server.js` — PASS
- `node --check scripts/doctor-u75-runtime.cjs` — PASS
- `node --check scripts/smoke-u75-bulk-integration.cjs` — PASS
- `npm run smoke:u75-bulk-integration` — PASS
- `npm run smoke:u74-final-product` — PASS (19 checks)
- `npm run smoke:u73-language-integrity` — PASS (34 checks)
- `npm run smoke:u72.4.2-functional` — PASS (9 checks)
- `npm run smoke:portfolio-hygiene` — PASS

The local Linux workspace could not complete `vite build` because its dependency installation timed out; Windows validation remains authoritative for the supplied Windows target environment.
