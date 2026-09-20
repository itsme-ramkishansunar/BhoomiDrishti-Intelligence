import crypto from 'node:crypto';

const ORDER = ['proposal','notification','declaration','award','compensation','possession','rr'];

function asIso(value){
  if(!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function hash(value){ return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }

export function reconcileTemporalEvidence({canonical={}, asOf=null}={}) {
  const requestedAsOf = asIso(asOf) || new Date().toISOString();
  const events = Array.isArray(canonical.timeline) ? canonical.timeline.filter(e=>e?.isoDate).map((e,i)=>({
    id:`TE-${i+1}`,
    key:String(e.key||'unknown'),
    label:String(e.label||e.key||'Event'),
    eventTime:asIso(e.isoDate),
    sourceDocument:String(e.document||'unknown'),
    sha256:e.sha256||null,
    excerpt:e.excerpt||null,
    sourceType:'USER_UPLOADED',
  })).sort((a,b)=>a.eventTime.localeCompare(b.eventTime)) : [];

  const included = events.filter(e=>e.eventTime<=requestedAsOf);
  const futureExcluded = events.filter(e=>e.eventTime>requestedAsOf);
  const conflicts=[];
  const grouped = new Map();
  for(const e of included){ if(!grouped.has(e.key)) grouped.set(e.key,[]); grouped.get(e.key).push(e); }
  for(const [key,rows] of grouped){
    const dates=[...new Set(rows.map(r=>r.eventTime))];
    if(dates.length>1){
      conflicts.push({type:'MULTIPLE_DATES',key,dates,documents:[...new Set(rows.map(r=>r.sourceDocument))],severity:'REVIEW'});
    }
  }
  let prev=null;
  for(const e of included){
    const idx=ORDER.indexOf(e.key);
    if(idx<0) continue;
    if(prev && idx<prev.orderIndex){
      conflicts.push({type:'CHRONOLOGY_INVERSION',earlierExpected:prev.key,laterObserved:e.key,earlierDate:prev.eventTime,laterDate:e.eventTime,documents:[prev.sourceDocument,e.sourceDocument],severity:'REVIEW'});
    } else prev={key:e.key,orderIndex:idx,eventTime:e.eventTime,sourceDocument:e.sourceDocument};
  }
  const snapshotEvents=[];
  for(const key of ORDER){
    const rows=grouped.get(key)||[];
    if(rows.length) snapshotEvents.push(rows[rows.length-1]);
  }
  const milestoneState={};
  for(const e of snapshotEvents) milestoneState[e.key]={eventTime:e.eventTime,sourceDocument:e.sourceDocument,sha256:e.sha256};
  const chronology=[];
  for(let i=1;i<snapshotEvents.length;i++) chronology.push({from:snapshotEvents[i-1].key,to:snapshotEvents[i].key,days:daysBetween(snapshotEvents[i-1].eventTime,snapshotEvents[i].eventTime)});
  const incomplete=ORDER.filter(k=>!milestoneState[k]);
  const quality = Math.max(0, Math.round(100 - conflicts.length*20 - incomplete.length*5));
  const snapshot={schemaVersion:'temporal-evidence-v1',asOf:requestedAsOf,events:snapshotEvents,milestoneState,chronology,conflicts,incompleteMilestones:incomplete,futureExcludedCount:futureExcluded.length,governance:{authoritative:false,availabilityPolicy:'event-time snapshot only; source availability time is not asserted when unavailable',userUploadedDocuments:events.filter(e=>e.sourceType==='USER_UPLOADED').length},quality:{qualityPct:quality,conflictCount:conflicts.length,incompleteMilestoneCount:incomplete.length}};
  return {...snapshot,snapshotSha256:hash(snapshot)};
}
