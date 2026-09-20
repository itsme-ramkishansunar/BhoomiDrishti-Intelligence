# BHOOMIDHRISHTI 1.0.32 — Final Public Deployment Release

## Release status
This is the final public-demo hardening release for the current U75 architecture. It is intended for public evaluation, judging and product feedback.

## Preserved
- U73 22-language integrity and safeguards.
- U72.4.2 persistent-store and project bootstrap contracts.
- U74 final product modules.
- U75 bulk ingestion, validation, provenance, conflict-aware promotion and drill-down.
- U75.2–U75.4 action intelligence, what-if simulation and statutory timelines.
- U75.5 evidence ledger and safe promotion.
- U75.6 command center.
- U75.7 reliability/recovery.
- U75.8 governed bulk workbench.
- U75.9 downstream intelligence propagation.
- U75.10 closure/reconciliation/health.
- GIS, RBAC, audit, multilingual and ML governance boundaries.

## Fixed in 1.0.32
- Removed duplicate React state declarations that broke Vite/esbuild startup in the public-review login page.
- Removed duplicate public-demo config fetch.
- Added stable top-level `sourceLabel` and `sourceId` fields to project API objects without removing the nested `source` object.
- Fixed/strengthened the public synthetic-only authorization boundary.
- Public demo session creation now fails safely when the deployment is misconfigured or has no synthetic reference records.
- Public feedback requires a valid public-demo Viewer session.
- Public ML readiness/gate responses are sanitized and cannot expose authoritative/private readiness details.
- Added login brute-force rate limiting.
- Added optional trusted-proxy configuration for correct rate limiting behind one reverse proxy hop.
- Added public UI/deployment integrity smoke checks.
- Removed local demo credential files and test `.env` from the distributable public artifact.

## Data boundary
The public demo is not an official Government of India system. It must only expose `synthetic_demo` reference records. Real government records, private project data and unapproved external AI calls are not part of this public profile.

## Exact verification
On Windows:

```powershell
npm.cmd install --no-audit --no-fund
npm.cmd run doctor:u75-runtime
npm.cmd run smoke:public-ui-integrity
npm.cmd run release:production
npm.cmd run start:all
```

The release chain includes the full regression suite, public-demo security/runtime smoke and a production Vite build.

## Deployment
Use `docker-compose.public-demo.yml` or a container platform using the repository `Dockerfile`. Terminate TLS at the hosting provider/reverse proxy. Set `BHOOMI_TRUST_PROXY=1` only when one trusted reverse proxy sits in front of the app; keep `0` for direct exposure.
