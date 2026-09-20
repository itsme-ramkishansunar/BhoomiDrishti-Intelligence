const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
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

const missing = required.filter(([, relative]) => !fs.existsSync(path.join(root, relative))).map(([name]) => name);
if (!missing.length) {
  console.log('Dependency preflight PASSED: required runtime/build packages are installed.');
  process.exit(0);
}

console.log(`Dependency preflight: missing ${missing.join(', ')}.`);
console.log('Installing declared package dependencies before validation…');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['install', '--no-audit', '--no-fund'], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  env: process.env,
});
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Dependency installation failed with code ${result.status}. Run npm.cmd install --no-audit --no-fund manually and retry.`);
}

const stillMissing = required.filter(([, relative]) => !fs.existsSync(path.join(root, relative))).map(([name]) => name);
if (stillMissing.length) throw new Error(`Dependency installation completed but packages are still missing: ${stillMissing.join(', ')}.`);
console.log('Dependency preflight PASSED: dependencies installed successfully.');
