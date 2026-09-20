-- BHOOMIDHRISHTI Upgrade 35: persisted temporal evidence snapshots.
CREATE TABLE IF NOT EXISTS temporal_evidence_snapshots (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL REFERENCES canonical_project_records(id) ON DELETE CASCADE,
  as_of TEXT NOT NULL,
  snapshot_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('REVIEW_REQUIRED','READY','ATTACHED')),
  quality_json TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_temporal_snapshot_canonical ON temporal_evidence_snapshots(canonical_id, created_at);
CREATE TABLE IF NOT EXISTS temporal_evidence_events (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES temporal_evidence_snapshots(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  event_time TEXT NOT NULL,
  source_document TEXT NOT NULL,
  sha256 TEXT,
  event_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_temporal_evidence_events_snapshot ON temporal_evidence_events(snapshot_id, milestone_key);
