-- U71.10 project portfolio hygiene: soft-archive known local test fixtures and add recoverable project removal state.
ALTER TABLE projects ADD COLUMN portfolio_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE projects ADD COLUMN archived_at TEXT;
ALTER TABLE projects ADD COLUMN archived_by TEXT;
ALTER TABLE projects ADD COLUMN archive_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_projects_portfolio_status ON projects(portfolio_status);
CREATE INDEX IF NOT EXISTS idx_projects_archived_at ON projects(archived_at);

-- These are the local validation fixtures visible in the shared demo store.
-- They are archived (not physically deleted) so no dependent evidence/history is damaged.
UPDATE projects
SET portfolio_status='archived',
    archived_at=COALESCE(archived_at, datetime('now')),
    archived_by=COALESCE(archived_by, 'system:u71.10-cleanup'),
    archive_reason=COALESCE(archive_reason, 'Known local validation/test fixture')
WHERE LOWER(TRIM(name)) IN (
  'bhoomidrishti_single_project_test',
  'bhoomidrishti_project_import_single_test'
)
   OR LOWER(TRIM(code)) IN (
  'bhoomidrishti_single_project_test',
  'bhoomidrishti_project_import_single_test'
);
