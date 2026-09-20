CREATE TABLE IF NOT EXISTS project_feature_states (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  feature_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('READY','REVIEW_REQUIRED','BLOCKED','NOT_APPLICABLE')),
  readiness TEXT NOT NULL CHECK(readiness IN ('COMPLETE','PARTIAL','BLOCKED','NOT_APPLICABLE')),
  provenance_status TEXT NOT NULL,
  source_type TEXT NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  initialized_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_project_feature_states_project ON project_feature_states(project_id);
CREATE INDEX IF NOT EXISTS idx_project_feature_states_status ON project_feature_states(status);
CREATE TABLE IF NOT EXISTS bulk_feature_runs (
  id TEXT PRIMARY KEY,
  registry_version TEXT NOT NULL,
  project_count INTEGER NOT NULL DEFAULT 0,
  initialized_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_bulk_feature_runs_completed ON bulk_feature_runs(completed_at);
