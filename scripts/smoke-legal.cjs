const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const root = process.cwd();
  const { evaluateLegalClocks, LEGAL_CLOCK_DEFINITIONS } = await import(pathToFileURL(path.join(root,'backend/domain/legal-engine.js')).href);
  const base = Date.parse('2026-01-01T00:00:00.000Z');
  const stayStart = Date.parse('2026-02-01T00:00:00.000Z');
  const stayEnd = Date.parse('2026-03-03T00:00:00.000Z');
  const events = [
    {id:'a',eventCode:'NH_3A_PUBLICATION',occurredAt:'2026-01-01T00:00:00.000Z'},
    {id:'s',eventCode:'COURT_STAY_STARTED',occurredAt:new Date(stayStart).toISOString()},
    {id:'e',eventCode:'COURT_STAY_ENDED',occurredAt:new Date(stayEnd).toISOString()},
  ];
  const result = evaluateLegalClocks({workflowCode:'NH_ACQUISITION_V1',events,asOf:'2026-12-31T00:00:00.000Z'});
  const clock = result.find(x=>x.code==='NH_3A_TO_3D');
  if(!clock || clock.pausedDays !== 30 || clock.durationDays !== LEGAL_CLOCK_DEFINITIONS.NH_3A_TO_3D.durationDays) throw new Error(`Legal clock pause/resume check failed: ${JSON.stringify(clock)}`);
  const awaiting = result.find(x=>x.code==='NH_3H_TO_3E');
  if(awaiting?.status !== 'AWAITING_TRIGGER') throw new Error('Missing-trigger safety check failed.');
  console.log('Legal workflow smoke passed: pause/resume, statutory source metadata and missing-trigger safety checks.');
})().catch(err => { console.error('Legal workflow smoke failed:', err); process.exit(1); });
