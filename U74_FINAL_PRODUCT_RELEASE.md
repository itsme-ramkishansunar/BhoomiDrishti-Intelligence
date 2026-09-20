# U74 — Final Product Hardening

Version: `1.0.19-u74-final-product`

## Added
- Project-level JSON evidence-pack export for authorised users with `reports:read`.
- Server-side project scope enforcement before export.
- Audit event for evidence-pack exports.
- Export governance boundary: no legal determination, government-truth claim, or production probability is created by the export.
- Frontend Evidence pack action on the project detail view.
- Deterministic U74 release smoke and `release:production` command.

## Safety
- No SQLite reset or migration.
- No changes to the existing risk engine, predictive governance, GIS policy, RBAC, or multilingual safety gate.
- Export excludes raw uploaded document text; provenance and decision-support metadata remain traceable.

## Release command
`npm run release:production`

The command runs language-integrity regression, U72.4.2 functional regression, portfolio hygiene, U74 final-product smoke, and the production frontend build.
