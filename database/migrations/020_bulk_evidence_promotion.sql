-- U75.5: governed field-level evidence and safe bulk promotion ledger.
-- Additive only. No existing project/source rows are modified by this migration.
CREATE TABLE IF NOT EXISTS bulk_promotion_batches (
  id TEXT PRIMARY KEY,
  ingestion_run_id TEXT REFERENCES data_ingestion_runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bulk_promotion_batches_run ON bulk_promotion_batches(ingestion_run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bulk_promotion_evidence (
  id TEXT PRIMARY KEY,
  batch_id TEXT REFERENCES bulk_promotion_batches(id) ON DELETE SET NULL,
  ingestion_run_id TEXT REFERENCES data_ingestion_runs(id) ON DELETE SET NULL,
  row_number INTEGER NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  field_name TEXT,
  incoming_value TEXT,
  existing_value TEXT,
  decision TEXT NOT NULL,
  match_state TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_id TEXT,
  source_checksum TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_bulk_promotion_evidence_run ON bulk_promotion_evidence(ingestion_run_id, row_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_promotion_evidence_project ON bulk_promotion_evidence(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_promotion_evidence_decision ON bulk_promotion_evidence(decision, created_at DESC);
