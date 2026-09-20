import {
  listProjects,
  listProjectEvents,
  listProjectIntelligenceSnapshots,
  listPredictions,
  listRecommendations,
  getProjectDataFacts,
  createPredictionRun,
  persistCandidatePrediction,
  createRecommendation,
  upsertOperationalAlert,
  appendProjectEvent,
  audit,
} from '../db.js';
import { scoreCandidatePrediction } from './predictive-engine.js';
import { buildEarlyWarning } from './operational-intelligence.js';
import { inferDemoWorkflow } from './workflows.js';
import { refreshUnifiedProjectSnapshot } from './unified-data-backbone.js';

export const BULK_INITIALIZATION_VERSION = 'bulk-project-initialization-v1';
const FACT_COUNT_EXPECTED = 20;

function actionForSignal(signal) {
  const map = {
    compensation: 'Review and age outstanding compensation cases.',
    legal: 'Verify active disputes and latest court-linked records with the authorised legal function.',
    documentation: 'Reconcile missing or incomplete document records against the authorised checklist.',
    approval: 'Review outstanding approvals, send-backs and pending administrative decisions.',
    resettlement: 'Audit rehabilitation and resettlement readiness against recorded entitlements and progress.',
    administrative: 'Review cross-department blockers and record the next verified operational action.',
    process_silence: 'Review the latest recorded workflow event and verify the next required operational step.',
  };
  return map[String(signal || '').toLowerCase()] || 'Review the current project evidence and verify the active bottleneck.';
}

function hasLifecycleEvent(projectId) {
  return listProjectEvents(projectId).some(e => String(e.eventType) === 'PROJECT_LIFECYCLE_BOOTSTRAPPED');
}

function ensureCandidatePrediction(project) {
  const existing = listPredictions(project.id, 1)[0];
  if (existing) return { created: false, prediction: existing, run: null };
  const workflow = inferDemoWorkflow(project);
  const prediction = scoreCandidatePrediction(project);
  const run = createPredictionRun({
    modelVersion: prediction.modelVersion,
    modelStatus: prediction.modelStatus,
    projectCount: 1,
    featurePolicy: prediction.validation?.leakagePolicy || 'strict_as_of',
    validationStatus: prediction.validation?.status || 'NOT_VALIDATED',
    metadata: { projectId: project.id, initializationVersion: BULK_INITIALIZATION_VERSION, automatic: true },
  });
  const persisted = persistCandidatePrediction(project, prediction, workflow.code, workflow.stages?.[Number(project.stageIndex) || 0]?.code || null);
  return { created: true, prediction: persisted, run };
}

function ensureRecommendation(project, warning) {
  const existing = listRecommendations(project.id).find(r => ['open', 'accepted'].includes(String(r.status || '')));
  if (existing) return { created: false, recommendation: existing };
  const actionText = project.risk?.recommendedActions?.[0] || actionForSignal(warning.primarySignal);
  if (!project.status || String(project.status).toLowerCase() !== 'ongoing') return { created: false, recommendation: null };
  const recommendation = createRecommendation({
    projectId: project.id,
    ownerRole: warning.primarySignal === 'legal' ? 'Legal Officer' : warning.primarySignal === 'compensation' ? 'Compensation / Accounts Cell' : 'Project Coordination',
    actionText,
    basisType: 'rule_based_operational_warning',
    priority: warning.severity === 'critical' ? 1 : warning.severity === 'high' ? 2 : 3,
    dueAt: null,
  }, { email: 'system', role: 'system' });
  return { created: true, recommendation };
}

function ensureAlert(project, warning) {
  if (String(project.status).toLowerCase() !== 'ongoing' || warning.severity === 'low') return { created: false, alert: null };
  const existing = upsertOperationalAlert({
    projectId: project.id,
    category: warning.primarySignal,
    severity: warning.severity,
    title: `${warning.severity.toUpperCase()} early-warning: ${project.name}`,
    reason: `${warning.primarySignal} is the strongest current rule-based operational signal; attention score ${warning.attentionScore}/100.`,
    attentionScore: warning.attentionScore,
    warningWindowDays: warning.warningWindowDays,
    warningWindowStatus: warning.warningWindowStatus,
    metadata: { warning, projectStatus: project.status, bulkInitialization: true },
  });
  return { created: false, alert: existing };
}

