-- Upgrade 48: operational early-warning, alert lifecycle, model monitoring, and replay.
CREATE TABLE IF NOT EXISTS operational_alerts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  attention_score REAL NOT NULL DEFAULT 0,
  warning_window_days INTEGER,
  warning_window_status TEXT NOT NULL DEFAULT 'NOT_AVAILABLE',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved','dismissed')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  resolution_note TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(project_id, category, rule_version)
);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_status ON operational_alerts(status, severity, attention_score DESC);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_project ON operational_alerts(project_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES operational_alerts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  event_note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_events_alert_time ON alert_events(alert_id, created_at DESC);

CREATE TABLE IF NOT EXISTS model_monitoring_snapshots (
  id TEXT PRIMARY KEY,
  model_version TEXT NOT NULL,
  dataset_version TEXT,
  evaluation_window TEXT,
  sample_count INTEGER NOT NULL DEFAULT 0,
  prediction_count INTEGER NOT NULL DEFAULT 0,
  drift_status TEXT NOT NULL DEFAULT 'NOT_AVAILABLE',
  coverage REAL,
  ood_rate REAL,
  false_alert_rate REAL,
  calibration_error REAL,
  brier REAL,
  action_rate REAL,
  outcome_rate REAL,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_monitoring_model_time ON model_monitoring_snapshots(model_version, created_at DESC);

CREATE TABLE IF NOT EXISTS replay_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  as_of TEXT,
  snapshot_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  prediction_count INTEGER NOT NULL DEFAULT 0,
  outcome_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'READY',
  replay_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_replay_runs_project_time ON replay_runs(project_id, created_at DESC);
