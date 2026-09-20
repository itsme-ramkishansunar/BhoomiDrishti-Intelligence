-- U72.4 additive governance: responsible department + recoverable portfolio authority + intake review queue.
ALTER TABLE projects ADD COLUMN responsible_department TEXT;
CREATE INDEX IF NOT EXISTS idx_projects_responsible_department ON projects(responsible_department);

CREATE TABLE IF NOT EXISTS intake_field_reviews (
  id TEXT PRIMARY KEY,
  intake_id TEXT NOT NULL REFERENCES project_intakes(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  candidate_value TEXT,
  source_document TEXT,
  source_excerpt TEXT,
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected','corrected')),
  reviewed_value TEXT,
  reviewer TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE(intake_id, field_key)
);
CREATE INDEX IF NOT EXISTS idx_intake_field_reviews_intake ON intake_field_reviews(intake_id,status);
