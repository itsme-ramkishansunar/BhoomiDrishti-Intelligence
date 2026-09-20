-- BHOOMIDHRISTI Upgrade 24: temporal workflow + legal clock foundation
CREATE TABLE IF NOT EXISTS project_stage_dependencies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_stage_code TEXT NOT NULL,
  to_stage_code TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'sequence',
  status TEXT NOT NULL DEFAULT 'open',
  reason TEXT,
  source_label TEXT NOT NULL DEFAULT 'derived',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, from_stage_code, to_stage_code, dependency_type)
);
CREATE INDEX IF NOT EXISTS idx_stage_dependencies_project ON project_stage_dependencies(project_id);

CREATE TABLE IF NOT EXISTS legal_clock_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clock_code TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  start_at TEXT,
  deadline_at TEXT,
  elapsed_days INTEGER,
  paused_days INTEGER,
  remaining_days INTEGER,
  source_section TEXT NOT NULL,
  snapshot_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_legal_clock_project_time ON legal_clock_snapshots(project_id, evaluated_at);
