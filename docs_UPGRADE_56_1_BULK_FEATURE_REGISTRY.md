# U56.1 — Bulk Feature Registry & Operational Readiness

U56.1 extends the verified U55 shared-persistent architecture with a persistent, versioned registry of 15 operational capabilities. It does not replace U55 and does not create a release-local production database.

## Features
- Unified project facts
- Unified intelligence snapshot
- Candidate predictive intelligence
- Predictive explanation
- Early-warning intelligence
- Operational alerts
- Action recommendations
- Project lifecycle
- Evidence graph
- Precise GIS mapping
- Workflow/legal-clock context
- Grounded AI context
- Action/outcome loop
- Replay/history
- Provenance + ML governance

## Safety
Feature readiness is derived from the shared repository. Missing GIS or unresolved statutory configuration is represented as `REVIEW_REQUIRED`; it is not fabricated. Candidate ML remains candidate/not validated. User-uploaded and synthetic provenance are not promoted automatically.

## Commands
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm.cmd run backup:persistent-store
npm.cmd run storage:migrate
npm.cmd run storage:repair
npm.cmd run storage:verify
npm.cmd run initialize:all
npm.cmd run initialize:features
npm.cmd run smoke:bulk-features
npm.cmd run validate:all
npm.cmd run build
npm.cmd run verify:persistent-store
npm.cmd run start:all
```

## Runtime API
- `GET /api/admin/bulk-features/status`
- `GET /api/admin/bulk-features/registry`
- `POST /api/admin/bulk-features`
- `GET /api/projects/:id/features`
