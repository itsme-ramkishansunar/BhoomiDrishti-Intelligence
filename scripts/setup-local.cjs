const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

function copyFrom(candidate, label) {
  if (candidate && fs.existsSync(candidate)) {
    fs.copyFileSync(candidate, envPath);
    console.log(`Local environment copied from ${label}.`);
    return true;
  }
  return false;
}

if (fs.existsSync(envPath)) {
  console.log('.env already exists; leaving it unchanged.');
  process.exit(0);
}

const candidates = [];
if (process.env.BHOOMI_ENV_SOURCE) candidates.push([path.resolve(process.env.BHOOMI_ENV_SOURCE), 'BHOOMI_ENV_SOURCE']);

// Legacy upgrade-chain discovery remains available only when explicitly enabled.
if (String(process.env.BHOOMI_LEGACY_ENV_DISCOVERY || 'false').toLowerCase() === 'true') {
  let cursor = root;
  for (let i=0; i<6; i++) {
    const sibling = path.join(cursor, 'BHOOMIDHRISTI_UPGRADE_15', 'BHOOMIDHRISTI_UPGRADE_15', '.env');
    candidates.push([sibling, 'explicitly enabled nearby Upgrade 15 checkpoint']);
    cursor = path.dirname(cursor);
  }
}

for (const [candidate,label] of candidates) if (copyFrom(candidate,label)) process.exit(0);

if (fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log('Created .env from .env.example. Add your local secrets through your secret manager/environment; do not commit .env.');
  process.exit(0);
}

console.error('Could not create .env. Provide BHOOMI_ENV_SOURCE or copy a local .env into the project root.');
process.exit(1);
