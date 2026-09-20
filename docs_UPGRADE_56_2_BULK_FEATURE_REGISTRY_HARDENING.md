# U56.2 — Bulk Feature Registry Hardening

Fixes the U56.1 shared-store failure where `initialize:features` could encounter `no such table: bulk_feature_runs` because the persistent-store migration command exited early when a shared DB already existed.

## Fixes
- Existing shared DB migration now loads the canonical DB migration path instead of treating an existing DB as fully migrated.
- Migration 017 is idempotently re-applied with `CREATE TABLE IF NOT EXISTS`, allowing repair when schema_migrations incorrectly records version 17 while feature tables are missing.
- `initialize:features` loads the canonical DB module before initialization, so the feature schema is self-healed before writes.
- Added `backup:persistent-store` using SQLite online backup instead of a raw file copy.
- Added `apply:pending-schema` for explicit schema verification/repair.

U55 remains the fallback baseline. No project data is deleted or recreated.
