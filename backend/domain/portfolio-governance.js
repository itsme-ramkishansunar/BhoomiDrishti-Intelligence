// U72.4: pure authority policy for recoverable project portfolio removal.
export const PORTFOLIO_GOVERNANCE_VERSION = 'u72.4-authority-scoped-portfolio-v1';

function norm(v){ return String(v ?? '').trim().toLowerCase(); }
function hasWildcard(user){ return Array.isArray(user?.permissions) && user.permissions.includes('*'); }
function inScope(user, project){
  const j=user?.jurisdiction||{};
  const ids=Array.isArray(j.projectIds)?j.projectIds.map(String):[];
  if(ids.length && !ids.includes(String(project?.id))) return false;
  const state=norm(j.state || user?.state);
  const district=norm(j.district || user?.district);
  if(state && !['unassigned','national'].includes(state) && state!==norm(project?.state)) return false;
  if(district && !['unassigned','national'].includes(district) && district!==norm(project?.district)) return false;
  return true;
}
export function canArchiveProject(user, project){
  if(!user || !project) return {allowed:false,code:'MISSING_CONTEXT',reason:'User and project are required.'};
  if(!(hasWildcard(user) || Array.isArray(user.permissions) && user.permissions.includes('projects:archive'))) return {allowed:false,code:'PERMISSION_REQUIRED',reason:'Portfolio removal authority is not assigned to this account.'};
  if(user.role==='Administrator' || hasWildcard(user)) return {allowed:true,code:'ADMINISTRATOR',reason:'System-level portfolio authority.'};
  if(!inScope(user,project)) return {allowed:false,code:'OUTSIDE_JURISDICTION',reason:'Project is outside the user’s assigned state/district/project scope.'};
  if(user.role==='Department Officer') {
    const department=norm(project.responsibleDepartment);
    const unit=norm(user.organisation || user.department);
    if(department && unit && department!==unit) return {allowed:false,code:'OUTSIDE_DEPARTMENT',reason:'Department Officer can remove only projects assigned to the officer’s responsible department/work unit.'};
    if(department && !unit) return {allowed:false,code:'DEPARTMENT_UNASSIGNED',reason:'A responsible department is recorded but this account has no matching department/work-unit assignment.'};
  }
  return {allowed:true,code:user.role==='Department Officer'?'DEPARTMENT_SCOPE':'JURISDICTION_SCOPE',reason:'Recoverable portfolio authority applies within the assigned scope.'};
}
