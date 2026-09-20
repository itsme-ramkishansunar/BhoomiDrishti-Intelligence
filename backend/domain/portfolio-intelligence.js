export const PORTFOLIO_INTELLIGENCE_VERSION = 'portfolio-intelligence-v1';

const clamp = (v,min,max) => Math.max(min, Math.min(max, Number(v)||0));

function pct(n,d){ return d ? Math.round((n/d)*100) : 0; }

export function buildPortfolioIntelligence(projects=[], {alerts=[], actions=[], feedback=[], readiness=null, monitoring=null, connectors=[]}={}) {
  const ongoing = projects.filter(p=>p.status !== 'completed');
  const completed = projects.filter(p=>p.status === 'completed');
  const high = projects.filter(p=>p.risk?.band === 'high');
  const medium = projects.filter(p=>p.risk?.band === 'medium');
  const openAlerts = alerts.filter(a=>['open','acknowledged'].includes(String(a.status)));
  const pendingActions = actions.filter(a=>!['resolved','closed'].includes(String(a.status)));
  const verifiedFeedback = feedback.filter(f=>String(f.verificationStatus||'').toLowerCase()==='verified');

  const stageMap = new Map();
  for (const p of projects) {
    const stage = p.stageName || p.stage || `Stage ${Number(p.stageIndex||0)+1}`;
    const row = stageMap.get(stage) || {stage, projects:0, high:0, riskSum:0, delaySum:0};
    row.projects += 1; row.high += p.risk?.band==='high' ? 1 : 0; row.riskSum += Number(p.risk?.overall||0); row.delaySum += Number(p.avgDelayDays||0); stageMap.set(stage,row);
  }
  const stages = [...stageMap.values()].map(x=>({...x,avgRisk:x.projects?Math.round(x.riskSum/x.projects):0,avgDelayDays:x.projects?Math.round(x.delaySum/x.projects):0,highPct:pct(x.high,x.projects)})).sort((a,b)=>b.avgRisk-a.avgRisk);

  const stateMap = new Map();
  for (const p of ongoing) {
    const state = p.state || 'Unassigned';
    const row = stateMap.get(state) || {state,projects:0,high:0,riskSum:0,familiesPending:0,disputes:0};
    row.projects += 1; row.high += p.risk?.band==='high'?1:0; row.riskSum += Number(p.risk?.overall||0); row.familiesPending += Number(p.familiesPending||0); row.disputes += Number(p.disputes||0); stateMap.set(state,row);
  }
  const states=[...stateMap.values()].map(x=>({...x,avgRisk:x.projects?Math.round(x.riskSum/x.projects):0,highPct:pct(x.high,x.projects)})).sort((a,b)=>b.avgRisk-a.avgRisk);

  const interventionQueue = projects.map(p=>{
    const risk=Number(p.risk?.overall||0);
    const pressure = clamp(risk*0.7 + clamp(Number(p.familiesPending||0)/Math.max(Number(p.familiesAffected||1),1)*100,0,100)*0.15 + clamp(Number(p.disputes||0)*12,0,100)*0.15,0,100);
    return {projectId:p.id,projectName:p.name,code:p.code,state:p.state,district:p.district,risk,band:p.risk?.band||'unknown',attentionScore:Math.round(pressure),primaryDriver:p.risk?.bottleneck?.label||'Review required',recommendedAction:p.risk?.recommendedActions?.[0]||'Review project evidence and current blockers.'};
  }).sort((a,b)=>b.attentionScore-a.attentionScore).slice(0,20);

  const sourceHealth = connectors.map(c=>({id:c.id,name:c.name,owner:c.owner,accessMode:c.accessMode,health:c.health||'never_synced',lastFetchedAt:c.latest?.fetchedAt||null,sourceType:c.sourceType,url:c.url}));

  return {
    version:PORTFOLIO_INTELLIGENCE_VERSION,
    generatedAt:new Date().toISOString(),
    summary:{projects:projects.length,ongoing:ongoing.length,completed:completed.length,highRisk:high.length,mediumRisk:medium.length,lowRisk:projects.length-high.length-medium.length,openAlerts:openAlerts.length,pendingActions:pendingActions.length,verifiedFeedback:verifiedFeedback.length,completionPct:pct(completed.length,projects.length)},
    stageBottlenecks:stages.slice(0,12),
    stateRisk:states.slice(0,20),
    interventionQueue,
    sourceHealth,
    governance:{productionPromotionAllowed:Boolean(readiness?.productionPromotionAllowed),gateStatus:readiness?.gate?.status||'BLOCKED',modelStatus:monitoring?.status||null,driftStatus:monitoring?.latestSnapshot?.driftStatus||'NOT_AVAILABLE',calibrationError:monitoring?.latestSnapshot?.calibrationError??null,oodRate:monitoring?.latestSnapshot?.oodRate??null},
    trust:{candidateIntelligenceOnly:readiness?.productionPromotionAllowed!==true,warningLeadTime:monitoring?.warningLeadTime||'NOT_VALIDATED',message:'Operational risk signals are decision support. Production probability claims require authorised historical outcome data and completed governance gates.'}
  };
}
