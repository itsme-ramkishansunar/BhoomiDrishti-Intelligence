-- BHOOMIDHRISHTI Upgrade 34: canonical project reconciliation and evidence graph persistence.
CREATE TABLE IF NOT EXISTS canonical_project_records (
  id TEXT PRIMARY KEY,
  intake_id TEXT NOT NULL REFERENCES project_intakes(id) ON DELETE CASCADE,
  project_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('REVIEW_REQUIRED','READY_FOR_REVIEW','ATTACHED')),
  readiness_pct REAL NOT NULL DEFAULT 0,
  conflict_count INTEGER NOT NULL DEFAULT 0,
  quality_json TEXT NOT NULL,
  canonical_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canonical_project_intake ON canonical_project_records(intake_id);
CREATE INDEX IF NOT EXISTS idx_canonical_project_project ON canonical_project_records(project_id);
CREATE TABLE IF NOT EXISTS canonical_project_entities (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL REFERENCES canonical_project_records(id) ON DELETE CASCADE,
  entity_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  confidence_pct REAL NOT NULL,
  review_required INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_canonical ON canonical_project_entities(canonical_id);
