# U72.4.1 — Runtime Schema Repair

This is an additive hotfix on U72.4. It addresses a shared-store edge case where schema migration versions 18/19 can already be recorded while the physical `projects` table is missing portfolio governance columns.

## Safety
- Never deletes or recreates the shared database.
- Never resets project/evidence/prediction data.
- Adds only missing governance columns/indexes and the human-review table if absent.
- Existing U72.1/U72.2/U72.3 document intelligence and predictive layers are untouched.

## Runtime repair
At backend startup the schema is reconciled for:
- projects.portfolio_status
- projects.archived_at
- projects.archived_by
- projects.archive_reason
- projects.responsible_department
- intake_field_reviews

The repair is idempotent.

## Verification
After starting the backend once, run:
`npm.cmd run smoke:u72.4-runtime-schema`
