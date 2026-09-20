const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const root = path.join(projectRoot, 'src');
const extensions = new Set(['.jsx', '.tsx', '.html']);
const bad = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(path.extname(entry.name))) {
      const text = fs.readFileSync(full, 'utf8');
      // This project keeps visible copy in UTF-8. Literal Unicode escape sequences
      // are a common source of the \u2014-style artifacts seen in the UI.
      if (/\\u[0-9a-fA-F]{4}/.test(text)) bad.push(path.relative(projectRoot, full));
      if (/\uFFFD/.test(text)) bad.push(`${path.relative(projectRoot, full)} (replacement character)`);
    }
  }
}

walk(root);
if (bad.length) {
  console.error('Text integrity check failed:');
  for (const item of bad) console.error(` - ${item}`);
  process.exit(1);
}
console.log('Text integrity check passed: no literal Unicode escape artifacts or replacement characters found in src/.');
