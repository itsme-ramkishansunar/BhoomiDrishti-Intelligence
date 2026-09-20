'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const BACKEND_PORT = 8797;
const FRONTEND_PORT = 5187;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bhoomidrishti-u44-runtime-'));
const tempData = path.join(tempRoot, 'data');
fs.mkdirSync(tempData, { recursive: true });
const tempDb = path.join(tempData, 'runtime-smoke.sqlite');
const RUNTIME_ADMIN_EMAIL = 'runtime-admin@bhoomidrishti.local';
const RUNTIME_ADMIN_PASSWORD = `smoke-${crypto.randomBytes(24).toString('base64url')}`;

const baseEnv = {
  ...process.env,
  NODE_ENV: 'development',
  BACKEND_PORT: String(BACKEND_PORT),
  FRONTEND_ORIGIN: `http://127.0.0.1:${FRONTEND_PORT}`,
  BHOOMI_DATA_DIR: tempData,
  BHOOMI_STORAGE_MODE: 'isolated',
  BHOOMI_ALLOW_CUSTOM_STORAGE: 'true',
  BHOOMI_DB_PATH: tempDb,
  BHOOMI_ADMIN_EMAIL: RUNTIME_ADMIN_EMAIL,
  BHOOMI_ADMIN_PASSWORD: RUNTIME_ADMIN_PASSWORD,
  AI_PROVIDER: 'local',
  AI_DATA_MODE: 'local_only',
  BHOOMI_DEMO_ACCESS_ENABLED: 'true',
  SERVE_FRONTEND: 'false',
};

const children = [];
function logChild(prefix, child) {
  child.stdout?.on('data', d => process.stdout.write(`[${prefix}] ${String(d)}`));
  child.stderr?.on('data', d => process.stderr.write(`[${prefix}:stderr] ${String(d)}`));
}
function start(command, args, env, prefix) {
  const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  logChild(prefix, child);
  children.push(child);
  return child;
}
async function waitFor(url, predicate, label, timeoutMs = 15000) {
  const startAt = Date.now();
  let lastError = null;
  while (Date.now() - startAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (!predicate || await predicate(response)) return response;
      lastError = new Error(`${label}: unexpected HTTP ${response.status}`);
    } catch (e) {
      lastError = e;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`${label} did not become ready: ${lastError?.message || 'timeout'}`);
}
async function expectStatus(url, expected, label, options = {}) {
  const res = await fetch(url, options);
  if (res.status !== expected) throw new Error(`${label}: expected ${expected}, got ${res.status}`);
  return res;
}
function extractSetCookie(response) {
  const raw = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
  if (!raw.length) throw new Error('Login did not return a session cookie.');
  return raw[0].split(';')[0];
}
function assertDependenciesInstalled() {
  const required = [
    ['dotenv', 'node_modules/dotenv/package.json'],
    ['express', 'node_modules/express/package.json'],
    ['cors', 'node_modules/cors/package.json'],
    ['helmet', 'node_modules/helmet/package.json'],
    ['express-rate-limit', 'node_modules/express-rate-limit/package.json'],
    ['react', 'node_modules/react/package.json'],
    ['react-dom', 'node_modules/react-dom/package.json'],
    ['vite', 'node_modules/vite/package.json'],
  ];
  const missing = required.filter(([, relative]) => !fs.existsSync(path.join(ROOT, relative))).map(([name]) => name);
  if (missing.length) {
    throw new Error(`Runtime dependencies are missing: ${missing.join(', ')}. Run npm.cmd install --no-audit --no-fund from the project root, then rerun the smoke.`);
  }
}

