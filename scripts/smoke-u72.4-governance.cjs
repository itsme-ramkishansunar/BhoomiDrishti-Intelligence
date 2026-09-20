const fs = require('node:fs');
const path = require('node:path');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const gov=await import(path.join(root,'backend/domain/portfolio-governance.js'));
  const ml=await import(path.join(root,'backend/domain/multilingual-intelligence.js'));
  const checks=[];
  const admin={role:'Administrator',permissions:['*'],organisation:'National',jurisdiction:{state:'National',district:'National',projectIds:[]}};
  const officer={role:'Department Officer',permissions:['projects:archive'],organisation:'Revenue Department',jurisdiction:{state:'Maharashtra',district:'Nashik',projectIds:[]}};
  const outsider={...officer,organisation:'Legal Department'};
  const project={id:'TEST-U724',state:'Maharashtra',district:'Nashik',responsibleDepartment:'Revenue Department'};
  checks.push(['administrator_scope',gov.canArchiveProject(admin,project).allowed===true]);
  checks.push(['department_scope',gov.canArchiveProject(officer,project).allowed===true]);
  checks.push(['department_boundary',gov.canArchiveProject(outsider,project).code==='OUTSIDE_DEPARTMENT']);
  checks.push(['jurisdiction_boundary',gov.canArchiveProject({...officer,organisation:'Revenue Department',jurisdiction:{state:'Gujarat',district:'Nashik',projectIds:[]}},project).code==='OUTSIDE_JURISDICTION']);
  const fixtures=[
    ['mr','Marathi','जिल्हा Nashik तालुका Dindori गाव Manori भूसंपादन मोबदला न्यायालय'],
    ['hi','Hindi','जिला Nashik ग्राम Manori भूमि अधिग्रहण मुआवजा न्यायालय'],
    ['ta','Tamil','மாவட்டம் சேலம் கிராமம் நிலம் கையகப்படுத்தல் இழப்பீடு நீதிமன்றம்'],
    ['bn','Bengali','জেলা নাসিক গ্রাম মানোরি ভূমি অধিগ্রহণ ক্ষতিপূরণ আদালত'],
  ];
  for(const [code,name,text] of fixtures){const d=ml.detectLanguageProfile(text);checks.push([`language_${code}`,d.primary?.code===code]);}
  const migration=fs.readFileSync(path.join(root,'database/migrations/019_authority_scoped_portfolio_governance.sql'),'utf8');
  checks.push(['additive_migration',/responsible_department/.test(migration)&&/intake_field_reviews/.test(migration)&&!/DROP TABLE|DROP COLUMN/i.test(migration)]);
  const ok=checks.every(([,v])=>v);
  console.log(JSON.stringify({ok,version:'U72.4',checks:checks.length,details:Object.fromEntries(checks),governanceVersion:gov.PORTFOLIO_GOVERNANCE_VERSION},null,2));
  process.exit(ok?0:1);
})().catch(e=>{console.error(e);process.exit(1)});
