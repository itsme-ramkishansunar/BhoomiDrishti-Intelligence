# U69 — Map and Interaction Reliability

## Purpose
Controlled functional hardening on top of U68 without a database migration or replacement of the persistent store.

## GIS
- Keeps authoritative project/parcel geometry and stored project coordinates distinct from approximate locations.
- Adds a transient district-centroid fallback for unresolved records when the district is known. The fallback is visual only, explicitly approximate, and is never persisted as a project coordinate.
- Adds explicit India view and fit-data controls.
- Recalculates map size on window resize.
- Keeps unresolved records visible in the portfolio and allows deliberate geocoding through the existing authenticated proxy.

## Interactive intelligence
- Moves predictive chart selection state to the top-level hook section so React hook ordering remains valid during loading/error/data transitions.
- Dashboard risk donut and state-risk bars expose click-to-inspect details.
- Existing Predictive Lab, National Intelligence and project predictive charts remain interactive.

## Data safety
- No synthetic coordinate is written to the database by the unresolved fallback.
- No ML promotion, source authority, government data, or legal determination is fabricated.
- No database migration.

## Validation
Run on Windows:

```powershell
npm.cmd install --no-audit --no-fund
npm.cmd run smoke:u69-functional-reliability
npm.cmd run smoke:local-access
npm.cmd run smoke:local-auth-http
npm.cmd run smoke:gis-integrity
npm.cmd run smoke:mapping
npm.cmd run build
npm.cmd run validate:all
npm.cmd run start:all
```
