'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const temporaryScripts = [
  'scripts/smoke-runtime.cjs',
  'scripts/smoke-u45-action-loop.cjs',
  'scripts/smoke-new-project-write.cjs',
  'scripts/smoke-unified-data-backbone.cjs',
];
for (const rel of temporaryScripts) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const isolated = /BHOOMI_STORAGE_MODE['\"]?\s*[:=]\s*['\"]isolated['\"]/.test(source) || /process\.env\.BHOOMI_STORAGE_MODE\s*=\s*['\"]isolated['\"]/.test(source);
  const customAllowed = /BHOOMI_ALLOW_CUSTOM_STORAGE['\"]?\s*[:=]\s*['\"]true['\"]/.test(source) || /process\.env\.BHOOMI_ALLOW_CUSTOM_STORAGE\s*=\s*['\"]true['\"]/.test(source);
  if (!isolated || !customAllowed) throw new Error(`Temporary validation script is not isolated: ${rel}`);
  console.log(`PASS validation isolation: ${rel}`);
}
console.log('Validation isolation smoke PASSED');
