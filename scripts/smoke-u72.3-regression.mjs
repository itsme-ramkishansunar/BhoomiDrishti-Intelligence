import fs from 'node:fs';
import path from 'node:path';
import { analyseProjectIntake } from '../backend/domain/intake-analyzer.js';
const root=process.cwd();
const fixturePath=process.env.BHOOMI_REGRESSION_TEXT_FILE;
const fixture=fixturePath && fs.existsSync(fixturePath) ? fs.readFileSync(fixturePath,'utf8') : `
नाशिक पवरक्रमा मागव (Nashik Ring Road) प्रकल्पासाठी मौजे मानोरी, ता. दिंडोरी, जि. नाचशक येथील खाजगी जमिनींचे भूसंपादन.
महाराष्ट्र शासन. कलम ११ अन्वये प्राथमिक अधिसूचना दिनांक १९/०३/२०२६.
कलम १९ अंतिम अधिसूचना क्र. १५१/२०२६ दिनांक २५/०५/२०२६.
गट क्रमांक १३७/अ बाबत स्पेशल चसश्व्हल सूट क्र. २३५/२००८ प्रलंबित आहे.
गट क्र. १३७/अ बाबत रेग्युलर चसश्व्हल सूट क्र. २२/२००८ प्रलंबित आहे.
1 111/2 4.4200 1.0200
2 111/3 1.6000 0.3350
3 111/4 1.6600 0.7200
4 104 पै 0.9450 0.2000
5 105 पै 1.1420 0.6400
9 123 अ पै 2.7000 0.7800
11 123/ब/1 2.3800 0.3700
12 137/अ 8.9000 0.6700
`;
const r=analyseProjectIntake({documents:[{name:'regression-marathi-award.txt',text:fixture}]});
const langs=(r.languageProfile.languages||[]).map(x=>x.name);
const parcels=new Set((r.parcelEvidence||[]).map(x=>x.value));
const cases=new Set((r.legalCases||[]).map(x=>x.caseNumber));
const requiredParcels=['111/2','111/3','111/4','104','105','123/अ','123/ब/1','137/अ'];
for(const x of ['Nashik Ring Road','Maharashtra','Nashik','Manori']) if(!Object.values(r.extracted).includes(x)) throw new Error(`missing extracted location/project: ${x}`);
for(const x of requiredParcels) if(!parcels.has(x)) throw new Error(`missing parcel/group: ${x}`);
for(const x of ['235/2008','22/2008']) if(!cases.has(x)) throw new Error(`missing legal case: ${x}`);
if(langs.includes('Konkani')||langs.includes('Hindi')||langs.includes('Dogri')||langs.includes('Maithili')||langs.includes('Nepali')) throw new Error(`false related-language detection: ${langs.join(', ')}`);
if(r.notifications.length<2 || r.notifications.length>5) throw new Error(`unexpected statutory reference count: ${r.notifications.length}`);
if(r.entityResolution.edgeCount<1) throw new Error('evidence graph has no edges');
console.log(JSON.stringify({ok:true,version:'U72.3',checks:8,project:r.extracted.projectName,state:r.extracted.state,district:r.extracted.district,village:r.extracted.village,languages:langs,legalCases:[...cases],parcelCount:parcels.size,statutoryReferences:r.notifications.length,evidenceEdges:r.entityResolution.edgeCount,databaseMigration:false,modelReplacement:false,canonicalOverwrite:false},null,2));
