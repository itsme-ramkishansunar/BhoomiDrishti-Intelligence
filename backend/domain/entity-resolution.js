import crypto from 'node:crypto';

function norm(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\b(sri|mr|mrs|ms|shri|sm)\b\.?/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
function similarity(a,b){
  const na=norm(a), nb=norm(b); if(!na||!nb) return 0; if(na===nb) return 1; if(na.includes(nb)||nb.includes(na)) return 0.92;
  const aa=new Set(na.split(' ')), bb=new Set(nb.split(' ')); const inter=[...aa].filter(x=>bb.has(x)).length; const union=new Set([...aa,...bb]).size; return union?inter/union:0;
}
function addEntity(entities,type,value,source,confidence,metadata={}) {
  const clean=String(value??'').trim(); if(!clean) return null;
  const key=`${type}:${norm(clean)}`; let e=entities.find(x=>x.key===key);
  if(!e){e={id:`ENT-${crypto.createHash('sha1').update(key).digest('hex').slice(0,12)}`,key,type,value:clean,normalizedValue:norm(clean),confidence,sourceDocuments:[],metadata};entities.push(e);}
  if(source && !e.sourceDocuments.includes(source)) e.sourceDocuments.push(source); e.confidence=Math.min(e.confidence,confidence); return e;
}

function normalizeCaseNumber(value=''){const map={'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9'};return String(value).replace(/[०-९]/g,ch=>map[ch]);}

export function resolveEntities({documents=[],projectDraft={},extracted={},fieldEvidence=[],milestoneTimeline=[]}={}) {
  const entities=[],edges=[], conflicts=[];
  const project=addEntity(entities,'project',projectDraft.name||extracted.projectName,'intake',0.78,{status:projectDraft.status||null});
  for(const e of fieldEvidence){const x=addEntity(entities,`field:${e.field}`,e.value,e.document,0.72,{excerpt:e.excerpt||null});if(project&&x)edges.push({from:project.id,to:x.id,type:'SUPPORTED_BY_FIELD',confidence:0.72});}
  for(const [field,value] of Object.entries({state:extracted.state,district:extracted.district,village:extracted.village,acquisitionType:extracted.acquisitionType})){const x=addEntity(entities,field,value,'intake',0.78);if(project&&x)edges.push({from:project.id,to:x.id,type:'HAS_ATTRIBUTE',confidence:0.78});}
  const patterns={
    survey_number:/(?:\b(?:survey|sur\.?)\s*(?:no\.?|number)?|सर्वे(?:\s*क्रमांक)?|सर्वे नंबर|गट(?:\s*क्रमांक)?|group(?:\s*no\.?)?)\s*[:#.-]?\s*([A-Za-z0-9\/\-\.]{1,40})/giu,
    khasra_number:/(?:\b(?:khasra)\s*(?:no\.?|number)?|खसरा(?:\s*क्रमांक)?|खसरा नंबर)\s*[:#.-]?\s*([A-Za-z0-9\/\-\.]{1,40})/giu,
    ulpin:/(?:\b(?:ulpin|bhu[- ]?aadhaar)|भू-?आधार|भू आधार)\s*[:#.-]?\s*([A-Z0-9-]{6,40})/giu,
    case_number:/(?:\b(?:case(?:\s+no\.?)?|cnr|civil suit|special civil suit|regular civil suit)|दावा\s*क्रमांक|खटला\s*क्रमांक|केस\s*नंबर|प्रकरण\s*क्रमांक)\s*[:#.-]?\s*([A-Z0-9\/\-\.]{3,50})/giu,
  };
  for(const [kind,rx] of Object.entries(patterns)) for(const d of documents){ for(const m of String(d.text||'').matchAll(rx)){const x=addEntity(entities,kind,m[1],d.name,0.68);if(project&&x)edges.push({from:project.id,to:x.id,type:kind==='case_number'?'HAS_CASE':'HAS_IDENTIFIER',confidence:0.68});}}
  for(const m of milestoneTimeline){const x=addEntity(entities,'milestone',`${m.label} | ${m.rawDate}`,m.document,m.isoDate?0.82:0.55,{key:m.key,isoDate:m.isoDate});if(project&&x)edges.push({from:project.id,to:x.id,type:'HAS_MILESTONE',confidence:x.confidence});}
  const legalRx=/(?:special civil suit|regular civil suit|civil suit|writ petition|stay order|न्यायालयीन प्रकरण|दावा|खटला|प्रकरण|court case)[^\n]{0,100}/giu;
  const caseNoRx=/(?:special[\s\S]{0,80}?civil[\s\S]{0,80}?suit|regular[\s\S]{0,80}?civil[\s\S]{0,80}?suit|स्पेशल[\s\S]{0,80}?सूट|रेग्युलर[\s\S]{0,80}?सूट)[\s\S]{0,60}?(?:no\.?|number|क्र\.?|क्रमांक|नं\.?)\s*[:.-]?\s*([0-9०-९]+[\/\-][0-9०-९]+)/giu;
  const compensationRx=/(?:compensation|award amount|payment|disbursement|मोबदला|नुकसानभरपाई|मुआवजा|क्षतिपूर्ति)[^\n]{0,100}/giu;
  const parcelRx=/(?:survey|sur\.?|khasra|group|gat|parcel|plot|सर्वे|गट|खसरा|सर्वे क्रमांक|गट क्रमांक)\s*(?:no\.?|number|क्रमांक|क्र\.?)?\s*[:#.-]?\s*([A-Za-z0-9\/\-\.]{1,40})/giu;
  for(const d of documents){
    for(const m of String(d.text||'').matchAll(legalRx)){const x=addEntity(entities,'legal_reference',m[0],d.name,0.78);if(project&&x)edges.push({from:project.id,to:x.id,type:'HAS_LEGAL_REFERENCE',confidence:x.confidence});}
    for(const m of String(d.text||'').matchAll(caseNoRx)){const x=addEntity(entities,'case_number',m[1],d.name,0.86,{normalized:normalizeCaseNumber(m[1])});if(project&&x)edges.push({from:project.id,to:x.id,type:'HAS_CASE',confidence:x.confidence});}
    for(const m of String(d.text||'').matchAll(compensationRx)){const x=addEntity(entities,'compensation_reference',m[0],d.name,0.70);if(project&&x)edges.push({from:project.id,to:x.id,type:'HAS_COMPENSATION_REFERENCE',confidence:x.confidence});}
    for(const m of String(d.text||'').matchAll(parcelRx)){const x=addEntity(entities,'parcel_reference',m[1],d.name,0.74);if(project&&x)edges.push({from:project.id,to:x.id,type:'HAS_PARCEL',confidence:x.confidence});}
  }
  for(const field of ['state','district','village']){
    const vals=[]; for(const d of documents){const hit=new RegExp(`\\b${field}\\s*[:\\-]\\s*([^\\n,;]{2,80})`,'i').exec(d.text||'');if(hit?.[1])vals.push({value:hit[1].trim(),document:d.name});}
    const uniq=[]; for(const v of vals){if(!uniq.some(u=>similarity(u.value,v.value)>=0.92))uniq.push(v);} if(uniq.length>1)conflicts.push({field,values:uniq.map(x=>x.value),documents:uniq.map(x=>x.document),severity:'high'});
  }
  return {version:'entity-resolution-v2-multilingual',method:'deterministic-normalization-and-evidence-linking',entityCount:entities.length,edgeCount:edges.length,entities,edges,conflicts,matchPolicy:{exact:1,containment:0.92,tokenSimilarity:'jaccard',humanReviewBelow:0.85},warnings:['Entity matches are candidate links, not authoritative identity assertions.','Conflicting records require human verification before operational use.']};
}
