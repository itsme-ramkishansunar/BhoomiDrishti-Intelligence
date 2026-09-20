-- BHOOMIDHRISHTI Upgrade 38: real public-source connector snapshots.
-- Snapshots are provenance records, not authoritative government claims.
CREATE TABLE IF NOT EXISTS source_connector_snapshots (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  duration_ms INTEGER,
  http_status INTEGER,
  ok INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  etag TEXT,
  last_modified TEXT,
  body_bytes INTEGER,
  body_sha256 TEXT NOT NULL,
  parser TEXT NOT NULL,
  extracted_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('SUCCESS','HTTP_ERROR','FETCH_ERROR','PARSE_ERROR')),
  error_message TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_connector_snapshots_connector ON source_connector_snapshots(connector_id, fetched_at);
CREATE INDEX IF NOT EXISTS idx_source_connector_snapshots_hash ON source_connector_snapshots(body_sha256);
