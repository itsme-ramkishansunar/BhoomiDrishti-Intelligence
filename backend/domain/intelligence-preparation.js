import crypto from 'node:crypto';

export const INTELLIGENCE_PREPARATION_VERSION = 'intelligence-preparation-v1';

function sha256(value){
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function prepareSIH26017Intelligence({intake, canonical, temporalSnapshot, predictiveStatus='NOT_VALIDATED'}={}) {
  const canonicalObj = canonical?.canonical || canonical || {};
  const temporal = temporalSnapshot?.snapshot || temporalSnapshot || null;
  const canonicalQuality = canonical?.quality || canonicalObj.quality || {};
  const temporalQuality = temporal?.quality || {};
  const reviewReasons = [];
  if (canonical?.status === 'REVIEW_REQUIRED' || canonicalObj.governance?.humanReviewRequired) reviewReasons.push('canonical_review_required');
  if ((canonicalQuality.conflictCount || canonicalObj.quality?.conflictCount || 0) > 0) reviewReasons.push('canonical_conflicts');
  if ((temporalQuality.conflictCount || 0) > 0) reviewReasons.push('temporal_conflicts');
  if ((temporalQuality.qualityPct ?? 100) < 80) reviewReasons.push('temporal_quality_low');
  if (!temporal) reviewReasons.push('temporal_snapshot_missing');
  if (!intake) reviewReasons.push('intake_missing');

  const predictiveNotValidated = /not[_ -]?validated|candidate/i.test(String(predictiveStatus || ''));
  const gate = reviewReasons.length ? 'REVIEW_REQUIRED' : (predictiveNotValidated ? 'PREDICTION_GATE_NOT_VALIDATED' : 'READY_FOR_PREDICTION');
  const readiness = Math.max(0, Math.min(100, Math.round(
    (Number(canonical?.readinessPct ?? canonicalQuality.readinessPct ?? 0) * 0.45) +
    (Number(canonicalQuality.evidenceCoveragePct ?? 0) * 0.20) +
    (Number(temporalQuality.qualityPct ?? 0) * 0.35)
  )));
  const output = {
    schemaVersion: INTELLIGENCE_PREPARATION_VERSION,
    generatedAt: new Date().toISOString(),
    intakeId: intake?.id || null,
    canonicalId: canonical?.id || null,
    temporalSnapshotId: temporalSnapshot?.id || null,
    sourceClassification: intake?.sourceClassification || canonicalObj.sourceClassification || 'USER_UPLOADED / NOT_GOVERNMENT_VERIFIED',
    readinessPct: readiness,
    gate,
    reviewReasons,
    predictive: {
      status: predictiveStatus,
      modelTrainability: predictiveNotValidated ? 'blocked_pending_real_authorized_dataset' : 'available',
      note: 'This preparation run does not manufacture a predictive probability.'
    },
    counts: {
      documents: Number(intake?.documentCount || intake?.files?.length || 0),
      entities: Array.isArray(canonicalObj.entities) ? canonicalObj.entities.length : 0,
      evidenceLinks: Array.isArray(canonicalObj.links) ? canonicalObj.links.length : 0,
      temporalEvents: Array.isArray(temporal?.events) ? temporal.events.length : 0,
      futureExcluded: Number(temporal?.futureExcludedCount || 0),
      conflicts: Number(canonicalObj.quality?.conflictCount || canonicalQuality.conflictCount || 0) + Number(temporalQuality.conflictCount || 0)
    }
  };
  return {...output,runSha256:sha256(output)};
}
