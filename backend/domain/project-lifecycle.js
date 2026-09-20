import { inferDemoWorkflow } from './workflows.js';
import { scoreCandidatePrediction } from './predictive-engine.js';
import { buildEarlyWarning } from './operational-intelligence.js';

export const PROJECT_LIFECYCLE_VERSION = 'project-lifecycle-v1';

function actionForSignal(signal) {
  const map = {
    compensation: 'Review and age outstanding compensation cases.',
    legal: 'Verify active disputes and latest court-linked records with the authorised legal function.',
    documentation: 'Reconcile missing or incomplete document records against the authorised checklist.',
    approval: 'Review outstanding approvals, send-backs and pending administrative decisions.',
    resettlement: 'Audit rehabilitation and resettlement readiness against recorded entitlements and progress.',
    administrative: 'Review cross-department blockers and record the next verified workflow action.',
    process_silence: 'Review the latest recorded workflow event and verify the next required operational step.',
  };
  return map[String(signal || '').toLowerCase()] || 'Review the current project evidence and verify the active bottleneck.';
}

export function buildProjectBootstrap(project, deps = {}) {
  if (!project?.id) throw new Error('Project is required for lifecycle bootstrap.');
  const { listRecommendations = () => [], createRecommendation, upsertOperationalAlert, appendProjectEvent, createPredictionRun, persistCandidatePrediction, audit } = deps;
  const workflow = inferDemoWorkflow(project);
  const prediction = scoreCandidatePrediction(project);
  const warning = buildEarlyWarning(project);
  const existingRecommendations = listRecommendations(project.id);
  const actionText = project.risk?.recommendedActions?.[0] || actionForSignal(warning.primarySignal);
  let recommendation = existingRecommendations.find(r => String(r.actionText || '').trim() === actionText && ['open','accepted'].includes(String(r.status || '')));
  if (!recommendation && typeof createRecommendation === 'function') {
    recommendation = createRecommendation({
      projectId: project.id,
      ownerRole: warning.primarySignal === 'legal' ? 'Legal Officer' : warning.primarySignal === 'compensation' ? 'Compensation / Accounts Cell' : 'Project Coordination',
      actionText,
      basisType: 'rule_based_operational_warning',
      priority: warning.severity === 'critical' ? 1 : warning.severity === 'high' ? 2 : 3,
      dueAt: null,
    }, { email: 'system', role: 'system' });
  }
  let predictionRun = null;
  let persistedPrediction = null;
  if (typeof createPredictionRun === 'function') {
    predictionRun = createPredictionRun({
      modelVersion: prediction.modelVersion,
      modelStatus: prediction.modelStatus,
      projectCount: 1,
      featurePolicy: prediction.validation?.leakagePolicy || 'strict_as_of',
      validationStatus: prediction.validation?.status || 'NOT_VALIDATED',
      metadata: { projectId: project.id, lifecycleVersion: PROJECT_LIFECYCLE_VERSION, automatic: true },
    });
  }
  if (typeof persistCandidatePrediction === 'function') {
    persistedPrediction = persistCandidatePrediction(project, prediction, workflow.code, workflow.stages?.[Number(project.stageIndex) || 0]?.code || null);
  }
  let alert = null;
  if (typeof upsertOperationalAlert === 'function' && project.status === 'ongoing' && warning.severity !== 'low') {
    alert = upsertOperationalAlert({
      projectId: project.id,
      category: warning.primarySignal,
      severity: warning.severity,
      title: `${warning.severity.toUpperCase()} early-warning: ${project.name}`,
      reason: `${warning.primarySignal} is the strongest current rule-based operational signal; attention score ${warning.attentionScore}/100.`,
      attentionScore: warning.attentionScore,
      warningWindowDays: warning.warningWindowDays,
      warningWindowStatus: warning.warningWindowStatus,
      metadata: { warning, projectStatus: project.status, automaticBootstrap: true },
    });
  }
  let createdEvent = null;
  if (typeof appendProjectEvent === 'function') {
    createdEvent = appendProjectEvent({
      projectId: project.id,
      eventType: 'PROJECT_LIFECYCLE_BOOTSTRAPPED',
      eventCode: PROJECT_LIFECYCLE_VERSION,
      occurredAt: new Date().toISOString(),
      effectiveAt: new Date().toISOString(),
      sourceLabel: project.source?.label || 'user_uploaded',
      sourceId: project.source?.id || null,
      payload: { workflow: workflow.code, warningSeverity: warning.severity, primarySignal: warning.primarySignal, predictionStatus: prediction.modelStatus },
    }, { email: 'system', role: 'system' });
  }
  if (typeof audit === 'function') {
    audit({ actor: 'system', actorRole: 'system', action: 'project.lifecycle.bootstrap', resourceType: 'project', resourceId: project.id, outcome: 'success', metadata: { workflow: workflow.code, predictionStatus: prediction.modelStatus, warningSeverity: warning.severity, recommendationId: recommendation?.id || null, alertId: alert?.id || null } });
  }
  return {
    version: PROJECT_LIFECYCLE_VERSION,
    projectId: project.id,
    workflowCode: workflow.code,
    prediction,
    predictionRun,
    persistedPrediction,
    warning,
    recommendation,
    alert,
    event: createdEvent,
    automatic: true,
  };
}
