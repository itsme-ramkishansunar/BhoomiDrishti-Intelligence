# U72.4.2 — Bulk Functional Repair

## Fixed

- Corrected the persistent `project_data_facts` UPSERT so portfolio-archive columns are not referenced in the wrong table. This removes the `no such column: portfolio_status` failure during first-time project bootstrap on older shared stores.
- Persisted extracted Project Intake field candidates into `intake_field_reviews` immediately after analysis, preserving candidate/non-canonical status and provenance.
- Made administrator-governed Predictive Lab build actions role-aware in the UI instead of exposing controls that return `Permission required: workflow:admin` to ordinary officers.
- Made Data Health bulk initialization and public-source snapshot controls role-aware.
- Made Integration Control connector test/snapshot controls role-aware.
- Made command-palette navigation use the authenticated permission set instead of a hard-coded dashboard-only filter.

## Safety

- No database reset or recreation.
- No predictive model replacement.
- No GIS replacement.
- No authentication/RBAC weakening.
- Administrator-only operations remain administrator-only; the UI now explains the boundary instead of producing avoidable 403 errors.
- Candidate intake facts remain separate from the canonical operational record until review.

## Regression

`npm.cmd run smoke:u72.4.2-functional`

The regression uses an isolated temporary SQLite store and exercises:

1. project-fact insert and ON CONFLICT update;
2. persistent intake field-review queue;
3. bulk project initialization;
4. source-level authorization guards.
