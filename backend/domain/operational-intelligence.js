export const OPERATIONAL_INTELLIGENCE_VERSION = 'operational-intelligence-v1';

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Number(n) || 0)); }
function severityFor(score) { if (score >= 85) return 'critical'; if (score >= 70) return 'high'; if (score >= 50) return 'medium'; return 'low'; }

export function buildEarlyWarning(project) {
  const p = project || {};
  const risk = Number(p.risk?.overall ?? 0);
  const compensation = Number(p.risk?.categories?.compensation ?? 0);
  const legal = Number(p.risk?.categories?.legal ?? 0);
  const documentation = Number(p.risk?.categories?.documentation ?? 0);
  const approval = Number(p.risk?.categories?.approval ?? 0);
  const rework = Number(p.prevDelays ?? 0);
  const silence = clamp(Number(p.avgDelayDays ?? 0) * 0.8, 0, 100);
  const urgency = clamp(risk * 0.55 + compensation * 0.18 + documentation * 0.1 + legal * 0.08 + approval * 0.05 + rework * 2 + silence * 0.04, 0, 100);
  const primary = [
    ['compensation', compensation], ['legal', legal], ['documentation', documentation],
    ['approval', approval], ['process_silence', silence], ['administrative', Number(p.risk?.categories?.administrative ?? 0)]
  ].sort((a,b)=>b[1]-a[1])[0];
  const actionability = clamp((100 - Number(p.approvalPct ?? 0)) * 0.55 + Number(p.docsMissing ?? 0) * 0.9 + Number(p.familiesPending ?? 0) * 0.08, 0, 100);
  const attentionScore = clamp(urgency * 0.72 + actionability * 0.28, 0, 100);
  const warningWindowDays = null;
  return {
    version: OPERATIONAL_INTELLIGENCE_VERSION,
    projectId: String(p.id),
    projectName: p.name,
    attentionScore: Math.round(attentionScore * 10) / 10,
    severity: severityFor(attentionScore),
    primarySignal: primary?.[0] || 'risk',
    ruleBased: true,
    warningWindowDays,
    warningWindowStatus: 'NOT_AVAILABLE',
    why: {
      risk,
      compensation,
      legal,
      documentation,
      approval,
      eventSilenceSignal: Math.round(silence * 10) / 10,
      priorDelaySignal: rework
    },
    nextAction: p.risk?.recommendedActions?.[0] || 'Review the current project evidence and verify the active bottleneck.',
    disclaimer: 'Rule-based operational warning. It is not a calibrated ML probability and does not establish causality.'
  };
}

export function buildOperationalOverview(projects, {alerts=[]}={}) {
  const warnings = (projects || []).filter(p=>p.status === 'ongoing').map(buildEarlyWarning).sort((a,b)=>b.attentionScore-a.attentionScore);
  const openAlerts = (alerts || []).filter(a=>a.status === 'open' || a.status === 'acknowledged');
  const productionModel = Boolean(projects?.__productionModel || false);
  return {
    version: OPERATIONAL_INTELLIGENCE_VERSION,
    generatedAt: new Date().toISOString(),
    warnings: warnings.slice(0, 25),
    summary: {
      projectsAnalysed: warnings.length,
      highOrCritical: warnings.filter(w=>['high','critical'].includes(w.severity)).length,
      openAlerts: openAlerts.length,
      productionModelAvailable: productionModel
    },
    trust: {
      warningLeadTime: 'NOT_AVAILABLE',
      modelCalibration: productionModel ? 'REPORTED_BY_APPROVED_MODEL' : 'NOT_AVAILABLE',
      causalInference: false
    }
  };
}

export function buildModelMonitoringStatus({readiness=null, latestSnapshot=null}={}) {
  const blocked = readiness?.gate?.productionPromotionAllowed !== true;
  return {
    status: blocked ? 'BLOCKED_UNTIL_VALIDATED' : 'MONITORING_READY',
    productionPromotionAllowed: !blocked,
    latestSnapshot: latestSnapshot || null,
    required: ['prediction_coverage','calibration','false_alert_rate','ood_rate','outcome_action_rate','drift']
  };
}
