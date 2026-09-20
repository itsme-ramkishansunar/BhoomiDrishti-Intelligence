const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const steps = [
  'ensure:dependencies',
  'smoke:storage-integrity',
  'smoke:gis-integrity',
  'smoke:u54-runtime',
  'smoke:repository-persistence-e2e',
  'smoke:gis-e2e',
  'smoke:source-connectors',
  'smoke:data-ingestion',
  'smoke:portability',
  'smoke:persistent-store',
  'smoke:persistent-store-io',
  'smoke:readme-consolidation', 'smoke:forensics-depth',
  'doctor',
  'smoke:frontend-symbols',
  'smoke:ai-ux',
  'smoke:ai-query-intelligence',
  'smoke:ai-query-seed',
  'smoke:validation-isolation',
  'smoke:runtime',
  'check:text',
  'check:js',
  'db:check',
  'smoke:platform',
  'smoke:ai',
  'smoke:legal',
  'smoke:ai-conversation',
  'smoke:predictive',
  'smoke:temporal-dataset',
  'smoke:data-forensics',
  'smoke:project-intake',
  'smoke:entity-resolution',
  'smoke:canonical-project',
  'smoke:temporal-reconciliation',
  'smoke:intelligence-preparation',
  'smoke:intelligence-trust',
  'smoke:hardening',
  'smoke:system-contract',
  'smoke:u45-action-loop',
  'smoke:ml-governance',
  'smoke:ml-baseline',
  'smoke:operational-intelligence',
  'smoke:mlops',
  'smoke:replay',
  'smoke:new-project-automation',
  'smoke:project-lifecycle',
  'smoke:provenance',
  'smoke:unified-data-backbone',
  'smoke:mapping',
  'smoke:new-project-write',
  'smoke:system-readiness',
  'smoke:u62-finalization',
  'smoke:u63-final-hardening',
  'smoke:u64-connector-controls',
  'smoke:u65-functional-hardening',
  'smoke:u66-functional-recovery',
  'smoke:u67-functional-reliability',
  'smoke:u70-map-rebuild',
  'smoke:u71-functional-hardening',
  'smoke:bulk-initialize',
  'smoke:bulk-features',
  'smoke:final-product',
  'build',
]

function runNpmScript(script) {
  const npmExecPath = process.env.npm_execpath;
  let command;
  let args;
  if (npmExecPath && fs.existsSync(npmExecPath)) {
    command = process.execPath;
    args = [npmExecPath, 'run', script];
  } else if (process.platform === 'win32') {
    // Avoid shell:true and its argument-injection/deprecation risks.
    const npmCmd = process.env.ComSpec || 'cmd.exe';
    command = npmCmd;
    args = ['/d', '/s', '/c', `npm.cmd run ${JSON.stringify(script).slice(1,-1)}`];
  } else {
    command = 'npm';
    args = ['run', script];
  }
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const code = Number.isInteger(result.status) ? result.status : 1;
    throw new Error(`STOP: npm run ${script} failed with code ${code}`);
  }
}

try {
  for (const script of steps) {
    console.log(`\n=== npm run ${script} ===`);
    runNpmScript(script);
  }
  console.log('\nBHOOMIDHRISHTI validation-all PASSED.');
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
