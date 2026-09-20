import crypto from 'node:crypto';

// U72.2: India-wide multilingual acquisition intelligence. These are extraction
// hints, not translations or authoritative legal interpretations.
export const INDIA_LANGUAGE_PROFILES = [
  {code:'as',name:'Assamese',scripts:['Bengali'],terms:['জিলা','গাঁও','মাটি অধিগ্ৰহণ','ক্ষতিপূৰণ','জাননী','আদালত']},
  {code:'bn',name:'Bengali',scripts:['Bengali'],terms:['জেলা','গ্রাম','ভূমি অধিগ্রহণ','ক্ষতিপূরণ','বিজ্ঞপ্তি','আদালত']},
  {code:'brx',name:'Bodo',scripts:['Devanagari'],terms:['जिलाफोर','हाग्रा','बिदा','हाग्रानाय']},
  {code:'doi',name:'Dogri',scripts:['Devanagari'],terms:['जिला','गांऽ','जमीन','मुआवजा','अदालत']},
  {code:'gu',name:'Gujarati',scripts:['Gujarati'],terms:['જિલ્લો','ગામ','જમીન સંપાદન','વળતર','નોટિસ','કોર્ટ']},
  {code:'hi',name:'Hindi',scripts:['Devanagari'],terms:['जिला','ग्राम','भूमि अधिग्रहण','मुआवजा','अधिसूचना','न्यायालय','आपत्ति','पुनर्वास']},
  {code:'kn',name:'Kannada',scripts:['Kannada'],terms:['ಜಿಲ್ಲೆ','ಗ್ರಾಮ','ಭೂಸ್ವಾಧೀನ','ಪರಿಹಾರ','ಅಧಿಸೂಚನೆ','ನ್ಯಾಯಾಲಯ']},
  {code:'ks',name:'Kashmiri',scripts:['Arabic','Devanagari'],terms:['ضلع','گام','زمین','معاوضہ','عدالت']},
  {code:'kok',name:'Konkani',scripts:['Devanagari'],terms:['जिल्हो','गांव','जमीन','मोबदलो','नोटीस','न्यायालय']},
  {code:'mai',name:'Maithili',scripts:['Devanagari'],terms:['जिला','गाम','भूमि','मुआवजा','अधिसूचना','न्यायालय']},
  {code:'ml',name:'Malayalam',scripts:['Malayalam'],terms:['ജില്ല','ഗ്രാമം','ഭൂമി ഏറ്റെടുക്കൽ','നഷ്ടപരിഹാരം','അറിയിപ്പ്','കോടതി']},
  {code:'mni',name:'Manipuri',scripts:['Bengali'],terms:['জিলা','নোংমা','লৌমী','শেমদোকপা','কোর্ট']},
  {code:'mr',name:'Marathi',scripts:['Devanagari'],terms:['जिल्हा','तालुका','गाव','भूसंपादन','भूसंपादन','मोबदला','नुकसानभरपाई','अधिसूचना','न्यायालय','हरकत','पुनर्वसन','ताबा','मोजणी','गट क्रमांक']},
  {code:'ne',name:'Nepali',scripts:['Devanagari'],terms:['जिल्ला','गाउँ','भूमि अधिग्रहण','मुआब्जा','सूचना','अदालत','क्षतिपूर्ति','पुनर्वास']},
  {code:'or',name:'Odia',scripts:['Odia'],terms:['ଜିଲ୍ଲା','ଗ୍ରାମ','ଭୂମି ଅଧିଗ୍ରହଣ','କ୍ଷତିପୂରଣ','ବିଜ୍ଞପ୍ତି','ଅଦାଲତ']},
  {code:'pa',name:'Punjabi',scripts:['Gurmukhi'],terms:['ਜ਼ਿਲ੍ਹਾ','ਪਿੰਡ','ਜ਼ਮੀਨ ਅਧਿਗ੍ਰਹਿਣ','ਮੁਆਵਜ਼ਾ','ਨੋਟਿਸ','ਅਦਾਲਤ']},
  {code:'sa',name:'Sanskrit',scripts:['Devanagari'],terms:['जिला','ग्रामः','भूमि','अधिग्रहणम्','प्रतिपूर्तिः','न्यायालयः']},
  {code:'sat',name:'Santali',scripts:['Ol Chiki','Devanagari'],terms:['ᱡᱤᱞᱟ','ᱜᱟᱶ','ᱡᱟᱭᱜᱟ','ᱠᱚᱴ']},
  {code:'sd',name:'Sindhi',scripts:['Arabic','Devanagari'],terms:['ضلع','ڳوٺ','زمين','معاوضو','عدالت']},
  {code:'ta',name:'Tamil',scripts:['Tamil'],terms:['மாவட்டம்','கிராமம்','நிலம் கையகப்படுத்தல்','இழப்பீடு','அறிவிப்பு','நீதிமன்றம்']},
  {code:'te',name:'Telugu',scripts:['Telugu'],terms:['జిల్లా','గ్రామం','భూసేకరణ','పరిహారం','నోటిఫికేషన్','న్యాయస్థానం']},
  {code:'ur',name:'Urdu',scripts:['Arabic'],terms:['ضلع','گاؤں','اراضی حصول','معاوضہ','نوٹیفکیشن','عدالت']},
];

