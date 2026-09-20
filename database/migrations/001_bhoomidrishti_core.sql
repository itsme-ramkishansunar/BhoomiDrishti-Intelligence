-- BHOOMIDHRISTI core relational schema reference for PostgreSQL/PostGIS deployment.
-- Local Windows development uses the same logical model in SQLite via node:sqlite.
-- Production deployments should enable PostgreSQL, PostGIS, TLS, managed secrets,
-- institution-approved identity, backups and network controls before loading restricted data.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  name text PRIMARY KEY,
  description text NOT NULL,
  permissions jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL REFERENCES roles(name),
  status text NOT NULL CHECK (status IN ('active','suspended','disabled')),
  organisation text,
  state text,
  district text,
  jurisdiction jsonb NOT NULL DEFAULT '{}'::jsonb,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  password_hash text,
  password_salt text,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  organisation text NOT NULL,
  requested_role text NOT NULL REFERENCES roles(name),
  justification text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')),
  assigned_role text REFERENCES roles(name),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text,
  provisioned_user_id uuid REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  type text NOT NULL,
  state text NOT NULL,
  district text NOT NULL,
  total_parcels integer NOT NULL DEFAULT 0,
  parcels_acquired integer NOT NULL DEFAULT 0,
  families_affected integer NOT NULL DEFAULT 0,
  families_pending integer NOT NULL DEFAULT 0,
  avg_delay_days numeric NOT NULL DEFAULT 0,
  disputes integer NOT NULL DEFAULT 0,
  court_cases integer NOT NULL DEFAULT 0,
  approval_pct numeric NOT NULL DEFAULT 0,
  docs_missing integer NOT NULL DEFAULT 0,
  resettlement_pct numeric NOT NULL DEFAULT 0,
  rehab_pct numeric NOT NULL DEFAULT 0,
  depts integer NOT NULL DEFAULT 0,
  prev_delays integer NOT NULL DEFAULT 0,
  stage_index integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('ongoing','completed')),
  planned_days integer,
  actual_days integer,
  latitude double precision,
  longitude double precision,
  geometry geometry(Geometry,4326),
  acquisition_profile text,
  source_label text NOT NULL DEFAULT 'unknown',
  source_id text,
  source_retrieved_at timestamptz,
  source_effective_at timestamptz,
  source_version text,
  source_checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_geom ON projects USING gist (geometry);
CREATE INDEX IF NOT EXISTS idx_projects_state_district ON projects(state,district);
CREATE TABLE IF NOT EXISTS project_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_index integer NOT NULL,
  stage_name text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  entered_at timestamptz,
  completed_at timestamptz,
  statutory_clock_source text,
  target_days integer,
  UNIQUE(project_id, stage_index)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  actor_role text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  outcome text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS data_sources (
  id text PRIMARY KEY,
  name text UNIQUE NOT NULL,
  source_type text NOT NULL,
  status text NOT NULL,
  owner text,
  access_note text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
