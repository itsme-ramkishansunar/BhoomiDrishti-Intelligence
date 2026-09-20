-- BHOOMIDHRISTI Upgrade 25: persistent, project-scoped AI conversations and evidence lineage
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL DEFAULT 'Bhoomi AI session',
  context_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_updated ON ai_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_project ON ai_sessions(user_id, project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  mode TEXT,
  model TEXT,
  api_version TEXT,
  confidence REAL,
  evidence_coverage REAL,
  uncertainty REAL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session_time ON ai_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS ai_message_evidence (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
  evidence_key TEXT NOT NULL,
  project_id TEXT,
  evidence_type TEXT NOT NULL,
  label TEXT NOT NULL,
  claim TEXT NOT NULL,
  source TEXT,
  provenance TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_message_evidence_message ON ai_message_evidence(message_id);
