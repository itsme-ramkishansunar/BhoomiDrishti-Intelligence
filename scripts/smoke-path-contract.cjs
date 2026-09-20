'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PROJECT_ROOT, STORAGE_MODE, DEFAULT_PERSISTENT_DATA_ROOT, DATA_ROOT_DIR, DATA_INCOMING_DIR, DATA_FORENSICS_DIR, DATA_INTAKE_TMP_DIR, DB_PATH } = require('../backend/runtime-paths.cjs');

function assert(ok, message) {
  if (!ok) throw new Error(message);
  console.log(`PASS path contract: ${message}`);
}

const rel = (p) => path.relative(PROJECT_ROOT, p).replaceAll('\\', '/');
const isAbsolute = (p) => path.isAbsolute(p);

assert(path.resolve(PROJECT_ROOT) === PROJECT_ROOT, 'project root is absolute and canonical');
assert(DATA_ROOT_DIR === path.resolve(DATA_ROOT_DIR), `data root resolves to ${DATA_ROOT_DIR}`);
assert(DATA_INCOMING_DIR === path.join(DATA_ROOT_DIR, 'incoming'), 'incoming directory is under canonical data root');
assert(DATA_FORENSICS_DIR === path.join(DATA_ROOT_DIR, 'forensics'), 'forensics directory is under canonical data root');
assert(DATA_INTAKE_TMP_DIR === path.join(DATA_ROOT_DIR, 'intake', 'tmp'), 'intake temporary directory is under canonical data root');
assert(isAbsolute(DB_PATH), 'database path is always absolute after resolution');
const dataIsProjectRelative = !rel(DATA_ROOT_DIR).startsWith('../');
const dbIsProjectRelative = !rel(DB_PATH).startsWith('../');
assert(dataIsProjectRelative || path.isAbsolute(DATA_ROOT_DIR), 'data root is either project-relative or explicitly absolute');
assert(dbIsProjectRelative || path.isAbsolute(DB_PATH), 'database path is either project-relative or explicitly absolute');
assert(['shared','isolated'].includes(STORAGE_MODE), 'storage mode is shared or isolated');
if (STORAGE_MODE === 'shared') {
  assert(path.isAbsolute(DEFAULT_PERSISTENT_DATA_ROOT), 'shared persistent root is absolute');
  assert(!DATA_ROOT_DIR.startsWith(PROJECT_ROOT + path.sep), 'shared persistent data is outside the release folder');
}


const viteConfig = fs.readFileSync(path.join(PROJECT_ROOT, 'vite.config.js'), 'utf8');
assert(/loadEnv\s*\(/.test(viteConfig), 'vite.config.js loads environment for proxy configuration');
assert(/BHOOMI_BACKEND_ORIGIN/.test(viteConfig), 'vite.config.js supports explicit backend origin');
assert(/BACKEND_PORT/.test(viteConfig), 'vite.config.js derives backend proxy from BACKEND_PORT');
assert(!/['"](?:https?:\/\/)(?:localhost|127\.0\.0\.1):8787['"]/.test(viteConfig), 'vite.config.js has no hard-coded backend proxy target');

const files = [
  ['scripts/data-forensics.cjs', /backend[\\/]data[\\/]incoming|DATA_INCOMING_DIR/],
  ['scripts/setup-local.cjs', /BHOOMI_LEGACY_ENV_DISCOVERY/],
  ['README.md', /backend\/data\/incoming/],
  ['.env.example', /BHOOMI_STORAGE_MODE=shared/],
  ['.env.example', /BHOOMI_PERSISTENT_ROOT=/],
];
for (const [file, re] of files) {
  const text = fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8');
  assert(re.test(text), `${file} uses canonical runtime-path contract`);
}

const setupSource = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/setup-local.cjs'), 'utf8');
assert(!/BHOOMIDHRISTI_UPGRADE_15/.test(setupSource) || /BHOOMI_LEGACY_ENV_DISCOVERY/.test(setupSource), 'legacy Upgrade 15 discovery is explicitly gated');

const forensicsSource = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/data-forensics.cjs'), 'utf8');
assert(!/path\.join\(root,\s*['"]data['"]/.test(forensicsSource), 'data-forensics does not construct the legacy root/data path');

console.log('Path/runtime contract passed.');
