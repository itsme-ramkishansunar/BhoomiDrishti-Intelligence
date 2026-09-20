-- BHOOMIDHRISHTI Upgrade 30: self-service project intake and autonomous local-first analysis.
CREATE TABLE IF NOT EXISTS project_intakes (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'analysed' CHECK(status IN ('analysed','draft_created','archived')),
  analysis_version TEXT NOT NULL,
  source_classification TEXT NOT NULL,
  document_count INTEGER NOT NULL DEFAULT 0,
  completeness_pct REAL NOT NULL DEFAULT 0,
  evidence_coverage_pct REAL NOT NULL DEFAULT 0,
  extraction_confidence_pct REAL NOT NULL DEFAULT 0,
  combined_sha256 TEXT NOT NULL,
  analysis_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_intakes_created ON project_intakes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_intakes_project ON project_intakes(project_id);
CREATE TABLE IF NOT EXISTS project_intake_files (
  id TEXT PRIMARY KEY,
  intake_id TEXT NOT NULL REFERENCES project_intakes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  byte_size INTEGER,
  sha256 TEXT NOT NULL,
  parser TEXT NOT NULL,
  text_chars INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_intake_files_intake ON project_intake_files(intake_id);
