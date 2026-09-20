import crypto from 'node:crypto';
import {
  syncProjectDataFacts, upsertProjectIntelligenceSnapshot, getLatestProjectIntelligenceSnapshot, getProjectDataHub,
  getProjectDataFacts, listProjectEvidence, listProjectEvents, listPredictions, listRecommendations,
  listOperationalAlerts, listInterventionActions, listOfficerFeedback, getLatestPredictionDiff, latestReplayRun
} from '../db.js';
import { buildProjectIntelligence, buildEvidence } from './intelligence.js';
import { buildEarlyWarning } from './operational-intelligence.js';
import { scoreCandidatePrediction } from './predictive-engine.js';
import { inferDemoWorkflow } from './workflows.js';
import { classifySourceLabel } from './provenance.js';

export const UNIFIED_DATA_BACKBONE_VERSION = 'unified-data-backbone-v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }

export function buildUnifiedProjectPayload(project, { storedPrediction = null } = {}) {
  const workflow = inferDemoWorkflow(project);
  const prediction = storedPrediction || scoreCandidatePrediction(project);
  const warning = buildEarlyWarning(project);
  const intelligence = buildProjectIntelligence(project);
  const evidenceCards = buildEvidence(project);
  return {
    version: UNIFIED_DATA_BACKBONE_VERSION,
    asOf: new Date().toISOString(),
    project: {
      id:String(project.id), name:project.name, code:project.code, type:project.type, state:project.state, district:project.district, status:project.status,
      updatedAt:project.updatedAt, sourceLabel:project.source?.label || project.sourceLabel || 'UNVERIFIED',
    },
    provenance: {
      sourceLabel:project.source?.label || project.sourceLabel || 'UNVERIFIED',
      provenanceStatus:classifySourceLabel(project.source?.label || project.sourceLabel || 'UNVERIFIED'),
      sourceId:project.source?.id || project.sourceId || null,
      sourceChecksum:project.source?.checksum || project.sourceChecksum || null,
    },
    data: { facts:getProjectDataFacts(project.id), evidence:listProjectEvidence(project.id), events:listProjectEvents(project.id) },
    intelligence: { risk:project.risk || null, prediction, warning, summary:intelligence, workflow, evidenceCards },
    operations: {
      recommendations:listRecommendations(project.id),
      alerts:listOperationalAlerts({projectIds:[String(project.id)],status:'all',limit:200}),
      interventions:listInterventionActions(project.id),
      feedback:listOfficerFeedback(project.id),
    },
    history: { predictions:listPredictions(project.id,20), predictionDiff:getLatestPredictionDiff(project.id), replay:latestReplayRun(project.id) },
    governance: {
      productionModelPromotable:false,
      predictionStatus:prediction?.modelStatus || 'candidate_not_validated',
      legalDecisionDelegated:true, humanDecisionRequired:true, notCausal:true,
    },
  };
}

export function refreshUnifiedProjectSnapshot(project, { generatedBy='system' } = {}) {
  if (!project?.id) throw new Error('Project is required to refresh the unified snapshot.');
  syncProjectDataFacts(project, generatedBy);
  const currentPredictions = listPredictions(project.id, 1);
  const payload = buildUnifiedProjectPayload(project, { storedPrediction: currentPredictions[0] || null });
  const factsSha256 = hash(payload.data.facts);
  const dataSha256 = hash(payload);
  return upsertProjectIntelligenceSnapshot({ projectId:project.id, snapshotKey:'current', asOf:payload.asOf, projectUpdatedAt:project.updatedAt || payload.asOf, payload, factsSha256, dataSha256, generatedBy });
}

export function getUnifiedProjectDataHub(projectId) {
  const live = getProjectDataHub(projectId);
  if (!live.project) return null;
  return live;
}
