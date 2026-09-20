/**
 * U75.3 Scenario / What-if Intelligence
 * Uses the existing transparent risk engine against a cloned project record.
 * Scenario values never mutate the project itself.
 */
import { computeRisk } from '../risk-engine.js';

export const U75_3_SCENARIO_VERSION='u75.3-governed-scenario-engine-v1';

const NUMERIC_FIELDS=['avgDelayDays','familiesPending','familiesAffected','disputes','courtCases','approvalPct','docsMissing','resettlementPct','rehabPct','depts','prevDelays','plannedDays','actualDays'];

export function normalizeScenarioChanges(changes={}){
  const out={};
  for(const key of NUMERIC_FIELDS){
    if(changes[key]===undefined || changes[key]===null || changes[key]==='') continue;
    const n=Number(changes[key]); if(Number.isFinite(n)) out[key]=n;
  }
  return out;
}
export function simulateScenario(project,changes={}){
  const normalized=normalizeScenarioChanges(changes);
  const baseProject={...project};
  const scenarioProject={...project,...normalized};
  const baseRisk=computeRisk(baseProject);
  const scenarioRisk=computeRisk(scenarioProject);
  const delta=scenarioRisk.overall-baseRisk.overall;
  const changedFields=Object.keys(normalized).map(field=>({field,from:baseProject[field],to:scenarioProject[field]}));
  return {version:U75_3_SCENARIO_VERSION,generatedAt:new Date().toISOString(),projectId:project.id,
    scenario:{changes:normalized,changedFields},actualState:{risk:baseRisk.overall,band:baseRisk.band},
    simulatedState:{risk:scenarioRisk.overall,band:scenarioRisk.band},
    delta,drivers:scenarioRisk.drivers.slice(0,4),
    disclaimer:'Scenario simulation only. It is not a prediction of actual future outcome, does not alter project facts, and does not establish causal effect.'};
}
