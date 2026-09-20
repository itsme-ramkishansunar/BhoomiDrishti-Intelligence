'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function resolveFromProject(value, fallback) {
  const raw = String(value ?? '').trim();
  if (!raw) return path.resolve(PROJECT_ROOT, fallback);
  return path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(PROJECT_ROOT, raw);
}

function defaultPersistentDataRoot() {
  const explicit = String(process.env.BHOOMI_PERSISTENT_ROOT ?? '').trim();
  if (explicit) return path.resolve(explicit);
  if (process.platform === 'win32') {
    const base = String(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')).trim();
    return path.join(base, 'BhoomiDrishti', 'data');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'BhoomiDrishti', 'data');
  }
  const base = String(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')).trim();
  return path.join(base, 'bhoomidrishti', 'data');
}

const STORAGE_MODE = String(process.env.BHOOMI_STORAGE_MODE || 'shared').trim().toLowerCase() === 'isolated' ? 'isolated' : 'shared';
const ALLOW_CUSTOM_STORAGE = String(process.env.BHOOMI_ALLOW_CUSTOM_STORAGE || '').trim().toLowerCase() === 'true';
const DEFAULT_PERSISTENT_DATA_ROOT = defaultPersistentDataRoot();
const configuredDataDir = String(process.env.BHOOMI_DATA_DIR ?? '').trim();
const normalizedConfiguredDataDir = configuredDataDir.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '').toLowerCase();
const legacyProjectDataSentinel = !configuredDataDir || normalizedConfiguredDataDir === 'backend/data';

// Shared is the production/default local behavior. The legacy `backend/data`
// setting from earlier upgrades is deliberately treated as a migration sentinel
// rather than as a new per-release database location. Tests can opt into
// isolated storage explicitly. An explicit absolute/custom path is still honored.
const useSharedStore = STORAGE_MODE === 'shared' && !ALLOW_CUSTOM_STORAGE;
const DATA_ROOT_DIR = useSharedStore
  ? DEFAULT_PERSISTENT_DATA_ROOT
  : resolveFromProject(configuredDataDir, 'backend/data');

const DATA_INCOMING_DIR = path.join(DATA_ROOT_DIR, 'incoming');
const DATA_FORENSICS_DIR = path.join(DATA_ROOT_DIR, 'forensics');
const DATA_INTAKE_TMP_DIR = path.join(DATA_ROOT_DIR, 'intake', 'tmp');

const configuredDbPath = String(process.env.BHOOMI_DB_PATH ?? '').trim();
const normalizedConfiguredDbPath = configuredDbPath.replaceAll('\\', '/').toLowerCase();
const legacyProjectDbSentinel = !configuredDbPath || normalizedConfiguredDbPath === 'backend/data/bhoomidrishti.sqlite';
const DB_PATH = (STORAGE_MODE === 'shared' && !ALLOW_CUSTOM_STORAGE)
  ? path.join(DATA_ROOT_DIR, 'bhoomidrishti.sqlite')
  : resolveFromProject(configuredDbPath, path.relative(PROJECT_ROOT, path.join(DATA_ROOT_DIR, 'bhoomidrishti.sqlite')));

const PERSISTENCE_MANIFEST_PATH = path.join(DATA_ROOT_DIR, 'storage-manifest.json');
const PERSISTENT_BACKUP_DIR = path.join(DATA_ROOT_DIR, 'backups');
const RUNTIME_LOCK_PATH = path.join(DATA_ROOT_DIR, '.bhoomidrishti-runtime.lock');

function ensureRuntimeDirs() {
  for (const dir of [DATA_ROOT_DIR, DATA_INCOMING_DIR, DATA_FORENSICS_DIR, DATA_INTAKE_TMP_DIR, PERSISTENT_BACKUP_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(PERSISTENCE_MANIFEST_PATH)) {
    const manifest = {
      schema: 'bhoomidrishti-persistent-store-v1',
      storageMode: STORAGE_MODE,
      application: 'BHOOMIDHRISHTI',
      dataRoot: DATA_ROOT_DIR,
      database: DB_PATH,
      createdAt: new Date().toISOString(),
      note: 'Persistent application data is intentionally stored outside release folders so upgrades reuse the same project repository.'
    };
    fs.writeFileSync(PERSISTENCE_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  }
}

module.exports = {
  PROJECT_ROOT,
  STORAGE_MODE,
  DEFAULT_PERSISTENT_DATA_ROOT,
  DATA_ROOT_DIR,
  DATA_INCOMING_DIR,
  DATA_FORENSICS_DIR,
  DATA_INTAKE_TMP_DIR,
  DB_PATH,
  PERSISTENCE_MANIFEST_PATH,
  PERSISTENT_BACKUP_DIR,
  RUNTIME_LOCK_PATH,
  ALLOW_CUSTOM_STORAGE,
  resolveFromProject,
  defaultPersistentDataRoot,
  ensureRuntimeDirs,
};
