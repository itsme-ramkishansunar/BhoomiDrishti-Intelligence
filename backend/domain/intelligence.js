import { inferDemoWorkflow, evaluatePossessionReadiness } from './workflows.js';
import { classifySourceLabel } from './provenance.js';

function clamp(n, min=0, max=1){ return Math.max(min, Math.min(max, Number(n) || 0)); }

export function buildProjectIntelligence(project) {
  const workflow = inferDemoWorkflow(project);
  const risk = project?.risk || {};
  const drivers = Array.isArray(risk.drivers) ? risk.drivers : [];
  const top = drivers[0] || null;
  const second = drivers[1] || null;
  const compRatio = project?.familiesAffected ? clamp(Number(project.familiesPending)/Number(project.familiesAffected)) : 0;
  const acquisitionProgress = project?.totalParcels ? clamp(Number(project.parcelsAcquired)/Number(project.totalParcels)) : 0;
  const dataCompleteness = clamp(1 - ((project?.docsMissing || 0) / Math.max(20, (project?.totalParcels || 20))), 0.15, 1);
  const quality = Math.round(dataCompleteness * 100);
  const readiness = evaluatePossessionReadiness(project, workflow);
  const bottleneckScore = top?.value ?? null;
  const riskVelocity = project?.status === 'ongoing' ? Math.round((Number(project.avgDelayDays || 0) / 90) * 100) : 0;
  const delayBands = {
    thirtyDays: clamp(Number(project.avgDelayDays || 0) / 30),
    sixtyDays: clamp(Number(project.avgDelayDays || 0) / 60),
    ninetyDays: clamp(Number(project.avgDelayDays || 0) / 90),
  };
  return {
    predictionUnit: 'project',
    asOf: new Date().toISOString(),
    currentRisk: risk.overall ?? null,
    riskBand: risk.band ?? 'unknown',
    predictedBottleneck: top ? { key: top.key, label: top.label, score: top.value, contribution: top.contribution } : null,
    secondaryDriver: second ? { key: second.key, label: second.label, score: second.value, contribution: second.contribution } : null,
    dataReliability: { completenessPct: quality, freshness: project?.source?.retrievedAt ? 'known' : 'unknown', sourceLabel: project?.source?.label || 'unspecified', applicability: workflow.code === 'UNRESOLVED' ? 'LOW' : 'CONFIGURED' },
    acquisitionProgressPct: Math.round(acquisitionProgress * 100),
    compensationPendingRatioPct: Math.round(compRatio * 100),
    delaySignals: { avgDelayDays: Number(project.avgDelayDays || 0), p30Signal: Math.round(delayBands.thirtyDays*100), p60Signal: Math.round(delayBands.sixtyDays*100), p90Signal: Math.round(delayBands.ninetyDays*100) },
    riskVelocity,
    workflow,
    possessionReadiness: readiness,
    governance: {
      probabilityLabel: risk.overall != null ? 'Stored risk score' : 'Unavailable',
      notCausal: true,
      legalDecisionDelegated: true,
      humanDecisionRequired: true,
    },
  };
}

export function buildTimeline(project) {
  const now = new Date();
  const stage = Number(project?.stageIndex || 0);
  const base = new Date(now.getTime() - Math.max(1, stage + 1) * 20 * 86400000);
  const labels = ['Project registered','Acquisition stage entered','Current stage review','Current risk snapshot'];
  return labels.map((label,i)=>({ id:`EV-${project.id}-${i+1}`, label, occurredAt:new Date(base.getTime()+i*10*86400000).toISOString(), eventType:i===0?'PROJECT_REGISTERED':i===1?'STAGE_ENTERED':i===2?'STAGE_REVIEW':'RISK_SNAPSHOT', source:project?.source?.label || 'synthetic_demo' }));
}

export function buildEvidence(project) {
  const p = project;
  const evidence = [
    { id:'E-RISK', category:'MODEL', claim:`Stored risk output is ${p.risk?.overall ?? 'unavailable'}/100 (${p.risk?.band || 'unknown'}).`, source:'BhoomiDrishti risk engine', provenance:'DERIVED' },
    { id:'E-COMP', category:'COMPENSATION', claim:`${p.familiesPending ?? 0} of ${p.familiesAffected ?? 0} affected families are recorded as pending.`, source:p.source?.label || 'project record', provenance:classifySourceLabel(p.source?.label) },
    { id:'E-DOCS', category:'DOCUMENTATION', claim:`${p.docsMissing ?? 0} documents are recorded as missing/incomplete.`, source:p.source?.label || 'project record', provenance:classifySourceLabel(p.source?.label) },
    { id:'E-LEGAL', category:'LEGAL', claim:`${p.disputes ?? 0} disputes and ${p.courtCases ?? 0} court cases are recorded.`, source:p.source?.label || 'project record', provenance:classifySourceLabel(p.source?.label) },
  ];
  return evidence;
}
