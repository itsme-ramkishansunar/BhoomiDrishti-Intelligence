# BHOOMIDHRISHTI 1.0.31 — Final Public Deployment Hardening

This release is a bug-fix/hardening increment on U75.10. It preserves the existing project/data model and adds no destructive migration.

## Fixed
- Removed duplicate public-demo React state declarations and duplicate config fetch in `LoginPage.jsx`.
- Exposed stable `sourceLabel`/`sourceId` fields on project API objects while retaining the nested `source` object.
- Hardened public-demo session creation to require `synthetic_only` mode and an available synthetic project set.
- Hardened public authorization to reject any non-synthetic source and any non-synthetic public-demo mode.
- Restricted public feedback submission to an authenticated public-demo Viewer session.
- Added `Cache-Control: no-store` to public demo config/session/feedback responses.

## Deployment contract
Public internet deployment is demo/evaluation only. It is not an official Government of India production service. Real government/authoritative datasets, private records, and external AI providers must not be attached to the public demo.

## Verification
Run on Windows: `npm.cmd install --no-audit --no-fund`, `npm.cmd run doctor:u75-runtime`, `npm.cmd run release:production`, then `npm.cmd run start:all`.

## 1.0.32 deployment hardening
- Added proxy-aware rate-limit configuration and authentication brute-force throttling.
- Restricted public feedback writes to the public-demo session.
- Sanitized global ML readiness/gate responses for public-demo users.
- Added public UI integrity smoke.

## Final release identity
`1.0.32-u75.10-final-deployment`

The release remains additive/non-destructive. The public-demo boundary is a synthetic evaluation profile; authoritative/private government data is not exposed to it.
