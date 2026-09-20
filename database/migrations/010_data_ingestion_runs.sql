-- Upgrade 40: self-service authorized dataset ingestion ledger.
-- Files remain immutable source artifacts; analysis does not promote data to authoritative government status.
CREATE TABLE IF NOT EXISTS data_ingestion_runs (
  id TEXT PRIMARY KEY,
  original_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  content_type TEXT,
  extension TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  source_classification TEXT NOT NULL DEFAULT 'USER_UPLOADED / NOT_GOVERNMENT_VERIFIED',
  status TEXT NOT NULL CHECK(status IN ('RECEIVED','ANALYZED','ANALYSIS_FAILED')),
  report_json TEXT,
  error_message TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_data_ingestion_runs_created ON data_ingestion_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_ingestion_runs_sha256 ON data_ingestion_runs(sha256);
