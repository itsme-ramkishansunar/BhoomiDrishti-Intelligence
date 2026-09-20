ALTER TABLE projects ADD COLUMN location_authority TEXT;
ALTER TABLE projects ADD COLUMN location_confidence REAL;
ALTER TABLE projects ADD COLUMN location_accuracy_m REAL;
ALTER TABLE projects ADD COLUMN location_verified_at TEXT;
ALTER TABLE projects ADD COLUMN location_verified_by TEXT;
CREATE INDEX IF NOT EXISTS idx_projects_location_authority ON projects(location_authority);
CREATE INDEX IF NOT EXISTS idx_projects_location_verified ON projects(location_verified_at);
