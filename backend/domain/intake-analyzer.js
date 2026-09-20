import crypto from 'node:crypto';
import { resolveEntities } from './entity-resolution.js';
import { extractMultilingualFacts, classifyDocumentMultilingual, sectionSignalsMultilingual, detectLanguageProfile, normalizeUnicode } from './multilingual-intelligence.js';
import { languageIntegrityReport } from './language-integrity.js';

const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE_PATTERNS = [
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  new RegExp(`\\b${MONTHS}\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'gi'),
  /\b\d{4}-\d{2}-\d{2}\b/g,
];
const FIELD_RULES = [
  { key:'projectName', labels:['project name','name of project','project title'], regexes:[/(?:project name|name of project|project title)\s*[:\-]\s*([^\n]{3,120})/i] },
  { key:'state', labels:['state'], regexes:[/\bstate\s*[:\-]\s*([A-Z][A-Za-z .'-]{2,60})/i] },
  { key:'district', labels:['district'], regexes:[/\bdistrict\s*[:\-]\s*([A-Z][A-Za-z .'-]{2,60})/i] },
  { key:'village', labels:['village'], regexes:[/\bvillage\s*[:\-]\s*([^\n,;]{2,80})/i] },
  { key:'acquisitionType', labels:['type','project type','acquisition type'], regexes:[/(?:project type|acquisition type|type)\s*[:\-]\s*([^\n]{3,80})/i] },
];

function clean(s){ return String(s||'').replace(/\s+/g,' ').trim().replace(/[.;,:-]+$/,'').trim(); }
function parseDelimitedLine(line, delimiter=','){
  const out=[]; let cur='', quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++;}
      else quoted=!quoted;
    } else if(ch===delimiter && !quoted){out.push(cur.trim());cur='';}
    else cur+=ch;
  }
  out.push(cur.trim()); return out;
}
function structuredTextForDocument(document){
  const name=String(document?.name||'').toLowerCase(); const raw=String(document?.text||'');
  if(!raw.trim()) return raw;
  try{
    if(name.endsWith('.json')){
      const value=JSON.parse(raw);
      const rows=Array.isArray(value)?value:[value];
      return rows.map((row,i)=>{
        if(!row||typeof row!=='object') return String(row);
        return Object.entries(row).map(([k,v])=>{const value=Array.isArray(v)?v.join(', '):String(v??''); const label=String(k).replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2'); return `${k}: ${value}\n${label}: ${value}`;}).join('\n');
      }).join('\n===== RECORD =====\n');
    }
    if(name.endsWith('.ndjson')){
      return raw.split(/\r?\n/).filter(Boolean).map(line=>{
        try{return structuredTextForDocument({name:'data.json',text:line});}catch{return line;}
      }).join('\n===== RECORD =====\n');
    }
    if(name.endsWith('.csv') || name.endsWith('.tsv')){
      const delimiter=name.endsWith('.tsv')?'\\t':',';
      const rows=raw.split(/\r?\n/).filter(line=>line.trim());
      if(rows.length<2) return raw;
      const headers=parseDelimitedLine(rows[0],delimiter).map(h=>h.replace(/^\uFEFF/,'').trim());
      if(!headers.some(Boolean)) return raw;
      return rows.slice(1).map((line,rowIndex)=>{
        const cells=parseDelimitedLine(line,delimiter);
        return headers.map((h,i)=>{if(!h)return ''; const value=cells[i]??''; const label=String(h).replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2'); return `${h}: ${value}\n${label}: ${value}`;}).filter(Boolean).join('\n');
      }).join(`\n===== RECORD ${1} =====\n`);
    }
  }catch(_){ /* preserve raw text if structured parsing fails */ }
  return raw;
}

function classifyDocument(document){ return classifyDocumentMultilingual(document); }
function buildDocumentQuality(documents){
  const byHash=new Map(), byText=new Map(), items=[];
  for(const d of documents){
    const hash=String(d.sha256||'').toLowerCase();
    const textHash=hashText(String(d.text||'').replace(/\s+/g,' ').trim().toLowerCase());
    const duplicateOf=hash && byHash.has(hash) ? byHash.get(hash) : (byText.has(textHash) ? byText.get(textHash) : null);
    if(hash && !byHash.has(hash)) byHash.set(hash,d.name);
    if(!byText.has(textHash)) byText.set(textHash,d.name);
    const classification=classifyDocument(d);
    items.push({
      name:d.name,size:Number(d.size||0),sha256:d.sha256||null,
      parser:d.parser||'unknown',ocr:d.ocr||{used:false,engine:null,pages:0,reason:'not_reported'},
      classification,duplicateOf,reviewRequired:Boolean(duplicateOf)||classification.confidence<0.7||Number(String(d.text||'').replace(/\s/g,'').length)<40,
      languages:detectLanguageProfile(d.text||''),
      textChars:String(d.text||'').length,
    });
  }
  return {items,duplicates:items.filter(x=>x.duplicateOf).map(x=>({document:x.name,duplicateOf:x.duplicateOf})),
    reviewQueue:items.filter(x=>x.reviewRequired).map(x=>({document:x.name,reason:x.duplicateOf?'duplicate_document':x.classification.confidence<0.7?'low_classification_confidence':'low_text_extraction'}))};
}

function analysisDocuments(documents){
  return documents.map(d=>({...d,text:structuredTextForDocument(d)}));
}
function firstMatch(text, regexes){ for(const r of regexes){ const m=String(text||'').match(r); if(m?.[1]) return clean(m[1]); } return null; }
function firstMatchWithEvidence(text, regexes){ for(const r of regexes){ const m=String(text||'').match(r); if(m?.[1]){ const value=clean(m[1]); const start=Math.max(0,(m.index||0)-120); const end=Math.min(String(text||'').length,(m.index||0)+Math.max(m[0].length,120)+120); return {value,excerpt:clean(String(text||'').slice(start,end))}; } } return {value:null,excerpt:null}; }
function numberFrom(text, patterns){ for(const r of patterns){ const m=String(text||'').match(r); if(m){ const n=Number(String(m[1]).replace(/,/g,'')); if(Number.isFinite(n)) return n; } } return null; }
function percentFrom(text, patterns){ const n=numberFrom(text,patterns); return n==null?null:Math.max(0,Math.min(100,n)); }
function hashText(text){ return crypto.createHash('sha256').update(String(text||'')).digest('hex'); }
function collectDates(text){ const out=[]; for(const r of DATE_PATTERNS){ for(const m of String(text||'').matchAll(r)){ const d=Date.parse(m[0]); if(Number.isFinite(d)) out.push({raw:m[0],iso:new Date(d).toISOString()}); } } const seen=new Map(); out.forEach(x=>seen.set(x.raw,x)); return [...seen.values()].sort((a,b)=>a.iso.localeCompare(b.iso)); }

function sourceEvidence(documents, key, regexes){
  for(const d of documents){
    const hit=firstMatchWithEvidence(d.text||'',regexes);
    if(hit.value) return {field:key,value:hit.value,document:d.name,sha256:d.sha256||null,excerpt:hit.excerpt};
  }
  return null;
}
function uniqueValues(values){ return [...new Set(values.filter(v=>v!=null&&String(v).trim()!=='' ).map(v=>clean(v)))]; }
function conflictingEvidence(documents, field, regexes){
  const hits=[];
  for(const d of documents){ const hit=firstMatchWithEvidence(d.text||'',regexes); if(hit.value) hits.push({document:d.name,value:hit.value,sha256:d.sha256||null,excerpt:hit.excerpt}); }
  const vals=uniqueValues(hits.map(h=>h.value));
  return {field,values:vals,conflicted:vals.length>1,hits};
}
const MILESTONE_RULES=[
  {key:'proposal',label:'Proposal / schedule',rx:[/(?:proposal|land\s+schedule)[^\n]{0,80}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,/(?:proposal|land\s+schedule)\s*(?:date)?\s*[:=]\s*([^\n]{3,30})/i]},
  {key:'notification',label:'Preliminary notification',rx:[/(?:preliminary\s+)?notification[^\n]{0,80}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,/(?:notification)\s*(?:date)?\s*[:=]\s*([^\n]{3,30})/i]},
  {key:'declaration',label:'Declaration',rx:[/(?:declaration|declaration\s+under)[^\n]{0,80}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,/(?:declaration)\s*(?:date)?\s*[:=]\s*([^\n]{3,30})/i]},
  {key:'award',label:'Award',rx:[/(?:award|award\s+declared)[^\n]{0,80}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,/(?:award)\s*(?:date)?\s*[:=]\s*([^\n]{3,30})/i]},
  {key:'compensation',label:'Compensation',rx:[/(?:compensation|disbursement|payment)[^\n]{0,80}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i]},
  {key:'possession',label:'Possession',rx:[/(?:possession|handing\s+over)[^\n]{0,80}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,/(?:possession)\s*(?:date)?\s*[:=]\s*([^\n]{3,30})/i]},
  {key:'rr',label:'R&R milestone',rx:[/(?:rehabilitation|resettlement|R&R)[^\n]{0,80}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i]},
];
function buildMilestoneTimeline(documents){
  const events=[];
  for(const d of documents){
    const text=String(d.text||'');
    for(const rule of MILESTONE_RULES){
      for(const rx of rule.rx){
        const m=rx.exec(text); if(!m) continue;
        const raw=clean(m[1]); const parsed=Date.parse(raw); 
        events.push({key:rule.key,label:rule.label,rawDate:raw,isoDate:Number.isFinite(parsed)?new Date(parsed).toISOString():null,document:d.name,sha256:d.sha256||null,excerpt:clean(text.slice(Math.max(0,m.index-90),Math.min(text.length,m.index+m[0].length+100)))});
        break;
      }
    }
  }
  const seen=new Set();
  return events.filter(e=>{const k=`${e.key}|${e.document}|${e.rawDate}`; if(seen.has(k)) return false; seen.add(k); return true;}).sort((a,b)=>(a.isoDate||'9999').localeCompare(b.isoDate||'9999')).slice(0,80);
}
function buildReadiness({sections,missingCritical,approvalPct,resettlementPct,possession,disputes,conflicts,documents}){
  const evidence=(sections.reduce((a,s)=>a+(s.count>0?1:0),0)/sections.length)*100;
  const completeness=Math.max(0,100-(missingCritical.length*15));
  const governance=Math.max(0,100-(conflicts.filter(c=>c.conflicted).length*15));
  const legal=disputes>0?55:75;
  const approval=approvalPct==null?50:approvalPct;
  const rr=resettlementPct==null?50:resettlementPct;
  const possessionScore=possession==null?50:/completed|complete|taken/i.test(possession)?90:35;
  const score=Math.round((evidence*.18)+(completeness*.18)+(governance*.14)+(legal*.12)+(approval*.12)+(rr*.12)+(possessionScore*.14));
  return {score,components:{evidenceCoveragePct:Math.round(evidence),fieldCompletenessPct:Math.round(completeness),sourceConsistencyPct:Math.round(governance),legalReadinessPct:legal,approvalReadinessPct:Math.round(approval),rrReadinessPct:Math.round(rr),possessionReadinessPct:possessionScore},status:score>=80?'HIGH':score>=60?'MEDIUM':'LOW'};
}

function sectionSignals(text){ return sectionSignalsMultilingual(text); }
export function analyseProjectIntake({documents=[]}){
  const base=extractMultilingualFacts(documents);
  const docs=base.docs;
  const documentQuality=buildDocumentQuality(docs);
  const normalized=normalizeUnicode(base.text);
  const values=base.extracted;
  const fieldEvidence=base.fieldEvidence;
  const numeric=values;
  const totalParcels=numeric.totalParcels ?? null;
  const familiesAffected=numeric.familiesAffected ?? null;
  const compensationAmount=numeric.compensationAmount ?? null;
  const parcelsAcquired=numeric.parcelsAcquired ?? null;
  const familiesPending=numeric.familiesPending ?? null;
  const avgDelayDays=numeric.avgDelayDays ?? null;
  const docsMissing=numeric.docsMissing ?? null;
  const depts=numeric.depts ?? null;
  const prevDelays=numeric.prevDelays ?? null;
  const approvalPct=numeric.approvalPct==null?null:Math.max(0,Math.min(100,numeric.approvalPct));
  const resettlementPct=numeric.resettlementPct==null?null:Math.max(0,Math.min(100,numeric.resettlementPct));
  const disputes=numeric.disputes ?? null;
  const statusMatch=normalized.match(/\b(status|project status)\s*[:=]\s*(ongoing|completed|complete|closed|pending|in progress)\b/i);
  const possession=/\bpossession\s*(?:status)?\s*[:=]\s*(completed|complete|taken|pending|partial|not started)\b/i.exec(normalized)?.[1]||null;
  const dates=collectDates(normalized);
  const sections=base.sections;
  const conflicts=[
    conflictingEvidence(docs,'projectName',FIELD_RULES.find(f=>f.key==='projectName')?.regexes||[]),
    conflictingEvidence(docs,'state',FIELD_RULES.find(f=>f.key==='state')?.regexes||[]),
    conflictingEvidence(docs,'district',FIELD_RULES.find(f=>f.key==='district')?.regexes||[]),
    conflictingEvidence(docs,'village',FIELD_RULES.find(f=>f.key==='village')?.regexes||[]),
    conflictingEvidence(docs,'acquisitionType',FIELD_RULES.find(f=>f.key==='acquisitionType')?.regexes||[]),
  ];
  const milestoneTimeline=buildMilestoneTimeline(docs);
  const missingCritical=[];
  if(!values.projectName) missingCritical.push('project_name');
  if(!values.state) missingCritical.push('state');
  if(!values.district) missingCritical.push('district');
  if(totalParcels==null && base.parcelIds.length===0) missingCritical.push('parcel_count');
  if(familiesAffected==null && !sections.find(s=>s.key==='rr')?.count) missingCritical.push('affected_families');
  const evidenceCoverage=Math.round(Math.max(0,Math.min(100,(sections.reduce((a,s)=>a+(s.count>0?1:0),0)/sections.length)*100)));
  const chars=normalized.replace(/\s/g,'').length;
  const languageScore=Math.min(12,(base.language.languages?.length||0)*3);
  const extractionConfidence=Math.round(Math.max(0,Math.min(100, 35 + Math.min(35,Math.floor(chars/1200)) + Math.round(evidenceCoverage*0.3) + languageScore)));
  const signal={status:'CANDIDATE_ONLY',note:'Local evidence signal only. It is not a calibrated production delay probability and must not be presented as a validated ML prediction.',drivers:[]};
  if(disputes>0 || sections.find(s=>s.key==='legal')?.count>0 || base.cases.length) signal.drivers.push('legal_or_dispute_exposure');
  if(resettlementPct!=null && resettlementPct<80) signal.drivers.push('r_and_r_progress_gap');
  if(approvalPct!=null && approvalPct<80) signal.drivers.push('approval_progress_gap');
  if(possession && /pending|partial|not started/i.test(possession)) signal.drivers.push('possession_dependency');
  if(missingCritical.length>=3) signal.drivers.push('material_data_completeness_gap');
  if(base.parcelIds.length>0) signal.drivers.push('parcel_level_evidence_present');
  const completeness=Math.round(Math.max(0,Math.min(100,100-(missingCritical.length*15))));
  const readiness=buildReadiness({sections,missingCritical,approvalPct,resettlementPct,possession,disputes:disputes||0,conflicts,documents});
  const enrichedEvidence=[...fieldEvidence];
  if(base.notifications.length) enrichedEvidence.push({field:'notifications',value:`${base.notifications.length} statutory notification/declaration references`,document:base.notifications[0].document,confidence:0.78,derived:true,excerpt:base.notifications[0].excerpt});
  if(base.cases.length) enrichedEvidence.push({field:'courtCases',value:`${base.cases.length} court/legal reference(s)`,document:base.cases[0].document,confidence:0.82,derived:true,excerpt:base.cases[0].excerpt});
  if(base.parcelIds.length) enrichedEvidence.push({field:'parcelIdentifiers',value:`${new Set(base.parcelIds.map(x=>x.value)).size} candidate parcel/group identifiers`,document:base.parcelIds[0].document,confidence:0.74,derived:true,excerpt:base.parcelIds[0].excerpt});
  const entityResolution=resolveEntities({documents:docs,projectDraft:{name:values.projectName,status:statusMatch?.[2]||null},extracted:{...values,totalParcels,familiesAffected,compensationAmount,approvalPct,resettlementPct,disputes,possession},fieldEvidence:enrichedEvidence,milestoneTimeline});
  const projectDraft={
    name:values.projectName || (documents[0]?.name ? clean(documents[0].name.replace(/\.[^.]+$/,'')) : 'New acquisition project'),
    code:`INTAKE-${hashText(normalized).slice(0,8).toUpperCase()}`, type:values.acquisitionType||'Land Acquisition', state:values.state||'Unassigned', district:values.district||'Unassigned',
    totalParcels:totalParcels||base.parcelIds.length, parcelsAcquired:parcelsAcquired||0, familiesAffected:familiesAffected||0, familiesPending:familiesPending||0,
    avgDelayDays:avgDelayDays||0, disputes:disputes||0, courtCases:disputes||base.cases.length, approvalPct:approvalPct||0, docsMissing:docsMissing||0,
    resettlementPct:resettlementPct||0, rehabPct:resettlementPct||0, depts:depts||0, prevDelays:prevDelays||0, stageIndex:0, status:/completed|complete|closed/i.test(statusMatch?.[2]||'')?'completed':'ongoing',
    latitude:numberFrom(normalized,[/(?:project\s*)?latitude\s*[:=]\s*(-?\d+(?:\.\d+)?)/i]), longitude:numberFrom(normalized,[/(?:project\s*)?longitude\s*[:=]\s*(-?\d+(?:\.\d+)?)/i]), locationPrecision:'PROJECT_POINT', locationConfirmed:false, sourceLabel:'user_uploaded', sourceId:`intake-${hashText(normalized).slice(0,12)}`,
  };
  const languageIntegrity=languageIntegrityReport(normalized);
  return {schemaVersion:'1.2',analysisVersion:'intake-rules-v3-multilingual-language-integrity',generatedAt:new Date().toISOString(),analysisMode:'local-first-multilingual',sourceClassification:'USER_UPLOADED / NOT_GOVERNMENT_VERIFIED',languageProfile:base.language,
    projectDraft, extracted:{...values,totalParcels,parcelsAcquired,familiesAffected,familiesPending,compensationAmount,approvalPct,resettlementPct,disputes,possession,avgDelayDays,docsMissing,depts,prevDelays,status:statusMatch?.[2]||null},
    dateCandidates:dates.slice(0,60), notifications:base.notifications.slice(0,80), legalCases:base.cases.slice(0,80), parcelEvidence:base.parcelIds.slice(0,120),
    sections, completenessPct:completeness,evidenceCoveragePct:evidenceCoverage,extractionConfidencePct:extractionConfidence,missingCritical,candidateSignal:signal,fieldEvidence:enrichedEvidence,conflicts,milestoneTimeline,entityResolution,evidenceGraph:entityResolution,acquisitionReadiness:readiness,
    provenance:documents.map(d=>({name:d.name,size:d.size,type:d.type,sha256:d.sha256,textChars:String(d.text||'').length,parser:d.parser||'browser',ocr:d.ocr||null,source:'user_uploaded',languages:detectLanguageProfile(d.text||'')})),documentQuality,
    integrity:{combinedTextSha256:hashText(normalized),documentCount:documents.length},
    languageIntegrity,
    warnings:['Language integrity gate: source text is preserved; no automatic legal translation or interpretation is applied.',...(languageIntegrity.requiresHumanReview?['Language identification or mixed-language evidence requires human verification before operational use.']:[]),'Uploaded content is not treated as authoritative government data until provenance and authorization are recorded.','Fields inferred from text require human verification before they become operational project records.','No production ML probability is generated by this intake step.',`Multilingual extraction profile: ${base.language.languages?.map(x=>x.name).slice(0,6).join(', ')||'undetermined'}.`,`OCR is fallback-only for image/scanned pages; embedded text is preserved when available.`,...(documents.filter(d=>String(d.text||'').trim().length<200).map(d=>`Low extracted text in ${d.name}; the file may be scanned/image-only and needs OCR.`))]};
}
