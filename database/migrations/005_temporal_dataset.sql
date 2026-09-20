-- BHOOMIDHRISTI Upgrade 27: temporal dataset and leakage-safe training foundation.
-- Stores reproducible dataset versions, as-of examples, cohort splits, and leakage audits.
CREATE TABLE IF NOT EXISTS dataset_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  grain TEXT NOT NULL,
  source_scope TEXT NOT NULL,
  as_of_policy TEXT NOT NULL,
  label_definition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  example_count INTEGER NOT NULL DEFAULT 0,
  observed_label_count INTEGER NOT NULL DEFAULT 0,
  censored_count INTEGER NOT NULL DEFAULT 0,
  leakage_violations INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_created ON dataset_versions(created_at);

CREATE TABLE IF NOT EXISTS temporal_examples (
  id TEXT PRIMARY KEY,
  dataset_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  as_of TEXT NOT NULL,
  feature_json TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  label_observed INTEGER NOT NULL DEFAULT 0,
  delay_label INTEGER,
  observed_delay_days REAL,
  observed_duration_days REAL,
  censored INTEGER NOT NULL DEFAULT 0,
  censor_reason TEXT,
  outcome_at TEXT,
  source_event_count INTEGER NOT NULL DEFAULT 0,
  feature_policy TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_temporal_examples_dataset_project ON temporal_examples(dataset_version_id, project_id, as_of);

CREATE TABLE IF NOT EXISTS temporal_split_assignments (
  id TEXT PRIMARY KEY,
  dataset_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  example_id TEXT NOT NULL REFERENCES temporal_examples(id) ON DELETE CASCADE,
  split TEXT NOT NULL CHECK(split IN ('train','validation','test','holdout','unassigned')),
  cohort_time TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(dataset_version_id, example_id)
);
CREATE INDEX IF NOT EXISTS idx_temporal_split_dataset_split ON temporal_split_assignments(dataset_version_id, split);

CREATE TABLE IF NOT EXISTS leakage_audits (
  id TEXT PRIMARY KEY,
  dataset_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  example_id TEXT,
  feature_key TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('info','warning','error')),
  rule_code TEXT NOT NULL,
  as_of TEXT,
  source_time TEXT,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leakage_audit_dataset ON leakage_audits(dataset_version_id, severity);
