(async () => {
  const { answerWithEvidence } = await import('../backend/domain/ai-query-intelligence.js');
  const demo = [
    {id:'P1',name:'Alpha Project',code:'ALP',type:'Highway',state:'Tamil Nadu',district:'Salem',status:'ongoing',stageIndex:4,familiesAffected:100,familiesPending:30,avgDelayDays:60,disputes:2,courtCases:1,approvalPct:60,docsMissing:12,risk:{overall:72,band:'high',bottleneck:{label:'Compensation Risk'},drivers:[{key:'compensation',label:'Compensation Risk',value:70,contribution:19.6},{key:'legal',label:'Legal Risk',value:35,contribution:7}],recommendedActions:['Review and age outstanding compensation cases.']}},
    {id:'P2',name:'Beta Project',code:'BET',type:'Railway',state:'Karnataka',district:'Hubballi',status:'ongoing',stageIndex:3,familiesAffected:50,familiesPending:5,avgDelayDays:15,disputes:0,courtCases:0,approvalPct:92,docsMissing:2,risk:{overall:28,band:'low',bottleneck:{label:'Documentation Risk'},drivers:[{key:'documentation',label:'Documentation Risk',value:10,contribution:1.2}],recommendedActions:[]}},
    {id:'P3',name:'Gamma Project',code:'GAM',type:'Highway',state:'Bihar',district:'Gaya',status:'completed',stageIndex:7,familiesAffected:10,familiesPending:0,avgDelayDays:0,disputes:0,courtCases:0,approvalPct:100,docsMissing:0,risk:{overall:12,band:'low',bottleneck:{label:'Administrative Risk'},drivers:[],recommendedActions:[]}},
    {id:'P4',name:'Delta Project',code:'DEL',type:'Road',state:'Kerala',district:'Kochi',status:'ongoing',stageIndex:2,familiesAffected:20,familiesPending:2,avgDelayDays:8,disputes:0,courtCases:0,approvalPct:95,docsMissing:1,risk:{overall:18,band:'low',bottleneck:{label:'Administrative Risk'},drivers:[{key:'administrative',label:'Administrative Risk',value:8,contribution:0.8}],recommendedActions:['Verify the latest administrative milestone record.']}},
  ];
  const cases = [

    ['Which projects need attention first?','Priority attention',/Priority attention/,/Alpha Project/],
    ['Compare the three highest-risk projects based on risk, evidence coverage, bottlenecks, uncertainty, and recommended action.','Exact three comparison',/Comparison/,/Alpha Project/,3],
    ['Identify the highest-risk project and explain the evidence supporting its risk.','Highest-risk evidence target',/Evidence vs derived intelligence — Alpha Project/,/Alpha Project/],
    ['How many projects are loaded?','Portfolio count',/4 projects are loaded/],
    ['What is the current system readiness?','System readiness',/predictive model status is candidate_not_validated/],
    ['What are the major delay drivers?','Delay drivers',/Compensation Risk/],
    ['Which statements are directly supported by project evidence and which are derived by the system?','Evidence vs derived',/Direct record evidence/],
    ['Compare the high-risk projects based on risk and major bottlenecks.','Comparison',/Alpha Project/],
    ['What should the officer verify next?','Recommended action',/Review and age outstanding compensation cases/],
    ['What should we prioritise this week?','Weekly priority action',/Recommended next actions|Weekly priority actions/,/Alpha Project/],
    ['Why is Alpha Project risky?','Risky project explanation',/Why Alpha Project is risky/,/Alpha Project/],
    ['Which project has the highest compensation risk?','Highest compensation-risk project',/Highest compensation risk:/,/Alpha Project/],
    ['What is uncertain?','Uncertainty',/does not invent/],
    ['Perform a complete portfolio-level risk analysis. Identify the highest-risk projects, explain delay drivers, distinguish evidence from derived intelligence, explain uncertainty, and provide next actions.','Multi-part',/Interpretation note/],
    ['Tell me the exact officer responsible for the highest-risk project.','Unavailable officer',/exact responsible government officer identity/],
  ];
  for (const [name,label,re,entity,repeats] of cases) {
    const focus = name.includes('prioritise') || name.includes('Alpha Project risky') ? 'P1' : '';
    const r = answerWithEvidence({projects:demo,query:name,focusProjectId:focus,systemContext:{predictiveModelStatus:'candidate_not_validated',predictiveModelVersion:'predictive-baseline-v1'}});
    if (!re.test(r.text)) throw new Error(`${label} assertion failed: ${r.text}`);
    if (entity && !new RegExp(entity.source, entity.flags).test(r.text)) throw new Error(`${label} entity assertion failed: ${r.text}`);
    if (Number.isInteger(repeats)) {
      const comparisonSection = r.text.split('Comparison\n')[1]?.split('\n\n')[0] || '';
      const count = comparisonSection.split('\n').filter((line) => /^\d+\. /.test(line)).length;
      if (count !== repeats) throw new Error(`${label} expected ${repeats} compared projects but found ${count}: ${r.text}`);
    }
  }

  const crossFocus = answerWithEvidence({projects:demo,query:'Why is Alpha Project risky?',focusProjectId:'P3'});
  if (!/Alpha Project/.test(crossFocus.text) || /Gamma Project/.test(crossFocus.text)) throw new Error('Explicit project mention did not override stale selected-project context.');

  const weekly = answerWithEvidence({projects:demo,query:'What should we prioritise this week?',focusProjectId:'P1'});
  if (!/Weekly priority actions — Alpha Project|Recommended next actions — Alpha Project/.test(weekly.text) || !/Review and age outstanding compensation cases/.test(weekly.text)) throw new Error('Prioritise-this-week query failed selected-project action resolution.');

  const highestComp = answerWithEvidence({projects:demo,query:'Which project has the highest compensation risk?',focusProjectId:'P3'});
  if (!/Highest compensation risk: Alpha Project — 72\/100/.test(highestComp.text)) throw new Error('Highest compensation-risk query failed driver ranking.');

  const highest = answerWithEvidence({projects:demo,query:'Identify the highest-risk project and explain the evidence supporting its risk.',focusProjectId:'P3'});
  if (!/Risk: Alpha Project — 72\/100/.test(highest.text) || !/Evidence vs derived intelligence — Alpha Project/.test(highest.text) || /Gamma Project/.test(highest.text)) throw new Error('Explicit highest-risk query was hijacked by stale focus.');

  const three = answerWithEvidence({projects:demo,query:'Compare the three highest-risk projects based on risk, evidence coverage, bottlenecks, uncertainty, and recommended action.',focusProjectId:'P3'});
  const threeSection = three.text.split('Comparison\n')[1]?.split('\n\n')[0] || '';
  const threeCount = threeSection.split('\n').filter((line) => /^\d+\. /.test(line)).length;
  if (threeCount !== 3) throw new Error(`Explicit three-project constraint failed: ${threeCount}`);

  if (three.relatedProjects.length !== 3 || three.relatedProjects.map((p) => p.name).join('|') !== 'Alpha Project|Beta Project|Delta Project') {
    throw new Error(`Related-project scope leaked beyond explicit comparison constraint: ${three.relatedProjects.map((p) => p.name).join(', ')}`);
  }

  const follow = answerWithEvidence({projects:demo,query:'What evidence supports that?',recentMessages:[{role:'user',text:'Tell me about Alpha Project risk.'}]});
  if (!/Alpha Project/.test(follow.text)) throw new Error('Follow-up project resolution failed.');
  const long = answerWithEvidence({projects:demo,query:'Perform a complete portfolio-level risk analysis. Identify the highest-risk projects, explain delay drivers, distinguish evidence from derived intelligence, explain uncertainty, and provide next actions.'});
  if (long.queryPlan.intents.length < 4 || long.recommendations.length === 0) throw new Error('Long multi-part query decomposition failed.');
  console.log('AI QUERY INTELLIGENCE SMOKE PASSED');
})();
