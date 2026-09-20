import 'node:sqlite';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { computeRisk, STAGES } from './risk-engine.js';
import { classifySourceLabel } from './domain/provenance.js';
import { demoPointForDistrict, demoPointForState, coordinatePairValid, indiaCoordinateValid, MAPPING_VERSION } from './domain/map-location-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { DB_PATH, DATA_ROOT_DIR, ensureRuntimeDirs } = require('./runtime-paths.cjs');
ensureRuntimeDirs();
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.accessSync(path.dirname(DB_PATH), fs.constants.R_OK | fs.constants.W_OK);

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}
function openPersistentDatabase() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  let lastError = null;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const handle = new DatabaseSync(DB_PATH, { timeout: 10000 });
      handle.exec('PRAGMA foreign_keys = ON;');
      handle.exec('PRAGMA busy_timeout = 10000;');
      return handle;
    } catch (error) {
      lastError = error;
      const transient = /unable to open database file|database is locked|database table is locked|busy|locked/i.test(String(error?.message || ''));
      if (!transient || attempt === 20) break;
      sleepSync(Math.min(250 * attempt, 1500));
    }
  }
  throw new Error(`Unable to open persistent BHOOMIDHRISHTI database at ${DB_PATH} after retries. The shared store must be writable and no other BHOOMIDHRISHTI release may hold it. Original error: ${lastError?.message || 'unknown error'}`);
}
let db = openPersistentDatabase();

