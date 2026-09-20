const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { STORAGE_MODE, DEFAULT_PERSISTENT_DATA_ROOT, DATA_ROOT_DIR, DATA_INCOMING_DIR, DATA_FORENSICS_DIR, DATA_INTAKE_TMP_DIR, DB_PATH, PERSISTENCE_MANIFEST_PATH } = require('../backend/runtime-paths.cjs');
const fail = (m) => { console.error(`FAIL: ${m}`); process.exitCode = 1; };
const pass = (m) => console.log(`PASS: ${m}`);

console.log('BHOOMIDHRISHTI environment doctor');
console.log(`Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json'))) fail('package.json not found; run this command from the project root.');
else pass('project root resolved without requiring a developer-specific absolute path');

for (const d of ['backend','database','scripts','src']) {
  if (fs.existsSync(path.join(root,d))) pass(`required directory: ${d}`); else fail(`missing directory: ${d}`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
console.log(`Node.js: ${process.versions.node}`);
if (nodeMajor < 22) fail('Node.js 22+ is required for the current built-in SQLite adapter.');
try {
  require('node:sqlite');
  pass('node:sqlite is available');
} catch (e) {
  fail('node:sqlite is unavailable. Use a supported Node.js runtime with built-in node:sqlite.');
}

const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) pass('.env present');
else console.warn('WARN: .env is missing; configure a local environment before AI/server startup.');

try {
  for (const dir of [DATA_ROOT_DIR, DATA_INCOMING_DIR, DATA_FORENSICS_DIR, DATA_INTAKE_TMP_DIR]) { fs.mkdirSync(dir, { recursive:true }); fs.accessSync(dir, fs.constants.W_OK); }
  pass('runtime data tree is writable');
} catch (e) { fail(`runtime data tree is not writable: ${e.message}`); }

console.log(`BHOOMI_STORAGE_MODE: ${STORAGE_MODE}`);
console.log(`BHOOMI_PERSISTENT_DEFAULT: ${DEFAULT_PERSISTENT_DATA_ROOT}`);
console.log(`BHOOMI_DATA_DIR: ${DATA_ROOT_DIR}`);
console.log(`BHOOMI_DB_PATH: ${DB_PATH}`);
console.log(`BHOOMI_STORAGE_MANIFEST: ${PERSISTENCE_MANIFEST_PATH}`);
if (STORAGE_MODE === 'shared' && DATA_ROOT_DIR.startsWith(root + path.sep)) fail('shared persistent data unexpectedly resolves inside the release folder');

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  pass(`package ${pkg.name} ${pkg.version}`);
} catch (e) { fail(`cannot read package.json: ${e.message}`); }

// Detect actual developer-specific absolute filesystem paths in source files.
// Do not scan Markdown documentation or URL routes; those legitimately contain words such as /users/.
const skip = new Set(['node_modules','.git','dist']);
const roots = ['backend','database','scripts','src'];
const skipPathScanFiles = new Set(['smoke-portability.cjs','smoke-hardening.cjs','smoke-system-contract.cjs']);
const exts = /\.(js|cjs|jsx|json|sql|yml|yaml)$/;
const absoluteUserPathPatterns = [
  /\b[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`]+[\\/]/i,
  /(^|["'`\s])\/(?:Users|home)\/[A-Za-z0-9._-]+(?:\/|$)/,
];
const warnings = [];
for (const relRoot of roots) {
  const start = path.join(root, relRoot);
  const stack = [start];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
      if (skip.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { stack.push(full); continue; }
      if (!exts.test(ent.name) || skipPathScanFiles.has(ent.name)) continue;
      const text = fs.readFileSync(full,'utf8');
      if (absoluteUserPathPatterns.some(re=>re.test(text))) warnings.push(path.relative(root,full));
    }
  }
}
for (const file of warnings) console.warn(`WARN: possible developer-specific absolute filesystem path in ${file}`);
if (warnings.length === 0) pass('no obvious developer-specific absolute filesystem paths found in application/config source');

if (process.exitCode) console.error('\nEnvironment doctor found blocking issues.');
else console.log('\nEnvironment doctor passed.');
