#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bhoomidrishti-u7242-'));
process.env.BHOOMI_STORAGE_MODE = 'isolated';
process.env.BHOOMI_ALLOW_CUSTOM_STORAGE = 'true';
process.env.BHOOMI_DATA_DIR = root;
process.env.BHOOMI_DEMO_ACCESS_ENABLED = 'true';
process.env.NODE_ENV = 'test';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const source = (name) => fs.readFileSync(path.join(PROJECT_ROOT, name), 'utf8');
const checks = [];
const pass = (name, ok, detail='') => checks.push({name, ok:Boolean(ok), detail});

try {
  const db = await import('../backend/db.js');
  const projects = db.listProjects();
  pass('isolated persistent database', projects.length > 0, `${projects.length} seeded project(s)`);

  const project = projects[0];
  db.syncProjectDataFacts(project, 'u72.4.2-smoke');
  db.syncProjectDataFacts(project, 'u72.4.2-smoke');
  pass('project facts insert + ON CONFLICT update', db.getProjectDataFacts(project.id).length >= 20, `${db.getProjectDataFacts(project.id).length} facts`);

  const intake = db.createProjectIntake({
    createdBy: 'u72.4.2-smoke',
    analysis: {
      analysisVersion:'smoke', sourceClassification:'USER_UPLOADED / NOT_GOVERNMENT_VERIFIED',
      completenessPct:80, evidenceCoveragePct:80, extractionConfidencePct:90,
      integrity:{documentCount:1,combinedTextSha256:'smoke'}, provenance:[{name:'smoke.pdf',type:'application/pdf',size:10,sha256:'smoke',parser:'test',textChars:10}],
      fieldEvidence:[{field:'projectName',value:'Smoke Project',document:'smoke.pdf',excerpt:'Smoke Project',confidence:.95}]
    }
  });
  const reviews = db.upsertIntakeFieldReviews(intake.id, intake.analysis.fieldEvidence, 'u72.4.2-smoke');
  pass('persistent intake field-review queue', reviews.length === 1 && reviews[0].status === 'pending', JSON.stringify(reviews));

  const bulk = (await import('../backend/domain/bulk-initialization.js')).bulkInitializeProjects({onlyMissing:true, actor:'u72.4.2-smoke'});
  pass('bulk project initialization runtime', bulk.summary.failed === 0, JSON.stringify(bulk.summary));

  const dbSource = source('backend/db.js');
  const predictiveSource = source('src/components/ops/PredictiveLabPage.jsx');
  const healthSource = source('src/components/ops/DataHealthPage.jsx');
  const integrationSource = source('src/components/ops/IntegrationControlPage.jsx');
  const appSource = source('src/App.jsx');
  pass('no portfolio columns in project_data_facts upsert', !/effective_at=excluded\.effective_at,updated_at=excluded\.updated_at,portfolio_status=/.test(dbSource));
  pass('predictive lab admin guard', predictiveSource.includes('canAdmin') && predictiveSource.includes('Administrator governance permission required'));
  pass('data health admin guard', healthSource.includes('canAdmin') && healthSource.includes('Sync · Admin'));
  pass('integration control admin guard', integrationSource.includes('canAdmin') && integrationSource.includes('Capture · Admin'));
  pass('command palette permission-aware', appSource.includes('permissions=[]') && appSource.includes('permissions.includes(n.permission)'));

  const failed = checks.filter(x=>!x.ok);
  console.log(JSON.stringify({ok:failed.length===0,version:'U72.4.2',checks:checks.length,failed:failed.map(x=>x.name),details:checks},null,2));
  process.exitCode = failed.length ? 1 : 0;
} catch (error) {
  console.error(JSON.stringify({ok:false,version:'U72.4.2',error:String(error?.stack||error)},null,2));
  process.exitCode = 1;
}
