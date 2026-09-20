const { spawnSync } = require('node:child_process');
const candidates = process.platform === 'win32' ? ['py','python','python3'] : ['python3','python','py'];
let lastError = '';
for (const exe of candidates) {
  try {
    const probe = spawnSync(exe, ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], windowsHide: true });
    if (probe.status !== 0) { lastError = (probe.stderr || '').trim() || `exit ${probe.status}`; continue; }
    console.log(`Using Python: ${(probe.stdout || '').trim()}`);
    const run = spawnSync(exe, ['-m','pip','install','-r','requirements-intake.txt'], { stdio:'inherit', windowsHide:true });
    if (run.status === 0) process.exit(0);
    lastError = `Python pip exited with code ${run.status}`;
  } catch (e) { lastError = e.message; }
}
console.error(`Unable to locate a usable Python interpreter for intake setup. Tried: ${candidates.join(', ')}. ${lastError}`);
process.exit(1);
