# U56.3 — Bulk Feature Registry Schema Repair

U56.3 hardens migration 017 for shared persistent stores created by experimental or partially-applied U56 builds.

If `project_feature_states` or `bulk_feature_runs` already exists with an incompatible schema, the application preserves the old table under a timestamped `_legacy_YYYYMMDDHHMMSS` name and recreates the canonical U56 schema. No legacy table is dropped.

Run `npm run repair:bulk-feature-schema` before bulk feature initialization when upgrading an existing shared store.
