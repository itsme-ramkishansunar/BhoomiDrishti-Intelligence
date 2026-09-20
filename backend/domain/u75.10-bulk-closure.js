/**
 * U75.10 Bulk Closure & Reconciliation
 *
 * Read-only operational contracts that verify the governed bulk pipeline after
 * promotion. No project facts are mutated by this module.
 */
export const U75_10_BULK_CLOSURE_VERSION = 'u75.10-bulk-closure-v1';

const asInt = v => Math.max(0, Number(v)||0);

export function buildBulkReconciliation({
  ingestionRun = null,
  batches = [],
  evidence = [],
  projects = [],
  intelligence = null
} = {}) {
  const runId = ingestionRun?.id ? String(ingestionRun.id) : null;
  const latest = batches?.[0] || null;
  const projectIds = new Set((projects||[]).map(p => String(p.id)));
  const evidenceProjectIds = new Set((evidence||[]).map(e => e?.projectId).filter(Boolean).map(String));
  const missingProjectEvidence = [...evidenceProjectIds].filter(id => !projectIds.has(id));
  const promotedEvidence = (evidence||[]).filter(e => String(e?.decision||'').toUpperCase().includes('PROMOT') || String(e?.decision||'').toUpperCase()==='APPLY_INCOMING');
  const conflicts = (evidence||[]).filter(e => ['BLOCK_CONFLICT','KEEP_EXISTING'].includes(String(e?.decision||'').toUpperCase()));
  const failedBatch = String(latest?.status||'').toUpperCase()==='PARTIAL';
  const expectedRows = asInt(latest?.summary?.requested ?? latest?.summary?.rows);
  const promoted = asInt(latest?.summary?.promoted);
  const blocked = asInt(latest?.summary?.blocked);
  const skipped = asInt(latest?.summary?.skipped);
  const failed = asInt(latest?.summary?.failed);
  const accounted = promoted + blocked + skipped + failed;
  const reconciliation = expectedRows === 0
    ? 'NO_BATCH'
    : (accounted === expectedRows && !missingProjectEvidence.length && !failedBatch ? 'RECONCILED' : 'REVIEW_REQUIRED');
  return {
    version: U75_10_BULK_CLOSURE_VERSION,
    generatedAt: new Date().toISOString(),
    ingestionRun: runId ? {id:runId,status:ingestionRun.status,filename:ingestionRun.originalFilename,sha256:ingestionRun.sha256} : null,
    batch: latest ? {id:latest.id,status:latest.status,expectedRows, promoted,blocked,skipped,failed,accounted} : null,
    evidence: {
      count:(evidence||[]).length,
      projectCount:evidenceProjectIds.size,
      missingProjectCount:missingProjectEvidence.length,
      conflictDecisionCount:conflicts.length,
      applyOrPromotionCount:promotedEvidence.length
    },
    intelligence: intelligence ? {
      projectCount:asInt(intelligence.projectCount),
      succeeded:asInt(intelligence.succeeded),
      failed:asInt(intelligence.failed),
      highAttention:asInt(intelligence.highAttention),
      riskVelocityIncreasing:asInt(intelligence.riskVelocityIncreasing),
      actionQueuesReady:asInt(intelligence.actionQueuesReady)
    } : null,
    reconciliation,
    safeToProceed: reconciliation === 'RECONCILED',
    issues: [
      ...(missingProjectEvidence.length ? [`${missingProjectEvidence.length} evidence record(s) reference missing project(s).`] : []),
      ...(failedBatch ? ['Latest governed promotion batch is PARTIAL.'] : []),
      ...(expectedRows && accounted !== expectedRows ? [`Batch accounting mismatch: expected ${expectedRows}, accounted ${accounted}.`] : []),
      ...(intelligence?.failed ? [`${intelligence.failed} intelligence propagation result(s) failed.`] : [])
    ]
  };
}

export function buildBulkClosureHealth({
  runs=[],
  batches=[],
  projects=[],
  intelligenceSummary=null,
  connectorCount=0
}={}) {
  const analysed = (runs||[]).filter(r=>String(r?.status||'')==='ANALYZED').length;
  const failedRuns = (runs||[]).filter(r=>String(r?.status||'').includes('FAILED')).length;
  const completedBatches = (batches||[]).filter(b=>String(b?.status||'').toUpperCase()==='COMPLETED').length;
  const partialBatches = (batches||[]).filter(b=>String(b?.status||'').toUpperCase()==='PARTIAL').length;
  const latestBatch = batches?.[0] || null;
  const intelligenceFailed = asInt(intelligenceSummary?.failed);
  const issues = [];
  if (failedRuns) issues.push(`${failedRuns} ingestion run(s) are in a failed state.`);
  if (partialBatches) issues.push(`${partialBatches} promotion batch(es) are partial.`);
  if (intelligenceFailed) issues.push(`${intelligenceFailed} downstream intelligence propagation result(s) failed.`);
  return {
    version:U75_10_BULK_CLOSURE_VERSION,
    generatedAt:new Date().toISOString(),
    status:issues.length ? 'REVIEW_REQUIRED' : 'HEALTHY',
    scope:{ingestionRuns:runs.length,analysedRuns:analysed,failedRuns,projects:projects.length,connectors:connectorCount},
    promotion:{batches:batches.length,completedBatches,partialBatches,latestBatchId:latestBatch?.id||null,latestBatchStatus:latestBatch?.status||null},
    intelligence:intelligenceSummary||null,
    issues
  };
}
