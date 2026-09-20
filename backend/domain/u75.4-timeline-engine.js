/**
 * U75.4 Statutory / Configured Timeline Intelligence
 * Uses configured project-stage clocks and recorded events. Missing authority or
 * jurisdictional configuration is reported rather than invented.
 */
export const U75_4_TIMELINE_VERSION='u75.4-statutory-timeline-engine-v1';

const DAY=86400000;
function daysBetween(a,b=new Date()){const x=new Date(a).getTime(),y=new Date(b).getTime();return Number.isFinite(x)&&Number.isFinite(y)?Math.max(0,Math.round((y-x)/DAY)):null;}
export function buildStatutoryTimeline(project,stages=[],events=[]){
  const now=new Date();
  const stageRows=(stages||[]).map(s=>{
    const entered=s.enteredAt||null, completed=s.completedAt||null, target=s.targetDays==null?null:Number(s.targetDays);
    const elapsed=entered?daysBetween(entered,completed||now):null;
    const variance=elapsed!=null&&target!=null?elapsed-target:null;
    let state=s.state||'pending';
    if(completed) state='completed'; else if(entered) state='active';
    return {...s,state,elapsedDays:elapsed,targetDays:target,varianceDays:variance,
      overdue:variance!=null?variance>0:false,clockStatus:target==null?'NOT_CONFIGURED':(variance!=null?(variance>0?'OVERDUE':'WITHIN_TARGET'):'TRACKING'),
      evidenceSource:s.statutoryClockSource||null};
  });
  const active=stageRows.find(s=>s.state==='active')||stageRows.find(s=>Number(s.stageIndex)===Number(project.stageIndex))||null;
  const configured=stageRows.filter(s=>s.targetDays!=null).length>0;
  return {version:U75_4_TIMELINE_VERSION,generatedAt:now.toISOString(),projectId:project.id,
    workflowCode:project.acquisitionProfile||null,jurisdiction:{state:project.state,district:project.district},
    configurationStatus:configured?'CONFIGURED':'NOT_CONFIGURED',activeStage:active,
    stages:stageRows,events:events||[],
    projectPlan:{plannedDays:project.plannedDays??null,actualDays:project.actualDays??null,varianceDays:(project.plannedDays!=null&&project.actualDays!=null?Number(project.actualDays)-Number(project.plannedDays):null)},
    disclaimer:'Timeline intelligence uses configured project-stage clocks and recorded events. It does not invent statutory deadlines or determine legal compliance where authoritative configuration is unavailable.'};
}