export function initializeProjectIntelligence(project, { actor = 'system-bulk-initializer', forceRefresh = false } = {}) {
  if (!project?.id) throw new Error('Project is required.');
  const beforeFacts = getProjectDataFacts(project.id).length;
  const beforeSnapshot = listProjectIntelligenceSnapshots(project.id, 1)[0] || null;
  const beforePrediction = listPredictions(project.id, 1)[0] || null;
  const beforeLifecycle = hasLifecycleEvent(project.id);

  const facts = beforeFacts === FACT_COUNT_EXPECTED ? getProjectDataFacts(project.id) : null;
  if (!facts) {
    // refreshUnifiedProjectSnapshot also synchronises the normalized facts; snapshot is rebuilt below after operations.
    // This function is intentionally called once more at the end to capture all changes.
  }

  const predictionResult = beforePrediction ? { created: false, prediction: beforePrediction, run: null } : ensureCandidatePrediction(project);
  const warning = buildEarlyWarning(project);
  const recommendationResult = ensureRecommendation(project, warning);
  const alertResult = ensureAlert(project, warning);

  let lifecycleEvent = null;
  if (!beforeLifecycle) {
    const workflow = inferDemoWorkflow(project);
    lifecycleEvent = appendProjectEvent({
      projectId: project.id,
      eventType: 'PROJECT_LIFECYCLE_BOOTSTRAPPED',
      eventCode: BULK_INITIALIZATION_VERSION,
      occurredAt: new Date().toISOString(),
      effectiveAt: new Date().toISOString(),
      sourceLabel: project.source?.label || 'user_uploaded',
      sourceId: project.source?.id || null,
      payload: { workflow: workflow.code, warningSeverity: warning.severity, primarySignal: warning.primarySignal, predictionStatus: predictionResult.prediction?.modelStatus || predictionResult.prediction?.status || 'candidate_not_validated', bulkInitialization: true },
    }, { email: 'system', role: 'system' });
  }

  const snapshot = refreshUnifiedProjectSnapshot(project, { generatedBy: actor });
  audit({
    actor,
    actorRole: 'system',
    action: 'project.bulk_initialized',
    resourceType: 'project',
    resourceId: String(project.id),
    outcome: 'success',
    metadata: {
      version: BULK_INITIALIZATION_VERSION,
      factsBefore: beforeFacts,
      snapshotBefore: Boolean(beforeSnapshot),
      predictionBefore: Boolean(beforePrediction),
      lifecycleBefore: beforeLifecycle,
      recommendationCreated: recommendationResult.created,
      predictionCreated: predictionResult.created,
      forceRefresh: Boolean(forceRefresh),
      snapshotId: snapshot?.id || null,
    },
  });

  return {
    projectId: String(project.id),
    name: project.name,
    facts: getProjectDataFacts(project.id).length,
    snapshot: Boolean(snapshot),
    prediction: Boolean(listPredictions(project.id, 1)[0]),
    recommendation: listRecommendations(project.id).length > 0,
    alert: Boolean(alertResult.alert),
    lifecycle: true,
    predictionCreated: predictionResult.created,
    recommendationCreated: recommendationResult.created,
    lifecycleCreated: Boolean(lifecycleEvent),
  };
}

export function bulkInitializeProjects({ onlyMissing = true, forceRefresh = false, actor = 'system-bulk-initializer', filters = {} } = {}) {
  const projects = listProjects(filters);
  const startedAt = new Date().toISOString();
  const results = [];
  const errors = [];
  for (const project of projects) {
    try {
      const factsCount = getProjectDataFacts(project.id).length;
      const snapshot = listProjectIntelligenceSnapshots(project.id, 1)[0] || null;
      const lifecycle = hasLifecycleEvent(project.id);
      const prediction = listPredictions(project.id, 1)[0] || null;
      const snapshotStale = Boolean(snapshot && project.updatedAt && snapshot.projectUpdatedAt && new Date(snapshot.projectUpdatedAt).getTime() < new Date(project.updatedAt).getTime());
      const needs = forceRefresh || !onlyMissing || factsCount !== FACT_COUNT_EXPECTED || !snapshot || snapshotStale || !prediction || !lifecycle;
      if (!needs) {
        results.push({ projectId: String(project.id), name: project.name, skipped: true, facts: factsCount, snapshot: true, prediction: true, lifecycle: true });
        continue;
      }
      results.push(initializeProjectIntelligence(project, { actor, forceRefresh }));
    } catch (error) {
      errors.push({ projectId: String(project.id), name: project.name, error: String(error?.message || error) });
    }
  }
  const initialized = results.filter(r => !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const summary = {
    version: BULK_INITIALIZATION_VERSION,
    startedAt,
    completedAt: new Date().toISOString(),
    projectCount: projects.length,
    initialized,
    skipped,
    failed: errors.length,
    errors,
    factsReady: results.filter(r => Number(r.facts || 0) >= FACT_COUNT_EXPECTED).length,
    snapshotsReady: results.filter(r => r.snapshot).length,
    predictionsReady: results.filter(r => r.prediction).length,
    lifecycleReady: results.filter(r => r.lifecycle).length,
  };
  audit({ actor, actorRole: 'system', action: 'project.bulk_initialization.completed', resourceType: 'project_repository', outcome: errors.length ? 'partial' : 'success', metadata: summary });
  return { summary, results };
}

export function getBulkInitializationStatus() {
  const projects = listProjects();
  let factsReady = 0;
  let snapshotsReady = 0;
  let predictionsReady = 0;
  let lifecycleReady = 0;
  for (const project of projects) {
    if (getProjectDataFacts(project.id).length >= FACT_COUNT_EXPECTED) factsReady += 1;
    if (listProjectIntelligenceSnapshots(project.id, 1).length) snapshotsReady += 1;
    if (listPredictions(project.id, 1).length) predictionsReady += 1;
    if (hasLifecycleEvent(project.id)) lifecycleReady += 1;
  }
  return {
    version: BULK_INITIALIZATION_VERSION,
    projectCount: projects.length,
    factsReady,
    snapshotsReady,
    predictionsReady,
    lifecycleReady,
    fullyInitialized: projects.length > 0 && factsReady === projects.length && snapshotsReady === projects.length && predictionsReady === projects.length && lifecycleReady === projects.length,
  };
}
