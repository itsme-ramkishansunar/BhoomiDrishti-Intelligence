const fs=require('fs');
const path=require('path');
const app=fs.readFileSync(path.join(__dirname,'..','src','App.jsx'),'utf8');
const dash=fs.readFileSync(path.join(__dirname,'..','src','components','dashboard','DashboardPage.jsx'),'utf8');
const checks=[
 ['dashboard navigation bridge', app.includes('navigateToProjects')],
 ['risk filter propagation', app.includes('initialFilters={projectNavigationFilters}') && dash.includes('{risk:"high"}')],
 ['state filter propagation', dash.includes('navigateToProjects?.({state:row.state})')],
 ['status filter', app.includes('statusFilter')],
 ['department filter', app.includes('departmentFilter')],
 ['stage filter', app.includes('stageFilter')],
 ['KPI actions', dash.includes('onClick={() => navigateToProjects?.({risk:"high"})}')],
 ['risk chart actions', dash.includes('navigateToProjects?.({risk:r.name.toLowerCase()})')],
];
for(const [n,ok] of checks){if(!ok) throw new Error('FAIL '+n); console.log('PASS '+n)}
console.log('U75 dashboard drilldown smoke: PASS');
