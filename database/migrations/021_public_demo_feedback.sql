-- Additive public-demo review storage. No project facts are modified.
CREATE TABLE IF NOT EXISTS public_demo_feedback (
  id TEXT PRIMARY KEY,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  category TEXT NOT NULL,
  worked TEXT NOT NULL DEFAULT '',
  improvements TEXT NOT NULL DEFAULT '',
  would_use TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_public_demo_feedback_created_at ON public_demo_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_demo_feedback_category ON public_demo_feedback(category);
