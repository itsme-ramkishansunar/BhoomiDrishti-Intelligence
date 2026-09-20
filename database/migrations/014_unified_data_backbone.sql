-- Upgrade 51: unified persistent data/evidence backbone and materialized intelligence snapshot.
-- These are derived/materialized records; the base operational tables remain the source of truth.
CREATE TABLE IF NOT EXISTS project_data_facts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fact_key TEXT NOT NULL,
  value_text TEXT,
  value_numeric REAL,
  value_json TEXT,
  unit TEXT,
  source_label TEXT NOT NULL,
  provenance_status TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  source_id TEXT,
  source_checksum TEXT,
  observed_at TEXT,
  effective_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, fact_key)
);
CREATE INDEX IF NOT EXISTS idx_project_data_facts_project ON project_data_facts(project_id, fact_key);
CREATE INDEX IF NOT EXISTS idx_project_data_facts_provenance ON project_data_facts(provenance_status, verification_status);

CREATE TABLE IF NOT EXISTS project_intelligence_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_key TEXT NOT NULL DEFAULT 'current',
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  as_of TEXT NOT NULL,
  project_updated_at TEXT NOT NULL,
  facts_sha256 TEXT NOT NULL,
  data_sha256 TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, snapshot_key)
);
CREATE INDEX IF NOT EXISTS idx_project_intelligence_snapshots_project ON project_intelligence_snapshots(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_intelligence_snapshots_hash ON project_intelligence_snapshots(data_sha256);
