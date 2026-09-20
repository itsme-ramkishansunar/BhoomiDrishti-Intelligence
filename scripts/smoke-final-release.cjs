const fs = require('node:fs');
const path = require('node:path');
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const required = ['validate:all','start:all','release:check','release:final','smoke:project-lifecycle','smoke:system-readiness','smoke:unified-data-backbone','smoke:storage-integrity','smoke:gis-integrity','smoke:repository-persistence-e2e','smoke:gis-e2e'];
for (const key of required) {
  if (!pkg.scripts?.[key]) throw new Error(`Missing release script: ${key}`);
  console.log(`PASS release script: ${key}`);
}
for (const rel of ['README.md','U53_PERSISTENT_STORE_GUIDE.md','U54_VERSION.txt','docs_UPGRADE_54_RELEASE_NOTES.md','INSTALL_U54_WINDOWS.ps1','BACKUP_PERSISTENT_STORE_WINDOWS.ps1','Dockerfile','docker-compose.yml','backend/domain/project-lifecycle.js','backend/domain/unified-data-backbone.js','database/migrations/014_unified_data_backbone.sql','scripts/smoke-project-lifecycle.cjs','scripts/smoke-system-readiness.cjs','scripts/smoke-unified-data-backbone.cjs','scripts/migrate-persistent-store.cjs','scripts/verify-persistent-store.cjs','scripts/smoke-persistent-store.cjs']) {
  if (!fs.existsSync(path.join(process.cwd(), rel))) throw new Error(`Missing release artifact: ${rel}`);
  console.log(`PASS release artifact: ${rel}`);
}
console.log('Final release smoke PASSED');
