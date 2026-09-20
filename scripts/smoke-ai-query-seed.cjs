'use strict';
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const projects=JSON.parse(fs.readFileSync(path.join(root,'backend','seed-projects.json'),'utf8'));
  const { computeRisk }=await import('../backend/risk-engine.js');
  const { answerWithEvidence }=await import('../backend/domain/ai-query-intelligence.js');
  const scored=projects.map(p=>({...p,risk:computeRisk(p)}));
  const checks=[
    ['How many projects are loaded?',/29 projects are loaded/],
    ['What is the current system readiness?',/candidate_not_validated/],
    ['What are the major delay drivers?',/Compensation Risk|Legal Risk|Approval Risk|Documentation Risk/],
    ['Which project has the highest risk?',/Nagpur Logistics Corridor/],
    ['Which projects have compensation pending?',/Nagpur Logistics Corridor|Sambalpur Industrial Township/],
    ['Identify the highest-risk project and explain the main evidence behind its risk.',/Direct record (evidence|fields)|Derived\/application output|Stored risk output/],
    ['Compare the high-risk projects based on risk, evidence coverage, and major bottlenecks.',/Nagpur Logistics Corridor|Comparison|evidence coverage not recorded/],
    ['Which statements are directly supported by project evidence and which are derived by the system?',/Direct record (evidence|fields)|Derived intelligence/],
    ['What is uncertain?',/Unavailable government records|Stored risk outputs/],
    ['What should the officer verify next?',/verify|Review/],
  ];
  for(const [q,re] of checks){ const r=answerWithEvidence({projects:scored,query:q,systemContext:{predictiveModelStatus:'candidate_not_validated',predictiveModelVersion:'predictive-baseline-v1'}}); if(!re.test(r.text)) throw new Error(`Seed query failed: ${q}\n${r.text}`); }
  const follow=answerWithEvidence({projects:scored,query:'What evidence supports that?',recentMessages:[{role:'user',text:'Tell me about Nagpur Logistics Corridor risk.'}]});
  if(!/Nagpur Logistics Corridor/.test(follow.text)) throw new Error('Seed follow-up resolution failed.');
  console.log('AI QUERY SEED REGRESSION PASSED (29 PROJECTS)');
})().catch(e=>{console.error(`AI QUERY SEED REGRESSION FAILED: ${e.stack||e.message}`);process.exit(1);});