async function main() {
  assertDependenciesInstalled();
  console.log('Starting isolated runtime smoke…');
  const backend = start(process.execPath, ['backend/server.js'], baseEnv, 'backend');
  await waitFor(`http://127.0.0.1:${BACKEND_PORT}/api/health`, async r => r.ok, 'backend health');
  console.log('PASS runtime: backend health endpoint');

  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) throw new Error('Vite binary is missing. Run npm install before runtime smoke.');
  const frontendEnv = { ...baseEnv, BHOOMI_BACKEND_ORIGIN: `http://127.0.0.1:${BACKEND_PORT}`, BACKEND_ORIGIN: `http://127.0.0.1:${BACKEND_PORT}`, BACKEND_PORT: String(BACKEND_PORT), VITE_FORCE_PORT: String(FRONTEND_PORT) };
  start(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(FRONTEND_PORT), '--strictPort'], frontendEnv, 'vite');
  await waitFor(`http://127.0.0.1:${FRONTEND_PORT}/`, async r => r.ok, 'frontend dev server');
  console.log('PASS runtime: frontend dev server');

  const healthViaProxy = await expectStatus(`http://127.0.0.1:${FRONTEND_PORT}/api/health`, 200, 'frontend API proxy');
  const health = await healthViaProxy.json();
  if (!health.ok) throw new Error('Health payload did not report ok=true.');
  console.log('PASS runtime: Vite /api proxy → backend');

  const html = await (await fetch(`http://127.0.0.1:${FRONTEND_PORT}/`)).text();
  if (!html.includes('<div id="root"></div>')) throw new Error('Frontend HTML does not contain the React root.');
  console.log('PASS runtime: frontend HTML root');

  await expectStatus(`http://127.0.0.1:${BACKEND_PORT}/api/auth/me`, 401, 'unauthenticated auth guard');
  console.log('PASS runtime: unauthenticated auth guard');

  const login = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: RUNTIME_ADMIN_EMAIL, password: RUNTIME_ADMIN_PASSWORD }),
  });
  if (login.status !== 200) throw new Error(`Admin login failed with ${login.status}.`);
  const cookie = extractSetCookie(login);
  console.log('PASS runtime: authentication login + session cookie');

  await expectStatus(`http://127.0.0.1:${BACKEND_PORT}/api/auth/me`, 200, 'authenticated session', { headers: { Cookie: cookie } });
  console.log('PASS runtime: authenticated /api/auth/me');

  const projectsRes = await expectStatus(`http://127.0.0.1:${BACKEND_PORT}/api/projects`, 200, 'authorised project repository', { headers: { Cookie: cookie, Accept: 'application/json' } });
  const projectsBody = await projectsRes.json();
  if (!Array.isArray(projectsBody.projects)) throw new Error('Project repository payload missing projects array.');
  console.log(`PASS runtime: authorised project repository (${projectsBody.projects.length} projects)`);

  await expectStatus(`http://127.0.0.1:${BACKEND_PORT}/api/ai/status`, 200, 'AI status', { headers: { Cookie: cookie } });
  console.log('PASS runtime: AI status route');

  const connectorRes = await expectStatus(`http://127.0.0.1:${BACKEND_PORT}/api/source-connectors/catalog`, 200, 'source connector catalog', { headers: { Cookie: cookie } });
  const connectorBody = await connectorRes.json();
  if (!Array.isArray(connectorBody.connectors)) throw new Error('Connector catalog payload missing connectors array.');
  console.log('PASS runtime: source connector catalog');

  if (projectsBody.projects[0]?.id) {
    const trust = await expectStatus(`http://127.0.0.1:${BACKEND_PORT}/api/projects/${encodeURIComponent(projectsBody.projects[0].id)}/intelligence-trust`, 200, 'intelligence trust', { headers: { Cookie: cookie } });
    const trustBody = await trust.json();
    if (!trustBody.evidenceReadiness || !trustBody.applicability) throw new Error('Intelligence-trust payload incomplete.');
    console.log('PASS runtime: intelligence-trust route');
  }

  console.log('Isolated runtime smoke PASSED.');
}

function cleanup() {
  for (const child of children.reverse()) {
    try { child.kill('SIGTERM'); } catch {}
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
}

main().catch(error => {
  console.error(`RUNTIME SMOKE FAILED: ${error.stack || error.message}`);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(cleanup, 250);
});