db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roles (
  name TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  permissions_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL REFERENCES roles(name),
  status TEXT NOT NULL CHECK(status IN ('active','suspended','disabled')),
  organisation TEXT,
  state TEXT,
  district TEXT,
  jurisdiction_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organisation TEXT NOT NULL,
  requested_role TEXT NOT NULL REFERENCES roles(name),
  justification TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
  assigned_role TEXT REFERENCES roles(name),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  provisioned_user_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_request_pending_email ON access_requests(LOWER(email)) WHERE status='pending';
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  total_parcels INTEGER NOT NULL DEFAULT 0,
  parcels_acquired INTEGER NOT NULL DEFAULT 0,
  families_affected INTEGER NOT NULL DEFAULT 0,
  families_pending INTEGER NOT NULL DEFAULT 0,
  avg_delay_days REAL NOT NULL DEFAULT 0,
  disputes INTEGER NOT NULL DEFAULT 0,
  court_cases INTEGER NOT NULL DEFAULT 0,
  approval_pct REAL NOT NULL DEFAULT 0,
  docs_missing INTEGER NOT NULL DEFAULT 0,
  resettlement_pct REAL NOT NULL DEFAULT 0,
  rehab_pct REAL NOT NULL DEFAULT 0,
  depts INTEGER NOT NULL DEFAULT 0,
  prev_delays INTEGER NOT NULL DEFAULT 0,
  stage_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('ongoing','completed')),
  planned_days INTEGER,
  actual_days INTEGER,
  map_x REAL,
  map_y REAL,
  latitude REAL,
  longitude REAL,
  geometry_geojson TEXT,
  acquisition_profile TEXT,
  source_label TEXT NOT NULL DEFAULT 'synthetic_demo',
  source_id TEXT,
  source_retrieved_at TEXT,
  source_effective_at TEXT,
  source_version TEXT,
  source_checksum TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_state_district ON projects(state,district);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE TABLE IF NOT EXISTS project_stages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL,
  stage_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  entered_at TEXT,
  completed_at TEXT,
  statutory_clock_source TEXT,
  target_days INTEGER,
  UNIQUE(project_id, stage_index)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  outcome TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at);
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  owner TEXT,
  access_note TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS legal_frameworks (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_url TEXT,
  version_label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflow_templates (
  code TEXT PRIMARY KEY,
  legal_framework_code TEXT REFERENCES legal_frameworks(code),
  name TEXT NOT NULL,
  applicability_note TEXT,
  source_url TEXT,
  version_label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflow_stages (
  id TEXT PRIMARY KEY,
  workflow_code TEXT NOT NULL REFERENCES workflow_templates(code) ON DELETE CASCADE,
  stage_code TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(workflow_code, stage_code)
);
CREATE TABLE IF NOT EXISTS project_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_code TEXT,
  occurred_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_id TEXT,
  effective_at TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_events_project_time ON project_events(project_id, occurred_at);
CREATE TABLE IF NOT EXISTS data_snapshots (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES data_sources(id),
  snapshot_type TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  effective_at TEXT,
  checksum TEXT,
  schema_version TEXT,
  record_count INTEGER DEFAULT 0,
  quality_status TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS data_lineage (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT REFERENCES data_snapshots(id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  field_name TEXT,
  source_value_json TEXT,
  transform_note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_parcels (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  survey_number TEXT,
  khasra_number TEXT,
  khata_number TEXT,
  ulpin TEXT,
  village TEXT,
  area_hectares REAL,
  geometry_geojson TEXT,
  geometry_version TEXT,
  source_label TEXT NOT NULL DEFAULT 'synthetic_demo',
  source_id TEXT,
  confidence REAL,
  validation_status TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_parcels_project ON project_parcels(project_id);
CREATE TABLE IF NOT EXISTS compensation_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parcel_id TEXT,
  case_state TEXT NOT NULL,
  amount_determined REAL DEFAULT 0,
  amount_deposited REAL DEFAULT 0,
  amount_tendered REAL DEFAULT 0,
  amount_received REAL DEFAULT 0,
  amount_disputed REAL DEFAULT 0,
  pending_since TEXT,
  source_label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS litigation_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parcel_id TEXT,
  case_reference TEXT,
  state TEXT NOT NULL,
  filed_at TEXT,
  stage_relevance TEXT,
  stay_status TEXT NOT NULL DEFAULT 'unknown',
  stay_started_at TEXT,
  stay_ended_at TEXT,
  affected_area_hectares REAL DEFAULT 0,
  linkage_confidence REAL,
  source_label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS document_records (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  parcel_id TEXT,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL,
  source_label TEXT NOT NULL,
  checksum TEXT,
  page_count INTEGER,
  ocr_status TEXT,
  extraction_confidence REAL,
  validation_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prediction_as_of TEXT NOT NULL,
  snapshot_id TEXT,
  model_version TEXT,
  workflow_code TEXT,
  stage_code TEXT,
  delay_probability REAL,
  expected_additional_days REAL,
  applicability TEXT,
  uncertainty REAL,
  data_completeness REAL,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_predictions_project_time ON predictions(project_id, prediction_as_of);
CREATE TABLE IF NOT EXISTS prediction_explanations (
  id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  layer TEXT NOT NULL,
  feature_key TEXT,
  feature_value REAL,
  contribution REAL,
  evidence_id TEXT,
  explanation_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prediction_id TEXT,
  owner_role TEXT,
  action_text TEXT NOT NULL,
  basis_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 3,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS interventions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  recommendation_id TEXT,
  scenario_json TEXT NOT NULL,
  estimated_effect_json TEXT NOT NULL,
  is_hypothetical INTEGER NOT NULL DEFAULT 1,
  actual_outcome_json TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  acknowledged_by TEXT,
  acknowledged_at TEXT
);
CREATE TABLE IF NOT EXISTS model_registry (
  version TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  training_population TEXT,
  label_definition TEXT,
  legal_context TEXT,
  status TEXT NOT NULL DEFAULT 'candidate',
  created_at TEXT NOT NULL,
  approved_at TEXT
);
CREATE TABLE IF NOT EXISTS model_evaluations (
  id TEXT PRIMARY KEY,
  model_version TEXT NOT NULL REFERENCES model_registry(version),
  split_strategy TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  sample_count INTEGER,
  roc_auc REAL,
  pr_auc REAL,
  brier REAL,
  calibration_error REAL,
  notes TEXT
);
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
`);

db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(1, new Date().toISOString());

const MIGRATION_2 = 2;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_2)) {
  const t = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO legal_frameworks(code,name,source_url,version_label,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('NHA_1956','National Highways Act, 1956','https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_30_42_00002_195648_1517807321068&type=act','authoritative-source-reference',t,t);
  db.prepare('INSERT OR IGNORE INTO legal_frameworks(code,name,source_url,version_label,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('RFCTLARR_2013','Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013','https://www.indiacode.nic.in/handle/123456789/17043','authoritative-source-reference',t,t);
  db.prepare('INSERT OR IGNORE INTO workflow_templates(code,legal_framework_code,name,applicability_note,source_url,version_label,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run('NH_ACQUISITION_V1','NHA_1956','National Highways acquisition pathway','Applicable only when authorised project configuration establishes this pathway.','https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_30_42_00002_195648_1517807321068&type=act','v1',t,t);
  db.prepare('INSERT OR IGNORE INTO workflow_templates(code,legal_framework_code,name,applicability_note,source_url,version_label,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run('RFCTLARR_CENTRAL_V1','RFCTLARR_2013','RFCTLARR acquisition pathway','Applicable only when the authorised acquisition profile selects this framework.','https://www.indiacode.nic.in/handle/123456789/17043','v1',t,t);
  const stages=[['3A','3A — Intention to acquire'],['3C','3C — Objections'],['3D','3D — Declaration'],['3E','3E — Possession'],['3G','3G — Compensation determination'],['3H','3H — Deposit/payment']];
  const stx=db.prepare('INSERT OR IGNORE INTO workflow_stages(id,workflow_code,stage_code,stage_label,sequence_no,created_at) VALUES(?,?,?,?,?,?)');
  stages.forEach((x,i)=>stx.run(crypto.randomUUID(),'NH_ACQUISITION_V1',x[0],x[1],i,t));
  const rf=[['SIA','Social Impact Assessment'],['PRELIMINARY_NOTIFICATION','Preliminary notification'],['OBJECTIONS','Objections / hearing'],['DECLARATION','Declaration under section 19'],['AWARD','Collector award'],['RR_AWARD','Rehabilitation & Resettlement award'],['PAYMENT','Compensation payment'],['POSSESSION','Possession']];
  rf.forEach((x,i)=>stx.run(crypto.randomUUID(),'RFCTLARR_CENTRAL_V1',x[0],x[1],i,t));
  db.prepare('INSERT OR IGNORE INTO model_registry(version,model_name,purpose,training_population,label_definition,legal_context,status,created_at) VALUES(?,?,?,?,?,?,?,?)').run('rules-risk-v2','BhoomiDrishti rules baseline','Transparent deterministic risk decomposition while labelled historical data is being onboarded','Current authorised repository','Stored risk composition; not a trained delay outcome label','Workflow applicability required before statutory inference','baseline',t);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_2,t);
}


const MIGRATION_4 = 4;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_4)) {
  const t = now();
  db.exec(`
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
  `);
  db.prepare('INSERT OR IGNORE INTO model_registry(version,model_name,purpose,training_population,label_definition,legal_context,status,created_at) VALUES(?,?,?,?,?,?,?,?)').run(
    'predictive-baseline-v1',
    'BhoomiDrishti candidate temporal predictive baseline',
    'Architecture-stage delay likelihood, stage hazard and expected additional days while authorised historical outcomes are being onboarded',
    'Demo repository; insufficient for production calibration',
    'Candidate delay-likelihood score; not a calibrated production probability',
    'Prediction requires applicable acquisition workflow and as-of feature policy',
    'candidate',
    t
  );
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_4,t);
}


export const ROLE_PERMISSIONS = {
  Administrator: ['*','admin:access','admin:audit','projects:write','projects:archive','documents:write','workflow:admin','integrations:admin'],
  'Government Officer': ['dashboard:read','projects:read','projects:edit','projects:archive','risk:read','map:read','alerts:read','alerts:action','history:read','feedback:write','ai:use','documents:read','workflow:read','workflow:action','reports:read'],
  'Department Officer': ['dashboard:read','projects:read','projects:edit','projects:archive','risk:read','map:read','alerts:read','feedback:write','ai:use','documents:read','documents:verify','workflow:read','workflow:action','reports:read'],
  'Legal Officer': ['dashboard:read','projects:read','risk:read','map:read','alerts:read','history:read','feedback:write','ai:use','documents:read','documents:verify','legal:review','workflow:read','workflow:action','reports:read'],
  Viewer: ['dashboard:read','projects:read','risk:read','map:read','alerts:read','history:read','ai:use','reports:read'],
};
export const ROLE_DESCRIPTIONS = {
  Administrator: 'Full system administration, configuration, security and operational access.',
  'Government Officer': 'Government project oversight, prioritisation, actions and escalations.',
  'Department Officer': 'Assigned departmental work across compensation, documentation and operational tasks.',
  'Legal Officer': 'Legal and dispute review, evidence inspection and case-related decision support.',
  Viewer: 'Read-only access to authorised dashboards, project intelligence and reports.',
};

for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
  db.prepare('INSERT OR IGNORE INTO roles(name, description, permissions_json) VALUES(?,?,?)').run(name, ROLE_DESCRIPTIONS[name], JSON.stringify(permissions));
}

function now() { return new Date().toISOString(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return { salt, hash: crypto.scryptSync(String(password), salt, 64).toString('hex') }; }
export function verifyPassword(password, stored) {
  if (!stored?.password_hash || !stored?.password_salt) return false;
  const actual = crypto.scryptSync(String(password), stored.password_salt, 64);
  const expected = Buffer.from(stored.password_hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
export function createPassword(password) { return hashPassword(password); }
export function parseJson(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
export function publicUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, status: row.status, organisation: row.organisation, jurisdiction: parseJson(row.jurisdiction_json, {}), permissions: parseJson(row.permissions_json, ROLE_PERMISSIONS[row.role] || []), roleDescription: ROLE_DESCRIPTIONS[row.role] || '', mustChangePassword: Boolean(row.must_change_password) };
}
function mapProject(row) {
  const project = {
    id: row.id, name: row.name, code: row.code, type: row.type, state: row.state, district: row.district,
    totalParcels: row.total_parcels, parcelsAcquired: row.parcels_acquired, familiesAffected: row.families_affected,
    familiesPending: row.families_pending, avgDelayDays: row.avg_delay_days, disputes: row.disputes, courtCases: row.court_cases,
    approvalPct: row.approval_pct, docsMissing: row.docs_missing, resettlementPct: row.resettlement_pct, rehabPct: row.rehab_pct,
    depts: row.depts, prevDelays: row.prev_delays, stageIndex: row.stage_index, status: row.status, plannedDays: row.planned_days,
    actualDays: row.actual_days, x: row.map_x, y: row.map_y, latitude: row.latitude, longitude: row.longitude,
    geometryGeoJSON: parseJson(row.geometry_geojson, null), acquisitionProfile: row.acquisition_profile || null,
    locationPrecision: row.location_precision || 'UNRESOLVED', locationSource: row.location_source || null,
    locationLabel: row.location_label || null, locationOsmType: row.location_osm_type || null,
    locationOsmId: row.location_osm_id || null, locationBBox: parseJson(row.location_bbox_json, null),
    locationResolvedAt: row.location_resolved_at || null,
    locationAuthority: row.location_authority || null, locationConfidence: row.location_confidence == null ? null : Number(row.location_confidence), locationAccuracyM: row.location_accuracy_m == null ? null : Number(row.location_accuracy_m), locationVerifiedAt: row.location_verified_at || null, locationVerifiedBy: row.location_verified_by || null,
    responsibleDepartment: row.responsible_department || null,
    portfolioStatus: row.portfolio_status || 'active', archivedAt: row.archived_at || null, archivedBy: row.archived_by || null, archiveReason: row.archive_reason || null,
    sourceLabel: row.source_label || null,
    sourceId: row.source_id || null,
    source: { label: row.source_label, id: row.source_id, retrievedAt: row.source_retrieved_at, effectiveAt: row.source_effective_at, version: row.source_version, checksum: row.source_checksum },
  };
  return { ...project, risk: computeRisk(project) };
}

function hasLocationIntegrityColumns() {
  try { return db.prepare("SELECT 1 FROM pragma_table_info('projects') WHERE name='location_authority'").get() !== undefined; } catch (_) { return false; }
}

function refreshLocationIntegrityMetadata() {
  try {
    db.prepare(`UPDATE projects SET location_authority=CASE
      WHEN location_source='DEMO_DISTRICT_CENTROID' THEN 'DEMO_APPROXIMATE'
      WHEN location_source='NOMINATIM_OSM' THEN 'OPEN_MAP_GEOCODE'
      WHEN location_precision='PARCEL_GEOMETRY' THEN 'SOURCE_GEOMETRY'
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'PROJECT_RECORD_POINT'
      ELSE NULL END,
      location_confidence=CASE
      WHEN location_source='DEMO_DISTRICT_CENTROID' THEN 0.25
      WHEN location_source='NOMINATIM_OSM' THEN 0.75
      WHEN location_precision='PARCEL_GEOMETRY' THEN 1
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 0.6
      ELSE NULL END
      WHERE location_authority IS NULL`).run();
  } catch (_) {}
}

function backfillSyntheticDemoLocations() {
  const rows = db.prepare(
    `SELECT id,district,latitude,longitude,location_precision,location_source FROM projects
     WHERE COALESCE(source_label,'')='synthetic_demo'
       AND (COALESCE(location_source,'') IN ('','DEMO_DISTRICT_CENTROID') OR COALESCE(location_precision,'')='DISTRICT_CENTROID')`
  ).all();
  if (!rows.length) return;
  const update = db.prepare(`UPDATE projects SET latitude=?,longitude=?,location_precision=?,location_source=?,location_label=?,location_resolved_at=?,updated_at=? WHERE id=?`);
  const t = now();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const demo = demoPointForDistrict(row.district);
      if (!demo) continue;
      const same = Number(row.latitude) === Number(demo.latitude) && Number(row.longitude) === Number(demo.longitude) && row.location_precision === demo.precision && row.location_source === demo.source;
      if (!same) update.run(demo.latitude,demo.longitude,demo.precision,demo.source,demo.label,t,t,row.id);
      if (hasLocationIntegrityColumns()) {
        db.prepare(`UPDATE projects SET location_authority='DEMO_APPROXIMATE', location_confidence=0.25 WHERE id=?`).run(row.id);
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function repairProjectLocationIntegrity() {
  if (!hasLocationIntegrityColumns()) return { repaired: 0, cleared: 0 };
  const rows = db.prepare(`SELECT id,district,latitude,longitude,location_precision,location_source,location_label FROM projects WHERE latitude IS NOT NULL OR longitude IS NOT NULL OR location_precision IS NULL OR location_precision='UNRESOLVED'`).all();
  if (!rows.length) return { repaired: 0, cleared: 0 };
  const repair = db.prepare(`UPDATE projects SET latitude=?, longitude=?, location_precision=?, location_source=?, location_label=?, location_resolved_at=COALESCE(location_resolved_at,?), location_authority=?, location_confidence=?, updated_at=? WHERE id=?`);
  const clear = db.prepare(`UPDATE projects SET latitude=NULL, longitude=NULL, location_precision='UNRESOLVED', location_source=NULL, location_label='Coordinate rejected by India GIS integrity boundary', location_resolved_at=NULL, location_authority=NULL, location_confidence=NULL, updated_at=? WHERE id=?`);
  const allowDemoFallback = String(process.env.BHOOMI_LOCAL_DEMO_LOCATION_FALLBACK ?? 'true').toLowerCase() !== 'false';
  let repaired=0, cleared=0; const t=now();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const lat=Number(row.latitude), lon=Number(row.longitude);
      const hasAnyCoordinate=Number.isFinite(lat)||Number.isFinite(lon);
      if (!indiaCoordinateValid(lat,lon)) {
        const fallback = allowDemoFallback ? demoPointForDistrict(row.district) : null;
        if (fallback && (!Number.isFinite(lat)||!Number.isFinite(lon)||!indiaCoordinateValid(lat,lon))) {
          repair.run(fallback.latitude, fallback.longitude, 'DISTRICT_CENTROID', 'DEMO_DISTRICT_CENTROID', `${fallback.label}; approximate only — not authoritative project/parcel geometry`, t, 'DEMO_APPROXIMATE', 0.25, t, row.id);
          repaired++;
        } else if (hasAnyCoordinate) { clear.run(t,row.id); cleared++; }
        continue;
      }
      const precision=String(row.location_precision||'').trim().toUpperCase();
      if (!precision || precision==='UNRESOLVED') {
        repair.run(lat, lon, 'PROJECT_POINT', row.location_source || 'PROJECT_RECORD', row.location_label || 'Coordinate supplied in project record', t, 'PROJECT_RECORD_POINT', 0.6, t, row.id);
        repaired++;
      }
    }
    db.exec('COMMIT');
  } catch(e){ db.exec('ROLLBACK'); throw e; }
  return {repaired,cleared};
}

function seedProjects() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
  if (count > 0) return;
  const seedPath = path.join(__dirname, 'seed-projects.json');
  const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const tx = db.prepare(`INSERT INTO projects(id,name,code,type,state,district,responsible_department,total_parcels,parcels_acquired,families_affected,families_pending,avg_delay_days,disputes,court_cases,approval_pct,docs_missing,resettlement_pct,rehab_pct,depts,prev_delays,stage_index,status,planned_days,actual_days,map_x,map_y,latitude,longitude,location_precision,location_source,location_label,source_label,source_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const stageTx = db.prepare('INSERT INTO project_stages(id,project_id,stage_index,stage_name,state) VALUES(?,?,?,?,?)');
  db.exec('BEGIN IMMEDIATE');
  try {
    const t = now();
    for (const p of data) {
      const demo=demoPointForDistrict(p.district);
      tx.run(p.id,p.name,p.code,p.type,p.state,p.district,p.responsibleDepartment ?? null,p.totalParcels,p.parcelsAcquired,p.familiesAffected,p.familiesPending,p.avgDelayDays,p.disputes,p.courtCases,p.approvalPct,p.docsMissing,p.resettlementPct,p.rehabPct,p.depts,p.prevDelays,p.stageIndex,p.status,p.plannedDays ?? null,p.actualDays ?? null,p.x ?? null,p.y ?? null,demo?.latitude ?? null,demo?.longitude ?? null,demo?.precision ?? 'UNRESOLVED',demo?.source ?? null,demo?.label ?? null,'synthetic_demo','bootstrap:'+p.id,t,t);
      const stageName = STAGES[Math.max(0, Math.min(STAGES.length - 1, Number(p.stageIndex) || 0))];
      stageTx.run(crypto.randomUUID(),p.id,Number(p.stageIndex)||0,stageName,'current');
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
const MIGRATION_5 = 5;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_5)) {
  const t = now();
  db.exec(`
    CREATE TABLE IF NOT EXISTS dataset_versions (
      id TEXT PRIMARY KEY, version TEXT NOT NULL UNIQUE, grain TEXT NOT NULL, source_scope TEXT NOT NULL,
      as_of_policy TEXT NOT NULL, label_definition TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
      example_count INTEGER NOT NULL DEFAULT 0, observed_label_count INTEGER NOT NULL DEFAULT 0,
      censored_count INTEGER NOT NULL DEFAULT 0, leakage_violations INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, created_by TEXT, metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_dataset_versions_created ON dataset_versions(created_at);
    CREATE TABLE IF NOT EXISTS temporal_examples (
      id TEXT PRIMARY KEY, dataset_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, as_of TEXT NOT NULL,
      feature_json TEXT NOT NULL, context_json TEXT NOT NULL DEFAULT '{}', label_observed INTEGER NOT NULL DEFAULT 0,
      delay_label INTEGER, observed_delay_days REAL, observed_duration_days REAL, censored INTEGER NOT NULL DEFAULT 0,
      censor_reason TEXT, outcome_at TEXT, source_event_count INTEGER NOT NULL DEFAULT 0,
      feature_policy TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_temporal_examples_dataset_project ON temporal_examples(dataset_version_id, project_id, as_of);
    CREATE TABLE IF NOT EXISTS temporal_split_assignments (
      id TEXT PRIMARY KEY, dataset_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
      example_id TEXT NOT NULL REFERENCES temporal_examples(id) ON DELETE CASCADE,
      split TEXT NOT NULL CHECK(split IN ('train','validation','test','holdout','unassigned')),
      cohort_time TEXT, created_at TEXT NOT NULL, UNIQUE(dataset_version_id, example_id)
    );
    CREATE INDEX IF NOT EXISTS idx_temporal_split_dataset_split ON temporal_split_assignments(dataset_version_id, split);
    CREATE TABLE IF NOT EXISTS leakage_audits (
      id TEXT PRIMARY KEY, dataset_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
      example_id TEXT, feature_key TEXT, severity TEXT NOT NULL CHECK(severity IN ('info','warning','error')),
      rule_code TEXT NOT NULL, as_of TEXT, source_time TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_leakage_audit_dataset ON leakage_audits(dataset_version_id, severity);
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_5, t);
}

const MIGRATION_6 = 6;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_6)) {
  const t = now();
  db.exec(`
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
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_6, t);
}

const MIGRATION_7 = 7;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_7)) {
  const t = now();
  db.exec(`
    CREATE TABLE IF NOT EXISTS canonical_project_records (
      id TEXT PRIMARY KEY, intake_id TEXT NOT NULL REFERENCES project_intakes(id) ON DELETE CASCADE, project_id TEXT,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('REVIEW_REQUIRED','READY_FOR_REVIEW','ATTACHED')),
      readiness_pct REAL NOT NULL DEFAULT 0, conflict_count INTEGER NOT NULL DEFAULT 0, quality_json TEXT NOT NULL, canonical_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_canonical_project_intake ON canonical_project_records(intake_id);
    CREATE INDEX IF NOT EXISTS idx_canonical_project_project ON canonical_project_records(project_id);
    CREATE TABLE IF NOT EXISTS canonical_project_entities (
      id TEXT PRIMARY KEY, canonical_id TEXT NOT NULL REFERENCES canonical_project_records(id) ON DELETE CASCADE, entity_key TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_value TEXT NOT NULL, normalized_value TEXT NOT NULL, confidence_pct REAL NOT NULL, review_required INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_canonical_entities_canonical ON canonical_project_entities(canonical_id);
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_7,t);
}

const MIGRATION_8 = 8;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_8)) {
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '008_temporal_evidence.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_8, now());
}
const MIGRATION_9 = 9;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_9)) {
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '009_source_connector_snapshots.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_9, now());
}
const MIGRATION_10 = 10;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_10)) {
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '010_data_ingestion_runs.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_10, now());
}

const MIGRATION_11 = 11;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_11)) {
  const t = now();
  db.exec(`
    CREATE TABLE IF NOT EXISTS officer_feedback (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      category TEXT NOT NULL,
      observation TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'unreviewed',
      learning_eligible INTEGER NOT NULL DEFAULT 0,
      linked_prediction_id TEXT,
      reviewer_id TEXT,
      reviewed_at TEXT,
      review_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_project_time ON officer_feedback(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_feedback_learning ON officer_feedback(learning_eligible, verification_status);

    CREATE TABLE IF NOT EXISTS intervention_actions (
      id TEXT PRIMARY KEY,
      intervention_id TEXT NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      recommendation_id TEXT,
      action_text TEXT NOT NULL,
      owner_role TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      due_at TEXT,
      actor_id TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      outcome_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_intervention_actions_project ON intervention_actions(project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS prediction_diffs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      current_prediction_id TEXT NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
      previous_prediction_id TEXT REFERENCES predictions(id) ON DELETE SET NULL,
      diff_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prediction_diffs_project_time ON prediction_diffs(project_id, created_at DESC);
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_11, t);
}

const MIGRATION_12 = 12;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_12)) {
  const t = now();
  db.exec(`
    ALTER TABLE intervention_actions ADD COLUMN outcome_verification_status TEXT NOT NULL DEFAULT 'unreviewed';
    ALTER TABLE intervention_actions ADD COLUMN learning_eligible INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE intervention_actions ADD COLUMN outcome_reviewer_id TEXT;
    ALTER TABLE intervention_actions ADD COLUMN outcome_reviewed_at TEXT;
    ALTER TABLE intervention_actions ADD COLUMN outcome_review_note TEXT;
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_12, t);
}

const MIGRATION_13 = 13;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_13)) {
  const t = now();
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '013_operational_intelligence.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_13, t);
}


const MIGRATION_14 = 14;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_14)) {
  const t = now();
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '014_unified_data_backbone.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_14, t);
}

const MIGRATION_15 = 15;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_15)) {
  const t = now();
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '015_precise_mapping.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_15, t);
}


const MIGRATION_16 = 16;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_16)) {
  const t = now();
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '016_location_integrity.sql'), 'utf8'));
  db.exec(`UPDATE projects SET location_authority=CASE
      WHEN location_source='DEMO_DISTRICT_CENTROID' THEN 'DEMO_APPROXIMATE'
      WHEN location_source='NOMINATIM_OSM' THEN 'OPEN_MAP_GEOCODE'
      WHEN location_precision='PARCEL_GEOMETRY' THEN 'SOURCE_GEOMETRY'
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'PROJECT_RECORD_POINT'
      ELSE NULL END,
      location_confidence=CASE
      WHEN location_source='DEMO_DISTRICT_CENTROID' THEN 0.25
      WHEN location_source='NOMINATIM_OSM' THEN 0.75
      WHEN location_precision='PARCEL_GEOMETRY' THEN 1
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 0.6
      ELSE NULL END
    WHERE location_authority IS NULL`);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_16, t);
}


const MIGRATION_17 = 17;
// U56.2 repair: some older shared stores contain a table named
// project_feature_states with a pre-registry schema. CREATE TABLE IF NOT EXISTS
// cannot repair that case because SQLite keeps the old columns. Detect that exact
// condition, preserve the legacy table under a timestamped name, and recreate the
// canonical registry table. This is intentionally data-preserving: the old table
// is never dropped.
function ensureBulkFeatureRegistrySchema() {
  const migration17Sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '017_bulk_feature_registry.sql'), 'utf8');
  const requiredProjectFeatureColumns = ['id','project_id','feature_key','feature_version','status','readiness','provenance_status','source_type','evidence_count','blocked_reason','metadata_json','initialized_at','updated_at'];
  const requiredRunColumns = ['id','registry_version','project_count','initialized_count','skipped_count','failed_count','started_at','completed_at','metadata_json'];
  const columns = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(r => String(r.name)));
  const hasTable = (table) => Boolean(db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(table));

  db.exec('BEGIN IMMEDIATE');
  try {
    if (hasTable('project_feature_states')) {
      const cols = columns('project_feature_states');
      const missing = requiredProjectFeatureColumns.filter(c => !cols.has(c));
      if (missing.length) {
        const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0,14);
        const legacy = `project_feature_states_legacy_${stamp}`;
        const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='project_feature_states' AND name NOT LIKE 'sqlite_%'`).all();
        for (const row of indexes) db.exec(`DROP INDEX IF EXISTS "${String(row.name).replaceAll('\"','\"\"')}"`);
        db.exec(`ALTER TABLE project_feature_states RENAME TO "${legacy}"`);
        console.log(`Preserved incompatible project_feature_states as ${legacy}; rebuilding canonical schema (missing: ${missing.join(', ')})`);
      }
    }
    if (hasTable('bulk_feature_runs')) {
      const cols = columns('bulk_feature_runs');
      const missing = requiredRunColumns.filter(c => !cols.has(c));
      if (missing.length) {
        const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0,14);
        const legacy = `bulk_feature_runs_legacy_${stamp}`;
        const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='bulk_feature_runs' AND name NOT LIKE 'sqlite_%'`).all();
        for (const row of indexes) db.exec(`DROP INDEX IF EXISTS "${String(row.name).replaceAll('\"','\"\"')}"`);
        db.exec(`ALTER TABLE bulk_feature_runs RENAME TO "${legacy}"`);
        console.log(`Preserved incompatible bulk_feature_runs as ${legacy}; rebuilding canonical schema (missing: ${missing.join(', ')})`);
      }
    }
    db.exec(migration17Sql);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw error;
  }
}
ensureBulkFeatureRegistrySchema();
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_17)) {
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_17, now());
}

const MIGRATION_18 = 18;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_18)) {
  const t = now();
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '018_project_portfolio_archive.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_18, t);
}

const MIGRATION_19 = 19;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_19)) {
  const t = now();
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '019_authority_scoped_portfolio_governance.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_19, t);
}


const MIGRATION_20 = 20;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_20)) {
  const t = now();
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '020_bulk_evidence_promotion.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_20, t);
}

const MIGRATION_21 = 21;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(MIGRATION_21)) {
  const t = now();
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '021_public_demo_feedback.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?,?)').run(MIGRATION_21, t);
}

// U72.4.1 runtime schema self-heal. Some shared stores can already have
// migration versions 18/19 recorded while one or more ALTER TABLE operations
// were not present in the physical schema (for example after an older release
// partially applied a migration). Never reset or recreate the shared DB.
// Reconcile only the additive columns/tables required by portfolio governance.
function ensurePortfolioGovernanceRuntimeSchema() {
  const hasTable = (table) => Boolean(db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(table));
  const columns = (table) => new Set(db.prepare(`PRAGMA table_info(\"${String(table).replaceAll('\"','\"\"')}\")`).all().map(r => String(r.name)));
  if (!hasTable('projects')) throw new Error('Persistent schema is missing the projects table; refusing destructive recovery.');
  const projectColumns = columns('projects');
  const additions = [
    ['portfolio_status', "TEXT NOT NULL DEFAULT 'active'"],
    ['archived_at', 'TEXT'],
    ['archived_by', 'TEXT'],
    ['archive_reason', 'TEXT'],
    ['responsible_department', 'TEXT'],
  ];
  const missing = additions.filter(([name]) => !projectColumns.has(name));
  if (missing.length) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [name, definition] of missing) {
        db.exec(`ALTER TABLE projects ADD COLUMN \"${name.replaceAll('\"','\"\"')}\" ${definition}`);
      }
      db.exec('CREATE INDEX IF NOT EXISTS idx_projects_portfolio_status ON projects(portfolio_status)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_projects_archived_at ON projects(archived_at)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_projects_responsible_department ON projects(responsible_department)');
      db.exec('COMMIT');
      console.log(`U72.4.1 schema self-heal: added ${missing.map(([name]) => name).join(', ')}`);
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw error;
    }
  } else {
    db.exec('CREATE INDEX IF NOT EXISTS idx_projects_portfolio_status ON projects(portfolio_status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_projects_archived_at ON projects(archived_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_projects_responsible_department ON projects(responsible_department)');
  }

  if (!hasTable('intake_field_reviews')) {
    db.exec(`CREATE TABLE IF NOT EXISTS intake_field_reviews (
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
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_intake_field_reviews_intake ON intake_field_reviews(intake_id,status)');
  }
}
ensurePortfolioGovernanceRuntimeSchema();

function normaliseFactValue(value) {
  if (value === undefined || value === null) return { valueText: null, valueNumeric: null };
  const valueText = String(value);
  const n = Number(value);
  return { valueText, valueNumeric: Number.isFinite(n) && valueText.trim() !== '' ? n : null };
}

export function syncProjectDataFacts(project, actor = 'system') {
  if (!project?.id) throw new Error('Project is required to sync unified data facts.');
  const t = now();
  const sourceLabel = project?.source?.label || project?.sourceLabel || project?.source_label || 'UNVERIFIED';
  const provenanceStatus = classifySourceLabel(sourceLabel);
  const verificationStatus = provenanceStatus === 'OFFICIAL' ? 'SOURCE_DECLARED' : 'UNVERIFIED';
  const facts = [
    ['name', project.name, null], ['code', project.code, null], ['type', project.type, null],
    ['state', project.state, null], ['district', project.district, null], ['responsible_department', project.responsibleDepartment, null], ['status', project.status, null],
    ['total_parcels', project.totalParcels, 'parcels'], ['parcels_acquired', project.parcelsAcquired, 'parcels'],
    ['families_affected', project.familiesAffected, 'families'], ['families_pending', project.familiesPending, 'families'],
    ['avg_delay_days', project.avgDelayDays, 'days'], ['disputes', project.disputes, 'cases'],
    ['court_cases', project.courtCases, 'cases'], ['approval_pct', project.approvalPct, 'percent'],
    ['docs_missing', project.docsMissing, 'documents'], ['resettlement_pct', project.resettlementPct, 'percent'],
    ['rehab_pct', project.rehabPct, 'percent'], ['departments_involved', project.depts, 'departments'],
    ['prior_delays', project.prevDelays, 'events'], ['stage_index', project.stageIndex, 'stage'],
  ];
  const stmt = db.prepare(`INSERT INTO project_data_facts(
      id,project_id,fact_key,value_text,value_numeric,value_json,unit,source_label,provenance_status,verification_status,
      source_id,source_checksum,observed_at,effective_at,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(project_id,fact_key) DO UPDATE SET
      value_text=excluded.value_text,value_numeric=excluded.value_numeric,value_json=excluded.value_json,unit=excluded.unit,
      source_label=excluded.source_label,provenance_status=excluded.provenance_status,verification_status=excluded.verification_status,
      source_id=excluded.source_id,source_checksum=excluded.source_checksum,observed_at=excluded.observed_at,
      effective_at=excluded.effective_at,updated_at=excluded.updated_at`);
  for (const [factKey, value, unit] of facts) {
    const {valueText, valueNumeric} = normaliseFactValue(value);
    stmt.run(
      `FACT-${crypto.randomUUID()}`, String(project.id), factKey, valueText, valueNumeric, JSON.stringify(value ?? null), unit || null,
      sourceLabel, provenanceStatus, verificationStatus,
      project?.source?.id || project?.sourceId || null, project?.source?.checksum || project?.sourceChecksum || null,
      project?.source?.retrievedAt || project?.sourceRetrievedAt || t,
      project?.source?.effectiveAt || project?.sourceEffectiveAt || null, t, t
    );
  }
  audit({actor, action:'project.data_facts.synced', resourceType:'project', resourceId:String(project.id), outcome:'success', metadata:{factCount:facts.length,provenanceStatus}});
  return getProjectDataFacts(project.id);
}

export function getProjectDataFacts(projectId) {
  return db.prepare(`SELECT id,project_id AS projectId,fact_key AS factKey,value_text AS valueText,value_numeric AS valueNumeric,
    value_json AS valueJson,unit,source_label AS sourceLabel,provenance_status AS provenanceStatus,
    verification_status AS verificationStatus,source_id AS sourceId,source_checksum AS sourceChecksum,
    observed_at AS observedAt,effective_at AS effectiveAt,created_at AS createdAt,updated_at AS updatedAt
    FROM project_data_facts WHERE project_id=? ORDER BY fact_key`).all(String(projectId))
    .map(row=>({...row,value:parseJson(row.valueJson,row.valueText)}));
}

export function upsertProjectIntelligenceSnapshot({projectId, snapshotKey='current', asOf, projectUpdatedAt, payload, factsSha256, dataSha256, generatedBy='system'}={}) {
  const id=`PIS-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const t=now();
  const current=db.prepare('SELECT snapshot_version AS snapshotVersion FROM project_intelligence_snapshots WHERE project_id=? AND snapshot_key=?').get(String(projectId),String(snapshotKey));
  const version=Number(current?.snapshotVersion||0)+1;
  db.prepare(`INSERT INTO project_intelligence_snapshots(
    id,project_id,snapshot_key,snapshot_version,as_of,project_updated_at,facts_sha256,data_sha256,payload_json,generated_by,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(project_id,snapshot_key) DO UPDATE SET
    snapshot_version=excluded.snapshot_version,as_of=excluded.as_of,project_updated_at=excluded.project_updated_at,
    facts_sha256=excluded.facts_sha256,data_sha256=excluded.data_sha256,payload_json=excluded.payload_json,
    generated_by=excluded.generated_by,updated_at=excluded.updated_at`).run(
      id,String(projectId),String(snapshotKey),version,String(asOf||t),String(projectUpdatedAt||t),
      String(factsSha256||''),String(dataSha256||''),JSON.stringify(payload||{}),String(generatedBy||'system'),t,t
    );
  return getLatestProjectIntelligenceSnapshot(projectId,snapshotKey);
}

export function getLatestProjectIntelligenceSnapshot(projectId, snapshotKey='current') {
  const row=db.prepare(`SELECT id,project_id AS projectId,snapshot_key AS snapshotKey,snapshot_version AS snapshotVersion,as_of AS asOf,
    project_updated_at AS projectUpdatedAt,facts_sha256 AS factsSha256,data_sha256 AS dataSha256,payload_json AS payloadJson,
    generated_by AS generatedBy,created_at AS createdAt,updated_at AS updatedAt
    FROM project_intelligence_snapshots WHERE project_id=? AND snapshot_key=? LIMIT 1`).get(String(projectId),String(snapshotKey));
  return row ? {...row,payload:parseJson(row.payloadJson,{})} : null;
}

export function listProjectIntelligenceSnapshots(projectId, limit=20) {
  return db.prepare(`SELECT id,project_id AS projectId,snapshot_key AS snapshotKey,snapshot_version AS snapshotVersion,as_of AS asOf,
    project_updated_at AS projectUpdatedAt,facts_sha256 AS factsSha256,data_sha256 AS dataSha256,generated_by AS generatedBy,
    created_at AS createdAt,updated_at AS updatedAt FROM project_intelligence_snapshots WHERE project_id=? ORDER BY updated_at DESC LIMIT ?`)
    .all(String(projectId), Math.min(Math.max(Number(limit)||20,1),100));
}

export function getProjectDataHub(projectId) {
  const id=String(projectId);
  return {
    version:'unified-data-backbone-v1',
    project:getProject(id),
    facts:getProjectDataFacts(id),
    evidence:listProjectEvidence(id),
    events:listProjectEvents(id),
    predictions:listPredictions(id,20),
    recommendations:listRecommendations(id),
    alerts:listOperationalAlerts({projectIds:[id],status:'all',limit:200}),
    interventions:listInterventionActions(id),
    feedback:listOfficerFeedback(id),
    predictionDiff:getLatestPredictionDiff(id),
    replay:latestReplayRun(id),
    snapshot:getLatestProjectIntelligenceSnapshot(id),
  };
}

export function createCanonicalProject({intakeId, canonical, createdBy, projectId=null}) {
  const id=`CANP-${crypto.randomUUID().slice(0,8).toUpperCase()}`; const t=now();
  db.prepare(`INSERT INTO canonical_project_records(id,intake_id,project_id,created_by,created_at,status,readiness_pct,conflict_count,quality_json,canonical_json) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,intakeId,projectId,createdBy,t,projectId?'ATTACHED':canonical.status,Number(canonical.quality?.readinessPct||0),Number(canonical.quality?.conflictCount||0),JSON.stringify(canonical.quality||{}),JSON.stringify(canonical));
  const ins=db.prepare('INSERT INTO canonical_project_entities(id,canonical_id,entity_key,entity_type,entity_value,normalized_value,confidence_pct,review_required) VALUES(?,?,?,?,?,?,?,?)');
  for(const e of (canonical.entities||[])) ins.run(`CANE-${crypto.randomUUID()}`,id,String(e.canonicalKey||e.key||e.id),String(e.type||'unknown'),String(e.value||''),String(e.normalizedValue||''),Number((e.confidence||0)*100),e.reviewRequired?1:0);
  audit({actor:createdBy,action:'canonical_project.created',resourceType:'canonical_project',resourceId:id,outcome:'success',metadata:{intakeId,readinessPct:canonical.quality?.readinessPct||0,conflictCount:canonical.quality?.conflictCount||0}});
  return getCanonicalProject(id);
}
export function getCanonicalProject(id){
  const row=db.prepare('SELECT id,intake_id AS intakeId,project_id AS projectId,created_by AS createdBy,created_at AS createdAt,status,readiness_pct AS readinessPct,conflict_count AS conflictCount,quality_json AS qualityJson,canonical_json AS canonicalJson FROM canonical_project_records WHERE id=?').get(String(id));
  if(!row)return null; return {...row,quality:parseJson(row.qualityJson,{}),canonical:parseJson(row.canonicalJson,{}),entities:db.prepare('SELECT id,entity_key AS entityKey,entity_type AS entityType,entity_value AS entityValue,normalized_value AS normalizedValue,confidence_pct AS confidencePct,review_required AS reviewRequired FROM canonical_project_entities WHERE canonical_id=? ORDER BY rowid').all(String(id))};
}
export function getCanonicalProjectForIntake(intakeId){const row=db.prepare('SELECT id FROM canonical_project_records WHERE intake_id=? ORDER BY created_at DESC LIMIT 1').get(String(intakeId));return row?getCanonicalProject(row.id):null;}
export function attachCanonicalProjectToProject(id,projectId,actor){const result=db.prepare("UPDATE canonical_project_records SET project_id=?,status='ATTACHED' WHERE id=?").run(String(projectId),String(id)); if(!result.changes)return null; audit({actor:actor.email,actorRole:actor.role,action:'canonical_project.attached',resourceType:'canonical_project',resourceId:id,outcome:'success',metadata:{projectId}}); return getCanonicalProject(id);}


export function createTemporalEvidenceSnapshot({canonicalId, snapshot, createdBy}) {
  const id=`TES-${crypto.randomUUID().slice(0,8).toUpperCase()}`; const t=now();
  const status=snapshot.conflicts?.length ? 'REVIEW_REQUIRED' : 'READY';
  db.prepare(`INSERT INTO temporal_evidence_snapshots(id,canonical_id,as_of,snapshot_sha256,status,quality_json,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?)`).run(id,String(canonicalId),String(snapshot.asOf),String(snapshot.snapshotSha256),status,JSON.stringify(snapshot.quality||{}),JSON.stringify(snapshot),t);
  const ins=db.prepare('INSERT INTO temporal_evidence_events(id,snapshot_id,milestone_key,event_time,source_document,sha256,event_json) VALUES(?,?,?,?,?,?,?)');
  for(const e of (snapshot.events||[])) ins.run(crypto.randomUUID(),id,String(e.key),String(e.eventTime),String(e.sourceDocument),e.sha256||null,JSON.stringify(e));
  audit({actor:createdBy,action:'temporal_evidence.snapshot_created',resourceType:'temporal_evidence_snapshot',resourceId:id,outcome:'success',metadata:{canonicalId,asOf:snapshot.asOf,conflictCount:snapshot.quality?.conflictCount||0}});
  return getTemporalEvidenceSnapshot(id);
}
export function getTemporalEvidenceSnapshot(id){
  const row=db.prepare('SELECT id,canonical_id AS canonicalId,as_of AS asOf,snapshot_sha256 AS snapshotSha256,status,quality_json AS qualityJson,snapshot_json AS snapshotJson,created_at AS createdAt FROM temporal_evidence_snapshots WHERE id=?').get(String(id));
  if(!row)return null;
  return {...row,quality:parseJson(row.qualityJson,{}),snapshot:parseJson(row.snapshotJson,{}),events:db.prepare('SELECT id,milestone_key AS milestoneKey,event_time AS eventTime,source_document AS sourceDocument,sha256,event_json AS eventJson FROM temporal_evidence_events WHERE snapshot_id=? ORDER BY event_time').all(String(id)).map(e=>({...e,event:parseJson(e.eventJson,{})}))};
}
export function getLatestTemporalEvidenceSnapshot(canonicalId){const row=db.prepare('SELECT id FROM temporal_evidence_snapshots WHERE canonical_id=? ORDER BY created_at DESC LIMIT 1').get(String(canonicalId));return row?getTemporalEvidenceSnapshot(row.id):null;}

export function listIntakeFieldReviews(intakeId) {
  return db.prepare(`SELECT id,intake_id AS intakeId,field_key AS fieldKey,candidate_value AS candidateValue,source_document AS sourceDocument,source_excerpt AS sourceExcerpt,confidence,status,reviewed_value AS reviewedValue,reviewer,review_note AS reviewNote,created_at AS createdAt,reviewed_at AS reviewedAt FROM intake_field_reviews WHERE intake_id=? ORDER BY field_key`).all(String(intakeId));
}
export function upsertIntakeFieldReviews(intakeId, fieldEvidence=[], actor='system') {
  const t=now();
  const stmt=db.prepare(`INSERT INTO intake_field_reviews(id,intake_id,field_key,candidate_value,source_document,source_excerpt,confidence,status,created_at) VALUES(?,?,?,?,?,?,?,'pending',?) ON CONFLICT(intake_id,field_key) DO UPDATE SET candidate_value=excluded.candidate_value,source_document=excluded.source_document,source_excerpt=excluded.source_excerpt,confidence=excluded.confidence`);
  for(const e of (fieldEvidence||[])){ if(!e?.field) continue; stmt.run(crypto.randomUUID(),String(intakeId),String(e.field),e.value==null?null:String(e.value),e.document||null,e.excerpt||null,e.confidence==null?null:Number(e.confidence),t); }
  return listIntakeFieldReviews(intakeId);
}
export function reviewIntakeField(intakeId, fieldKey, {status='verified',reviewedValue=null,reviewNote='' }={}, actor='system') {
  const allowed=['verified','rejected','corrected','pending']; if(!allowed.includes(status)) throw new Error('Invalid field review status.');
  const existing=db.prepare('SELECT id FROM intake_field_reviews WHERE intake_id=? AND field_key=?').get(String(intakeId),String(fieldKey)); if(!existing) return null;
  const t=now(); db.prepare('UPDATE intake_field_reviews SET status=?,reviewed_value=?,reviewer=?,review_note=?,reviewed_at=? WHERE intake_id=? AND field_key=?').run(status,reviewedValue==null?null:String(reviewedValue),String(actor?.email||actor||'system'),String(reviewNote||''),t,String(intakeId),String(fieldKey));
  audit({actor:String(actor?.email||actor||'system'),actorRole:actor?.role||'system',action:'project_intake.field_reviewed',resourceType:'intake_field_review',resourceId:existing.id,outcome:status,metadata:{intakeId:String(intakeId),fieldKey:String(fieldKey)}});
  return listIntakeFieldReviews(intakeId).find(x=>x.fieldKey===String(fieldKey))||null;
}

export function createProjectIntake({createdBy, analysis, projectId=null}) {
  const id = `INT-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const t = now();
  db.prepare(`INSERT INTO project_intakes(id,project_id,created_by,created_at,status,analysis_version,source_classification,document_count,completeness_pct,evidence_coverage_pct,extraction_confidence_pct,combined_sha256,analysis_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, projectId, createdBy, t, projectId ? 'draft_created' : 'analysed', analysis.analysisVersion || 'intake-rules-v1',
    analysis.sourceClassification || 'USER_UPLOADED / NOT_GOVERNMENT_VERIFIED', Number(analysis.integrity?.documentCount||0),
    Number(analysis.completenessPct||0), Number(analysis.evidenceCoveragePct||0), Number(analysis.extractionConfidencePct||0),
    String(analysis.integrity?.combinedTextSha256||''), JSON.stringify(analysis)
  );
  const fileStmt=db.prepare('INSERT INTO project_intake_files(id,intake_id,file_name,mime_type,byte_size,sha256,parser,text_chars,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  for(const f of (analysis.provenance||[])) fileStmt.run(crypto.randomUUID(),id,String(f.name||'unknown'),f.type||null,Number(f.size||0),String(f.sha256||''),String(f.parser||'browser'),Number(f.textChars||0),t);
  return getProjectIntake(id);
}
export function attachProjectToIntake(id, projectId, actor) {
  const existing=db.prepare('SELECT id FROM project_intakes WHERE id=?').get(id); if(!existing) return null;
  const t=now(); db.prepare("UPDATE project_intakes SET project_id=?,status='draft_created' WHERE id=?").run(projectId,id);
  audit({actor:actor.email,actorRole:actor.role,action:'project_intake.project_created',resourceType:'project_intake',resourceId:id,outcome:'success',metadata:{projectId}});
  return getProjectIntake(id);
}
export function getProjectIntake(id) {
  const row=db.prepare('SELECT id,project_id AS projectId,created_by AS createdBy,created_at AS createdAt,status,analysis_version AS analysisVersion,source_classification AS sourceClassification,document_count AS documentCount,completeness_pct AS completenessPct,evidence_coverage_pct AS evidenceCoveragePct,extraction_confidence_pct AS extractionConfidencePct,combined_sha256 AS combinedSha256,analysis_json AS analysisJson FROM project_intakes WHERE id=?').get(id);
  if(!row) return null;
  return {...row,analysis:parseJson(row.analysisJson,{}),files:db.prepare('SELECT file_name AS name,mime_type AS type,byte_size AS size,sha256,parser,text_chars AS textChars,created_at AS createdAt FROM project_intake_files WHERE intake_id=? ORDER BY created_at').all(id)};
}
export function listProjectIntakes(limit=25) {
  return db.prepare('SELECT id,project_id AS projectId,created_by AS createdBy,created_at AS createdAt,status,analysis_version AS analysisVersion,source_classification AS sourceClassification,document_count AS documentCount,completeness_pct AS completenessPct,evidence_coverage_pct AS evidenceCoveragePct,extraction_confidence_pct AS extractionConfidencePct,combined_sha256 AS combinedSha256 FROM project_intakes ORDER BY created_at DESC LIMIT ?').all(Math.min(Math.max(Number(limit)||25,1),100));
}


seedProjects();
backfillSyntheticDemoLocations();
refreshLocationIntegrityMetadata();

function seedDataSources() {
  const rows = [
    ['public-lacrris','LACRRIS public land-acquisition reporting','government','PUBLIC','Department of Land Resources','Public reporting interface; snapshot/discovery only until authorized machine access exists.',null],
    ['public-paimana','PAIMANA public infrastructure monitoring','government','PUBLIC','MoSPI','Public dashboard; aggregate/download controls exposed by the portal.',null],
    ['seed-lacrris','LACRRIS','government','PENDING_ACCESS','Department of Land Resources','Integration requires approved access/credentials.',null],
    ['public-bhoomi-rashi-home','Bhoomi Rashi public portal','government','PUBLIC','MoRTH','Public web snapshot connector. Not an authoritative project-record feed.',null],
    ['public-dilrmp-ulpin-state','DILRMP ULPIN / map status','government','PUBLIC','Department of Land Resources','Public web status table snapshot connector. Not a legal land-record authority.',null],
    ['public-parivesh-home','PARIVESH public portal','government','PUBLIC','MoEFCC','Public web snapshot connector for contextual clearance discovery.',null],
    ['public-datagov-home','Open Government Data Platform','open_data','PUBLIC','Government of India','Public dataset discovery connector; resource-level provenance retained.',null],
    ['seed-bhoomi-rashi','Bhoomi Rashi','government','PUBLIC_SNAPSHOT','MoRTH','Use authorized/public snapshots only unless formal integration access is granted.',null],
    ['seed-dilrmp','DILRMP / Land Stack','government','PENDING_ACCESS','Department of Land Resources','Connector boundary reserved for authorized deployment.',null],
    ['seed-rccms','RCCMS','government','PENDING_ACCESS','Department of Land Resources','Case access must follow authorized institutional pathways.',null],
    ['seed-ecourts','eCourts / NJDG','government','PUBLIC','eCourts / Department of Justice','Public services may expose CAPTCHA and usage controls; do not scrape aggressively.',null],
    ['seed-parivesh','PARIVESH','government','PUBLIC','MoEFCC','Use as contextual clearance/dependency signal unless authorized integration is provided.',null],
    ['seed-pfms','PFMS','government','PENDING_ACCESS','Controller General of Accounts / Government of India','API integration requires approved system-level access.',null],
    ['seed-bhuvan','Bhuvan / ISRO','geospatial','PUBLIC','ISRO','Analytical/geospatial enrichment; do not treat non-authoritative layers as legal cadastral geometry.',null],
    ['seed-datagov','data.gov.in','open_data','PUBLIC','OGD Platform India','Public/open datasets; each resource retains its own freshness and licensing metadata.',null],
    ['seed-demo','Local seeded project records','development','LOCAL_SEED','BhoomiDrishti','Synthetic demonstration data. Not government data.',null],
  ];
  const stmt=db.prepare('INSERT OR IGNORE INTO data_sources(id,name,source_type,status,owner,access_note,last_sync_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?, ?, ?)');
  const t=now();
  for(const row of rows) stmt.run(...row,t,t);
}
seedDataSources();

export function listDataSources() {
  return db.prepare('SELECT id,name,source_type AS sourceType,status,owner,access_note AS accessNote,last_sync_at AS lastSyncAt,created_at AS createdAt,updated_at AS updatedAt FROM data_sources ORDER BY name').all();
}

export function listSourceDataSources() {
  return listDataSources();
}


export function createSourceConnectorSnapshot(snapshot, createdBy) {
  const id = `SRC-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const t = now();
  const status = snapshot.ok ? 'SUCCESS' : (snapshot.httpStatus ? 'HTTP_ERROR' : 'FETCH_ERROR');
  db.prepare(`INSERT INTO source_connector_snapshots(id,connector_id,source_url,fetched_at,duration_ms,http_status,ok,content_type,etag,last_modified,body_bytes,body_sha256,parser,extracted_json,status,error_message,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id,String(snapshot.connectorId),String(snapshot.url),String(snapshot.fetchedAt),Number(snapshot.durationMs||0),snapshot.httpStatus==null?null:Number(snapshot.httpStatus),snapshot.ok?1:0,
    snapshot.contentType||null,snapshot.etag||null,snapshot.lastModified||null,Number(snapshot.bodyBytes||0),String(snapshot.bodySha256||''),String(snapshot.parser||'unknown'),JSON.stringify(snapshot.extracted||{}),status,snapshot.errorMessage?String(snapshot.errorMessage):null,String(createdBy),t
  );
  db.prepare('UPDATE data_sources SET last_sync_at=?, updated_at=? WHERE id=?').run(t,t,String(snapshot.connectorId));
  audit({actor:createdBy,action:'source_connector.snapshot_created',resourceType:'source_connector_snapshot',resourceId:id,outcome:status.toLowerCase(),metadata:{connectorId:snapshot.connectorId,url:snapshot.url,httpStatus:snapshot.httpStatus,bodySha256:snapshot.bodySha256}});
  return getSourceConnectorSnapshot(id);
}
export function createSourceConnectorFailure({connectorId,url,parser,error,createdBy}={}) {
  return createSourceConnectorSnapshot({connectorId,url,fetchedAt:now(),durationMs:0,httpStatus:null,ok:false,contentType:null,etag:null,lastModified:null,bodyBytes:0,bodySha256:crypto.createHash('sha256').update(String(error||'')).digest('hex'),parser:parser||'unknown',extracted:{},errorMessage:String(error||'')},createdBy);
}
export function getSourceConnectorSnapshot(id){
  const row=db.prepare('SELECT id,connector_id AS connectorId,source_url AS url,fetched_at AS fetchedAt,duration_ms AS durationMs,http_status AS httpStatus,ok,content_type AS contentType,etag,last_modified AS lastModified,body_bytes AS bodyBytes,body_sha256 AS bodySha256,parser,extracted_json AS extractedJson,status,error_message AS errorMessage,created_by AS createdBy,created_at AS createdAt FROM source_connector_snapshots WHERE id=?').get(String(id));
  if(!row)return null; return {...row,ok:Boolean(row.ok),extracted:parseJson(row.extractedJson,{})};
}
export function listSourceConnectorSnapshots(connectorId=null,limit=50){
  const safe=Math.min(Math.max(Number(limit)||50,1),200);
  const rows=connectorId ? db.prepare('SELECT id,connector_id AS connectorId,source_url AS url,fetched_at AS fetchedAt,duration_ms AS durationMs,http_status AS httpStatus,ok,content_type AS contentType,etag,last_modified AS lastModified,body_bytes AS bodyBytes,body_sha256 AS bodySha256,parser,status,error_message AS errorMessage,created_by AS createdBy,created_at AS createdAt FROM source_connector_snapshots WHERE connector_id=? ORDER BY fetched_at DESC LIMIT ?').all(String(connectorId),safe) : db.prepare('SELECT id,connector_id AS connectorId,source_url AS url,fetched_at AS fetchedAt,duration_ms AS durationMs,http_status AS httpStatus,ok,content_type AS contentType,etag,last_modified AS lastModified,body_bytes AS bodyBytes,body_sha256 AS bodySha256,parser,status,error_message AS errorMessage,created_by AS createdBy,created_at AS createdAt FROM source_connector_snapshots ORDER BY fetched_at DESC LIMIT ?').all(safe);
  return rows.map(r=>({...r,ok:Boolean(r.ok)}));
}


export function createDataIngestionRun({originalFilename,storedPath,contentType,extension,bytes,sha256,sourceClassification='USER_UPLOADED / NOT_GOVERNMENT_VERIFIED',status='RECEIVED',report=null,errorMessage=null,createdBy='system'}={}) {
  const id = `ING-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const t = now();
  db.prepare(`INSERT INTO data_ingestion_runs(id,original_filename,stored_path,content_type,extension,bytes,sha256,source_classification,status,report_json,error_message,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,String(originalFilename||'upload.bin'),String(storedPath||''),contentType||null,String(extension||''),Number(bytes||0),String(sha256||''),String(sourceClassification),String(status),report?JSON.stringify(report):null,errorMessage?String(errorMessage):null,String(createdBy),t,t);
  audit({actor:createdBy,action:'data_ingestion.run_created',resourceType:'data_ingestion_run',resourceId:id,outcome:status.toLowerCase(),metadata:{originalFilename,bytes,sha256,sourceClassification}});
  return getDataIngestionRun(id);
}
export function updateDataIngestionRun(id,{status,report,errorMessage}={}) {
  const t = now();
  db.prepare('UPDATE data_ingestion_runs SET status=?, report_json=?, error_message=?, updated_at=? WHERE id=?').run(String(status),report?JSON.stringify(report):null,errorMessage?String(errorMessage):null,t,String(id));
  return getDataIngestionRun(id);
}
export function getDataIngestionRun(id) {
  const row=db.prepare('SELECT id,original_filename AS originalFilename,stored_path AS storedPath,content_type AS contentType,extension,bytes,sha256,source_classification AS sourceClassification,status,report_json AS reportJson,error_message AS errorMessage,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM data_ingestion_runs WHERE id=?').get(String(id));
  if(!row) return null;
  return {...row,report:parseJson(row.reportJson,null)};
}
export function listDataIngestionRuns(limit=50) {
  const safe=Math.min(Math.max(Number(limit)||50,1),200);
  return db.prepare('SELECT id,original_filename AS originalFilename,stored_path AS storedPath,content_type AS contentType,extension,bytes,sha256,source_classification AS sourceClassification,status,error_message AS errorMessage,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM data_ingestion_runs ORDER BY created_at DESC LIMIT ?').all(safe);
}


export function createBulkPromotionBatch(input={}, actor={}) {
  const id=`BATCH-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const t=now();
  db.prepare(`INSERT INTO bulk_promotion_batches(id,ingestion_run_id,status,summary_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`)
    .run(id,input.ingestionRunId||null,String(input.status||'PLANNED'),JSON.stringify(input.summary||{}),String(actor?.email||actor||'system'),t,t);
  return getBulkPromotionBatch(id);
}
export function updateBulkPromotionBatch(id,input={}) {
  const t=now();
  db.prepare('UPDATE bulk_promotion_batches SET status=?,summary_json=?,updated_at=? WHERE id=?')
    .run(String(input.status||'PLANNED'),JSON.stringify(input.summary||{}),t,String(id));
  return getBulkPromotionBatch(id);
}
export function getBulkPromotionBatch(id) {
  const row=db.prepare('SELECT id,ingestion_run_id AS ingestionRunId,status,summary_json AS summaryJson,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM bulk_promotion_batches WHERE id=?').get(String(id));
  return row?{...row,summary:parseJson(row.summaryJson,{})}:null;
}
export function listBulkPromotionBatches({ingestionRunId=null,limit=50}={}) {
  const safe=Math.min(Math.max(Number(limit)||50,1),200);
  const rows=ingestionRunId
    ? db.prepare('SELECT id,ingestion_run_id AS ingestionRunId,status,summary_json AS summaryJson,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM bulk_promotion_batches WHERE ingestion_run_id=? ORDER BY created_at DESC LIMIT ?').all(String(ingestionRunId),safe)
    : db.prepare('SELECT id,ingestion_run_id AS ingestionRunId,status,summary_json AS summaryJson,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM bulk_promotion_batches ORDER BY created_at DESC LIMIT ?').all(safe);
  return rows.map(r=>({...r,summary:parseJson(r.summaryJson,{})}));
}
export function recordBulkPromotionEvidence(items=[], actor={}) {
  if(!Array.isArray(items)||!items.length)return [];
  const t=now();
  const stmt=db.prepare(`INSERT INTO bulk_promotion_evidence(id,batch_id,ingestion_run_id,row_number,project_id,field_name,incoming_value,existing_value,decision,match_state,source_label,source_id,source_checksum,confidence,created_by,created_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const out=[];
  for(const item of items){
    const id=`EVID-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    stmt.run(id,item.batchId||null,item.ingestionRunId||null,Number(item.rowNumber||0),item.projectId||null,item.fieldName||null,
      item.incomingValue===undefined?null:JSON.stringify(item.incomingValue),item.existingValue===undefined?null:JSON.stringify(item.existingValue),String(item.decision||'OBSERVED'),String(item.matchState||'NO_MATCH'),String(item.sourceLabel||'USER_UPLOAD'),item.sourceId||null,item.sourceChecksum||null,Number(item.confidence||0),String(actor?.email||actor||'system'),t,JSON.stringify(item.metadata||{}));
    out.push(id);
  }
  return out;
}
export function listBulkPromotionEvidence({batchId=null,ingestionRunId=null,projectId=null,limit=1000}={}) {
  const clauses=[]; const params=[];
  if(batchId){clauses.push('batch_id=?');params.push(String(batchId));}
  if(ingestionRunId){clauses.push('ingestion_run_id=?');params.push(String(ingestionRunId));}
  if(projectId){clauses.push('project_id=?');params.push(String(projectId));}
  const safe=Math.min(Math.max(Number(limit)||1000,1),5000);
  const rows=db.prepare(`SELECT id,batch_id AS batchId,ingestion_run_id AS ingestionRunId,row_number AS rowNumber,project_id AS projectId,field_name AS fieldName,incoming_value AS incomingValue,existing_value AS existingValue,decision,match_state AS matchState,source_label AS sourceLabel,source_id AS sourceId,source_checksum AS sourceChecksum,confidence,created_by AS createdBy,created_at AS createdAt,metadata_json AS metadataJson FROM bulk_promotion_evidence ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY created_at DESC LIMIT ?`).all(...params,safe);
  return rows.map(r=>({...r,incomingValue:parseJson(r.incomingValue,r.incomingValue),existingValue:parseJson(r.existingValue,r.existingValue),metadata:parseJson(r.metadataJson,{})}));
}
export function updateLocalPassword(email, passwordHash, passwordSalt) {
  const normalized = String(email || '').trim().toLowerCase();
  const result = db.prepare("UPDATE users SET password_hash=?, password_salt=?, status='active', must_change_password=0, updated_at=? WHERE LOWER(email)=?").run(String(passwordHash), String(passwordSalt), now(), normalized);
  if (!result.changes) throw new Error(`Local account not found: ${normalized}`);
  return getUserByEmail(normalized);
}

export function ensureAdmin(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Administrator email is required.');
  const existingByEmail = db.prepare('SELECT id,role FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
  if (existingByEmail) {
    if (existingByEmail.role !== 'Administrator') throw new Error(`Configured administrator email already belongs to role ${existingByEmail.role}.`);
    return existingByEmail.id;
  }

  // Legacy releases reserved USR-ADMIN-001. Never collide with or mutate an
  // existing shared-store account. A second bootstrap admin receives a stable
  // id derived from its email, so repeated starts remain idempotent.
  const reservedId = 'USR-ADMIN-001';
  const existingReserved = db.prepare('SELECT id FROM users WHERE id = ?').get(reservedId);
  let userId = reservedId;
  if (existingReserved) userId = `USR-ADMIN-${crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0,8).toUpperCase()}`;
  if (db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) {
    userId = `USR-ADMIN-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  }

  const p = hashPassword(password);
  const t = now();
  db.prepare(`INSERT INTO users(id,email,name,role,status,organisation,state,district,jurisdiction_json,permissions_json,password_hash,password_salt,must_change_password,created_at,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(userId, normalizedEmail, 'System Administrator','Administrator','active','BhoomiDrishti Development Environment','National','National',JSON.stringify({state:'National',district:'National'}),JSON.stringify(ROLE_PERMISSIONS.Administrator),p.hash,p.salt,1,t,'bootstrap',t);
  return userId;
}


export const DEMO_ROLE_ACCOUNTS = [
  { id: 'USR-DEMO-GOV-001', email: String(process.env.BHOOMI_GOV_EMAIL || 'government.officer@example.invalid').trim().toLowerCase(), name: 'Government Officer (Demo)', role: 'Government Officer', password: String(process.env.BHOOMI_GOV_PASSWORD || '').trim(), organisation: 'BhoomiDrishti Demo — Government Oversight', state: 'National', district: 'National' },
  { id: 'USR-DEMO-DEPT-001', email: String(process.env.BHOOMI_DEPT_EMAIL || 'department.officer@example.invalid').trim().toLowerCase(), name: 'Department Officer (Demo)', role: 'Department Officer', password: String(process.env.BHOOMI_DEPT_PASSWORD || '').trim(), organisation: 'BhoomiDrishti Demo — Department Operations', state: 'National', district: 'National' },
  { id: 'USR-DEMO-LEGAL-001', email: String(process.env.BHOOMI_LEGAL_EMAIL || 'legal.officer@example.invalid').trim().toLowerCase(), name: 'Legal Officer (Demo)', role: 'Legal Officer', password: String(process.env.BHOOMI_LEGAL_PASSWORD || '').trim(), organisation: 'BhoomiDrishti Demo — Legal Review', state: 'National', district: 'National' },
  { id: 'USR-DEMO-VIEW-001', email: String(process.env.BHOOMI_VIEWER_EMAIL || 'viewer@example.invalid').trim().toLowerCase(), name: 'Viewer (Demo)', role: 'Viewer', password: String(process.env.BHOOMI_VIEWER_PASSWORD || '').trim(), organisation: 'BhoomiDrishti Demo — Monitoring Desk', state: 'National', district: 'National' },
];

export function ensureDemoRoleAccounts(enabled = true) {
  if (!enabled) return;
  const upsert = db.prepare(`UPDATE users SET name=?, role=?, status='active', organisation=?, state=?, district=?, jurisdiction_json=?, permissions_json=?, password_hash=?, password_salt=?, must_change_password=0, updated_at=? WHERE LOWER(email)=?`);
  const insert = db.prepare(`INSERT INTO users(id,email,name,role,status,organisation,state,district,jurisdiction_json,permissions_json,password_hash,password_salt,must_change_password,created_at,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const t = now();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const account of DEMO_ROLE_ACCOUNTS) {
      if (!account.email || !account.password) continue;
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(email)=?').get(account.email);
      const p = hashPassword(account.password);
      const jurisdiction = { state: account.state, district: account.district, projectIds: [] };
      if (existing) {
        upsert.run(account.name, account.role, account.organisation, account.state, account.district, JSON.stringify(jurisdiction), JSON.stringify(ROLE_PERMISSIONS[account.role]), p.hash, p.salt, t, account.email);
      } else {
        let userId = account.id;
        if (db.prepare('SELECT id FROM users WHERE id=?').get(userId)) userId = `USR-DEMO-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
        insert.run(userId, account.email, account.name, account.role, 'active', account.organisation, account.state, account.district, JSON.stringify(jurisdiction), JSON.stringify(ROLE_PERMISSIONS[account.role]), p.hash, p.salt, 0, t, 'demo-bootstrap', t);
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function getDemoRoleAccounts() {
  return DEMO_ROLE_ACCOUNTS.map(({ password, ...account }) => ({ ...account, password }));
}

export function getUserByEmail(email) { return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase()); }
export function listUsers() { return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(publicUser); }
export function updateUserAccess({id,role,organisation,state,district,projectIds=[]}) {
  if (!ROLE_DESCRIPTIONS[role] || role==='Administrator') throw new Error('Invalid operational profile.');
  const existing=db.prepare('SELECT id FROM users WHERE id=?').get(id);
  if(!existing) return null;
  const jurisdiction={state:state||'Unassigned',district:district||'Unassigned',projectIds:Array.isArray(projectIds)?projectIds.map(String):[]};
  const t=now();
  db.prepare('UPDATE users SET role=?,organisation=?,state=?,district=?,jurisdiction_json=?,permissions_json=?,updated_at=? WHERE id=?').run(role,organisation||null,state||'Unassigned',district||'Unassigned',JSON.stringify(jurisdiction),JSON.stringify(ROLE_PERMISSIONS[role]),t,id);
  return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id));
}
export function listRequests() { return db.prepare('SELECT * FROM access_requests ORDER BY CASE WHEN status=\'pending\' THEN 0 ELSE 1 END, created_at DESC').all(); }
export function createAccessRequest({ name,email,organisation,requestedRole,justification }) {
  const request = { id: `AR-${crypto.randomUUID().slice(0,8).toUpperCase()}`, name, email: email.toLowerCase(), organisation, requestedRole, justification, status:'pending', createdAt:now() };
  db.prepare('INSERT INTO access_requests(id,name,email,organisation,requested_role,justification,status,created_at) VALUES(?,?,?,?,?,?,?,?)').run(request.id,name,request.email,organisation,requestedRole,justification,'pending',request.createdAt);
  return request;
}
export function decideAccessRequest({ id, decision, assignedRole, actor }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const request = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(id);
    if (!request) { db.exec('ROLLBACK'); return { error: 'Access request not found.', code: 404 }; }
    if (request.status !== 'pending') { db.exec('ROLLBACK'); return { error: 'Access request has already been decided.', code: 409 }; }
    if (!['approve','reject'].includes(decision)) { db.exec('ROLLBACK'); return { error: 'Decision must be approve or reject.', code: 400 }; }
    const t = now();
    if (decision === 'reject') {
      db.prepare('UPDATE access_requests SET status=\'rejected\', decided_at=?, decided_by=? WHERE id=? AND status=\'pending\'').run(t,actor.email,id);
      db.exec('COMMIT');
      return { request: { ...request, status:'rejected', decidedAt:t, decidedBy:actor.email } };
    }
    if (!ROLE_DESCRIPTIONS[assignedRole] || assignedRole === 'Administrator') { db.exec('ROLLBACK'); return { error: 'Invalid assigned role.', code: 400 }; }
    const existing = getUserByEmail(request.email);
    if (existing) { db.exec('ROLLBACK'); return { error: 'An account already exists for this email.', code: 409 }; }
    const tempPassword = crypto.randomBytes(12).toString('base64url');
    const p = hashPassword(tempPassword);
    const userId = `USR-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    db.prepare(`INSERT INTO users(id,email,name,role,status,organisation,state,district,jurisdiction_json,permissions_json,password_hash,password_salt,must_change_password,created_at,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(userId,request.email,request.name,assignedRole,'active',request.organisation,'Unassigned','Unassigned',JSON.stringify({state:'Unassigned',district:'Unassigned'}),JSON.stringify(ROLE_PERMISSIONS[assignedRole]),p.hash,p.salt,1,t,actor.email,t);
    const result = db.prepare(`UPDATE access_requests SET status='approved', decided_at=?, decided_by=?, assigned_role=?, provisioned_user_id=? WHERE id=? AND status='pending'`).run(t,actor.email,assignedRole,userId,id);
    if (result.changes !== 1) { db.exec('ROLLBACK'); return { error: 'The request changed before it could be approved. Refresh and try again.', code: 409 }; }
    db.exec('COMMIT');
    return { request: { ...request, status:'approved', decidedAt:t, decidedBy:actor.email, assignedRole, provisionedUserId:userId }, provisionedAccount: { id:userId,email:request.email,name:request.name,role:assignedRole,status:'active',organisation:request.organisation,jurisdiction:{state:'Unassigned',district:'Unassigned'},permissions:ROLE_PERMISSIONS[assignedRole],roleDescription:ROLE_DESCRIPTIONS[assignedRole],mustChangePassword:true,temporaryPassword:tempPassword } };
  } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
}
export function audit({ actor, actorRole, action, resourceType=null, resourceId=null, outcome, metadata={} }) {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO audit_events(id,actor,actor_role,action,resource_type,resource_id,outcome,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,actor,actorRole || null,action,resourceType,resourceId,outcome,JSON.stringify(metadata),now());
}
export function listAudit(limit=200) { return db.prepare('SELECT id,actor,actor_role AS actorRole,action,resource_type AS resourceType,resource_id AS resourceId,outcome,metadata_json AS metadataJson,created_at AS createdAt FROM audit_events ORDER BY created_at DESC LIMIT ?').all(limit).map((e)=>({...e,metadata:parseJson(e.metadataJson,{})})); }

export function listProjects(filters={}) {
  const clauses=[]; const params=[];
  if (!filters.includeArchived) clauses.push("COALESCE(portfolio_status,'active')='active'");
  if (filters.state) { clauses.push('state = ?'); params.push(filters.state); }
  if (filters.district) { clauses.push('district = ?'); params.push(filters.district); }
  if (filters.status) { clauses.push('status = ?'); params.push(filters.status); }
  if (filters.type) { clauses.push('type = ?'); params.push(filters.type); }
  if (filters.q) { clauses.push('(LOWER(name) LIKE ? OR LOWER(code) LIKE ? OR LOWER(district) LIKE ?)'); const q=`%${String(filters.q).toLowerCase()}%`; params.push(q,q,q); }
  const sql = `SELECT * FROM projects ${clauses.length ? 'WHERE '+clauses.join(' AND ') : ''} ORDER BY updated_at DESC`;
  return db.prepare(sql).all(...params).map(mapProject);
}
export function getProject(id) { const row = db.prepare("SELECT * FROM projects WHERE id = ? AND COALESCE(portfolio_status,'active')='active'").get(id); return row ? mapProject(row) : null; }
export function getProjectAnyStatus(id) { const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(String(id)); return row ? mapProject(row) : null; }
export function archiveProject(id, actor, reason='Removed from operational portfolio by authorised administrator') {
  const existing = db.prepare("SELECT id, portfolio_status FROM projects WHERE id=?").get(String(id));
  if (!existing) return null;
  const t = now();
  db.prepare(`UPDATE projects SET portfolio_status='archived', archived_at=?, archived_by=?, archive_reason=?, updated_at=? WHERE id=?`).run(t, String(actor?.email||actor||'system'), String(reason||'Removed from operational portfolio'), t, String(id));
  audit({actor:String(actor?.email||actor||'system'),actorRole:actor?.role||'system',action:'project.archived',resourceType:'project',resourceId:String(id),outcome:'success',metadata:{reason:String(reason||'Removed from operational portfolio'),previousStatus:existing.portfolio_status||'active'}});
  return db.prepare('SELECT * FROM projects WHERE id=?').get(String(id)) ? mapProject(db.prepare('SELECT * FROM projects WHERE id=?').get(String(id))) : null;
}
export function restoreProject(id, actor) {
  const existing = db.prepare("SELECT id FROM projects WHERE id=? AND portfolio_status='archived'").get(String(id));
  if (!existing) return null;
  const t=now();
  db.prepare("UPDATE projects SET portfolio_status='active', archived_at=NULL, archived_by=NULL, archive_reason=NULL, updated_at=? WHERE id=?").run(t,String(id));
  audit({actor:String(actor?.email||actor||'system'),actorRole:actor?.role||'system',action:'project.restored',resourceType:'project',resourceId:String(id),outcome:'success'});
  return getProject(id);
}
export function listArchivedProjects() {
  return db.prepare("SELECT * FROM projects WHERE COALESCE(portfolio_status,'active')='archived' ORDER BY archived_at DESC, updated_at DESC").all().map(mapProject);
}
export function upsertProject(input, actor) {
  const id = String(input.id || `P-${crypto.randomUUID().slice(0,8).toUpperCase()}`);
  const code = String(input.code || `IMP-${crypto.randomUUID().slice(0,6).toUpperCase()}`);
  const t=now();
  const state=String(input.state||'Unassigned').trim() || 'Unassigned';
  const district=String(input.district||'Unassigned').trim() || 'Unassigned';
  const responsibleDepartment = String(input.responsibleDepartment || input.responsible_department || '').trim() || null;
  const rawLatitude=String(input.latitude??'').trim();
  const rawLongitude=String(input.longitude??'').trim();
  const hasLatitude=rawLatitude!=='';
  const hasLongitude=rawLongitude!=='';
  if(hasLatitude!==hasLongitude) throw new Error('Latitude and longitude must be supplied together.');
  if(hasLatitude && !coordinatePairValid(rawLatitude,rawLongitude)) throw new Error('Latitude and longitude must be valid numeric coordinates.');
  let locationHasPoint=hasLatitude && hasLongitude;
  let latitude=locationHasPoint ? Number(input.latitude) : null;
  let longitude=locationHasPoint ? Number(input.longitude) : null;
  let locationPrecision=String(input.locationPrecision||'').trim();
  let locationSource=input.locationSource||null;
  let locationLabel=input.locationLabel||null;
  let locationAuthority=input.locationAuthority||null;
  let locationConfidence=input.locationConfidence==null ? null : Number(input.locationConfidence);
  if(!locationHasPoint){
    const fallback=demoPointForDistrict(district) || demoPointForState(state);
    if(fallback){
      locationHasPoint=true; latitude=fallback.latitude; longitude=fallback.longitude;
      locationPrecision=fallback.precision; locationSource=fallback.source; locationLabel=fallback.label;
      locationAuthority='DEMO_APPROXIMATE'; locationConfidence=0.2;
    } else {
      locationPrecision=locationPrecision || 'UNRESOLVED';
    }
  }
  if (locationHasPoint && !indiaCoordinateValid(latitude,longitude)) throw new Error('Project coordinates must fall within the India GIS integrity boundary.');
  const params = [id, String(input.name||'').trim(), code, String(input.type||'Highway'), state, district, responsibleDepartment, Number(input.totalParcels||0), Number(input.parcelsAcquired||0), Number(input.familiesAffected||0), Number(input.familiesPending||0), Number(input.avgDelayDays||0), Number(input.disputes||0), Number(input.courtCases||0), Number(input.approvalPct||0), Number(input.docsMissing||0), Number(input.resettlementPct||0), Number(input.rehabPct||0), Number(input.depts||0), Number(input.prevDelays||0), Number(input.stageIndex||0), input.status === 'completed' ? 'completed' : 'ongoing', input.plannedDays ?? null, input.actualDays ?? null, input.x ?? null, input.y ?? null, locationHasPoint ? latitude : null, locationHasPoint ? longitude : null, input.geometryGeoJSON ? JSON.stringify(input.geometryGeoJSON) : null, input.acquisitionProfile || null, locationPrecision || (locationHasPoint ? 'PROJECT_POINT' : 'UNRESOLVED'), locationSource, locationLabel, input.locationOsmType || null, input.locationOsmId==null?null:String(input.locationOsmId), input.locationBBox ? JSON.stringify(input.locationBBox) : null, input.locationResolvedAt || (locationHasPoint ? t : null), input.sourceLabel || 'user_uploaded', input.sourceId || null, input.sourceRetrievedAt || t, input.sourceEffectiveAt || null, input.sourceVersion || null, input.sourceChecksum || null, t, t];
  if (!params[1]) throw new Error('Project name is required.');
  if (!params[5] || params[5] === '—') throw new Error('District is required.');
  db.prepare(`INSERT INTO projects(id,name,code,type,state,district,responsible_department,total_parcels,parcels_acquired,families_affected,families_pending,avg_delay_days,disputes,court_cases,approval_pct,docs_missing,resettlement_pct,rehab_pct,depts,prev_delays,stage_index,status,planned_days,actual_days,map_x,map_y,latitude,longitude,geometry_geojson,acquisition_profile,location_precision,location_source,location_label,location_osm_type,location_osm_id,location_bbox_json,location_resolved_at,source_label,source_id,source_retrieved_at,source_effective_at,source_version,source_checksum,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,code=excluded.code,type=excluded.type,state=excluded.state,district=excluded.district,responsible_department=excluded.responsible_department,total_parcels=excluded.total_parcels,parcels_acquired=excluded.parcels_acquired,families_affected=excluded.families_affected,families_pending=excluded.families_pending,avg_delay_days=excluded.avg_delay_days,disputes=excluded.disputes,court_cases=excluded.court_cases,approval_pct=excluded.approval_pct,docs_missing=excluded.docs_missing,resettlement_pct=excluded.resettlement_pct,rehab_pct=excluded.rehab_pct,depts=excluded.depts,prev_delays=excluded.prev_delays,stage_index=excluded.stage_index,status=excluded.status,planned_days=excluded.planned_days,actual_days=excluded.actual_days,map_x=excluded.map_x,map_y=excluded.map_y,latitude=excluded.latitude,longitude=excluded.longitude,geometry_geojson=excluded.geometry_geojson,acquisition_profile=excluded.acquisition_profile,location_precision=excluded.location_precision,location_source=excluded.location_source,location_label=excluded.location_label,location_osm_type=excluded.location_osm_type,location_osm_id=excluded.location_osm_id,location_bbox_json=excluded.location_bbox_json,location_resolved_at=excluded.location_resolved_at,source_label=excluded.source_label,source_id=excluded.source_id,source_retrieved_at=excluded.source_retrieved_at,source_effective_at=excluded.source_effective_at,source_version=excluded.source_version,source_checksum=excluded.source_checksum,updated_at=excluded.updated_at`).run(...params);
  const locAuthority=locationAuthority || (locationPrecision==='PARCEL_GEOMETRY' ? 'SOURCE_GEOMETRY' : locationSource==='NOMINATIM_OSM' ? 'OPEN_MAP_GEOCODE' : locationPrecision==='DISTRICT_CENTROID'||locationPrecision==='STATE_CENTROID' ? 'DEMO_APPROXIMATE' : locationHasPoint ? 'PROJECT_RECORD_POINT' : null);
  const locConfidence=locationConfidence ?? (locationPrecision==='PARCEL_GEOMETRY' ? 1 : locationSource==='NOMINATIM_OSM' ? 0.75 : locationPrecision==='DISTRICT_CENTROID'||locationPrecision==='STATE_CENTROID' ? 0.2 : locationHasPoint ? 0.6 : null);
  db.prepare(`UPDATE projects SET location_authority=?,location_confidence=? WHERE id=?`).run(locAuthority,locConfidence,id);
  const stageName=STAGES[Math.max(0,Math.min(STAGES.length-1,Number(input.stageIndex)||0))];
  db.prepare(`INSERT INTO project_stages(id,project_id,stage_index,stage_name,state) VALUES(?,?,?,?,?) ON CONFLICT(project_id,stage_index) DO UPDATE SET stage_name=excluded.stage_name,state=excluded.state`).run(crypto.randomUUID(),id,Number(input.stageIndex)||0,stageName,'current');
  audit({actor:actor.email,actorRole:actor.role,action:'project.upsert',resourceType:'project',resourceId:id,outcome:'success',metadata:{sourceLabel:input.sourceLabel||'user_uploaded'}});
  return getProject(id);
}
export function dashboardSummary() {
  const projects=listProjects(); const ongoing=projects.filter(p=>p.status==='ongoing'); const completed=projects.filter(p=>p.status==='completed');
  const high=projects.filter(p=>p.risk.band==='high').length; const med=projects.filter(p=>p.risk.band==='medium').length; const low=projects.filter(p=>p.risk.band==='low').length;
  const riskByState={}; for(const p of ongoing){ const x=riskByState[p.state]||{state:p.state,total:0,sum:0}; x.total++; x.sum+=p.risk.overall; riskByState[p.state]=x; }
  const stateRisk=Object.values(riskByState).map(x=>({...x,risk:Math.round(x.sum/x.total)})).sort((a,b)=>b.risk-a.risk);
  return { projects:projects.length, ongoing:ongoing.length, completed:completed.length, high, medium:med, low, parcelsAcquired:ongoing.reduce((s,p)=>s+p.parcelsAcquired,0), familiesAffected:ongoing.reduce((s,p)=>s+p.familiesAffected,0), familiesPending:ongoing.reduce((s,p)=>s+p.familiesPending,0), averageDelayDays:ongoing.length?Math.round(ongoing.reduce((s,p)=>s+p.avgDelayDays,0)/ongoing.length):0, disputes:ongoing.reduce((s,p)=>s+p.disputes,0), courtCases:ongoing.reduce((s,p)=>s+p.courtCases,0), docsMissing:ongoing.reduce((s,p)=>s+p.docsMissing,0), stateRisk };
}


export function listProjectStages(projectId) {
  return db.prepare(`SELECT id,project_id AS projectId,stage_index AS stageIndex,stage_name AS stageName,state,entered_at AS enteredAt,completed_at AS completedAt,statutory_clock_source AS statutoryClockSource,target_days AS targetDays FROM project_stages WHERE project_id=? ORDER BY stage_index ASC`).all(String(projectId));
}
export function listInterventions(projectId,limit=50) {
  const rows=db.prepare(`SELECT id,project_id AS projectId,recommendation_id AS recommendationId,scenario_json AS scenarioJson,estimated_effect_json AS estimatedEffectJson,is_hypothetical AS isHypothetical,actual_outcome_json AS actualOutcomeJson,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM interventions WHERE project_id=? ORDER BY created_at DESC LIMIT ?`).all(String(projectId),Math.min(Math.max(Number(limit)||50,1),200));
  return rows.map(x=>({...x,scenario:parseJson(x.scenarioJson,{}),estimatedEffect:parseJson(x.estimatedEffectJson,{}),actualOutcome:x.actualOutcomeJson?parseJson(x.actualOutcomeJson,null):null,isHypothetical:Boolean(x.isHypothetical)}));
}
export function listProjectEvents(projectId) {
  return db.prepare('SELECT id,event_type AS eventType,event_code AS eventCode,occurred_at AS occurredAt,recorded_at AS recordedAt,source_label AS sourceLabel,source_id AS sourceId,effective_at AS effectiveAt,payload_json AS payloadJson FROM project_events WHERE project_id=? ORDER BY occurred_at ASC').all(projectId).map(e=>({...e,payload:parseJson(e.payloadJson,{})}));
}
export function listProjectEvidence(projectId) {
  const docs=db.prepare('SELECT id,document_type AS documentType,status,source_label AS sourceLabel,checksum,page_count AS pageCount,ocr_status AS ocrStatus,extraction_confidence AS extractionConfidence,validation_status AS validationStatus FROM document_records WHERE project_id=? ORDER BY updated_at DESC').all(projectId);
  const cases=db.prepare('SELECT id,case_reference AS caseReference,state,stage_relevance AS stageRelevance,stay_status AS stayStatus,affected_area_hectares AS affectedAreaHectares,linkage_confidence AS linkageConfidence,source_label AS sourceLabel FROM litigation_records WHERE project_id=? ORDER BY updated_at DESC').all(projectId);
  const compensation=db.prepare('SELECT id,case_state AS caseState,amount_determined AS amountDetermined,amount_deposited AS amountDeposited,amount_tendered AS amountTendered,amount_received AS amountReceived,amount_disputed AS amountDisputed,pending_since AS pendingSince,source_label AS sourceLabel FROM compensation_records WHERE project_id=? ORDER BY updated_at DESC').all(projectId);
  return {documents:docs,litigation:cases,compensation};
}
export function listRecommendations(projectId) { return db.prepare('SELECT id,owner_role AS ownerRole,action_text AS actionText,basis_type AS basisType,priority,due_at AS dueAt,status,created_at AS createdAt,updated_at AS updatedAt FROM recommendations WHERE project_id=? ORDER BY priority ASC, created_at DESC').all(projectId); }
export function getRecommendation(id) { return db.prepare('SELECT id,project_id AS projectId,owner_role AS ownerRole,action_text AS actionText,basis_type AS basisType,priority,due_at AS dueAt,status,created_at AS createdAt,updated_at AS updatedAt FROM recommendations WHERE id=?').get(String(id)); }
export function createRecommendation(input, actor){ const id=crypto.randomUUID(); const t=now(); db.prepare('INSERT INTO recommendations(id,project_id,owner_role,action_text,basis_type,priority,due_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,input.projectId,input.ownerRole||null,input.actionText,input.basisType||'policy_configured',Number(input.priority||3),input.dueAt||null,'open',t,t); audit({actor:actor.email,actorRole:actor.role,action:'recommendation.created',resourceType:'recommendation',resourceId:id,outcome:'success',metadata:{projectId:input.projectId,basisType:input.basisType||'policy_configured'}}); return getRecommendation(id); }
export function updateRecommendation(id,{status,dueAt}) { const current=getRecommendation(id); if(!current)return null; const allowed=new Set(['open','accepted','declined','completed']); const next=allowed.has(String(status))?String(status):current.status; const t=now(); db.prepare('UPDATE recommendations SET status=?,due_at=?,updated_at=? WHERE id=?').run(next,dueAt===undefined?current.dueAt:(dueAt||null),t,String(id)); return getRecommendation(id); }
export function listPredictions(projectId,limit=20){ return db.prepare('SELECT id,prediction_as_of AS predictionAsOf,snapshot_id AS snapshotId,model_version AS modelVersion,workflow_code AS workflowCode,stage_code AS stageCode,delay_probability AS delayProbability,expected_additional_days AS expectedAdditionalDays,applicability,uncertainty,data_completeness AS dataCompleteness,status,created_at AS createdAt FROM predictions WHERE project_id=? ORDER BY prediction_as_of DESC LIMIT ?').all(projectId,limit); }
export function getDataHealthRows(){ return db.prepare('SELECT id,name,source_type AS sourceType,status,owner,access_note AS accessNote,last_sync_at AS lastSyncAt,created_at AS createdAt,updated_at AS updatedAt FROM data_sources ORDER BY name').all(); }
export function listModelRegistry(){ return db.prepare('SELECT version,model_name AS modelName,purpose,training_population AS trainingPopulation,label_definition AS labelDefinition,legal_context AS legalContext,status,created_at AS createdAt,approved_at AS approvedAt FROM model_registry ORDER BY created_at DESC').all(); }

export function createDatasetVersion(input={}) {
  const id=crypto.randomUUID(); const t=now();
  db.prepare(`INSERT INTO dataset_versions(id,version,grain,source_scope,as_of_policy,label_definition,status,example_count,observed_label_count,censored_count,leakage_violations,created_at,created_by,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,input.version||'temporal-baseline-v1',input.grain||'project-as-of-event',input.sourceScope||'authorised project repository',input.asOfPolicy||'features must be known at or before as_of',input.labelDefinition||'Completed: actual_days > planned_days; ongoing: right-censored with unknown binary label',input.status||'draft',Number(input.exampleCount||0),Number(input.observedLabelCount||0),Number(input.censoredCount||0),Number(input.leakageViolations||0),t,input.createdBy||null,JSON.stringify(input.metadata||{}));
  return db.prepare('SELECT id,version,grain,source_scope AS sourceScope,as_of_policy AS asOfPolicy,label_definition AS labelDefinition,status,example_count AS exampleCount,observed_label_count AS observedLabelCount,censored_count AS censoredCount,leakage_violations AS leakageViolations,created_at AS createdAt,created_by AS createdBy,metadata_json AS metadataJson FROM dataset_versions WHERE id=?').get(id);
}
export function insertTemporalExample(example) {
  db.prepare(`INSERT INTO temporal_examples(id,dataset_version_id,project_id,as_of,feature_json,context_json,label_observed,delay_label,observed_delay_days,observed_duration_days,censored,censor_reason,outcome_at,source_event_count,feature_policy,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(example.id||crypto.randomUUID(),example.datasetVersionId,example.projectId,example.asOf,JSON.stringify(example.features||{}),JSON.stringify(example.context||{}),example.labelObserved?1:0,example.delayLabel ?? null,example.observedDelayDays ?? null,example.observedDurationDays ?? null,example.censored?1:0,example.censorReason||null,example.outcomeAt||null,Number(example.sourceEventCount||0),example.featurePolicy||'strict_as_of',now());
}
export function insertTemporalSplit({datasetVersionId,exampleId,split,cohortTime}) {
  db.prepare(`INSERT OR REPLACE INTO temporal_split_assignments(id,dataset_version_id,example_id,split,cohort_time,created_at) VALUES(?,?,?,?,?,?)`).run(crypto.randomUUID(),datasetVersionId,exampleId,split,cohortTime||null,now());
}
export function insertLeakageAudit(item) {
  db.prepare(`INSERT INTO leakage_audits(id,dataset_version_id,example_id,feature_key,severity,rule_code,as_of,source_time,detail,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(),item.datasetVersionId,item.exampleId||null,item.featureKey||null,item.severity||'error',item.ruleCode,item.asOf||null,item.sourceTime||null,item.detail,now());
}
export function updateDatasetVersion(id,patch={}) {
  db.prepare(`UPDATE dataset_versions SET status=?,example_count=?,observed_label_count=?,censored_count=?,leakage_violations=?,metadata_json=? WHERE id=?`).run(patch.status||'draft',Number(patch.exampleCount||0),Number(patch.observedLabelCount||0),Number(patch.censoredCount||0),Number(patch.leakageViolations||0),JSON.stringify(patch.metadata||{}),id);
  return getDatasetVersion(id);
}
export function getDatasetVersion(id) {
  const row=db.prepare('SELECT id,version,grain,source_scope AS sourceScope,as_of_policy AS asOfPolicy,label_definition AS labelDefinition,status,example_count AS exampleCount,observed_label_count AS observedLabelCount,censored_count AS censoredCount,leakage_violations AS leakageViolations,created_at AS createdAt,created_by AS createdBy,metadata_json AS metadataJson FROM dataset_versions WHERE id=?').get(id);
  return row ? {...row,metadata:parseJson(row.metadataJson,{})} : null;
}
export function latestDatasetVersion() {
  const row=db.prepare('SELECT id FROM dataset_versions ORDER BY created_at DESC LIMIT 1').get();
  return row ? getDatasetVersion(row.id) : null;
}
export function listTemporalExamples(datasetVersionId,limit=500) {
  return db.prepare('SELECT id,dataset_version_id AS datasetVersionId,project_id AS projectId,as_of AS asOf,feature_json AS featureJson,context_json AS contextJson,label_observed AS labelObserved,delay_label AS delayLabel,observed_delay_days AS observedDelayDays,observed_duration_days AS observedDurationDays,censored,censor_reason AS censorReason,outcome_at AS outcomeAt,source_event_count AS sourceEventCount,feature_policy AS featurePolicy,created_at AS createdAt FROM temporal_examples WHERE dataset_version_id=? ORDER BY as_of,project_id LIMIT ?').all(datasetVersionId,limit).map(r=>({...r,labelObserved:Boolean(r.labelObserved),censored:Boolean(r.censored),features:parseJson(r.featureJson,{}),context:parseJson(r.contextJson,{})}));
}
export function listDatasetSplits(datasetVersionId) {
  return db.prepare('SELECT split,COUNT(*) AS count FROM temporal_split_assignments WHERE dataset_version_id=? GROUP BY split ORDER BY split').all(datasetVersionId);
}
export function listLeakageAudits(datasetVersionId) {
  return db.prepare('SELECT id,example_id AS exampleId,feature_key AS featureKey,severity,rule_code AS ruleCode,as_of AS asOf,source_time AS sourceTime,detail,created_at AS createdAt FROM leakage_audits WHERE dataset_version_id=? ORDER BY created_at').all(datasetVersionId);
}
export function seedProjectEvents(){
  const count=db.prepare('SELECT COUNT(*) AS n FROM project_events').get().n; if(count>0) return;
  const projects=db.prepare("SELECT id,source_label,source_id,stage_index,status,updated_at,type,name,acquisition_profile AS acquisitionProfile FROM projects WHERE COALESCE(portfolio_status,'active')='active'").all();
  const ins=db.prepare('INSERT INTO project_events(id,project_id,event_type,event_code,occurred_at,recorded_at,source_label,source_id,effective_at,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  const today=Date.now();
  for(const p of projects){
    const stage=Number(p.stage_index||0);
    const ageBase=Math.max(1,Math.min(240,40+stage*18));
    const registration=today-(ageBase+30)*86400000;
    const events=[['PROJECT_REGISTERED','PROJECT_REGISTERED',registration],['WORKFLOW_REVIEW','WORKFLOW_REVIEW',registration+Math.min(10,ageBase/2)*86400000],['CURRENT_REVIEW','CURRENT_REVIEW',today]];
    const isNH=(p.acquisitionProfile==='NH_ACQUISITION_V1' || (/highway/i.test(p.type||'') && /NH[- ]?\d+/i.test(p.name||'')));
    if(isNH){
      const legalEvents=[];
      legalEvents.push(['WORKFLOW_ASSIGNED','WORKFLOW_NH',today-Math.max(5,ageBase-10)*86400000]);
      if(stage>=1) legalEvents.push(['NH_3A_PUBLICATION','NH_3A_PUBLICATION',today-Math.max(15,ageBase-5)*86400000]);
      if(stage>=2) legalEvents.push(['NH_3C_OBJECTIONS','NH_3C_OBJECTIONS',today-Math.max(10,ageBase-25)*86400000]);
      if(stage>=3) legalEvents.push(['NH_3D_DECLARATION','NH_3D_DECLARATION',today-Math.max(5,ageBase-45)*86400000]);
      if(stage>=4) legalEvents.push(['NH_3G_COMPENSATION','NH_3G_COMPENSATION',today-Math.max(3,ageBase-65)*86400000]);
      if(stage>=5) legalEvents.push(['NH_3H_DEPOSIT','NH_3H_DEPOSIT',today-Math.max(2,ageBase-80)*86400000]);
      if(stage>=6) legalEvents.push(['NH_3E_NOTICE_SERVED','NH_3E_NOTICE_SERVED',today-Math.max(1,ageBase-95)*86400000]);
      if((p.status||'')==='completed' && stage>=6) legalEvents.push(['NH_3E_POSSESSION','NH_3E_POSSESSION',today-Math.max(0,ageBase-110)*86400000]);
      events.push(...legalEvents);
    }
    for(const e of events){const t=new Date(e[2]).toISOString();ins.run(crypto.randomUUID(),p.id,e[0],e[1],t,t,p.source_label||'synthetic_demo',p.source_id||null,t,JSON.stringify({stageIndex:p.stage_index,status:p.status,seeded:true,workflowInference:isNH?'NH-demo-inferred':null}),t);} }
}
seedProjectEvents();


export function appendProjectEvent({projectId,eventType,eventCode=null,occurredAt=now(),recordedAt=now(),sourceLabel='user_recorded',sourceId=null,effectiveAt=null,payload={}}, actor={email:'system',role:'system'}) {
  const project = getProject(projectId);
  if (!project) throw new Error('Project not found.');
  const occurred = new Date(occurredAt); if (Number.isNaN(occurred.getTime())) throw new Error('occurredAt must be a valid timestamp.');
  const recorded = new Date(recordedAt); if (Number.isNaN(recorded.getTime())) throw new Error('recordedAt must be a valid timestamp.');
  const effective = effectiveAt ? new Date(effectiveAt) : occurred;
  if (Number.isNaN(effective.getTime())) throw new Error('effectiveAt must be a valid timestamp.');
  if (occurred.getTime() > recorded.getTime() + 5000) throw new Error('Event occurrence cannot be materially later than its recorded timestamp.');
  const id = `EVT-${crypto.randomUUID()}`;
  db.prepare('INSERT INTO project_events(id,project_id,event_type,event_code,occurred_at,recorded_at,source_label,source_id,effective_at,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,projectId,eventType,eventCode,occurred.toISOString(),recorded.toISOString(),sourceLabel,sourceId,effective.toISOString(),JSON.stringify(payload||{}),now());
  audit({actor:actor.email||'system',actorRole:actor.role||'system',action:'project.event.recorded',resourceType:'project_event',resourceId:id,outcome:'success',metadata:{projectId,eventType,eventCode,sourceLabel}});
  return listProjectEvents(projectId).find(e=>e.id===id) || {id,projectId,eventType,eventCode,occurredAt:occurred.toISOString(),recordedAt:recorded.toISOString(),sourceLabel,sourceId,effectiveAt:effective.toISOString(),payload};
}

export function listProjectDependencies(projectId){ return db.prepare('SELECT id,from_stage_code AS fromStageCode,to_stage_code AS toStageCode,dependency_type AS dependencyType,status,reason,source_label AS sourceLabel,created_at AS createdAt,updated_at AS updatedAt FROM project_stage_dependencies WHERE project_id=? ORDER BY from_stage_code,to_stage_code').all(projectId); }

export function seedProjectWorkflowDependencies(){
  const exists=db.prepare('SELECT 1 FROM project_stage_dependencies LIMIT 1').get(); if(exists) return;
  const projects=db.prepare('SELECT id,type,name,acquisition_profile AS acquisitionProfile FROM projects').all();
  const ins=db.prepare('INSERT OR IGNORE INTO project_stage_dependencies(id,project_id,from_stage_code,to_stage_code,dependency_type,status,reason,source_label,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
  const t=now();
  for(const p of projects){
    const workflow=(p.acquisitionProfile==='NH_ACQUISITION_V1' || (/highway/i.test(p.type||'') && /NH/i.test(p.name||''))) ? 'NH' : null;
    const edges=workflow==='NH'
      ? [['3A','3C','sequence','open','Section 3C objection period follows publication of 3A'],['3C','3D','sequence','open','Declaration follows the objection stage'],['3D','3G','sequence','open','Compensation determination follows vesting/declaration pathway'],['3G','3H','sequence','open','Deposit/payment follows compensation determination'],['3H','3E','sequence','open','Possession follows deposit/payment prerequisites']]
      : [['IDENTITY','NOTIFICATION','sequence','open','Project identity/configuration must be established before workflow events'],['NOTIFICATION','CURRENT','sequence','open','Workflow progression is dependent on recorded notification evidence']];
    for(const [from,to,type,status,reason] of edges) ins.run(crypto.randomUUID(),p.id,from,to,type,status,reason,'DERIVED',t,t);
  }
}
seedProjectWorkflowDependencies();

export function recordLegalClockSnapshot({projectId, clock}){
  const id=`LCS-${crypto.randomUUID()}`; const t=now();
  db.prepare('INSERT INTO legal_clock_snapshots(id,project_id,clock_code,evaluated_at,status,start_at,deadline_at,elapsed_days,paused_days,remaining_days,source_section,snapshot_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,projectId,clock.code,t,clock.status,clock.startAt,clock.deadlineAt,clock.effectiveElapsedDays,clock.pausedDays,clock.remainingDays,clock.sourceSection||clock.source,JSON.stringify(clock));
  return id;
}


export function createAISession({userId, projectId=null, title='Bhoomi AI session', contextHash=null}) {
  const id=`AIS-${crypto.randomUUID()}`; const t=now();
  db.prepare('INSERT INTO ai_sessions(id,user_id,project_id,title,context_hash,status,created_at,updated_at,archived_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(id,String(userId),projectId ? String(projectId) : null,String(title||'Bhoomi AI session'),contextHash||null,'active',t,t,null);
  return getAISession(id,userId);
}
export function getAISession(id,userId) {
  return db.prepare('SELECT id,user_id AS userId,project_id AS projectId,title,context_hash AS contextHash,status,created_at AS createdAt,updated_at AS updatedAt,archived_at AS archivedAt FROM ai_sessions WHERE id=? AND user_id=?').get(String(id),String(userId)) || null;
}
export function listAISessions(userId,{projectId=null,limit=10}={}) {
  const safeLimit=Math.max(1,Math.min(50,Number(limit)||10));
  if(projectId){
    return db.prepare('SELECT id,user_id AS userId,project_id AS projectId,title,context_hash AS contextHash,status,created_at AS createdAt,updated_at AS updatedAt,archived_at AS archivedAt FROM ai_sessions WHERE user_id=? AND project_id=? AND status=\'active\' ORDER BY updated_at DESC LIMIT ?').all(String(userId),String(projectId),safeLimit);
  }
  return db.prepare('SELECT id,user_id AS userId,project_id AS projectId,title,context_hash AS contextHash,status,created_at AS createdAt,updated_at AS updatedAt,archived_at AS archivedAt FROM ai_sessions WHERE user_id=? AND status=\'active\' ORDER BY updated_at DESC LIMIT ?').all(String(userId),safeLimit);
}
export function listAIMessages(sessionId,{limit=16}={}) {
  const safeLimit=Math.max(1,Math.min(50,Number(limit)||16));
  return db.prepare(`SELECT id,role,content,text,mode,model,api_version AS apiVersion,confidence,evidence_coverage AS evidenceCoverage,uncertainty,metadata_json AS metadataJson,created_at AS createdAt FROM (
    SELECT id,role,content,content AS text,mode,model,api_version,confidence,evidence_coverage,uncertainty,metadata_json,created_at
    FROM ai_messages WHERE session_id=? ORDER BY created_at DESC LIMIT ?
  ) ORDER BY created_at ASC`).all(String(sessionId),safeLimit);
}
export function appendAIMessage({sessionId,role,content,mode=null,model=null,apiVersion=null,confidence=null,evidenceCoverage=null,uncertainty=null,evidence=[],metadata={}}) {
  const id=`AIM-${crypto.randomUUID()}`; const t=now();
  db.prepare('INSERT INTO ai_messages(id,session_id,role,content,mode,model,api_version,confidence,evidence_coverage,uncertainty,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,String(sessionId),String(role),String(content||''),mode,model,apiVersion,confidence,evidenceCoverage,uncertainty,JSON.stringify(metadata||{}),t);
  const insertEvidence=db.prepare('INSERT INTO ai_message_evidence(id,message_id,evidence_key,project_id,evidence_type,label,claim,source,provenance,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const item of Array.isArray(evidence)?evidence:[]) {
    if(!item) continue;
    insertEvidence.run(`AIE-${crypto.randomUUID()}`,id,String(item.evidenceKey||item.id||`E-${crypto.randomUUID()}`),item.projectId?String(item.projectId):null,String(item.evidenceType||'DERIVED'),String(item.label||'Evidence'),String(item.claim||''),item.source||null,item.provenance||null,t);
  }
  db.prepare('UPDATE ai_sessions SET updated_at=? WHERE id=?').run(t,String(sessionId));
  return db.prepare('SELECT id,role,content AS text,mode,model,api_version AS apiVersion,confidence,evidence_coverage AS evidenceCoverage,uncertainty,metadata_json AS metadataJson,created_at AS createdAt FROM ai_messages WHERE id=?').get(id);
}
export function listAIMessageEvidence(messageId) {
  return db.prepare('SELECT evidence_key AS evidenceKey,project_id AS projectId,evidence_type AS evidenceType,label,claim,source,provenance,created_at AS createdAt FROM ai_message_evidence WHERE message_id=? ORDER BY rowid').all(String(messageId));
}
export function archiveAISession(id,userId) {
  const t=now();
  const result=db.prepare('UPDATE ai_sessions SET status=\'archived\',updated_at=?,archived_at=? WHERE id=? AND user_id=? AND status=\'active\'').run(t,t,String(id),String(userId));
  return result.changes===1;
}


export function createPredictionRun({ modelVersion, modelStatus, projectCount, featurePolicy, validationStatus, metadata = {} }) {
  const id = `PR-${crypto.randomUUID()}`;
  const t = now();
  db.prepare('INSERT INTO prediction_runs(id,run_type,model_version,model_status,started_at,completed_at,project_count,feature_policy,validation_status,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(id,'project_prediction',modelVersion,modelStatus,t,t,Number(projectCount||0),featurePolicy,validationStatus,JSON.stringify(metadata));
  return db.prepare('SELECT id,run_type AS runType,model_version AS modelVersion,model_status AS modelStatus,started_at AS startedAt,completed_at AS completedAt,project_count AS projectCount,feature_policy AS featurePolicy,validation_status AS validationStatus,metadata_json AS metadataJson FROM prediction_runs WHERE id=?').get(id);
}

export function persistCandidatePrediction(project, prediction, workflowCode = null, stageCode = null) {
  const id = `PRED-${crypto.randomUUID()}`;
  const snapshotId = `SNAP-${crypto.randomUUID()}`;
  const t = now();
  db.prepare(`INSERT INTO predictions(id,project_id,prediction_as_of,snapshot_id,model_version,workflow_code,stage_code,delay_probability,expected_additional_days,applicability,uncertainty,data_completeness,status,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,project.id,prediction.asOf,snapshotId,prediction.modelVersion,workflowCode,stageCode,null,prediction.expectedAdditionalDays,prediction.modelStatus,prediction.uncertaintyPct/100,prediction.dataCompletenessPct/100,'candidate',t);
  const ins = db.prepare('INSERT INTO prediction_feature_snapshots(id,prediction_id,feature_key,feature_value,normalized_value,source_field,as_of,created_at) VALUES(?,?,?,?,?,?,?,?)');
  for (const [key,value] of Object.entries(prediction.features || {})) {
    ins.run(`PFS-${crypto.randomUUID()}`,id,key,Number(value),Number(value),key,prediction.asOf,t);
  }
  const exp = db.prepare('INSERT INTO prediction_explanations(id,prediction_id,layer,feature_key,feature_value,contribution,explanation_text,created_at) VALUES(?,?,?,?,?,?,?,?)');
  for (const e of (prediction.explanations || []).slice(0,9)) {
    exp.run(`PE-${crypto.randomUUID()}`,id,'predictive-baseline',e.key,e.value,e.contribution,e.direction,t);
  }
  return db.prepare('SELECT id,prediction_as_of AS predictionAsOf,snapshot_id AS snapshotId,model_version AS modelVersion,workflow_code AS workflowCode,stage_code AS stageCode,delay_probability AS delayProbability,expected_additional_days AS expectedAdditionalDays,applicability,uncertainty,data_completeness AS dataCompleteness,status,created_at AS createdAt FROM predictions WHERE id=?').get(id);
}

export function listPredictionFeatures(predictionId) {
  return db.prepare('SELECT id,feature_key AS featureKey,feature_value AS featureValue,normalized_value AS normalizedValue,source_field AS sourceField,as_of AS asOf,created_at AS createdAt FROM prediction_feature_snapshots WHERE prediction_id=? ORDER BY rowid').all(String(predictionId));
}

export function listPredictionExplanations(predictionId) {
  return db.prepare('SELECT id,layer,feature_key AS featureKey,feature_value AS featureValue,contribution,explanation_text AS explanationText,created_at AS createdAt FROM prediction_explanations WHERE prediction_id=? ORDER BY contribution DESC').all(String(predictionId));
}

export function getOfficerFeedback(id) { return db.prepare(`SELECT f.id,f.project_id AS projectId,f.user_id AS userId,f.signal_type AS signalType,f.category,f.observation, f.verification_status AS verificationStatus,f.learning_eligible AS learningEligible,f.linked_prediction_id AS linkedPredictionId, f.reviewer_id AS reviewerId,f.reviewed_at AS reviewedAt,f.review_note AS reviewNote,f.created_at AS createdAt,f.updated_at AS updatedAt, u.name AS userName,u.role AS userRole FROM officer_feedback f LEFT JOIN users u ON u.id=f.user_id WHERE f.id=?`).get(String(id)); }
export function listOfficerFeedback(projectId) {
  return db.prepare(`SELECT f.id,f.project_id AS projectId,f.user_id AS userId,f.signal_type AS signalType,f.category,f.observation,
    f.verification_status AS verificationStatus,f.learning_eligible AS learningEligible,f.linked_prediction_id AS linkedPredictionId,
    f.reviewer_id AS reviewerId,f.reviewed_at AS reviewedAt,f.review_note AS reviewNote,f.created_at AS createdAt,f.updated_at AS updatedAt,
    u.name AS userName,u.role AS userRole
    FROM officer_feedback f LEFT JOIN users u ON u.id=f.user_id WHERE f.project_id=? ORDER BY f.created_at DESC`).all(String(projectId)).map((x)=>({...x,learningEligible:Boolean(x.learningEligible)}));
}
export function createOfficerFeedback({projectId,userId,signalType,category,observation,linkedPredictionId=null}) {
  const id=`FB-${crypto.randomUUID().slice(0,8).toUpperCase()}`; const t=now();
  db.prepare(`INSERT INTO officer_feedback(id,project_id,user_id,signal_type,category,observation,verification_status,learning_eligible,linked_prediction_id,reviewer_id,reviewed_at,review_note,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,String(projectId),String(userId),String(signalType),String(category),String(observation),'unreviewed',0,linkedPredictionId?String(linkedPredictionId):null,null,null,null,t,t);
  return db.prepare(`SELECT id,project_id AS projectId,user_id AS userId,signal_type AS signalType,category,observation,verification_status AS verificationStatus,
    learning_eligible AS learningEligible,linked_prediction_id AS linkedPredictionId,reviewer_id AS reviewerId,reviewed_at AS reviewedAt,review_note AS reviewNote,created_at AS createdAt,updated_at AS updatedAt
    FROM officer_feedback WHERE id=?`).get(id);
}
export function reviewOfficerFeedback(id,{reviewerId,status,learningEligible=false,reviewNote=''}) {
  const valid=new Set(['unreviewed','verified','rejected']); const next=valid.has(status)?status:'unreviewed'; const t=now();
  const eligible=next==='verified' && Boolean(learningEligible) ? 1 : 0;
  const result=db.prepare('UPDATE officer_feedback SET verification_status=?,learning_eligible=?,reviewer_id=?,reviewed_at=?,review_note=?,updated_at=? WHERE id=?').run(next,eligible,String(reviewerId),t,String(reviewNote||''),t,String(id));
  if(!result.changes)return null;
  return db.prepare('SELECT id,project_id AS projectId,user_id AS userId,signal_type AS signalType,category,observation,verification_status AS verificationStatus,learning_eligible AS learningEligible,linked_prediction_id AS linkedPredictionId,reviewer_id AS reviewerId,reviewed_at AS reviewedAt,review_note AS reviewNote,created_at AS createdAt,updated_at AS updatedAt FROM officer_feedback WHERE id=?').get(String(id));
}

export function getInterventionAction(id) { const x=db.prepare(`SELECT id,intervention_id AS interventionId,project_id AS projectId,recommendation_id AS recommendationId,action_text AS actionText,owner_role AS ownerRole,status,due_at AS dueAt,actor_id AS actorId,started_at AS startedAt,completed_at AS completedAt,outcome_json AS outcomeJson, outcome_verification_status AS outcomeVerificationStatus,learning_eligible AS learningEligible,outcome_reviewer_id AS outcomeReviewerId,outcome_reviewed_at AS outcomeReviewedAt,outcome_review_note AS outcomeReviewNote,created_at AS createdAt,updated_at AS updatedAt FROM intervention_actions WHERE id=?`).get(String(id)); return x ? {...x,outcome:x.outcomeJson?parseJson(x.outcomeJson,{}):null,learningEligible:Boolean(x.learningEligible)} : null; }
export function listInterventionActions(projectId) {
  return db.prepare(`SELECT id,intervention_id AS interventionId,project_id AS projectId,recommendation_id AS recommendationId,action_text AS actionText,owner_role AS ownerRole,
    status,due_at AS dueAt,actor_id AS actorId,started_at AS startedAt,completed_at AS completedAt,outcome_json AS outcomeJson,
    outcome_verification_status AS outcomeVerificationStatus,learning_eligible AS learningEligible,outcome_reviewer_id AS outcomeReviewerId,outcome_reviewed_at AS outcomeReviewedAt,outcome_review_note AS outcomeReviewNote,created_at AS createdAt,updated_at AS updatedAt
    FROM intervention_actions WHERE project_id=? ORDER BY created_at DESC`).all(String(projectId)).map((x)=>({...x,outcome:x.outcomeJson?parseJson(x.outcomeJson,{}):null,learningEligible:Boolean(x.learningEligible)}));
}
export function createIntervention({projectId,recommendationId=null,scenario={},estimatedEffect={},createdBy}) {
  const id=`INTV-${crypto.randomUUID().slice(0,8).toUpperCase()}`; const t=now();
  db.prepare('INSERT INTO interventions(id,project_id,recommendation_id,scenario_json,estimated_effect_json,is_hypothetical,actual_outcome_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(id,String(projectId),recommendationId?String(recommendationId):null,JSON.stringify(scenario||{}),JSON.stringify(estimatedEffect||{}),1,null,String(createdBy||''),t,t);
  return db.prepare('SELECT id,project_id AS projectId,recommendation_id AS recommendationId,scenario_json AS scenarioJson,estimated_effect_json AS estimatedEffectJson,is_hypothetical AS isHypothetical,actual_outcome_json AS actualOutcomeJson,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM interventions WHERE id=?').get(id);
}
export function createInterventionAction({interventionId,projectId,recommendationId=null,actionText,ownerRole=null,dueAt=null,actorId}) {
  const id=`ACT-${crypto.randomUUID().slice(0,8).toUpperCase()}`; const t=now();
  db.prepare(`INSERT INTO intervention_actions(id,intervention_id,project_id,recommendation_id,action_text,owner_role,status,due_at,actor_id,started_at,completed_at,outcome_json,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,String(interventionId),String(projectId),recommendationId?String(recommendationId):null,String(actionText),ownerRole||null,'planned',dueAt||null,String(actorId),null,null,null,t,t);
  return db.prepare(`SELECT id,intervention_id AS interventionId,project_id AS projectId,recommendation_id AS recommendationId,action_text AS actionText,owner_role AS ownerRole,status,due_at AS dueAt,actor_id AS actorId,started_at AS startedAt,completed_at AS completedAt,outcome_json AS outcomeJson,outcome_verification_status AS outcomeVerificationStatus,learning_eligible AS learningEligible,outcome_reviewer_id AS outcomeReviewerId,outcome_reviewed_at AS outcomeReviewedAt,outcome_review_note AS outcomeReviewNote,created_at AS createdAt,updated_at AS updatedAt FROM intervention_actions WHERE id=?`).get(id);
}
export function updateInterventionAction(id,{status,dueAt,outcome=null}) {
  const current=db.prepare('SELECT * FROM intervention_actions WHERE id=?').get(String(id)); if(!current)return null;
  const allowed=new Set(['planned','in_progress','completed','cancelled']); const next=allowed.has(String(status))?String(status):current.status; const t=now();
  const started=next==='in_progress' && !current.started_at ? t : current.started_at;
  const completed=next==='completed' && !current.completed_at ? t : current.completed_at;
  const outcomeJson=outcome!==undefined && outcome!==null ? JSON.stringify(outcome) : current.outcome_json;
  db.prepare('UPDATE intervention_actions SET status=?,due_at=?,started_at=?,completed_at=?,outcome_json=?,updated_at=? WHERE id=?').run(next,dueAt===undefined?current.due_at:(dueAt||null),started,completed,outcomeJson,t,String(id));
  if (outcome !== undefined && outcome !== null) {
    db.prepare('UPDATE interventions SET actual_outcome_json=?,updated_at=? WHERE id=?').run(outcomeJson,t,String(current.intervention_id));
  }
  return db.prepare(`SELECT id,intervention_id AS interventionId,project_id AS projectId,recommendation_id AS recommendationId,action_text AS actionText,owner_role AS ownerRole,status,due_at AS dueAt,actor_id AS actorId,started_at AS startedAt,completed_at AS completedAt,outcome_json AS outcomeJson,
    outcome_verification_status AS outcomeVerificationStatus,learning_eligible AS learningEligible,outcome_reviewer_id AS outcomeReviewerId,outcome_reviewed_at AS outcomeReviewedAt,outcome_review_note AS outcomeReviewNote,created_at AS createdAt,updated_at AS updatedAt FROM intervention_actions WHERE id=?`).get(String(id));
}
export function reviewInterventionOutcome(id,{reviewerId,status,learningEligible=false,reviewNote=''}) {
  const allowed=new Set(['unreviewed','verified','rejected']); const next=allowed.has(status)?status:'unreviewed'; const eligible=next==='verified' && Boolean(learningEligible) ? 1 : 0; const t=now();
  const result=db.prepare('UPDATE intervention_actions SET outcome_verification_status=?,learning_eligible=?,outcome_reviewer_id=?,outcome_reviewed_at=?,outcome_review_note=?,updated_at=? WHERE id=?').run(next,eligible,String(reviewerId),t,String(reviewNote||''),t,String(id));
  if(!result.changes)return null;
  return db.prepare(`SELECT id,intervention_id AS interventionId,project_id AS projectId,recommendation_id AS recommendationId,action_text AS actionText,owner_role AS ownerRole,status,due_at AS dueAt,actor_id AS actorId,started_at AS startedAt,completed_at AS completedAt,outcome_json AS outcomeJson,
    outcome_verification_status AS outcomeVerificationStatus,learning_eligible AS learningEligible,outcome_reviewer_id AS outcomeReviewerId,outcome_reviewed_at AS outcomeReviewedAt,outcome_review_note AS outcomeReviewNote,created_at AS createdAt,updated_at AS updatedAt FROM intervention_actions WHERE id=?`).get(String(id));
}
export function createPredictionDiff({projectId,currentPredictionId,previousPredictionId=null,diff}) {
  const id=`PDIFF-${crypto.randomUUID().slice(0,8).toUpperCase()}`; const t=now();
  db.prepare('INSERT INTO prediction_diffs(id,project_id,current_prediction_id,previous_prediction_id,diff_json,created_at) VALUES(?,?,?,?,?,?)').run(id,String(projectId),String(currentPredictionId),previousPredictionId?String(previousPredictionId):null,JSON.stringify(diff||{}),t);
  return db.prepare('SELECT id,project_id AS projectId,current_prediction_id AS currentPredictionId,previous_prediction_id AS previousPredictionId,diff_json AS diffJson,created_at AS createdAt FROM prediction_diffs WHERE id=?').get(id);
}
export function getLatestPredictionDiff(projectId) {
  const row=db.prepare('SELECT id,project_id AS projectId,current_prediction_id AS currentPredictionId,previous_prediction_id AS previousPredictionId,diff_json AS diffJson,created_at AS createdAt FROM prediction_diffs WHERE project_id=? ORDER BY created_at DESC LIMIT 1').get(String(projectId));
  return row ? {...row,diff:parseJson(row.diffJson,{})} : null;
}



export function listOperationalAlerts({projectIds=null,status=null,limit=100}={}) {
  const safeLimit=Math.max(1,Math.min(500,Number(limit)||100));
  const clauses=[]; const args=[];
  if(Array.isArray(projectIds)){
    if(projectIds.length===0)return [];
    clauses.push(`project_id IN (${projectIds.map(()=>'?').join(',')})`); args.push(...projectIds.map(String));
  }
  if(status && status!=='all'){ clauses.push('status=?'); args.push(String(status)); }
  const sql=`SELECT a.id,a.project_id AS projectId,p.name AS projectName,p.code AS projectCode,a.category,a.severity,a.title,a.reason,a.source_type AS sourceType,a.rule_version AS ruleVersion,a.attention_score AS attentionScore,a.warning_window_days AS warningWindowDays,a.warning_window_status AS warningWindowStatus,a.status,a.first_seen_at AS firstSeenAt,a.last_seen_at AS lastSeenAt,a.acknowledged_by AS acknowledgedBy,a.acknowledged_at AS acknowledgedAt,a.resolved_by AS resolvedBy,a.resolved_at AS resolvedAt,a.resolution_note AS resolutionNote,a.metadata_json AS metadataJson FROM operational_alerts a JOIN projects p ON p.id=a.project_id ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, a.attention_score DESC, a.last_seen_at DESC LIMIT ?`;
  const rows=db.prepare(sql).all(...args,safeLimit);
  return rows.map(r=>({...r,attentionScore:Number(r.attentionScore||0),metadata:parseJson(r.metadataJson,{})}));
}
export function getOperationalAlert(id){
  const row=db.prepare(`SELECT a.id,a.project_id AS projectId,p.name AS projectName,p.code AS projectCode,a.category,a.severity,a.title,a.reason,a.source_type AS sourceType,a.rule_version AS ruleVersion,a.attention_score AS attentionScore,a.warning_window_days AS warningWindowDays,a.warning_window_status AS warningWindowStatus,a.status,a.first_seen_at AS firstSeenAt,a.last_seen_at AS lastSeenAt,a.acknowledged_by AS acknowledgedBy,a.acknowledged_at AS acknowledgedAt,a.resolved_by AS resolvedBy,a.resolved_at AS resolvedAt,a.resolution_note AS resolutionNote,a.metadata_json AS metadataJson FROM operational_alerts a JOIN projects p ON p.id=a.project_id WHERE a.id=?`).get(String(id));
  return row ? {...row,metadata:parseJson(row.metadataJson,{})} : null;
}
export function upsertOperationalAlert({projectId,category,severity,title,reason,sourceType='RULE_BASED_EARLY_WARNING',ruleVersion='operational-intelligence-v1',attentionScore=0,warningWindowDays=null,warningWindowStatus='NOT_AVAILABLE',metadata={}}={}) {
  const t=now(); const existing=db.prepare('SELECT id,status FROM operational_alerts WHERE project_id=? AND category=? AND rule_version=?').get(String(projectId),String(category),String(ruleVersion));
  if(existing){
    db.prepare(`UPDATE operational_alerts SET severity=?,title=?,reason=?,source_type=?,attention_score=?,warning_window_days=?,warning_window_status=?,last_seen_at=?,metadata_json=? WHERE id=?`).run(String(severity),String(title),String(reason),String(sourceType),Number(attentionScore||0),warningWindowDays===null?null:Number(warningWindowDays),String(warningWindowStatus),t,JSON.stringify(metadata||{}),existing.id);
    return getOperationalAlert(existing.id);
  }
  const id=`ALRT-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  db.prepare(`INSERT INTO operational_alerts(id,project_id,category,severity,title,reason,source_type,rule_version,attention_score,warning_window_days,warning_window_status,status,first_seen_at,last_seen_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,String(projectId),String(category),String(severity),String(title),String(reason),String(sourceType),String(ruleVersion),Number(attentionScore||0),warningWindowDays===null?null:Number(warningWindowDays),String(warningWindowStatus),'open',t,t,JSON.stringify(metadata||{}));
  db.prepare('INSERT INTO alert_events(id,alert_id,event_type,event_note,created_at) VALUES(?,?,?,?,?)').run(`ALE-${crypto.randomUUID()}`,id,'created',null,t);
  return getOperationalAlert(id);
}
export function updateOperationalAlertStatus(id,{status,actorId=null,note=null}={}) {
  const current=getOperationalAlert(id); if(!current)return null;
  const allowed=new Set(['open','acknowledged','resolved','dismissed']); const next=allowed.has(String(status))?String(status):current.status; const t=now();
  if(next==='acknowledged') db.prepare('UPDATE operational_alerts SET status=?,acknowledged_by=?,acknowledged_at=? WHERE id=?').run(next,actorId?String(actorId):null,t,String(id));
  else if(next==='resolved'||next==='dismissed') db.prepare('UPDATE operational_alerts SET status=?,resolved_by=?,resolved_at=?,resolution_note=? WHERE id=?').run(next,actorId?String(actorId):null,t,note?String(note):null,String(id));
  else db.prepare('UPDATE operational_alerts SET status=? WHERE id=?').run(next,String(id));
  db.prepare('INSERT INTO alert_events(id,alert_id,event_type,actor_id,event_note,created_at) VALUES(?,?,?,?,?,?)').run(`ALE-${crypto.randomUUID()}`,String(id),next,actorId?String(actorId):null,note?String(note):null,t);
  return getOperationalAlert(id);
}
export function listAlertEvents(alertId,limit=50){
  const safeLimit=Math.max(1,Math.min(200,Number(limit)||50));
  return db.prepare('SELECT id,alert_id AS alertId,event_type AS eventType,actor_id AS actorId,event_note AS eventNote,created_at AS createdAt FROM alert_events WHERE alert_id=? ORDER BY created_at DESC LIMIT ?').all(String(alertId),safeLimit);
}
export function createModelMonitoringSnapshot(input={}){
  const id=`MON-${crypto.randomUUID().slice(0,8).toUpperCase()}`; const t=now();
  db.prepare(`INSERT INTO model_monitoring_snapshots(id,model_version,dataset_version,evaluation_window,sample_count,prediction_count,drift_status,coverage,ood_rate,false_alert_rate,calibration_error,brier,action_rate,outcome_rate,notes,metadata_json,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,String(input.modelVersion||'unknown'),input.datasetVersion||null,input.evaluationWindow||null,Number(input.sampleCount||0),Number(input.predictionCount||0),String(input.driftStatus||'NOT_AVAILABLE'),input.coverage==null?null:Number(input.coverage),input.oodRate==null?null:Number(input.oodRate),input.falseAlertRate==null?null:Number(input.falseAlertRate),input.calibrationError==null?null:Number(input.calibrationError),input.brier==null?null:Number(input.brier),input.actionRate==null?null:Number(input.actionRate),input.outcomeRate==null?null:Number(input.outcomeRate),input.notes||null,JSON.stringify(input.metadata||{}),t,String(input.createdBy||'system'));
  return getModelMonitoringSnapshot(id);
}
export function getModelMonitoringSnapshot(id){
  const r=db.prepare('SELECT id,model_version AS modelVersion,dataset_version AS datasetVersion,evaluation_window AS evaluationWindow,sample_count AS sampleCount,prediction_count AS predictionCount,drift_status AS driftStatus,coverage,ood_rate AS oodRate,false_alert_rate AS falseAlertRate,calibration_error AS calibrationError,brier,action_rate AS actionRate,outcome_rate AS outcomeRate,notes,metadata_json AS metadataJson,created_at AS createdAt,created_by AS createdBy FROM model_monitoring_snapshots WHERE id=?').get(String(id));
  return r?{...r,metadata:parseJson(r.metadataJson,{})}:null;
}
export function latestModelMonitoringSnapshot(modelVersion=null){
  const r=modelVersion?db.prepare('SELECT id FROM model_monitoring_snapshots WHERE model_version=? ORDER BY created_at DESC LIMIT 1').get(String(modelVersion)):db.prepare('SELECT id FROM model_monitoring_snapshots ORDER BY created_at DESC LIMIT 1').get();
  return r?getModelMonitoringSnapshot(r.id):null;
}
export function createReplayRun({projectId,asOf=null,status='READY',replay,createdBy='system'}={}){
  const id=`REPLAY-${crypto.randomUUID().slice(0,8).toUpperCase()}`; const t=now(); const r=replay||{};
  db.prepare('INSERT INTO replay_runs(id,project_id,as_of,snapshot_count,event_count,prediction_count,outcome_count,status,replay_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,String(projectId),asOf||null,Number(r.snapshotCount||0),Number(r.eventCount||0),Number(r.predictionCount||0),Number(r.outcomeCount||0),String(status),JSON.stringify(r),String(createdBy||'system'),t);
  return getReplayRun(id);
}
export function getReplayRun(id){
  const r=db.prepare('SELECT id,project_id AS projectId,as_of AS asOf,snapshot_count AS snapshotCount,event_count AS eventCount,prediction_count AS predictionCount,outcome_count AS outcomeCount,status,replay_json AS replayJson,created_by AS createdBy,created_at AS createdAt FROM replay_runs WHERE id=?').get(String(id));
  return r?{...r,replay:parseJson(r.replayJson,{})}:null;
}
export function latestReplayRun(projectId){const r=db.prepare('SELECT id FROM replay_runs WHERE project_id=? ORDER BY created_at DESC LIMIT 1').get(String(projectId));return r?getReplayRun(r.id):null;}
export function getProjectOperationalStats(projectId){
  const id=String(projectId);
  const eventCount=Number(db.prepare('SELECT COUNT(*) AS n FROM project_events WHERE project_id=?').get(id).n||0);
  const predictionCount=Number(db.prepare('SELECT COUNT(*) AS n FROM predictions WHERE project_id=?').get(id).n||0);
  const outcomeCount=Number(db.prepare('SELECT COUNT(*) AS n FROM intervention_actions WHERE project_id=? AND outcome_json IS NOT NULL').get(id).n||0);
  const snapshotCount=Number(db.prepare('SELECT COUNT(*) AS n FROM temporal_evidence_snapshots tes JOIN canonical_project_records cpr ON cpr.id=tes.canonical_id WHERE cpr.project_id=?').get(id).n||0);
  return {eventCount,predictionCount,outcomeCount,snapshotCount};
}
export function getMapGeocodeCache(queryKey){
  const row=db.prepare('SELECT query_key AS queryKey,query_text AS queryText,result_json AS resultJson,fetched_at AS fetchedAt,expires_at AS expiresAt FROM map_geocode_cache WHERE query_key=?').get(String(queryKey));
  if(!row)return null;
  if(new Date(row.expiresAt).getTime() <= Date.now()){ db.prepare('DELETE FROM map_geocode_cache WHERE query_key=?').run(String(queryKey)); return null; }
  return {...row,results:parseJson(row.resultJson,[])};
}
export function saveMapGeocodeCache({queryKey,queryText,results,fetchedAt,expiresAt}){
  db.prepare('INSERT OR REPLACE INTO map_geocode_cache(query_key,query_text,result_json,fetched_at,expires_at) VALUES(?,?,?,?,?)').run(String(queryKey),String(queryText),JSON.stringify(results||[]),String(fetchedAt),String(expiresAt));
  return getMapGeocodeCache(queryKey);
}
export function updateProjectLocation(projectId,input,actor){
  const t=now(); const hasPoint=coordinatePairValid(input?.latitude,input?.longitude);
  if (hasPoint && !indiaCoordinateValid(input.latitude,input.longitude)) throw new Error('Project coordinates must fall within the India GIS integrity boundary.');
  const geometry=input?.geometryGeoJSON ? JSON.stringify(input.geometryGeoJSON) : null;
  const precision=String(input?.locationPrecision || (geometry ? 'PARCEL_GEOMETRY' : hasPoint ? 'PROJECT_POINT' : 'UNRESOLVED'));
  const source=String(input?.locationSource || '');
  const authority=precision==='PARCEL_GEOMETRY' ? 'SOURCE_GEOMETRY' : source==='NOMINATIM_OSM' ? 'OPEN_MAP_GEOCODE' : precision==='DISTRICT_CENTROID' ? 'DEMO_APPROXIMATE' : hasPoint ? 'PROJECT_RECORD_POINT' : null;
  const confidence=precision==='PARCEL_GEOMETRY' ? 1 : source==='NOMINATIM_OSM' ? 0.75 : precision==='DISTRICT_CENTROID' ? 0.25 : hasPoint ? 0.6 : null;
  const result=db.prepare(`UPDATE projects SET latitude=?,longitude=?,geometry_geojson=?,location_precision=?,location_source=?,location_label=?,location_osm_type=?,location_osm_id=?,location_bbox_json=?,location_resolved_at=?,location_authority=?,location_confidence=?,updated_at=? WHERE id=?`).run(
    hasPoint?Number(input.latitude):null, hasPoint?Number(input.longitude):null, geometry, precision, input?.locationSource||null, input?.locationLabel||null, input?.locationOsmType||null, input?.locationOsmId==null?null:String(input.locationOsmId), input?.locationBBox?JSON.stringify(input.locationBBox):null, hasPoint||geometry?t:null, authority, confidence, t, String(projectId));
  if(!result.changes)return null;
  audit({actor:actor?.email||'system',actorRole:actor?.role||null,action:'project.location_updated',resourceType:'project',resourceId:String(projectId),outcome:'success',metadata:{mappingVersion:MAPPING_VERSION,precision:input?.locationPrecision||null}});
  return getProject(projectId);
}


export function createPublicDemoFeedback({rating,category,worked,improvements,wouldUse,sessionId=null}) {
  const id=`PDR-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const t=now();
  const safeRating=Math.max(1,Math.min(5,Number(rating)||0));
  if (!safeRating) throw new Error('A rating from 1 to 5 is required.');
  const safeCategory=String(category||'General').trim().slice(0,80);
  const safeWorked=String(worked||'').trim().slice(0,2000);
  const safeImprovements=String(improvements||'').trim().slice(0,2000);
  const safeWouldUse=String(wouldUse||'').trim().slice(0,40);
  if (!safeWorked && !safeImprovements) throw new Error('Tell us at least one thing that worked or could be improved.');
  db.prepare(`INSERT INTO public_demo_feedback(id,rating,category,worked,improvements,would_use,session_id,created_at)
    VALUES(?,?,?,?,?,?,?,?)`).run(id,safeRating,safeCategory,safeWorked,safeImprovements,safeWouldUse,sessionId?String(sessionId).slice(0,120):null,t);
  return db.prepare(`SELECT id,rating,category,worked,improvements,would_use AS wouldUse,created_at AS createdAt FROM public_demo_feedback WHERE id=?`).get(id);
}
export function listPublicDemoFeedback(limit=100) {
  const safeLimit=Math.max(1,Math.min(500,Number(limit)||100));
  return db.prepare(`SELECT id,rating,category,worked,improvements,would_use AS wouldUse,created_at AS createdAt
    FROM public_demo_feedback ORDER BY created_at DESC LIMIT ?`).all(safeLimit);
}
export function getPublicDemoFeedbackSummary() {
  const total=Number(db.prepare('SELECT COUNT(*) AS n FROM public_demo_feedback').get().n||0);
  const avg=Number(db.prepare('SELECT AVG(rating) AS n FROM public_demo_feedback').get().n||0);
  const categories=db.prepare('SELECT category,COUNT(*) AS count FROM public_demo_feedback GROUP BY category ORDER BY count DESC').all();
  return {total,averageRating:Number(avg.toFixed(2)),categories};
}

export function close(){ db.close(); }


export function listBulkFeatureStates(projectId) {
  return db.prepare(`SELECT id, project_id AS projectId, feature_key AS featureKey, feature_version AS featureVersion,
    status, readiness, provenance_status AS provenanceStatus, source_type AS sourceType, evidence_count AS evidenceCount,
    blocked_reason AS blockedReason, metadata_json AS metadataJson, initialized_at AS initializedAt, updated_at AS updatedAt
    FROM project_feature_states WHERE project_id=? ORDER BY feature_key`).all(String(projectId)).map(r => ({
      ...r,
      metadata: parseJson(r.metadataJson, {}),
      evidenceCount: Number(r.evidenceCount || 0),
    }));
}

export function upsertBulkFeatureState({ projectId, featureKey, featureVersion, status, readiness, provenanceStatus='DERIVED', sourceType='UNIFIED_REPOSITORY', evidenceCount=0, blockedReason=null, metadata={} }) {
  const t = now();
  const id = `PFS-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const existing = db.prepare('SELECT id FROM project_feature_states WHERE project_id=? AND feature_key=?').get(String(projectId), String(featureKey));
  if (existing) {
    db.prepare(`UPDATE project_feature_states SET feature_version=?,status=?,readiness=?,provenance_status=?,source_type=?,evidence_count=?,blocked_reason=?,metadata_json=?,updated_at=? WHERE id=?`)
      .run(String(featureVersion), String(status), String(readiness), String(provenanceStatus), String(sourceType), Number(evidenceCount||0), blockedReason ? String(blockedReason) : null, JSON.stringify(metadata||{}), t, existing.id);
    return db.prepare(`SELECT id,project_id AS projectId,feature_key AS featureKey,feature_version AS featureVersion,status,readiness,provenance_status AS provenanceStatus,source_type AS sourceType,evidence_count AS evidenceCount,blocked_reason AS blockedReason,metadata_json AS metadataJson,initialized_at AS initializedAt,updated_at AS updatedAt FROM project_feature_states WHERE id=?`).get(existing.id);
  }
  db.prepare(`INSERT INTO project_feature_states(id,project_id,feature_key,feature_version,status,readiness,provenance_status,source_type,evidence_count,blocked_reason,metadata_json,initialized_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,String(projectId),String(featureKey),String(featureVersion),String(status),String(readiness),String(provenanceStatus),String(sourceType),Number(evidenceCount||0),blockedReason ? String(blockedReason) : null,JSON.stringify(metadata||{}),t,t);
  return db.prepare(`SELECT id,project_id AS projectId,feature_key AS featureKey,feature_version AS featureVersion,status,readiness,provenance_status AS provenanceStatus,source_type AS sourceType,evidence_count AS evidenceCount,blocked_reason AS blockedReason,metadata_json AS metadataJson,initialized_at AS initializedAt,updated_at AS updatedAt FROM project_feature_states WHERE id=?`).get(id);
}

export function createBulkFeatureRun({ version, projectCount, initialized, skipped, failed, metadata={} }) {
  const id = `BFR-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const t = now();
  db.prepare(`INSERT INTO bulk_feature_runs(id,registry_version,project_count,initialized_count,skipped_count,failed_count,started_at,completed_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(id,String(version),Number(projectCount||0),Number(initialized||0),Number(skipped||0),Number(failed||0),t,t,JSON.stringify(metadata||{}));
  return db.prepare(`SELECT id,registry_version AS registryVersion,project_count AS projectCount,initialized_count AS initialized,skipped_count AS skipped,failed_count AS failed,started_at AS startedAt,completed_at AS completedAt,metadata_json AS metadataJson FROM bulk_feature_runs WHERE id=?`).get(id);
}

export function listBulkFeatureRuns(limit=20) {
  const safeLimit=Math.max(1,Math.min(100,Number(limit)||20));
  return db.prepare(`SELECT id,registry_version AS registryVersion,project_count AS projectCount,initialized_count AS initialized,skipped_count AS skipped,failed_count AS failed,started_at AS startedAt,completed_at AS completedAt,metadata_json AS metadataJson FROM bulk_feature_runs ORDER BY completed_at DESC LIMIT ?`).all(safeLimit).map(r=>({...r,metadata:parseJson(r.metadataJson,{})}));
}
