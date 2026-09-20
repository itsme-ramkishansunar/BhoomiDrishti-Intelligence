const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const os = require('node:os');

const root = path.resolve(__dirname, '..');
const tempDb = path.join(os.tmpdir(), `bhoomidrishti_ai_smoke_${process.pid}_${Date.now()}.sqlite`);
process.env.BHOOMI_DB_PATH = tempDb;

(async () => {
  const db = await import(pathToFileURL(path.join(root, 'backend', 'db.js')).href);
  const session = db.createAISession({ userId: 'smoke-user', projectId: 'smoke-project', title: 'Smoke session', contextHash: 'smoke-hash' });
  if (!session?.id) throw new Error('AI session creation failed');
  const userMessage = db.appendAIMessage({ sessionId: session.id, role: 'user', content: 'Why is this project risky?' });
  const assistantMessage = db.appendAIMessage({
    sessionId: session.id,
    role: 'assistant',
    content: 'Stored risk output is a derived application metric.',
    mode: 'local-evidence-engine',
    confidence: 0.86,
    evidenceCoverage: 0.86,
    uncertainty: 0.14,
    evidence: [{ evidenceKey: 'E-RISK', projectId: 'smoke-project', evidenceType: 'MODEL', label: 'Stored risk output', claim: 'Stored risk output is 47/100.', source: 'BhoomiDrishti risk engine', provenance: 'DERIVED' }],
    metadata: { recommendations: ['Review the risk record.'], relatedProjects: [{ id: 'smoke-project', name: 'Smoke Project', risk: 47, band: 'medium' }], evidence: ['Stored risk output is derived.'] }
  });
  const messages = db.listAIMessages(session.id, { limit: 10 });
  const refs = db.listAIMessageEvidence(assistantMessage.id);
  if (messages.length !== 2) throw new Error(`Expected 2 messages, got ${messages.length}`);
  if (refs.length !== 1 || refs[0].evidenceKey !== 'E-RISK') throw new Error('Evidence lineage was not persisted');
  const persisted = messages.find((m) => m.id === assistantMessage.id);
  const metadata = JSON.parse(persisted?.metadataJson || '{}');
  if (!Array.isArray(metadata.relatedProjects) || metadata.relatedProjects[0]?.risk !== 47) throw new Error('AI analysis metadata was not persisted');
  if (db.getAISession(session.id, 'wrong-user')) throw new Error('Session ownership check failed');
  if (!db.archiveAISession(session.id, 'smoke-user')) throw new Error('Session archive failed');
  if (db.getAISession(session.id, 'smoke-user')?.status !== 'archived') throw new Error('Archived session state not persisted');
  db.close();
  for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(`${tempDb}${suffix}`); } catch (_) {} }
  console.log('AI conversation smoke passed: persistent session, message history, evidence lineage and ownership checks.');
})().catch(async (error) => {
  console.error(error?.stack || error?.message || error);
  try { const db = await import(pathToFileURL(path.join(root, 'backend', 'db.js')).href); db.close(); } catch (_) {}
  for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(`${tempDb}${suffix}`); } catch (_) {} }
  process.exit(1);
});