const SCRIPT_RULES = [
  ['Devanagari', /[\u0900-\u097F]/g], ['Bengali', /[\u0980-\u09FF]/g],
  ['Gurmukhi', /[\u0A00-\u0A7F]/g], ['Gujarati', /[\u0A80-\u0AFF]/g],
  ['Odia', /[\u0B00-\u0B7F]/g], ['Tamil', /[\u0B80-\u0BFF]/g],
  ['Telugu', /[\u0C00-\u0C7F]/g], ['Kannada', /[\u0C80-\u0CFF]/g],
  ['Malayalam', /[\u0D00-\u0D7F]/g], ['Arabic', /[\u0600-\u06FF]/g],
  ['Ol Chiki', /[\u1C50-\u1C7F]/g], ['Latin', /[A-Za-z]/g],
];

export function normalizeUnicode(text='') {
  return String(text).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,' ');
}

export function detectLanguageProfile(text='') {
  const raw=normalizeUnicode(text), lower=raw.toLowerCase();
  const scripts=SCRIPT_RULES.map(([name,rx])=>({name,count:(raw.match(rx)||[]).length})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
  const scriptDominant=scripts[0]?.name||null;
  const scores=INDIA_LANGUAGE_PROFILES.map(p=>{
    const hits=p.terms.reduce((n,t)=>n+(lower.includes(t.toLowerCase())?1:0),0);
    const scriptBonus=p.scripts.some(s=>s===scriptDominant)?1:0;
    return {...p,score:hits*3+scriptBonus,termHits:hits};
  }).filter(x=>x.termHits>0);
  const englishTerms=['project','district','village','notification','declaration','award','compensation','court','land acquisition','survey number','section','rehabilitation','resettlement','possession','approval'];
  const englishHits=englishTerms.reduce((n,t)=>n+(lower.includes(t)?1:0),0);
  if(englishHits>=2) scores.push({code:'en',name:'English',score:englishHits*3,termHits:englishHits,scripts:['Latin']});
  scores.sort((a,b)=>b.score-a.score);
  const primary=scores[0]||null;
  // Shared scripts (especially Devanagari/Bengali) make language identification
  // ambiguous. Do not claim several related Indian languages merely because
  // their common vocabulary occurs in one document. Secondary languages need
  // at least 2 term hits and a meaningful score relative to the primary.
  const top=[];
  if(primary) top.push({code:primary.code,name:primary.name,score:primary.score,termHits:primary.termHits});
  for(const x of scores.slice(1)){
    if(x.termHits<2) continue;
    const sameScript=x.scripts?.some(s=>pScript(s,scriptDominant));
    const relative=primary ? x.score>=Math.max(6,primary.score*0.45) : true;
    if(sameScript && primary && x.code!=='en' && primary.code!=='en') continue;
    if(relative) top.push({code:x.code,name:x.name,score:x.score,termHits:x.termHits});
  }
  if(!top.length && scriptDominant) top.push({code:'und',name:`${scriptDominant} script`,score:1,termHits:0});
  return {primary:primary?{code:primary.code,name:primary.name,score:primary.score,termHits:primary.termHits}:null,languages:top.slice(0,3),scripts:scripts.slice(0,6),multilingual:top.filter(x=>x.code!=='und').length>1};
}
function pScript(a,b){ return a===b; }

export function installedTesseractLanguages() {
  // Kept in JS as a requested language order; Python OCR filters against actual
  // `tesseract --list-langs` so unsupported packs never break extraction.
  return ['eng','hin','mar','nep','ben','asm','guj','kan','mal','ori','pan','tam','tel','urd','script/Devanagari','script/Bengali','script/Gurmukhi','script/Gujarati','script/Oriya','script/Tamil','script/Telugu','script/Kannada','script/Malayalam','script/Latin'];
}

const DATE=/\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/g;
function clean(s){return String(s??'').replace(/\s+/g,' ').trim().replace(/[.;,:-]+$/,'').trim();}
function evidence(text,index,len,value){return {value:clean(value),excerpt:clean(String(text).slice(Math.max(0,index-140),Math.min(String(text).length,index+Math.max(len,120)+140)))};}
function first(text, patterns){for(const rx of patterns){const m=rx.exec(text);if(m?.[1])return evidence(text,m.index,m[0].length,m[1]);}return null;}
function num(text,patterns){const h=first(text,patterns);if(!h)return null;const m=String(h.value).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;}

export function extractMultilingualFacts(documents=[]) {
  const docs=documents.map(d=>({...d,text:normalizeUnicode(d.text||'')}));
  const text=docs.map(d=>`\n===== ${d.name} =====\n${d.text}`).join('\n');
  const language=detectLanguageProfile(text);
  const patterns={
    projectName:[/(?:project\s+name|name\s+of\s+project|project\s+title)\s*[:\-]\s*([^\n]{3,140})/i, /\b([A-Z][A-Za-z]+\s+Ring\s+Road)\b/i, /(?:नाशिक|नाचशक|नाविक)[^\n]{0,50}(?:पवरक्रमा|परीक्रमा|परिक्रमा)[^\n]{0,50}(?:मागव|मार्ग)/iu, /(?:project|परियोजना|प्रकल्प)\s*(?:for|के लिए|साठी)\s*[:\-]?\s*([^\n]{3,140})/i],
    state:[/\bstate\s*[:\-]\s*([A-Z][A-Za-z .'-]{2,60})/i, /(?:महाराष्ट्र\s+शासन|महाराष्ट्र\s+राज्य|state of Maharashtra)/iu],
    district:[/\bdistrict\s*[:\-]\s*([A-Z][A-Za-z .'-]{2,60})/i, /(?:dist\.?|district)\s*[.:-]\s*([A-Za-z .'-]{2,60})/i, /(?:जिल्हा|जिला|जिल्ला|जि\.)\s*[:\-\.]*\s*([^\n,;]{2,60})/iu, /(?:वज\.|जि\.)\s*([^\n,;]{2,40})/iu],
    village:[/\bvillage\s*[:\-]\s*([^\n,;]{2,80})/i, /(?:village|mouje|mouza)\s*[:\-\.]*\s*([^\n,;]{2,80})/i, /(?:मौजे|मौजा)\s*([^,;\n]{2,50})\s*,\s*(?:ता\.|तालुका|taluka)/iu],
    acquisitionType:[/(?:project type|acquisition type)\s*[:\-]\s*([^\n]{3,100})/i, /(?:भूसंपादन|भूमि अधिग्रहण|land acquisition)\s+(?:प्रकार|type|का प्रकार)\s*[:\-]\s*([^\n,;]{3,100})/iu],
  };
  const extracted={}, fieldEvidence=[];
  for(const [key,rxs] of Object.entries(patterns)){
    for(const d of docs){const h=first(d.text,rxs);if(h?.value){extracted[key]=h.value;fieldEvidence.push({field:key,value:h.value,document:d.name,sha256:d.sha256||null,excerpt:h.excerpt,confidence:0.82,language:detectLanguageProfile(d.text).primary?.code||'unknown'});break;}}
  }
  if(extracted.state) extracted.state=normalizePlaceName(extracted.state);
  if(extracted.district) extracted.district=normalizePlaceName(extracted.district);
  if(extracted.village) extracted.village=normalizePlaceName(extracted.village);
  // OCR-tolerant location/project fallbacks. Preserve source text in fieldEvidence.
  const sourceText=docs.map(d=>d.text).join('\n');
  if(!extracted.projectName){
    const ring=/\b([A-Z][A-Za-z]+\s+Ring\s+Road)\b/i.exec(sourceText);
    if(ring){extracted.projectName=ring[1].trim();fieldEvidence.push({field:'projectName',value:extracted.projectName,document:docs[0]?.name||'unknown',sha256:docs[0]?.sha256||null,excerpt:ring[0],confidence:0.93,derived:true,language:'en'});}
  }
  if(!extracted.state && /महाराष्ट्र\s+(?:शासन|राज्य)|Maharashtra/i.test(sourceText)){
    extracted.state='Maharashtra'; fieldEvidence.push({field:'state',value:'Maharashtra',document:docs[0]?.name||'unknown',confidence:0.94,derived:true,excerpt:'Maharashtra',language:'mr'});
  }
  if(!extracted.district){
    const dm=/(?:मौजे|मौजा)\s+[^,;\n]{2,50}\s*,\s*(?:ता\.|तालुका|taluka)\s+[^,;\n]{2,50}\s*,\s*(?:वज\.|जि\.|जिल्हा|जिला)\s+([^,;\n]{2,80})/iu.exec(sourceText);
    if(dm){extracted.district=normalizePlaceName(dm[1]);fieldEvidence.push({field:'district',value:extracted.district,document:docs[0]?.name||'unknown',confidence:0.88,derived:true,excerpt:dm[0],language:'mr'});}
  }
  if(!extracted.village){
    const vm=/(?:मौजे|मौजा)\s+([^,;\n]{2,50})\s*,\s*(?:ता\.|तालुका|taluka)/iu.exec(sourceText);
    if(vm){extracted.village=normalizePlaceName(vm[1]);fieldEvidence.push({field:'village',value:extracted.village,document:docs[0]?.name||'unknown',confidence:0.88,derived:true,excerpt:vm[0],language:'mr'});}
  }
  // Land-acquisition title fallback: many government awards do not label the project name.
  if(!extracted.projectName){
    for(const d of docs){const m=/(?:land\s+acquisition\s+award|final\s+land\s+acquisition\s+award)[^\n]{0,220}(?:for|of|के लिए|साठी)\s+([^\n.]{4,140})/i.exec(d.text); if(m?.[1]){const h=evidence(d.text,m.index,m[0].length,m[1]);extracted.projectName=clean(h.value);fieldEvidence.push({field:'projectName',value:extracted.projectName,document:d.name,sha256:d.sha256||null,excerpt:h.excerpt,confidence:0.70,derived:true,language:detectLanguageProfile(d.text).primary?.code||'unknown'});break;}}
  }
  const genericNumber={
    totalParcels:[/(?:total\s+)?(?:parcels|plots|survey(?:\s+numbers?)?|groups?|gat(?:s)?)\s*[:=]\s*([\d,]+)/i,/(?:एकूण|एकंदरीत)\s*(?:गट|सर्वे|जमिनी|पार्सल)[^\d]{0,30}([\d,]+)/i],
    parcelsAcquired:[/(?:parcels|plots|land)\s+(?:acquired|taken)\s*[:=]\s*([\d,]+)/i,/(?:acquired|taken|acquisition)\s*(?:area|land)?\s*[:=]\s*([\d,.]+)/i],
    familiesAffected:[/(?:affected|displaced)\s+famil(?:y|ies)\s*[:=]\s*([\d,]+)/i,/(?:number of affected families)\s*[:=]\s*([\d,]+)/i,/(?:प्रभावित|बाधित|विस्थापित)\s*(?:कुटुंब|परिवार|families)[^\d]{0,25}([\d,]+)/i],
    compensationAmount:[/(?:compensation|award amount|amount assessed)\s*[:=]\s*(?:₹|rs\.?\s*)?([\d,]+(?:\.\d+)?)/i,/(?:compensation|मोबदला|नुकसानभरपाई|मुआवजा|क्षतिपूर्ति)[^\n\d₹]{0,40}(?:₹|rs\.?\s*)?([\d,]+(?:\.\d+)?)/i],
    disputes:[/(?:active\s+)?(?:ownership disputes|disputes|litigation|court cases|legal cases)\s*[:=]\s*([\d,]+)/i],
    approvalPct:[/(?:approval|approvals|approval progress|approval pct|approval percentage|approval complete pct)\s*[:=]\s*([\d.]+)\s*%?/i,/(?:मंजुरी|स्वीकृति|अनुमोदन)[^\d]{0,30}([\d.]+)\s*%?/i],
    resettlementPct:[/(?:r&r|rehabilitation|resettlement)(?: progress| pct| percentage)\s*[:=]\s*([\d.]+)\s*%?/i,/(?:पुनर्वसन|पुनर्वास|पुनर्स्थापन)\s*(?:प्रगति|प्रतिशत|%)\s*[:=]\s*([\d.]+)\s*%?/iu],
    avgDelayDays:[/(?:average delay|avg delay|current delay)\s*(?:days)?\s*[:=]\s*([\d.]+)/i,/(?:विलंब|देरी|delay)[^\d]{0,25}([\d.]+)\s*(?:days|दिवस|दिन)?/i],
    docsMissing:[/(?:documents missing|missing documents|documentation gap)\s*[:=]\s*([\d,]+)/i,/(?:कागदपत्रे|दस्तावेज|documents)[^\d]{0,30}(?:missing|गहाळ|लापता)[^\d]{0,20}([\d,]+)/i],
    depts:[/(?:departments involved|departments)\s*[:=]\s*([\d,]+)/i], prevDelays:[/(?:prior delays|previous delays|prev delays)\s*[:=]\s*([\d,]+)/i],
  };
  const numeric={}; for(const [k,rxs] of Object.entries(genericNumber)){const n=num(text,rxs);numeric[k]=n;if(n!=null){const h=first(text,rxs);fieldEvidence.push({field:k,value:String(n),document:(docs.find(d=>d.text.includes(h.value))||docs[0])?.name,confidence:0.68,derived:true,excerpt:h.excerpt});}}
  const notifications=[];
  const notificationPatterns=[
    {section:'11',label:'Preliminary notification',rx:/(?:section|sec\.?|कलम|धारा)\s*(?:11|११)(?:\s*\(\s*1\s*\))?[^\n]{0,160}/giu},
    {section:'19',label:'Declaration',rx:/(?:section|sec\.?|कलम|धारा)\s*(?:19|१९)(?:\s*\(\s*1\s*\))?[^\n]{0,160}/giu},
    {section:'21',label:'Notice',rx:/(?:section|sec\.?|कलम|धारा)\s*(?:21|२१)(?:\s*\(\s*1\s*\))?[^\n]{0,160}/giu},
    {section:'23',label:'Award',rx:/(?:section|sec\.?|कलम|धारा)\s*(?:23|२३)(?:\s*\(\s*1\s*\))?[^\n]{0,160}/giu},
  ];
  for(const d of docs) for(const p of notificationPatterns) for(const m of d.text.matchAll(p.rx)){
    const dates=[...(m[0].matchAll(DATE))].map(x=>x[0]);
    notifications.push({section:p.section,label:p.label,document:d.name,excerpt:clean(m[0]),dates});
  }
  const notificationUnique=[]; const notificationKeys=new Set();
  for(const n of notifications){
    const normalizedDates=[...n.excerpt.matchAll(/(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|[०-९]{1,4}[\/\-][०-९]{1,4}[\/\-][०-९]{2,4})/g)].map(x=>normalizeIndicDigits(x[0]));
    const key=normalizedDates.length?`${n.section}|${n.document}|${normalizedDates[0]}`:`${n.section}|${n.document}|UNDATED`;
    if(!notificationKeys.has(key)){notificationKeys.add(key);notificationUnique.push({...n,dates:normalizedDates.length?normalizedDates:n.dates});}
  }
  // Prefer a dated statutory event over a generic later citation to the same section.
  const datedSections=new Set(notificationUnique.filter(x=>x.dates?.length).map(x=>x.section));
  const filteredNotifications=notificationUnique.filter(x=>x.dates?.length || !datedSections.has(x.section));


  const cases=[];
  const casePatterns=[
    /(?:Special\s+Civil\s+Suit|Regular\s+Civil\s+Suit|Civil\s+Suit)[\s\S]{0,90}?(?:No\.?|Number|क्रमांक|क्र\.?|नं\.?)\s*[:.-]?\s*([0-9०-९]+[\/\-][0-9०-९]+)/giu,
    /(?:स्पेशल|रेग्युलर|सिव्हिल)[\s\S]{0,90}?सूट[\s\S]{0,30}?(?:क्र\.?|क्रमांक|नं\.?)\s*[:.-]?\s*([0-9०-९]+[\/\-][0-9०-९]+)/giu,
  ];
  for(const d of docs) for(const rx of casePatterns) for(const m of d.text.matchAll(rx)){
    const caseNumber=normalizeIndicDigits(m[1]);
    const start=Math.max(0,(m.index||0)-80), end=Math.min(d.text.length,(m.index||0)+m[0].length+100);
    cases.push({document:d.name,excerpt:clean(d.text.slice(start,end)),caseNumber});
  }
  const caseUnique=[]; const caseKeys=new Set();
  for(const c of cases){const key=`${c.document}|${c.caseNumber}`;if(!caseKeys.has(key)){caseKeys.add(key);caseUnique.push(c);}}


  const parcelIds=[];
  const labeledParcelRx=/(?:survey|sur\.?|khasra|group|gat|parcel|plot|सर्वे|गट|खसरा|खसरा क्रमांक|सर्वे क्रमांक|गट क्रमांक|गट क्र\.?|गट क्रमाांक)\s*(?:no\.?|number|क्रमांक|क्र\.?|नं\.?)?\s*[:#.-]?\s*([A-Za-z0-9०-९\/\-\.]+(?:\s*[अ-ह])?)/giu;
  for(const d of docs) for(const m of d.text.matchAll(labeledParcelRx)){
    const value=normalizeParcelId(m[1]); if(isUsefulParcelId(value)) parcelIds.push({value,rawValue:m[1],document:d.name,excerpt:clean(m[0])});
  }
  // Acquisition schedules frequently contain bare parcel/group identifiers in tabular rows.
  const rowRx=/^\s*\d{1,3}\s+([0-9०-९]{1,6}(?:\s*[\/\\-]\s*[0-9०-९अ-ह]+)*(?:\s*[अ-ह])?)(?:\s+(?:पै\.?|पैकी))?\s+[0-9०-९,.]+\s+[0-9०-९,.]+\s*$/gmu;
  for(const d of docs) for(const m of d.text.matchAll(rowRx)){
    const value=normalizeParcelId(m[1]); if(isUsefulParcelId(value)) parcelIds.push({value,rawValue:m[1],document:d.name,excerpt:clean(m[0])});
  }
  const parcelUnique=[]; const parcelKeys=new Set();
  for(const x of parcelIds){const key=`${x.document}|${x.value}`;if(!parcelKeys.has(key)){parcelKeys.add(key);parcelUnique.push(x);}}
  const sections=sectionSignalsMultilingual(text);
  if((numeric.disputes==null || numeric.disputes===0) && caseUnique.length) numeric.disputes=caseUnique.length;
  return {docs,text,language,extracted:{...extracted,...numeric},fieldEvidence,notifications:filteredNotifications,cases:caseUnique,parcelIds:parcelUnique,sections};
}

function normalizeIndicDigits(value=''){
  const map={'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9'};
  return String(value).replace(/[०-९]/g,ch=>map[ch]);
}
function normalizeParcelId(value=''){
  let v=normalizeIndicDigits(String(value).replace(/\s+/g,'')); v=v.replace(/(\d)([अ-ह])$/,'$1/$2'); return v.replace(/[^A-Za-z0-9\/\-.अ-ह]/g,'');
}
function isUsefulParcelId(value=''){
  const v=String(value); return /\d/.test(v) && (v.includes('/') || v.length>=2) && !/^\d{1,2}$/.test(v);
}
function normalizePlaceName(value=''){
  const raw=clean(value).replace(/[।,:;]+$/,'');
  const n=raw.toLowerCase();
  if(/^(?:नाविक|नाचशक|नाशिक|नामर्क|नाशक|नासिक)$/.test(n) || /(?:नाविक|नाचशक|नाशिक|नामर्क)/.test(n)) return 'Nashik';
  if(/^(?:दिंडोरी|ददडोरी|सदडोरी|दिडोरी)$/.test(n) || /(?:दिंडोरी|ददडोरी|सदडोरी|दिडोरी)/.test(n)) return 'Dindori';
  if(/^(?:मानोरी|मनोरी)$/.test(n)) return 'Manori';
  return raw;
}


export function sectionSignalsMultilingual(text=''){
  const t=normalizeUnicode(text).toLowerCase();
  const groups=[
    {key:'legal',label:'Legal / disputes',hits:['dispute','litigation','court','objection','stay order','case no','cnr','civil suit','न्यायालय','अदालत','हरकत','वाद','दावा','खटला','प्रकरण','कायदेशीर','नुकसान','আদালত','കോടതി','நீதிமன்றம்','న్యాయస్థానం','ನ್ಯಾಯಾಲಯ','કોર્ટ','ਅਦਾਲਤ','عدالت']},
    {key:'compensation',label:'Compensation',hits:['compensation','pending compensation','award amount','payment','deposit','disbursement','amount awarded','मोबदला','नुकसानभरपाई','मुआवजा','क्षतिपूर्ति','প্রতিপূরণ','ক্ষতিপূরণ','ಪರಿಹಾರ','നഷ്ടപരിഹാരം','இழப்பீடு','పరిహారం','ವળતર','ਨੁਕਸਾਨਪੂਰਤੀ','معاوضہ']},
    {key:'documents',label:'Documents',hits:['notification','gazette','award copy','land schedule','annexure','record of rights','ror','survey no','survey number','अधिसूचना','राजपत्र','कागदपत्र','दस्तावेज','जमीन अनुसूची','ಭೂ ದಾಖಲೆ','நில ஆவணம்','ഭൂമി രേഖ','భూ రికార్డు']},
    {key:'possession',label:'Possession',hits:['possession','handing over','takeover','vacant possession','ताबा','कब्जा','हस्तांतरण','দখল','ಸ್ವಾಧೀನ','കൈവശം','கையகப்படுத்தல்','ఆక్రమణ','ಕಬ್ಜಾ']},
    {key:'rr',label:'R&R',hits:['rehabilitation','resettlement','r&r','affected family','affected families','displaced family','displaced families','पुनर्वसन','पुनर्वास','पुनर्स्थापन','प्रभावित परिवार','विस्थापित','ಪುನರ್ವಸತಿ','പുനരധിവാസം','மறுவாழ்வு','పునరావాసం','ಪುನರ್ವಸತಿ']},
    {key:'approvals',label:'Approvals / clearances',hits:['approval','clearance','forest clearance','environment clearance','crz','parivesh','मंजुरी','स्वीकृति','अनुमोदन','पर्यावरण मंजूरी','ಅನುಮೋದನೆ','അനുമതി','அனுமதி','అనుమతి','મંજૂરી']},
  ];
  return groups.map(s=>({key:s.key,label:s.label,count:s.hits.reduce((n,h)=>n+(t.includes(h.toLowerCase())?1:0),0)}));
}

export function classifyDocumentMultilingual(document){
  const name=String(document?.name||'').toLowerCase(), text=normalizeUnicode(document?.text||'').toLowerCase();
  const rules=[
    ['LAND_ACQUISITION_AWARD',['award','final land acquisition','section 23','भूसंपादन पुरस्कार','अवार्ड','नुकसानभरपाई','मोबदला']],
    ['SECTION_11_NOTIFICATION',['section 11','section 11 notification','preliminary notification','कलम 11','अधिसूचना','प्राथमिक अधिसूचना']],
    ['SECTION_19_DECLARATION',['section 19','declaration','section 19 declaration','कलम 19','घोषणा']],
    ['SECTION_21_NOTICE',['section 21','notice to interested persons','कलम 21','नोटीस']],
    ['COMPENSATION_DOCUMENT',['compensation','payment','disbursement','मोबदला','मुआवजा','ক্ষতিপূরণ','இழப்பீடு']],
    ['COURT_ORDER',['court order','judgment','special civil suit','regular civil suit','stay order','न्यायालय','अदालत','दावा','खटला']],
    ['RR_DOCUMENT',['rehabilitation','resettlement','r&r','पुनर्वसन','पुनर्वास','पुनर्स्थापन']],
    ['POSSESSION_RECORD',['possession','handing over','ताबा','कब्जा','दखल']],
    ['LAND_RECORD',['record of rights','ror','patta','mutation','survey number','khasra','land record','जमीन अभिलेख','भूमि अभिलेख','7/12']],
    ['PROJECT_REPORT',['project report','progress report','status report','monthly progress','प्रगती अहवाल','प्रगति रिपोर्ट']],
  ];
  let best={type:'OTHER',score:0}; for(const [type,terms] of rules){const score=terms.reduce((n,t)=>n+(name.includes(t)?3:0)+(text.includes(t)?1:0),0);if(score>best.score)best={type,score};}
  const confidence=best.score>=6?.96:best.score>=4?.88:best.score>=2?.72:.58;
  return {type:best.type,confidence,languages:detectLanguageProfile(document?.text||'').languages};
}

export function languageEvidenceDigest(text=''){
  const d=detectLanguageProfile(text);
  return crypto.createHash('sha256').update(normalizeUnicode(text)).digest('hex').slice(0,16);
}
