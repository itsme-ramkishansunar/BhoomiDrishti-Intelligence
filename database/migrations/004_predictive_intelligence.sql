-- BHOOMIDHRISTI Upgrade 26: predictive intelligence artifacts.
-- The candidate baseline intentionally stores model status and validation metadata so
-- demo/synthetic outputs cannot be confused with calibrated production probabilities.
CREATE TABLE IF NOT EXISTS prediction_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL DEFAULT 'project_prediction',
  model_version TEXT NOT NULL,
  model_status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  project_count INTEGER NOT NULL DEFAULT 0,
  feature_policy TEXT NOT NULL,
  validation_status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_time ON prediction_runs(completed_at);

CREATE TABLE IF NOT EXISTS prediction_feature_snapshots (
  id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  feature_value REAL,
  normalized_value REAL,
  source_field TEXT,
  as_of TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prediction_feature_prediction ON prediction_feature_snapshots(prediction_id);

INSERT OR IGNORE INTO model_registry(version,model_name,purpose,training_population,label_definition,legal_context,status,created_at)
VALUES('predictive-baseline-v1','BhoomiDrishti candidate temporal predictive baseline','Architecture-stage delay likelihood, stage hazard and expected additional days while authorised historical outcomes are being onboarded','Demo repository; insufficient for production calibration','Candidate delay-likelihood score; not a calibrated production probability','Prediction requires applicable acquisition workflow and as-of feature policy','candidate',datetime('now'));
