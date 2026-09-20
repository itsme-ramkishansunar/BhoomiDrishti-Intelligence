import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ROLE_PERMISSIONS, ROLE_DESCRIPTIONS, ensureAdmin, ensureDemoRoleAccounts, repairProjectLocationIntegrity, getUserByEmail, verifyPassword, publicUser, createAccessRequest, listRequests, listUsers, decideAccessRequest, audit, listAudit, listProjects, getProject, upsertProject, dashboardSummary, listDataSources, updateUserAccess, listProjectEvents, listProjectEvidence, listRecommendations, getRecommendation, createRecommendation, updateRecommendation, listPredictions, getDataHealthRows, listModelRegistry, listProjectDependencies, appendProjectEvent, createAISession, getAISession, listAISessions, listAIMessages, appendAIMessage, listAIMessageEvidence, archiveAISession, createPredictionRun, persistCandidatePrediction, listPredictionFeatures, listPredictionExplanations, createDatasetVersion, getDatasetVersion, latestDatasetVersion, listTemporalExamples, listDatasetSplits, listLeakageAudits, createProjectIntake, getProjectIntake, listProjectIntakes, attachProjectToIntake, createCanonicalProject, getCanonicalProject, getCanonicalProjectForIntake, attachCanonicalProjectToProject, createTemporalEvidenceSnapshot, getTemporalEvidenceSnapshot, getLatestTemporalEvidenceSnapshot, createSourceConnectorSnapshot, createSourceConnectorFailure, getSourceConnectorSnapshot, listSourceConnectorSnapshots, createDataIngestionRun, updateDataIngestionRun, getDataIngestionRun, listDataIngestionRuns, listOfficerFeedback, getOfficerFeedback, createOfficerFeedback, reviewOfficerFeedback, createPublicDemoFeedback, listPublicDemoFeedback, getPublicDemoFeedbackSummary, listInterventionActions, getInterventionAction, createIntervention, createInterventionAction, updateInterventionAction, reviewInterventionOutcome, createPredictionDiff, getLatestPredictionDiff, listOperationalAlerts, getOperationalAlert, upsertOperationalAlert, updateOperationalAlertStatus, listAlertEvents, createModelMonitoringSnapshot, latestModelMonitoringSnapshot, createReplayRun, getReplayRun, latestReplayRun, getProjectOperationalStats, syncProjectDataFacts, upsertProjectIntelligenceSnapshot, getLatestProjectIntelligenceSnapshot, getProjectDataFacts, getProjectDataHub, listBulkPromotionEvidence, getBulkPromotionBatch, listBulkPromotionBatches, recordBulkPromotionEvidence, getMapGeocodeCache, saveMapGeocodeCache, updateProjectLocation, archiveProject, restoreProject, listArchivedProjects, getProjectAnyStatus, listIntakeFieldReviews, upsertIntakeFieldReviews, reviewIntakeField, listProjectStages, listInterventions } from './db.js';
import { buildProjectIntelligence, buildTimeline, buildEvidence } from './domain/intelligence.js';
import { analyseProjectIntake } from './domain/intake-analyzer.js';
import { buildCanonicalProject } from './domain/canonical-project.js';
import { reconcileTemporalEvidence } from './domain/temporal-reconciliation.js';
import { prepareSIH26017Intelligence, INTELLIGENCE_PREPARATION_VERSION } from './domain/intelligence-preparation.js';
import { scoreCandidatePrediction, buildPortfolioPredictionSummary, featureDictionary, PREDICTIVE_MODEL_VERSION, PREDICTIVE_MODEL_STATUS } from './domain/predictive-engine.js';
import { buildDataHealth } from './domain/data-health.js';
import { buildTemporalDataset, TEMPORAL_DATASET_VERSION, TEMPORAL_FEATURE_POLICY } from './domain/temporal-dataset.js';
import { WORKFLOW_TEMPLATES, inferDemoWorkflow } from './domain/workflows.js';
import { PUBLIC_CONNECTOR_CATALOG, fetchPublicConnector, buildConnectorHealth } from './domain/source-connectors.js';
import { buildWorkflowState, evaluateLegalClocks } from './domain/legal-engine.js';
import { calculateEvidenceReadiness, calculatePredictionApplicability, buildPredictionDiff } from './domain/intelligence-trust.js';
import { answerWithEvidence } from './domain/ai-query-intelligence.js';
import { buildReadinessFromForensics, evaluatePromotionGate, ML_GOVERNANCE_VERSION, PRODUCTION_MODEL_STATUS } from './domain/ml-governance.js';
import { buildEarlyWarning, buildOperationalOverview, buildModelMonitoringStatus, OPERATIONAL_INTELLIGENCE_VERSION } from './domain/operational-intelligence.js';
import { buildProjectBootstrap, PROJECT_LIFECYCLE_VERSION } from './domain/project-lifecycle.js';
import { refreshUnifiedProjectSnapshot, UNIFIED_DATA_BACKBONE_VERSION, getUnifiedProjectDataHub } from './domain/unified-data-backbone.js';
import { searchGeocoder, makeCacheRecord, mappingCacheKey, GEOCODER_PROVIDER, GEOCODER_VERSION } from './domain/mapping.js';
import { bulkInitializeProjects, initializeProjectIntelligence, getBulkInitializationStatus, BULK_INITIALIZATION_VERSION } from './domain/bulk-initialization.js';
import { bulkInitializeFeatures, getBulkFeatureStatus, getProjectFeatureStatus, BULK_FEATURE_REGISTRY, BULK_FEATURE_REGISTRY_VERSION } from './domain/bulk-features.js';
import { buildPortfolioIntelligence, PORTFOLIO_INTELLIGENCE_VERSION } from './domain/portfolio-intelligence.js';
import { buildPredictiveLabSnapshot, buildProjectLabPrediction, PREDICTIVE_LAB_VERSION, getResearchArtifactPath } from './domain/predictive-lab.js';
import { canArchiveProject, PORTFOLIO_GOVERNANCE_VERSION } from './domain/portfolio-governance.js';
import { U75_BULK_INTEGRATION_VERSION, U75_SOURCE_STATES, U75_INGESTION_STATES, U75_MATCH_STATES, classifyU75Source, buildU75IntakeState, validateBulkRows, matchProjectCandidate, profileRows } from './domain/u75-bulk-integration.js';
import { U75_ORCHESTRATOR_VERSION, U75_5_PROMOTION_VERSION, previewBulkPromotion, promoteBulkRows, previewSafeBulkPromotion, promoteBulkRowsSafe, safeStoredRunPath } from './domain/u75-bulk-orchestrator.js';
import { computeRisk } from './risk-engine.js';
import { buildActionIntelligence, evaluateActionRules, U75_2_ACTION_INTELLIGENCE_VERSION } from './domain/u75.2-action-intelligence.js';
import { simulateScenario, U75_3_SCENARIO_VERSION } from './domain/u75.3-scenario-engine.js';
import { buildStatutoryTimeline, U75_4_TIMELINE_VERSION } from './domain/u75.4-timeline-engine.js';
import { buildBulkIntelligenceEnvelope, summarizeBulkIntelligence, U75_9_BULK_INTELLIGENCE_VERSION } from './domain/u75.9-bulk-intelligence.js';
import { buildBulkClosureHealth, buildBulkReconciliation, U75_10_BULK_CLOSURE_VERSION } from './domain/u75.10-bulk-closure.js';

const app = express();
const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { DATA_ROOT_DIR, DATA_INCOMING_DIR, DATA_INTAKE_TMP_DIR: INTAKE_TMP_DIR, DB_PATH: RUNTIME_DB_PATH, ensureRuntimeDirs } = require('./runtime-paths.cjs');
const { buildForensicsReport, writeForensicsReport } = require('../scripts/data-forensics.cjs');
ensureRuntimeDirs();
const PORT = Number(process.env.BACKEND_PORT || 8787);
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const TRUST_PROXY = String(process.env.BHOOMI_TRUST_PROXY || '0').trim();
const COOKIE_NAME = 'bhoomi_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const AI_PROVIDER = (process.env.AI_PROVIDER || 'local').toLowerCase();
const AI_MODEL = process.env.AI_MODEL || (AI_PROVIDER === 'gemini' ? 'gemini-3.8-flash' : 'local-rules-v1');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const AI_DATA_MODE = (process.env.AI_DATA_MODE || 'local_only').toLowerCase();
const AI_FALLBACK_MODELS = String(process.env.AI_FALLBACK_MODELS || 'gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash').split(',').map(s => s.trim()).filter(Boolean);
const AI_API_VERSION = String(process.env.GEMINI_API_VERSION || 'v1').trim();
const AI_THINKING_LEVEL = String(process.env.AI_THINKING_LEVEL || 'low').trim();
const AI_MAX_OUTPUT_TOKENS = Math.max(256, Number(process.env.AI_MAX_OUTPUT_TOKENS || 1400));
const AI_PROVIDER_TIMEOUT_MS = Math.max(5000, Number(process.env.AI_PROVIDER_TIMEOUT_MS || 12000));
const AI_PROVIDER_TOTAL_BUDGET_MS = Math.max(2500, Number(process.env.AI_PROVIDER_TOTAL_BUDGET_MS || 9000));
const AI_PROVIDER_FAILURE_COOLDOWN_MS = Math.max(15000, Number(process.env.AI_PROVIDER_FAILURE_COOLDOWN_MS || 60000));
let geminiUnavailableUntil = 0;
const AI_LOCAL_FIRST = String(process.env.AI_LOCAL_FIRST || 'true').toLowerCase() !== 'false';
const IS_PRODUCTION = String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';
const DEMO_ACCESS_ENABLED = process.env.BHOOMI_DEMO_ACCESS_ENABLED !== 'false' && !IS_PRODUCTION;
const PUBLIC_DEMO_ENABLED = String(process.env.BHOOMI_PUBLIC_DEMO_ENABLED || 'false').toLowerCase() === 'true';
const PUBLIC_DEMO_DATA_MODE = String(process.env.BHOOMI_PUBLIC_DEMO_DATA_MODE || 'synthetic_only').toLowerCase();
const ADMIN_EMAIL = String(process.env.BHOOMI_ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.BHOOMI_ADMIN_PASSWORD || '');
if (IS_PRODUCTION) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Production startup requires BHOOMI_ADMIN_EMAIL and BHOOMI_ADMIN_PASSWORD.');
  if (ADMIN_PASSWORD === 'ChangeMe!2026') throw new Error('Production startup refused: replace the development administrator password.');
  if (DEMO_ACCESS_ENABLED) throw new Error('Production startup refused: BHOOMI_DEMO_ACCESS_ENABLED must be false.');
  if (PUBLIC_DEMO_ENABLED && PUBLIC_DEMO_DATA_MODE !== 'synthetic_only') throw new Error('Production public demo requires BHOOMI_PUBLIC_DEMO_DATA_MODE=synthetic_only.');
  if (PUBLIC_DEMO_ENABLED && AI_DATA_MODE !== 'local_only') throw new Error('Production public demo requires AI_DATA_MODE=local_only.');
}
ensureAdmin(ADMIN_EMAIL || 'admin@bhoomidrishti.local', ADMIN_PASSWORD || 'ChangeMe!2026');
ensureDemoRoleAccounts(DEMO_ACCESS_ENABLED);
try { const locationRepair = repairProjectLocationIntegrity(); if (locationRepair.repaired || locationRepair.cleared) console.log(`GIS integrity repair: ${locationRepair.repaired} coordinates classified, ${locationRepair.cleared} invalid coordinates withheld.`); } catch (error) { console.warn(`GIS integrity repair skipped safely: ${error?.message || error}`); }
const AUTO_BULK_INITIALIZE = String(process.env.BHOOMI_AUTO_INITIALIZE_ON_STARTUP || 'true').toLowerCase() !== 'false';
if (AUTO_BULK_INITIALIZE) {
  try {
    const init = bulkInitializeProjects({ onlyMissing: true, actor: 'system-startup' });
    console.log(`Bulk project initialization: ${init.summary.initialized} initialized, ${init.summary.skipped} already ready, ${init.summary.failed} failed.`);
    if (init.summary.failed) console.warn(JSON.stringify(init.summary.errors));
  } catch (error) {
    console.warn(`Bulk project initialization skipped safely: ${error?.message || error}`);
  }
}

app.disable('x-powered-by');
if (TRUST_PROXY && TRUST_PROXY !== '0' && TRUST_PROXY.toLowerCase() !== 'false') {
  const numericProxy = Number(TRUST_PROXY);
  app.set('trust proxy', Number.isFinite(numericProxy) ? numericProxy : TRUST_PROXY);
}
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 180, standardHeaders: true, legacyHeaders: false }));

const sessions = new Map();
function createSession(user,meta={}){const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{...publicUser(user),...meta,createdAt:Date.now(),expiresAt:Date.now()+SESSION_TTL_MS}); return token;}
function getSession(req){const raw=req.headers.cookie||''; const pair=raw.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE_NAME}=`)); if(!pair)return null; const token=pair.slice(COOKIE_NAME.length+1); const session=sessions.get(token); if(!session||session.expiresAt<Date.now()){sessions.delete(token);return null;} return {token,session};}
function setCookie(res,token){const secure=process.env.NODE_ENV==='production'; res.setHeader('Set-Cookie',`${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS/1000)}${secure?'; Secure':''}`);}
function clearCookie(res){res.setHeader('Set-Cookie',`${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV==='production'?'; Secure':''}`);}
function hasPermission(user,p){return Array.isArray(user?.permissions)&&(user.permissions.includes('*')||user.permissions.includes(p));}
function requireAuth(req,res,next){const found=getSession(req);if(!found)return res.status(401).json({error:'Authentication required.'});req.user=found.session;req.sessionToken=found.token;next();}
function requirePermission(p){return (req,res,next)=>{if(!hasPermission(req.user,p))return res.status(403).json({error:`Permission required: ${p}.`});next();};}

app.get('/api/health',(req,res)=>res.json({ok:true,service:'bhoomidrishti-backend',database:'sqlite-persistent',dataRoot:'configured',aiMode:AI_LOCAL_FIRST ? 'local-first' : 'provider-enabled',timestamp:new Date().toISOString()}));
app.get('/api/public/demo/config',(req,res)=>{res.setHeader('Cache-Control','no-store');return res.json({
  enabled:PUBLIC_DEMO_ENABLED,
  mode:PUBLIC_DEMO_ENABLED?'synthetic_read_only':'disabled',
  dataMode:PUBLIC_DEMO_DATA_MODE,
  feedbackEnabled:PUBLIC_DEMO_ENABLED,
  notice:'Public demo records are synthetic/reference records. They are not government records, official decisions, or validated production ML outcomes.',
  capabilities:['dashboard','projects','risk map','alerts','history','reports','local evidence AI','public feedback'],
  restrictions:['read-only','no uploads','no project edits','no bulk promotion','no administrative controls','no external AI provider'],
});});
const publicDemoLimiter=rateLimit({windowMs:60_000,max:12,standardHeaders:true,legacyHeaders:false,message:{error:'Public demo request limit reached. Please wait a minute and try again.'}});
app.post('/api/public/demo/session',publicDemoLimiter,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!PUBLIC_DEMO_ENABLED)return res.status(404).json({error:'Public demo is disabled.'});
  if(PUBLIC_DEMO_DATA_MODE!=='synthetic_only')return res.status(503).json({error:'Public demo is misconfigured: synthetic_only data mode is required.'});
  const syntheticCount=listProjects().filter(p=>String(p.sourceLabel||p.source?.label||'').toLowerCase()==='synthetic_demo').length;
  if(!syntheticCount)return res.status(503).json({error:'Public demo is unavailable until synthetic reference records are loaded.'});
  const user={id:`public-demo-viewer-${crypto.randomUUID()}`,email:'public-demo@bhoomidrishti.local',name:'Public Demo Viewer',role:'Viewer',status:'active',organisation:'Public Demonstration',jurisdiction_json:JSON.stringify({state:'National',district:'National',projectIds:[]}),permissions_json:JSON.stringify(['dashboard:read','projects:read','risk:read','map:read','alerts:read','history:read','ai:use','reports:read']),must_change_password:0};
  const token=createSession(user,{publicDemo:true});
  setCookie(res,token);
  res.json({user:{...publicUser(user),publicDemo:true},notice:'Synthetic read-only demonstration session.',dataMode:'synthetic_only',syntheticProjectCount:syntheticCount});
});
app.get('/api/admin/bulk-initialize/status',requireAuth,requirePermission('workflow:admin'),(req,res)=>res.json(getBulkInitializationStatus()));
app.get('/api/admin/bulk-features/status',requireAuth,requirePermission('workflow:admin'),(req,res)=>res.json(getBulkFeatureStatus()));
app.get('/api/admin/bulk-features/registry',requireAuth,requirePermission('workflow:admin'),(req,res)=>res.json({version:BULK_FEATURE_REGISTRY_VERSION,features:BULK_FEATURE_REGISTRY}));
app.post('/api/admin/bulk-features',requireAuth,requirePermission('workflow:admin'),(req,res)=>{try{const result=bulkInitializeFeatures({onlyMissing:req.body?.onlyMissing!==false,force:req.body?.force===true});res.status(result.summary.failed?207:200).json(result);}catch(e){res.status(500).json({error:e?.message||'Bulk feature initialization failed safely.',version:BULK_FEATURE_REGISTRY_VERSION});}});
app.post('/api/admin/bulk-initialize',requireAuth,requirePermission('workflow:admin'),(req,res)=>{try{const result=bulkInitializeProjects({onlyMissing:req.body?.onlyMissing!==false,forceRefresh:req.body?.forceRefresh===true,actor:req.user.email});res.status(result.summary.failed?207:200).json(result);}catch(e){res.status(500).json({error:e?.message||'Bulk initialization failed safely.',version:BULK_INITIALIZATION_VERSION});}});
function propagateBulkProjectsForAdmin(projectIds, actor, force=true) {
  const requested=new Set((projectIds||[]).map(String).filter(Boolean));
  const projects=listProjects().filter(p=>!requested.size || requested.has(String(p.id)));
  const results=[];
  for(const initialProject of projects){
    try{
      const init=initializeProjectIntelligence(initialProject,{actor:actor?.email||'system',forceRefresh:Boolean(force)});
      const project=getProject(initialProject.id)||initialProject;
      const states=initializeProjectFeatures(project,{force:true});
      const facts=getProjectDataFacts(project.id);
      const predictions=listPredictions(project.id,5);
      const stages=listProjectStages(project.id);
      const events=listProjectEvents(project.id);
      const alerts=listOperationalAlerts({projectIds:[project.id],status:'all',limit:200});
      const recommendations=listRecommendations(project.id);
      const risk=computeRisk(project);
      const earlyWarning=buildEarlyWarning(project);
      const actionIntelligence=buildActionIntelligence(project,{risk});
      const timeline=buildStatutoryTimeline(project,stages,events);
      const envelope=buildBulkIntelligenceEnvelope(project,{facts,predictions,stages,events,featureStates:states,alerts,recommendations,earlyWarning,actionIntelligence,timeline,risk});
      audit({actor:actor?.email||'system',actorRole:actor?.role||'system',action:'u75.bulk_intelligence.propagated',resourceType:'project',resourceId:String(project.id),outcome:'success',metadata:{version:U75_9_BULK_INTELLIGENCE_VERSION,force:Boolean(force),featureCount:states.length,alertCount:alerts.length,recommendationCount:recommendations.length,risk:risk.overall,riskVelocity:envelope.riskVelocity.direction}});
      results.push({status:'READY',projectId:String(project.id),projectName:project.name,initialization:init,...envelope});
    }catch(error){
      audit({actor:actor?.email||'system',actorRole:actor?.role||'system',action:'u75.bulk_intelligence.propagation_failed',resourceType:'project',resourceId:String(initialProject.id),outcome:'failed',metadata:{version:U75_9_BULK_INTELLIGENCE_VERSION,error:String(error?.message||error)}});
      results.push({status:'FAILED',projectId:String(initialProject.id),projectName:initialProject.name,error:String(error?.message||error)});
    }
  }
  return {version:U75_9_BULK_INTELLIGENCE_VERSION,force:Boolean(force),summary:summarizeBulkIntelligence(results),results};
}

app.get('/api/admin/u75/bulk/intelligence',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const requested=String(req.query?.projectIds||'').split(',').map(x=>x.trim()).filter(Boolean);
    const projects=listProjects().filter(p=>!requested.length || requested.includes(String(p.id)));
    const rows=projects.map(project=>{
      try {
        const facts=getProjectDataFacts(project.id);
        const predictions=listPredictions(project.id,5);
        const stages=listProjectStages(project.id);
        const events=listProjectEvents(project.id);
        const featureStates=listBulkFeatureStates(project.id);
        const alerts=listOperationalAlerts({projectIds:[project.id],status:'all',limit:200});
        const recommendations=listRecommendations(project.id);
        const risk=computeRisk(project);
        const earlyWarning=buildEarlyWarning(project);
        const actionIntelligence=buildActionIntelligence(project,{risk});
        const timeline=buildStatutoryTimeline(project,stages,events);
        return {status:'READY',...buildBulkIntelligenceEnvelope(project,{facts,predictions,stages,events,featureStates,alerts,recommendations,earlyWarning,actionIntelligence,timeline,risk})};
      } catch (error) {
        return {status:'FAILED',projectId:String(project.id),projectName:project.name,error:String(error?.message||error)};
      }
    });
    res.json({version:U75_9_BULK_INTELLIGENCE_VERSION,...summarizeBulkIntelligence(rows),rows});
  } catch (e) {
    res.status(500).json({error:e?.message||'Bulk intelligence overview unavailable safely.',version:U75_9_BULK_INTELLIGENCE_VERSION});
  }
});
app.post('/api/admin/u75/bulk/intelligence-refresh',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const requested=Array.isArray(req.body?.projectIds)?req.body.projectIds.map(String).filter(Boolean):[];
    const result=propagateBulkProjectsForAdmin(requested,req.user,Boolean(req.body?.force));
    res.status(result.summary.failed?207:200).json(result);
  } catch(e) {
    res.status(500).json({error:e?.message||'Bulk intelligence propagation failed safely.',version:U75_9_BULK_INTELLIGENCE_VERSION});
  }
});
app.get('/api/admin/u75/bulk/intelligence/export.csv',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const requested=String(req.query?.projectIds||'').split(',').map(x=>x.trim()).filter(Boolean);
    const projects=listProjects().filter(p=>!requested.length || requested.includes(String(p.id)));
    const rows=projects.map(project=>{
      const risk=computeRisk(project);
      const predictions=listPredictions(project.id,5);
      const velocity=buildBulkIntelligenceEnvelope(project,{predictions,risk,actionIntelligence:buildActionIntelligence(project,{risk}),timeline:buildStatutoryTimeline(project,listProjectStages(project.id),listProjectEvents(project.id)),featureStates:listBulkFeatureStates(project.id),facts:getProjectDataFacts(project.id),alerts:listOperationalAlerts({projectIds:[project.id],status:'all',limit:200}),recommendations:listRecommendations(project.id)}).riskVelocity;
      return [project.id,project.code,project.name,project.state,project.district,project.status,risk.overall,risk.band,velocity.direction,velocity.delta??'',project.familiesPending??'',project.disputes??'',project.courtCases??'',project.approvalPct??'',project.docsMissing??'',project.locationPrecision??''];
    });
    const esc=v=>{const x=String(v??'');return /[",\n]/.test(x)?`"${x.replaceAll('"','""')}"`:x;};
    const header=['project_id','code','project_name','state','district','status','risk','risk_band','risk_velocity','risk_velocity_delta','families_pending','disputes','court_cases','approval_pct','docs_missing','location_precision'];
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="bhoomidrishti-bulk-intelligence.csv"');
    res.send([header,...rows].map(r=>r.map(esc).join(',')).join('\n'));
  } catch(e) { res.status(500).json({error:e?.message||'Bulk intelligence export failed safely.'}); }
});

app.get('/api/admin/u75/bulk/health',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try{
    const runs=listDataIngestionRuns(Math.min(Number(req.query.limit||100),100));
    const batches=listBulkPromotionBatches({limit:Math.min(Number(req.query.batchLimit||100),100)});
    const projects=listProjects();
    const intelligenceRows=projects.map(p=>{
      const predictions=listPredictions(p.id,2);
      const risk=computeRisk(p);
      const velocity=buildBulkIntelligenceEnvelope(p,{predictions,risk}).riskVelocity;
      const actions=buildActionIntelligence(p,{risk});
      return {status:'READY',risk, riskVelocity:velocity, intervention:{actionability:(actions?.candidates||[]).length?'ACTION_QUEUE_READY':'NO_RULE_MATCH'}};
    });
    const intelligenceSummary=summarizeBulkIntelligence(intelligenceRows);
    const health=buildBulkClosureHealth({runs,batches,projects,intelligenceSummary,connectorCount:PUBLIC_CONNECTOR_CATALOG.length});
    res.json({version:U75_10_BULK_CLOSURE_VERSION,health});
  }catch(e){res.status(500).json({error:e?.message||'Bulk closure health unavailable safely.',version:U75_10_BULK_CLOSURE_VERSION});}
});
app.get('/api/admin/u75/bulk/reconciliation',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try{
    const runId=String(req.query?.ingestionRunId||'').trim();
    if(!runId)return res.status(400).json({error:'ingestionRunId is required for reconciliation.'});
    const run=getDataIngestionRun(runId);
    if(!run)return res.status(404).json({error:'Ingestion run not found.'});
    const batches=listBulkPromotionBatches({ingestionRunId:runId,limit:50});
    const evidence=listBulkPromotionEvidence({ingestionRunId:runId,limit:5000});
    const projectIds=[...new Set(evidence.map(e=>e?.projectId).filter(Boolean).map(String))];
    const projects=projectIds.map(id=>getProject(id)).filter(Boolean);
    const intelligenceRows=projects.map(project=>{const risk=computeRisk(project);const predictions=listPredictions(project.id,2);const riskVelocity=buildBulkIntelligenceEnvelope(project,{predictions,risk}).riskVelocity;const actionIntelligence=buildActionIntelligence(project,{risk});return {status:'READY',risk,riskVelocity,intervention:{actionability:(actionIntelligence?.candidates||[]).length?'ACTION_QUEUE_READY':'NO_RULE_MATCH'}};});
    const intelligenceSummary=summarizeBulkIntelligence(intelligenceRows);
    const reconciliation=buildBulkReconciliation({ingestionRun:run,batches,evidence,projects,intelligence:intelligenceSummary});
    res.status(reconciliation.safeToProceed?200:207).json({version:U75_10_BULK_CLOSURE_VERSION,reconciliation,intelligence:intelligenceSummary});
  }catch(e){res.status(500).json({error:e?.message||'Bulk reconciliation failed safely.',version:U75_10_BULK_CLOSURE_VERSION});}
});
app.post('/api/admin/u75/bulk/preflight',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try{
    const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
    if(rows.length>10000)return res.status(413).json({error:'Bulk preflight limited to 10000 rows.'});
    const validation=validateBulkRows(rows,{requiredFields:req.body?.requiredFields||[],allowedStatuses:req.body?.allowedStatuses||['ongoing','completed']});
    if(!validation.valid)return res.status(422).json({version:U75_10_BULK_CLOSURE_VERSION,validation,safeToProceed:false});
    const matchRows=rows.map((row,index)=>({row:index+1,...matchProjectCandidate(row,authorisedProjects(req.user))}));
    const counts={};
    for(const item of matchRows)counts[item.state]=(counts[item.state]||0)+1;
    const safe=Boolean(validation.valid)&&!Object.entries(counts).some(([k])=>String(k).toUpperCase()==='CONFLICT');
    res.status(safe?200:207).json({version:U75_10_BULK_CLOSURE_VERSION,validation,matching:{counts,results:matchRows},safeToProceed:safe,guardrails:['Validation required','Conflicts require review','Existing non-empty authoritative values are preserved','Promotion remains administrator-only']});
  }catch(e){res.status(400).json({error:e?.message||'Bulk preflight failed safely.',version:U75_10_BULK_CLOSURE_VERSION});}
});

app.get('/api/projects/:id/features',requireAuth,requirePermission('projects:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});res.json(getProjectFeatureStatus(project.id));});
app.get('/api/system/readiness',requireAuth,requirePermission('dashboard:read'),(req,res)=>{const projects=authorisedProjects(req.user);const alerts=listOperationalAlerts({projectIds:projects.map(p=>p.id),status:'all',limit:500});const feedback=projects.reduce((n,p)=>n+listOfficerFeedback(p.id).length,0);const actions=projects.reduce((n,p)=>n+listInterventionActions(p.id).length,0);const outcomes=projects.reduce((n,p)=>n+listInterventionActions(p.id).filter(a=>a.outcomeJson).length,0);const readiness=evaluatePromotionGate({});res.json({version:'system-readiness-v1',generatedAt:new Date().toISOString(),scope:{projects:projects.length,ongoing:projects.filter(p=>p.status==='ongoing').length,completed:projects.filter(p=>p.status==='completed').length},operations:{alerts:alerts.length,openAlerts:alerts.filter(a=>['open','acknowledged'].includes(a.status)).length,feedback,actions,outcomes,replayRuns:projects.reduce((n,p)=>n+(latestReplayRun(p.id)?1:0),0)},intelligence:{candidateRiskAvailable:projects.length>0,productionModelPromotable:readiness.productionPromotionAllowed===true,productionGate:readiness.gate?.status||'BLOCKED'},architecture:{automaticProjectBootstrap:PROJECT_LIFECYCLE_VERSION,unifiedDataBackbone:UNIFIED_DATA_BACKBONE_VERSION,aiEvidenceGrounded:true,temporalControls:true,auditTrail:true},limitations:['Production ML promotion requires authorised real historical outcome data and completed governance gates.','Government integrations remain adapter/configuration dependent until authorised access contracts exist.']});});
app.get('/api/ml/readiness',requireAuth,requirePermission('risk:read'),(req,res)=>{
  if(req.user.publicDemo){
    res.setHeader('Cache-Control','no-store');
    return res.json({governanceVersion:ML_GOVERNANCE_VERSION,modelStatus:PRODUCTION_MODEL_STATUS,status:'DEMO_ONLY',productionPromotionAllowed:false,dataScope:'synthetic_demo_only',note:'Public demonstration readiness is intentionally limited to the synthetic reference dataset; authoritative/private readiness details are not exposed.'});
  }
  const f=path.join(DATA_ROOT_DIR,'forensics','SIH26017_DATA_READINESS_LATEST.json');let report=null;if(fs.existsSync(f)){try{report=JSON.parse(fs.readFileSync(f,'utf8'));}catch(_){}}const readiness=buildReadinessFromForensics(report,null,null,null);res.json({governanceVersion:ML_GOVERNANCE_VERSION,modelStatus:PRODUCTION_MODEL_STATUS,...readiness});
});
app.get('/api/ml/gates',requireAuth,requirePermission('risk:read'),(req,res)=>{
  if(req.user.publicDemo){
    res.setHeader('Cache-Control','no-store');
    return res.json({governanceVersion:ML_GOVERNANCE_VERSION,productionModelStatus:PRODUCTION_MODEL_STATUS,gate:{status:'BLOCKED',productionPromotionAllowed:false,reason:'Public demonstration is synthetic/reference-data only.'},dataScope:'synthetic_demo_only'});
  }
  res.json({governanceVersion:ML_GOVERNANCE_VERSION,productionModelStatus:PRODUCTION_MODEL_STATUS,gate:evaluatePromotionGate({})});
});
app.get('/api/ml/lab',requireAuth,requirePermission('risk:read'),(req,res)=>{try{const projects=authorisedProjects(req.user);const dataset=latestDatasetVersion();const f=path.join(DATA_ROOT_DIR,'forensics','SIH26017_DATA_READINESS_LATEST.json');let report=null;if(fs.existsSync(f)){try{report=JSON.parse(fs.readFileSync(f,'utf8'));}catch(_){}}const readiness=buildReadinessFromForensics(report,null,null,null);const snapshot=buildPredictiveLabSnapshot(projects,{readiness,dataset});res.json(snapshot);}catch(e){res.status(500).json({error:e?.message||'Predictive lab unavailable.',version:PREDICTIVE_LAB_VERSION});}});
app.get('/api/ml/lab/projects/:id',requireAuth,requirePermission('risk:read'),(req,res)=>{try{const project=authorisedProjects(req.user).find(p=>String(p.id)===String(req.params.id));if(!project)return res.status(404).json({error:'Project not found in authorised scope.'});res.json(buildProjectLabPrediction(project));}catch(e){res.status(500).json({error:e?.message||'Project predictive lab unavailable.'});}});
app.post('/api/ml/lab/build-artifact',requireAuth,requirePermission('workflow:admin'),(req,res)=>{try{const script=path.join(SERVER_DIR,'..','scripts','build-predictive-research-artifact.cjs');const result=spawnSync(process.execPath,[script],{cwd:path.join(SERVER_DIR,'..'),env:process.env,encoding:'utf8'});const output=String(result.stdout||'').trim();const error=String(result.stderr||'').trim();audit({actor:req.user.email,actorRole:req.user.role,action:'ml.predictive_research_artifact.build',resourceType:'ml_artifact',resourceId:'predictive-intelligence-v2',outcome:result.status===0?'success':'blocked',metadata:{output:output.slice(-4000),error:error.slice(-2000),artifactPath:getResearchArtifactPath()}});if(result.status!==0)return res.status(409).json({error:error||output||'Research artifact build blocked safely.',output});res.status(201).json({message:'Research candidate artifact built. Production promotion remains blocked.',output,artifactPath:getResearchArtifactPath()});}catch(e){res.status(500).json({error:e?.message||'Research artifact build failed safely.'});}});
app.get('/api/portfolio/intelligence',requireAuth,requirePermission('dashboard:read'),(req,res)=>{
  try {
    const projects=authorisedProjects(req.user);
    const ids=projects.map(p=>p.id);
    const alerts=listOperationalAlerts({projectIds:ids,status:'all',limit:500});
    const actions=projects.flatMap(p=>listInterventionActions(p.id));
    const feedback=projects.flatMap(p=>listOfficerFeedback(p.id));
    const readiness=evaluatePromotionGate({});
    const monitoring=buildModelMonitoringStatus();
    const rows=listDataSources();
    const byId=new Map(rows.map(r=>[r.id,r]));
    const connectors=PUBLIC_CONNECTOR_CATALOG.map(c=>({...c,registry:byId.get(c.id)||null,latest:listSourceConnectorSnapshots(c.id,1)[0]||null,health:buildConnectorHealth(listSourceConnectorSnapshots(c.id,1)[0]||null)}));
    res.json(buildPortfolioIntelligence(projects,{alerts,actions,feedback,readiness,monitoring,connectors}));
  } catch(e) { res.status(500).json({error:e?.message||'Portfolio intelligence unavailable.',version:PORTFOLIO_INTELLIGENCE_VERSION}); }
});
app.get('/api/portfolio/export.csv',requireAuth,requirePermission('dashboard:read'),(req,res)=>{
  const projects=authorisedProjects(req.user);
  const esc=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};
  const header=['project_id','code','project_name','state','district','status','risk','risk_band','stage','families_affected','families_pending','avg_delay_days','disputes','court_cases','approval_pct','docs_missing','resettlement_pct','location_precision','source_label'];
  const rows=projects.map(p=>[p.id,p.code,p.name,p.state,p.district,p.status,p.risk?.overall,p.risk?.band,p.stageName||p.stageIndex,p.familiesAffected,p.familiesPending,p.avgDelayDays,p.disputes,p.courtCases,p.approvalPct,p.docsMissing,p.resettlementPct,p.locationPrecision,p.sourceLabel]);
  res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="bhoomidrishti-portfolio.csv"'); res.send([header,...rows].map(r=>r.map(esc).join(',')).join('\n'));
});
app.get('/api/projects/:id/evidence-pack',requireAuth,requirePermission('reports:read'),(req,res)=>{
  try {
    const project=getProject(req.params.id);
    if(!project)return res.status(404).json({error:'Project not found.'});
    if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
    const alerts=listOperationalAlerts({projectIds:[project.id],status:'all',limit:100});
    const actions=listInterventionActions(project.id);
    const feedback=listOfficerFeedback(project.id);
    const predictions=listPredictions(project.id,20);
    const intelligence=buildProjectIntelligence(project);
    const timeline=buildTimeline(project);
    const evidence=buildEvidence(project);
    const earlyWarning=buildEarlyWarning(project);
    const dataFacts=getProjectDataFacts(project.id);
    const dataHub=getProjectDataHub(project.id);
    const latestIntelligence=getLatestProjectIntelligenceSnapshot(project.id);
    const projectPredictions=predictions.map(p=>({id:p.id,modelVersion:p.modelVersion,modelStatus:p.modelStatus,delayProbability:p.delayProbability,expectedAdditionalDays:p.expectedAdditionalDays,createdAt:p.createdAt,validationStatus:p.validationStatus}));
    const pack={
      schemaVersion:'bhoomidrishti-evidence-pack-v1',
      generatedAt:new Date().toISOString(),
      generatedFor:{projectId:project.id,projectCode:project.code,projectName:project.name},
      generatedBy:{role:req.user.role,scope:'authorised_project_only'},
      project,
      intelligence,
      earlyWarning,
      timeline,
      evidence,
      operational:{alerts,interventionActions:actions,officerFeedback:feedback},
      predictive:{storedPredictions:projectPredictions,latestIntelligenceSnapshot:latestIntelligence},
      data:{facts:dataFacts,hub:dataHub},
      governance:{
        sourceLabel:project.source?.label||project.sourceLabel||'unspecified',
        authoritative:Boolean(project.source?.authoritative),
        productionProbabilityAllowed:false,
        note:'Export contains decision-support records and provenance metadata. It does not establish legal ownership, statutory authority, government truth, or a validated production probability.'
      }
    };
    audit({actor:req.user.email,actorRole:req.user.role,action:'report.evidence_pack.exported',resourceType:'project',resourceId:project.id,outcome:'success',metadata:{schemaVersion:pack.schemaVersion,alertCount:alerts.length,actionCount:actions.length}});
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="bhoomidrishti-${String(project.code||project.id).replace(/[^A-Za-z0-9._-]+/g,'_')}-evidence-pack.json"`);
    res.send(JSON.stringify(pack,null,2));
  } catch(e) {
    res.status(500).json({error:e?.message||'Evidence pack export failed safely.'});
  }
});

app.get('/api/operations/action-intelligence',requireAuth,requirePermission('dashboard:read'),(req,res)=>{
  const projects=authorisedProjects(req.user).filter(p=>p.status==='ongoing');
  const candidates=[];
  for(const project of projects){
    const risk=computeRisk(project);
    const intel=buildActionIntelligence(project,{risk});
    candidates.push(...intel.candidates.map(c=>({...c,projectId:project.id,projectCode:project.code,projectName:project.name,riskOverall:risk.overall,riskBand:risk.band})));
  }
  candidates.sort((a,b)=>a.priority-b.priority || (b.riskOverall||0)-(a.riskOverall||0));
  res.json({version:U75_2_ACTION_INTELLIGENCE_VERSION,generatedAt:new Date().toISOString(),count:candidates.length,candidates:candidates.slice(0,250),
    disclaimer:'Deterministic workflow recommendations only; verify current evidence and applicable authority before acting.'});
});
app.post('/api/operations/action-intelligence/generate',requireAuth,requirePermission('workflow:action'),(req,res)=>{
  const projects=authorisedProjects(req.user).filter(p=>p.status==='ongoing');
  const generated=[]; const skipped=[];
  for(const project of projects){
    const risk=computeRisk(project);
    const candidates=evaluateActionRules(project,{risk});
    const existing=listRecommendations(project.id);
    for(const c of candidates){
      const duplicate=existing.find(x=>x.status!=='declined' && String(x.basisType)===String(c.basisType) && String(x.actionText)===String(c.actionText));
      if(duplicate){ skipped.push({projectId:project.id,ruleCode:c.ruleCode,recommendationId:duplicate.id}); continue; }
      const rec=createRecommendation({projectId:project.id,ownerRole:c.ownerRole,actionText:c.actionText,basisType:c.basisType,priority:c.priority,dueAt:null},req.user);
      generated.push({...rec,ruleCode:c.ruleCode,severity:c.severity,evidence:c.evidence});
    }
  }
  audit({actor:req.user.email,actorRole:req.user.role,action:'action_intelligence.generated',resourceType:'recommendation_batch',outcome:'success',metadata:{generated:generated.length,skipped:skipped.length,version:U75_2_ACTION_INTELLIGENCE_VERSION}});
  res.json({version:U75_2_ACTION_INTELLIGENCE_VERSION,generatedCount:generated.length,skippedCount:skipped.length,recommendations:generated});
});
app.get('/api/projects/:id/action-intelligence',requireAuth,requirePermission('projects:read'),(req,res)=>{
  const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'});
  if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
  const risk=computeRisk(project); res.json({intelligence:buildActionIntelligence(project,{risk}),persisted:listRecommendations(project.id)});
});
app.get('/api/projects/:id/scenarios',requireAuth,requirePermission('projects:read'),(req,res)=>{
  const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'});
  if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
  res.json({version:U75_3_SCENARIO_VERSION,scenarios:listInterventions(project.id)});
});
app.post('/api/projects/:id/scenarios/preview',requireAuth,requirePermission('projects:read'),(req,res)=>{
  const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'});
  if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
  res.json({scenario:simulateScenario(project,req.body?.changes||{})});
});
app.post('/api/projects/:id/scenarios',requireAuth,requirePermission('workflow:action'),(req,res)=>{
  const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'});
  if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
  const simulation=simulateScenario(project,req.body?.changes||{});
  const scenarioRecord=createIntervention({projectId:project.id,recommendationId:req.body?.recommendationId||null,scenario:simulation.scenario,estimatedEffect:{actualRisk:simulation.actualState,simulatedRisk:simulation.simulatedState,delta:simulation.delta,disclaimer:simulation.disclaimer},createdBy:req.user.email});
  audit({actor:req.user.email,actorRole:req.user.role,action:'scenario.created',resourceType:'intervention',resourceId:scenarioRecord.id,outcome:'success',metadata:{projectId:project.id,version:U75_3_SCENARIO_VERSION}});
  res.status(201).json({scenario:simulation,record:scenarioRecord});
});
app.get('/api/projects/:id/statutory-timeline',requireAuth,requirePermission('projects:read'),(req,res)=>{
  const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'});
  if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
  res.json({timeline:buildStatutoryTimeline(project,listProjectStages(project.id),listProjectEvents(project.id))});
});
app.get('/api/operations/statutory-timeline',requireAuth,requirePermission('dashboard:read'),(req,res)=>{
  const projects=authorisedProjects(req.user).filter(p=>p.status==='ongoing');
  const rows=projects.map(project=>buildStatutoryTimeline(project,listProjectStages(project.id),listProjectEvents(project.id)));
  res.json({version:U75_4_TIMELINE_VERSION,count:rows.length,configured:rows.filter(x=>x.configurationStatus==='CONFIGURED').length,rows});
});

app.get('/api/operations/overview',requireAuth,requirePermission('dashboard:read'),(req,res)=>{
  const projects=authorisedProjects(req.user);
  const alerts=listOperationalAlerts({projectIds:projects.map(p=>p.id),limit:200});
  res.json(buildOperationalOverview(projects,{alerts}));
});
app.get('/api/projects/:id/early-warning',requireAuth,requirePermission('risk:read'),(req,res)=>{
  const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'});
  if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
  res.json(buildEarlyWarning(project));
});
app.get('/api/alerts',requireAuth,requirePermission('alerts:read'),(req,res)=>{
  const projects=authorisedProjects(req.user);
  const status=String(req.query?.status||'open');
  res.json({alerts:listOperationalAlerts({projectIds:projects.map(p=>p.id),status,limit:Math.min(Math.max(Number(req.query?.limit||100),1),300)})});
});
app.post('/api/alerts/generate',requireAuth,requirePermission('alerts:action'),(req,res)=>{
  const projects=authorisedProjects(req.user).filter(p=>p.status==='ongoing');
  const created=[];
  for(const project of projects){
    const warning=buildEarlyWarning(project);
    if(warning.severity==='low') continue;
    const alert=upsertOperationalAlert({projectId:project.id,category:warning.primarySignal,severity:warning.severity,title:`${warning.severity.toUpperCase()} early-warning: ${project.name}`,reason:`${warning.primarySignal} is the strongest current rule-based operational signal; attention score ${warning.attentionScore}/100.`,attentionScore:warning.attentionScore,warningWindowDays:warning.warningWindowDays,warningWindowStatus:warning.warningWindowStatus,metadata:{warning,projectStatus:project.status}});
    created.push(alert);
  }
  audit({actor:req.user.email,actorRole:req.user.role,action:'alerts.generated',resourceType:'operational_alert',outcome:'success',metadata:{count:created.length,ruleVersion:OPERATIONAL_INTELLIGENCE_VERSION}});
  res.json({count:created.length,alerts:created});
});
app.get('/api/alerts/:id/events',requireAuth,requirePermission('alerts:read'),(req,res)=>{
  const alert=getOperationalAlert(req.params.id); if(!alert)return res.status(404).json({error:'Alert not found.'});
  const project=getProject(alert.projectId); if(!project||!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Alert is outside your authorised scope.'});
  res.json({alert,events:listAlertEvents(alert.id)});
});
app.patch('/api/alerts/:id',requireAuth,requirePermission('alerts:action'),(req,res)=>{
  const alert=getOperationalAlert(req.params.id); if(!alert)return res.status(404).json({error:'Alert not found.'});
  const project=getProject(alert.projectId); if(!project||!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Alert is outside your authorised scope.'});
  const status=String(req.body?.status||''); if(!['open','acknowledged','resolved','dismissed'].includes(status))return res.status(400).json({error:'Invalid alert status.'});
  const updated=updateOperationalAlertStatus(alert.id,{status,actorId:req.user.id,note:req.body?.note||null});
  audit({actor:req.user.email,actorRole:req.user.role,action:`alert.${status}`,resourceType:'operational_alert',resourceId:alert.id,outcome:'success',metadata:{projectId:alert.projectId}});
  res.json({alert:updated});
});
app.get('/api/ml/monitoring',requireAuth,requirePermission('risk:read'),(req,res)=>{
  const latest=latestModelMonitoringSnapshot(req.query?.modelVersion||null);
  const readinessFile=path.join(DATA_ROOT_DIR,'ml','ML_READINESS_LATEST.json');
  let readiness=null; if(fs.existsSync(readinessFile)){try{readiness=JSON.parse(fs.readFileSync(readinessFile,'utf8'));}catch(_){}}
  res.json(buildModelMonitoringStatus({readiness,latestSnapshot:latest}));
});
app.post('/api/ml/monitoring/snapshot',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  const snapshot=createModelMonitoringSnapshot({...req.body,createdBy:req.user.email});
  audit({actor:req.user.email,actorRole:req.user.role,action:'ml.monitoring.snapshot',resourceType:'model_monitoring_snapshot',resourceId:snapshot.id,outcome:'success',metadata:{modelVersion:snapshot.modelVersion,driftStatus:snapshot.driftStatus}});
  res.status(201).json({snapshot});
});
app.get('/api/projects/:id/replay',requireAuth,requirePermission('history:read'),(req,res)=>{
  const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'});
  if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
  const stats=getProjectOperationalStats(project.id);
  const events=listProjectEvents(project.id).sort((a,b)=>String(a.occurredAt).localeCompare(String(b.occurredAt)));
  const predictions=listPredictions(project.id,100);
  const feedback=listOfficerFeedback(project.id);
  const actions=listInterventionActions(project.id);
  const latest=latestReplayRun(project.id);
  res.json({project:{id:project.id,name:project.name,code:project.code},stats,latestReplay:latest,replay:{status:'READY',pointInTimeSupported:true,events,predictions,feedback,actions}});
});
app.post('/api/projects/:id/replay',requireAuth,requirePermission('history:read'),(req,res)=>{
  const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'});
  if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
  const asOf=req.body?.asOf ? new Date(req.body.asOf).toISOString() : null;
  const stats=getProjectOperationalStats(project.id);
  const events=listProjectEvents(project.id).filter(e=>!asOf||String(e.occurredAt)<=asOf).sort((a,b)=>String(a.occurredAt).localeCompare(String(b.occurredAt)));
  const predictions=listPredictions(project.id,100).filter(p=>!asOf||String(p.predictionAsOf)<=asOf);
  const feedback=listOfficerFeedback(project.id).filter(f=>!asOf||String(f.createdAt)<=asOf);
  const actions=listInterventionActions(project.id).filter(a=>!asOf||String(a.createdAt)<=asOf);
  const replay={pointInTimeSupported:true,asOf,events,predictions,feedback,actions,snapshotCount:stats.snapshotCount,eventCount:events.length,predictionCount:predictions.length,outcomeCount:actions.filter(a=>a.outcomeJson).length};
  const run=createReplayRun({projectId:project.id,asOf,replay,createdBy:req.user.id});
  audit({actor:req.user.email,actorRole:req.user.role,action:'project.replay.created',resourceType:'replay_run',resourceId:run.id,outcome:'success',metadata:{projectId:project.id,asOf}});
  res.status(201).json({run,replay});
});

app.get('/api/ai/status',requireAuth,requirePermission('ai:use'),(req,res)=>{const configured=AI_PROVIDER==='gemini'?Boolean(GEMINI_API_KEY):AI_PROVIDER==='anthropic'?Boolean(ANTHROPIC_API_KEY):true;res.json({provider:AI_PROVIDER,model:AI_MODEL,externalEnabled:AI_DATA_MODE==='external_allowed',providerConfigured:configured,providerUsable:AI_PROVIDER==='local'?true:(configured&&AI_DATA_MODE==='external_allowed'),authorisedProjectCount:authorisedProjects(req.user).length,mode:AI_LOCAL_FIRST ? 'local-first+provider-available' : (AI_DATA_MODE==='external_allowed' ? `${AI_PROVIDER}-private-proxy+local-fallback` : 'local-evidence-engine'),localFirst:AI_LOCAL_FIRST,providerCircuitOpen:Date.now()<geminiUnavailableUntil,providerRetryAt:geminiUnavailableUntil||null,configurationNote:AI_PROVIDER==='local'?'Local evidence engine is active; no external API key is required.':(!configured?'External provider selected but its API key is not configured.':AI_DATA_MODE!=='external_allowed'?'External provider configured but blocked by AI_DATA_MODE.':'External provider is configured and permitted; live provider availability still requires a successful request.')});});

const authLoginLimiter=rateLimit({windowMs:15*60_000,max:10,standardHeaders:true,legacyHeaders:false,message:{error:'Too many sign-in attempts. Please try again later.'}});
app.post('/api/auth/login',authLoginLimiter,(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase();const password=String(req.body?.password||'');if(!email||!password)return res.status(400).json({error:'Email and password are required.'});const user=getUserByEmail(email);if(!user||user.status!=='active'||!verifyPassword(password,user)){audit({actor:email,action:'auth.login_failed',outcome:'denied'});return res.status(401).json({error:'Invalid credentials or inactive account.'});}const token=createSession(user);setCookie(res,token);audit({actor:user.email,actorRole:user.role,action:'auth.login',outcome:'success'});res.json({user:publicUser(user)});});
app.get('/api/auth/me',requireAuth,(req,res)=>res.json({user:req.user}));
app.post('/api/auth/logout',(req,res)=>{const found=getSession(req);if(found){audit({actor:found.session.email,actorRole:found.session.role,action:'auth.logout',outcome:'success'});sessions.delete(found.token);}clearCookie(res);res.json({ok:true});});
app.get('/api/auth/roles',requireAuth,(req,res)=>res.json({roles:Object.entries(ROLE_DESCRIPTIONS).map(([role,description])=>({role,description,permissions:ROLE_PERMISSIONS[role]||[]}))}));
const publicFeedbackLimiter=rateLimit({windowMs:15*60_000,max:5,standardHeaders:true,legacyHeaders:false,message:{error:'Feedback limit reached. Please try again later.'}});
function requirePublicDemoSession(req,res,next){
  const found=getSession(req);
  if(!found)return res.status(401).json({error:'Public demonstration session required.'});
  if(!found.session?.publicDemo)return res.status(403).json({error:'This endpoint is reserved for the public demonstration session.'});
  req.user=found.session; req.sessionToken=found.token; next();
}
app.post('/api/public/demo-feedback',publicFeedbackLimiter,requirePublicDemoSession,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!PUBLIC_DEMO_ENABLED)return res.status(404).json({error:'Public demo feedback is disabled.'});
  const rating=Number(req.body?.rating);
  const category=String(req.body?.category||'General').trim();
  const worked=String(req.body?.worked||'').trim();
  const improvements=String(req.body?.improvements||'').trim();
  const wouldUse=String(req.body?.wouldUse||'').trim();
  if(!Number.isInteger(rating)||rating<1||rating>5)return res.status(400).json({error:'Rating must be an integer from 1 to 5.'});
  if(category.length<2||category.length>80)return res.status(400).json({error:'Category is invalid.'});
  if(worked.length>2000||improvements.length>2000)return res.status(400).json({error:'Feedback is limited to 2000 characters per field.'});
  if(!worked&&!improvements)return res.status(400).json({error:'Tell us at least one thing that worked or could be improved.'});
  try{
    const found=getSession(req);
    const record=createPublicDemoFeedback({rating,category,worked,improvements,wouldUse,sessionId:found?.token?.slice(0,16)||null});
    res.status(201).json({feedback:record});
  }catch(e){res.status(400).json({error:e?.message||'Feedback could not be saved.'});}
});
app.get('/api/admin/public-demo-feedback',requireAuth,requirePermission('admin:access'),(req,res)=>res.json({summary:getPublicDemoFeedbackSummary(),feedback:listPublicDemoFeedback(req.query.limit)}));

const ACCESS_PROFILES = {
  Administrator: { scope:'System-wide', authorityModel:'Platform administration / deployment authority', modules:['Access & security','Data sources','Audit','Model governance','Configuration'], note:'Application profile. Actual government cadre/designation is deployment-configured.' },
  'Government Officer': { scope:'Assigned jurisdiction / projects', authorityModel:'Project oversight, prioritisation and escalation', modules:['Command Center','Project intelligence','Risk radar','Workflow','Reports'], note:'Authority boundaries are assigned by the administrator.' },
  'Department Officer': { scope:'Assigned department / projects', authorityModel:'Operational execution and verification', modules:['Assigned actions','Compensation','Documentation','Workflow','Reports'], note:'Department and project scope are administrator-assigned.' },
  'Legal Officer': { scope:'Assigned legal/jurisdictional scope', authorityModel:'Legal review and evidence verification', modules:['Dispute radar','Evidence center','Documents','Legal review','Reports'], note:'Legal conclusions remain with the authorised legal function.' },
  Viewer: { scope:'Assigned read-only scope', authorityModel:'Read-only monitoring and reporting', modules:['Dashboards','Risk radar','Maps','History','Reports'], note:'No mutation or privileged workflow actions.' },
};
app.get('/api/public/access-profiles',(req,res)=>res.json({profiles:Object.entries(ACCESS_PROFILES).map(([role,v])=>({role,...v}))}));
app.post('/api/access-requests',(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase();const name=String(req.body?.name||'').trim();const organisation=String(req.body?.organisation||'').trim();const requestedRole=String(req.body?.requestedRole||'').trim();const justification=String(req.body?.justification||'').trim();if(!email||!name||!organisation||!requestedRole||!justification)return res.status(400).json({error:'Name, email, organisation, requested access profile and justification are required.'});if(!ROLE_DESCRIPTIONS[requestedRole]||requestedRole==='Administrator')return res.status(400).json({error:'Select an eligible requested access profile.'});try{const reqRecord=createAccessRequest({name,email,organisation,requestedRole,justification});audit({actor:email,action:'access.requested',resourceType:'access_request',resourceId:reqRecord.id,outcome:'pending',metadata:{requestedRole}});res.status(201).json({request:reqRecord});}catch(e){const msg=String(e?.message||'');if(msg.includes('UNIQUE')||msg.includes('already'))return res.status(409).json({error:'An account or pending access request already exists for this email.'});res.status(500).json({error:'Unable to create access request.'});}});
app.get('/api/admin/access-requests',requireAuth,requirePermission('admin:access'),(req,res)=>res.json({requests:listRequests()}));
app.get('/api/admin/users',requireAuth,requirePermission('admin:access'),(req,res)=>res.json({users:listUsers()}));
app.post('/api/admin/users/:id/assignment',requireAuth,requirePermission('admin:access'),(req,res)=>{try{const role=String(req.body?.role||'');if(!ACCESS_PROFILES[role] || role==='Administrator')return res.status(400).json({error:'Invalid operational profile.'});const updated=updateUserAccess({id:req.params.id,role,organisation:String(req.body?.organisation||''),state:String(req.body?.state||'Unassigned'),district:String(req.body?.district||'Unassigned'),projectIds:Array.isArray(req.body?.projectIds)?req.body.projectIds:[]});if(!updated)return res.status(404).json({error:'User not found.'});audit({actor:req.user.email,actorRole:req.user.role,action:'user.assignment_updated',resourceType:'user',resourceId:req.params.id,outcome:'success',metadata:{role,state:req.body?.state||'Unassigned',district:req.body?.district||'Unassigned'}});res.json({user:updated});}catch(e){res.status(400).json({error:e?.message||'Unable to update user scope.'});}});
app.post('/api/admin/access-requests/:id/decision',requireAuth,requirePermission('admin:access'),(req,res)=>{const decision=String(req.body?.decision||'').toLowerCase();const assignedRole=String(req.body?.assignedRole||'');try{const out=decideAccessRequest({id:req.params.id,decision,assignedRole,actor:req.user});if(out.error)return res.status(out.code).json({error:out.error});audit({actor:req.user.email,actorRole:req.user.role,action:`access.${decision}ed`,resourceType:'access_request',resourceId:req.params.id,outcome:decision,metadata:{assignedRole:out.request?.assignedRole||null}});res.json(out);}catch(e){res.status(500).json({error:'Access decision failed safely; no partial account should be created.'});}});
app.get('/api/admin/audit',requireAuth,requirePermission('admin:audit'),(req,res)=>res.json({events:listAudit(Math.min(Math.max(Number(req.query.limit||200),1),1000))}));

function isProjectAuthorised(user, project) {
  if (!user || !project) return false;
  if (user.publicDemo) {
    if (PUBLIC_DEMO_DATA_MODE !== 'synthetic_only') return false;
    const source=String(project.sourceLabel || project.source?.label || '').toLowerCase();
    return source === 'synthetic_demo';
  }
  if (user.role === 'Administrator' || Array.isArray(user.permissions) && user.permissions.includes('*')) return true;
  const j = user.jurisdiction || {};
  const state = String(j.state || user.state || '').trim();
  const district = String(j.district || user.district || '').trim();
  const projectIds = Array.isArray(j.projectIds) ? j.projectIds.map(String) : [];
  if (projectIds.length && !projectIds.includes(String(project.id))) return false;
  if (state && !['Unassigned','National',''].includes(state) && String(project.state).toLowerCase() !== state.toLowerCase()) return false;
  if (district && !['Unassigned','National',''].includes(district) && String(project.district).toLowerCase() !== district.toLowerCase()) return false;
  return true;
}
function authorisedProjects(user, filters={}) {
  return listProjects(filters).filter(p=>isProjectAuthorised(user,p));
}
app.get('/api/projects',requireAuth,requirePermission('projects:read'),(req,res)=>res.json({projects:authorisedProjects(req.user,{state:req.query.state,district:req.query.district,status:req.query.status,type:req.query.type,q:req.query.q})}));
app.get('/api/projects/:id',requireAuth,requirePermission('projects:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});res.json({project});});
app.get('/api/projects-archived',requireAuth,requirePermission('projects:archive'),(req,res)=>{
  const projects=listArchivedProjects().filter(p=>canArchiveProject(req.user,{...p,portfolioStatus:'active'}).allowed);
  res.json({projects,governanceVersion:PORTFOLIO_GOVERNANCE_VERSION});
});
app.delete('/api/projects/:id',requireAuth,requirePermission('projects:archive'),(req,res)=>{
  const project=getProject(req.params.id);
  if(!project)return res.status(404).json({error:'Project not found or already removed.'});
  const decision=canArchiveProject(req.user,project);
  if(!decision.allowed)return res.status(403).json({error:decision.reason,code:decision.code,governanceVersion:PORTFOLIO_GOVERNANCE_VERSION});
  const reason=String(req.body?.reason||'Removed from active portfolio by authorised officer').trim().slice(0,500);
  if(reason.length<5)return res.status(400).json({error:'A removal reason of at least 5 characters is required.'});
  const archived=archiveProject(project.id,req.user,reason);
  res.json({project:archived,removed:true,mode:'soft-archive',authority:decision.code,governanceVersion:PORTFOLIO_GOVERNANCE_VERSION,message:'Project removed from the active operational portfolio. Evidence, history and audit records are preserved.'});
});
app.post('/api/projects/:id/restore',requireAuth,requirePermission('projects:archive'),(req,res)=>{
  const archived=getProjectAnyStatus(req.params.id);
  if(!archived || archived.portfolioStatus!=='archived')return res.status(404).json({error:'Archived project not found.'});
  const decision=canArchiveProject(req.user,{...archived,portfolioStatus:'active'});
  if(!decision.allowed)return res.status(403).json({error:decision.reason,code:decision.code,governanceVersion:PORTFOLIO_GOVERNANCE_VERSION});
  const restored=restoreProject(req.params.id,req.user);
  res.json({project:restored,restored:true,authority:decision.code,governanceVersion:PORTFOLIO_GOVERNANCE_VERSION});
});
function scopedDashboardSummary(user) {
  if(user?.role==='Administrator' || user?.permissions?.includes('*')) return dashboardSummary();
  const projects=authorisedProjects(user); const ongoing=projects.filter(p=>p.status==='ongoing'); const completed=projects.filter(p=>p.status==='completed');
  const high=projects.filter(p=>p.risk.band==='high').length; const medium=projects.filter(p=>p.risk.band==='medium').length; const low=projects.filter(p=>p.risk.band==='low').length;
  const byState={}; for(const p of ongoing){const x=byState[p.state]||{state:p.state,total:0,sum:0};x.total++;x.sum+=Number(p.risk.overall||0);byState[p.state]=x;}
  return {projects:projects.length,ongoing:ongoing.length,completed:completed.length,high,medium,low,parcelsAcquired:ongoing.reduce((s,p)=>s+p.parcelsAcquired,0),familiesAffected:ongoing.reduce((s,p)=>s+p.familiesAffected,0),familiesPending:ongoing.reduce((s,p)=>s+p.familiesPending,0),averageDelayDays:ongoing.length?Math.round(ongoing.reduce((s,p)=>s+p.avgDelayDays,0)/ongoing.length):0,disputes:ongoing.reduce((s,p)=>s+p.disputes,0),courtCases:ongoing.reduce((s,p)=>s+p.courtCases,0),docsMissing:ongoing.reduce((s,p)=>s+p.docsMissing,0),stateRisk:Object.values(byState).map(x=>({...x,risk:Math.round(x.sum/x.total)})).sort((a,b)=>b.risk-a.risk)};
}
app.get('/api/dashboard/summary',requireAuth,requirePermission('dashboard:read'),(req,res)=>res.json({summary:scopedDashboardSummary(req.user)}));
app.get('/api/data-sources',requireAuth,(req,res)=>res.json({sources:listDataSources()}));
app.get('/api/source-connectors/catalog',requireAuth,requirePermission('dashboard:read'),(req,res)=>{ const rows=listDataSources(); const byId=new Map(rows.map(r=>[r.id,r])); res.json({version:'source-connectors-v1',connectors:PUBLIC_CONNECTOR_CATALOG.map(c=>({...c,registry:byId.get(c.id)||null,latest:listSourceConnectorSnapshots(c.id,1)[0]||null}))}); });
app.get('/api/source-connectors/:id/snapshots',requireAuth,requirePermission('dashboard:read'),(req,res)=>{res.json({snapshots:listSourceConnectorSnapshots(req.params.id,Math.min(Number(req.query.limit||25),100))});});
app.post('/api/source-connectors/bulk-sync',requireAuth,requirePermission('workflow:admin'),async(req,res)=>{
  const requested=Array.isArray(req.body?.connectorIds)&&req.body.connectorIds.length?req.body.connectorIds.map(String):PUBLIC_CONNECTOR_CATALOG.map(c=>c.id);
  const connectors=PUBLIC_CONNECTOR_CATALOG.filter(c=>requested.includes(String(c.id)));
  const results=[];
  for(const connector of connectors){
    try{
      const snapshot=await fetchPublicConnector(connector);
      if(snapshot.ok){
        const saved=createSourceConnectorSnapshot(snapshot,req.user.email);
        results.push({connectorId:connector.id,status:'SNAPSHOT_OK',snapshot:saved});
      } else {
        const failure=createSourceConnectorFailure({connectorId:connector.id,url:connector.url,parser:connector.parser,error:snapshot.error||`HTTP ${snapshot.status||'unknown'}`,createdBy:req.user.email});
        results.push({connectorId:connector.id,status:'FAILED',snapshot:failure});
      }
    }catch(e){
      const failure=createSourceConnectorFailure({connectorId:connector.id,url:connector.url,parser:connector.parser,error:e?.message||'Public source fetch failed.',createdBy:req.user.email});
      results.push({connectorId:connector.id,status:'FAILED',snapshot:failure});
    }
  }
  audit({actor:req.user.email,actorRole:req.user.role,action:'source_connectors.bulk_sync',resourceType:'source_connector_batch',outcome:'completed',metadata:{requested:connectors.length,succeeded:results.filter(x=>x.status==='SNAPSHOT_OK').length,failed:results.filter(x=>x.status==='FAILED').length}});
  res.json({version:'source-connectors-bulk-sync-v1',count:results.length,results,note:'Public snapshots only. No government authority, live API status, or project truth is inferred from a successful HTTP fetch.'});
});
app.get('/api/source-connectors/:id/check',requireAuth,requirePermission('workflow:admin'),async(req,res)=>{
  const connector=PUBLIC_CONNECTOR_CATALOG.find(c=>c.id===req.params.id);
  if(!connector)return res.status(404).json({error:'Unknown public connector.'});
  try {
    const snapshot=await fetchPublicConnector(connector);
    res.status(snapshot.ok?200:502).json({connector, snapshot, health:buildConnectorHealth(snapshot), persisted:false, note:'Connection check only; no snapshot was persisted.'});
  } catch(e) {
    res.status(502).json({error:e?.name==='AbortError'?'Source request timed out safely.':(e?.message||'Public source check failed safely.'),connectorId:connector.id,url:connector.url,persisted:false});
  }
});
app.post('/api/source-connectors/:id/sync',requireAuth,requirePermission('workflow:admin'),async(req,res)=>{ const connector=PUBLIC_CONNECTOR_CATALOG.find(c=>c.id===req.params.id); if(!connector)return res.status(404).json({error:'Unknown public connector.'}); try { const snapshot=await fetchPublicConnector(connector); const saved=createSourceConnectorSnapshot(snapshot,req.user.email); res.status(snapshot.ok?201:502).json({connector, snapshot:saved, health:buildConnectorHealth(saved), note:'Public snapshot only; no authority is inferred from parsing.'}); } catch(e) { const failure=createSourceConnectorFailure({connectorId:connector.id,url:connector.url,parser:connector.parser,error:e?.message||'Public source fetch failed.',createdBy:req.user.email}); res.status(502).json({error:'Connector fetch failed safely; the failure was recorded.',snapshot:failure,health:'error'}); } });
app.get('/api/admin/u75/bulk/status',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const runs=listDataIngestionRuns(Math.min(Number(req.query.limit||25),100));
    const states={}; for(const state of U75_INGESTION_STATES) states[state]=0;
    for(const run of runs){ const state=String(run.status||'RECEIVED'); if(states[state]!=null) states[state]++; }
    res.json({version:U75_BULK_INTEGRATION_VERSION,sourceStates:U75_SOURCE_STATES,ingestionStates:U75_INGESTION_STATES,matchStates:U75_MATCH_STATES,runs:states,latest:runs.slice(0,10)});
  } catch(e) { res.status(500).json({error:e?.message||'U75 bulk status unavailable safely.'}); }
});
app.post('/api/admin/u75/bulk/profile',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try { const rows=Array.isArray(req.body?.rows)?req.body.rows:[]; if(rows.length>100000)return res.status(413).json({error:'Profile preview limited to 100000 rows.'}); res.json({version:U75_BULK_INTEGRATION_VERSION,sourceState:classifyU75Source(req.body||{}),profile:profileRows(rows),state:buildU75IntakeState({files:[{rows:rows.length,columns:Object.keys(rows[0]||{}).length,duplicateRowCount:profileRows(rows).duplicateCount,depthProfile:{completeness:{cellCompletenessPct:Number((100-profileRows(rows).nullCellRate*100).toFixed(2))}}}]})}); } catch(e) { res.status(400).json({error:e?.message||'Bulk profile failed safely.'}); }
});
app.post('/api/admin/u75/bulk/validate',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try { const result=validateBulkRows(req.body?.rows||[],{requiredFields:req.body?.requiredFields||[],allowedStatuses:req.body?.allowedStatuses||[]}); audit({actor:req.user.email,actorRole:req.user.role,action:'u75.bulk.validation',resourceType:'bulk_dataset',resourceId:String(req.body?.datasetId||'preview'),outcome:result.valid?'validated':'validation_required',metadata:{rows:result.profile.rowCount,errors:result.errors.length,warnings:result.warnings.length}}); res.status(result.valid?200:422).json({version:U75_BULK_INTEGRATION_VERSION,...result}); } catch(e) { res.status(400).json({error:e?.message||'Bulk validation failed safely.'}); }
});
app.post('/api/admin/u75/bulk/match-preview',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try { const projects=authorisedProjects(req.user); const rows=Array.isArray(req.body?.rows)?req.body.rows:[]; if(rows.length>10000)return res.status(413).json({error:'Match preview limited to 10000 rows.'}); const results=rows.map((row,index)=>({row:index+1,...matchProjectCandidate(row,projects)})); const counts={}; for(const state of U75_MATCH_STATES)counts[state]=results.filter(r=>r.state===state).length; res.json({version:U75_BULK_INTEGRATION_VERSION,counts,results}); } catch(e) { res.status(400).json({error:e?.message||'Bulk matching preview failed safely.'}); }
});
app.get('/api/admin/u75/bulk/rows/:id',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const run=getDataIngestionRun(req.params.id);
    if(!run)return res.status(404).json({error:'Ingestion run not found.'});
    if(run.status!=='ANALYZED')return res.status(409).json({error:`Run is ${run.status}; row extraction requires ANALYZED status.`});
    const root=path.resolve(SERVER_DIR,'..');
    const stored=safeStoredRunPath(root,run.storedPath,DATA_INCOMING_DIR);
    const script=path.join(root,'scripts','read-ingestion-rows.cjs');
    const limit=Math.min(Math.max(Number(req.query.limit||10000),1),50000);
    const r=spawnSync(process.execPath,[script,`--input=${stored}`,`--limit=${limit}`],{cwd:root,encoding:'utf8',timeout:120000,windowsHide:true});
    if(r.status!==0)return res.status(422).json({error:(r.stderr||r.stdout||'Dataset row extraction failed safely.').trim()});
    const parsed=JSON.parse(r.stdout||'{}');
    res.json({version:U75_ORCHESTRATOR_VERSION,run:{id:run.id,filename:run.originalFilename,sha256:run.sha256,status:run.status},...parsed});
  } catch(e) { res.status(400).json({error:e?.message||'Dataset rows unavailable safely.'}); }
});

app.post('/api/admin/u75/bulk/promotion-preview',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
    if(rows.length>10000)return res.status(413).json({error:'Promotion preview limited to 10000 rows.'});
    const validation=validateBulkRows(rows,{requiredFields:[],allowedStatuses:['ongoing','completed']});
    if(!validation.valid)return res.status(422).json({error:'Dataset validation is required before promotion preview.',validation});
    const preview=previewBulkPromotion(rows,{sourceLabel:req.body?.sourceLabel||'USER_UPLOAD',sourceId:req.body?.sourceId||null,sourceChecksum:req.body?.sourceChecksum||null});
    res.json({version:U75_ORCHESTRATOR_VERSION,validation,summary:{rows:preview.length,create:preview.filter(x=>x.action==='CREATE_PROJECT').length,update:preview.filter(x=>x.action==='UPDATE_MATCHED').length,conflicts:preview.filter(x=>x.action==='REVIEW_CONFLICT').length},preview});
  } catch(e) { res.status(400).json({error:e?.message||'Promotion preview failed safely.'}); }
});

app.post('/api/admin/u75/bulk/promote',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
    const approvedRows=Array.isArray(req.body?.approvedRows)?req.body.approvedRows:[];
    if(!rows.length)return res.status(400).json({error:'No rows were supplied for promotion.'});
    if(rows.length>10000)return res.status(413).json({error:'Promotion limited to 10000 rows per governed batch.'});
    const validation=validateBulkRows(rows,{requiredFields:[],allowedStatuses:['ongoing','completed']});
    if(!validation.valid)return res.status(422).json({error:'Dataset validation is required before promotion.',validation});
    const result=promoteBulkRows(rows,{approvedRows,sourceLabel:req.body?.sourceLabel||'USER_UPLOAD',sourceId:req.body?.sourceId||null,sourceChecksum:req.body?.sourceChecksum||null,actor:req.user,deps:{listRecommendations,createRecommendation,upsertOperationalAlert,appendProjectEvent,createPredictionRun,persistCandidatePrediction,audit}});
    const code=result.summary.failed?207:200;
    res.status(code).json({...result,validation});
  } catch(e) { res.status(400).json({error:e?.message||'Bulk promotion failed safely.'}); }
});


app.get('/api/admin/u75/bulk/batches',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const batches=listBulkPromotionBatches({ingestionRunId:req.query.ingestionRunId||null,limit:Math.min(Number(req.query.limit||25),100)});
    res.json({version:'u75.8-governed-bulk-workbench-v1',batches});
  } catch(e){res.status(500).json({error:e?.message||'Bulk promotion history unavailable safely.'});}
});
app.get('/api/admin/u75/bulk/batches/:id',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const batch=getBulkPromotionBatch(req.params.id);
    if(!batch)return res.status(404).json({error:'Promotion batch not found.'});
    const evidence=listBulkPromotionEvidence({batchId:batch.id,limit:Math.min(Number(req.query.limit||5000),5000)});
    res.json({version:'u75.8-governed-bulk-workbench-v1',batch,evidence});
  } catch(e){res.status(500).json({error:e?.message||'Promotion batch unavailable safely.'});}
});
app.post('/api/admin/u75/bulk/review-decision',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const rowNumber=Number(req.body?.rowNumber); const fieldName=String(req.body?.fieldName||'');
    const decision=String(req.body?.decision||'').toUpperCase();
    if(!Number.isInteger(rowNumber)||rowNumber<1||!fieldName)return res.status(400).json({error:'rowNumber and fieldName are required.'});
    if(!['APPLY_INCOMING','KEEP_EXISTING','BLOCK_CONFLICT'].includes(decision))return res.status(400).json({error:'Unsupported review decision.'});
    const runId=req.body?.ingestionRunId||null; const batchId=req.body?.batchId||null;
    const run=runId?getDataIngestionRun(runId):null;
    if(runId&&!run)return res.status(404).json({error:'Ingestion run not found.'});
    const ids=recordBulkPromotionEvidence([{batchId,ingestionRunId:runId,rowNumber,projectId:req.body?.projectId||null,fieldName,incomingValue:req.body?.incomingValue,existingValue:req.body?.existingValue,decision,matchState:req.body?.matchState||'REVIEW',sourceLabel:req.body?.sourceLabel||run?.sourceClassification||'USER_UPLOAD',sourceId:req.body?.sourceId||runId,sourceChecksum:req.body?.sourceChecksum||run?.sha256||null,confidence:Number(req.body?.confidence||0),metadata:{reviewAction:true,reviewNote:req.body?.reviewNote||null}}],req.user);
    audit({actor:req.user.email,actorRole:req.user.role,action:'u75.bulk.review_decision',resourceType:'bulk_promotion_evidence',resourceId:ids[0]||`${runId||'none'}:${rowNumber}:${fieldName}`,outcome:'recorded',metadata:{runId,batchId,rowNumber,fieldName,decision}});
    res.json({ok:true,decision,evidenceId:ids[0]||null});
  } catch(e){res.status(400).json({error:e?.message||'Review decision could not be recorded safely.'});}
});
app.get('/api/admin/u75/bulk/evidence/:runId',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const run=getDataIngestionRun(req.params.runId); if(!run)return res.status(404).json({error:'Ingestion run not found.'});
    const evidence=listBulkPromotionEvidence({ingestionRunId:run.id,limit:Math.min(Number(req.query.limit||2000),5000)});
    res.json({version:U75_5_PROMOTION_VERSION,run:{id:run.id,filename:run.originalFilename,sha256:run.sha256,status:run.status},count:evidence.length,evidence});
  } catch(e){res.status(500).json({error:e?.message||'Promotion evidence unavailable safely.'});}
});
app.post('/api/admin/u75/bulk/safe-promotion-preview',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
    if(rows.length>10000)return res.status(413).json({error:'Promotion preview limited to 10000 rows.'});
    const validation=validateBulkRows(rows,{requiredFields:[],allowedStatuses:['ongoing','completed']});
    if(!validation.valid)return res.status(422).json({error:'Dataset validation is required before safe promotion preview.',validation});
    const plan=previewSafeBulkPromotion(rows,{sourceLabel:req.body?.sourceLabel||'USER_UPLOAD',sourceId:req.body?.sourceId||null,sourceChecksum:req.body?.sourceChecksum||null,ingestionRunId:req.body?.ingestionRunId||null});
    res.json({version:U75_5_PROMOTION_VERSION,validation,...plan});
  } catch(e){res.status(400).json({error:e?.message||'Safe promotion preview failed safely.'});}
});
app.post('/api/admin/u75/bulk/safe-promote',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
    const approvedRows=Array.isArray(req.body?.approvedRows)?req.body.approvedRows:[];
    const conflictAcknowledgedRows=Array.isArray(req.body?.conflictAcknowledgedRows)?req.body.conflictAcknowledgedRows:[];
    if(!rows.length)return res.status(400).json({error:'No rows were supplied for safe promotion.'});
    if(rows.length>10000)return res.status(413).json({error:'Safe promotion limited to 10000 rows per governed batch.'});
    const validation=validateBulkRows(rows,{requiredFields:[],allowedStatuses:['ongoing','completed']});
    if(!validation.valid)return res.status(422).json({error:'Dataset validation is required before safe promotion.',validation});
    const result=promoteBulkRowsSafe(rows,{approvedRows,conflictAcknowledgedRows,conflictDecisions:req.body?.conflictDecisions||{},sourceLabel:req.body?.sourceLabel||'USER_UPLOAD',sourceId:req.body?.sourceId||null,sourceChecksum:req.body?.sourceChecksum||null,ingestionRunId:req.body?.ingestionRunId||null,actor:req.user,deps:{listRecommendations,createRecommendation,upsertOperationalAlert,appendProjectEvent,createPredictionRun,persistCandidatePrediction,audit}});
    res.status(result.summary.failed?207:200).json({...result,validation});
    const promotedIds=result.results.filter(x=>x.status==='PROMOTED_SAFE'&&x.project?.id).map(x=>String(x.project.id));
    const propagation=promotedIds.length?propagateBulkProjectsForAdmin(promotedIds,req.user,true):{version:U75_9_BULK_INTELLIGENCE_VERSION,summary:{projectCount:0,succeeded:0,failed:0,reviewRequired:0,highAttention:0,riskVelocityIncreasing:0,actionQueuesReady:0},results:[]};
    res.status(result.summary.failed||propagation.summary.failed?207:200).json({...result,validation,propagation});
  } catch(e){res.status(400).json({error:e?.message||'Safe bulk promotion failed safely.'});}
});
app.get('/api/data-ingestion/runs',requireAuth,requirePermission('projects:edit'),(req,res)=>res.json({runs:listDataIngestionRuns(req.query.limit)}));
app.get('/api/data-ingestion/runs/:id',requireAuth,requirePermission('projects:edit'),(req,res)=>{const run=getDataIngestionRun(req.params.id);if(!run)return res.status(404).json({error:'Ingestion run not found.'});res.json({run});});
app.post('/api/data-ingestion/runs/:id/retry-analysis',requireAuth,requirePermission('projects:edit'),(req,res)=>{
  try {
    const run=getDataIngestionRun(req.params.id);
    if(!run) return res.status(404).json({error:'Ingestion run not found.'});
    if(run.status==='ANALYZED') return res.json({run,note:'This ingestion run is already analysed; no retry was required.'});
    const storedPath=safeStoredRunPath(path.resolve(SERVER_DIR,'..'),run.storedPath,DATA_INCOMING_DIR);
    const reportFile=path.join(DATA_ROOT_DIR,'forensics',`${run.id}.json`);
    let report;
    try {
      report=writeForensicsReport(storedPath,reportFile);
    } catch(runtimeError) {
      const diagnostics={stage:'forensic_analysis',runtime:'node-in-process',message:String(runtimeError?.message||runtimeError),extension:run.extension,bytes:run.bytes,storedPath:run.storedPath};
      const failed=updateDataIngestionRun(run.id,{status:'ANALYSIS_FAILED',errorMessage:`${diagnostics.stage}: ${diagnostics.message}`});
      audit({actor:req.user.email,actorRole:req.user.role,action:'data_ingestion.analysis_retry_failed',resourceType:'data_ingestion_run',resourceId:run.id,outcome:'analysis_failed',metadata:diagnostics});
      return res.status(422).json({run:failed,error:'Forensic analysis still failed safely.',diagnostics});
    }
    const failedFiles=(report.files||[]).filter(x=>x?.error);
    if(failedFiles.length===report.files.length) {
      const diagnostics={stage:'forensic_analysis',runtime:'node-in-process',message:failedFiles.map(x=>`${x.file}: ${x.error}`).join(' | '),failedFiles:failedFiles.length,files:report.files.length};
      const failed=updateDataIngestionRun(run.id,{status:'ANALYSIS_FAILED',report,errorMessage:diagnostics.message});
      audit({actor:req.user.email,actorRole:req.user.role,action:'data_ingestion.analysis_retry_failed',resourceType:'data_ingestion_run',resourceId:run.id,outcome:'analysis_failed',metadata:diagnostics});
      return res.status(422).json({run:failed,error:'Every file failed forensic analysis. No promotion occurred.',diagnostics});
    }
    const saved=updateDataIngestionRun(run.id,{status:'ANALYZED',report,errorMessage:failedFiles.length?`Partial forensic analysis: ${failedFiles.length}/${report.files.length} file(s) failed.`:null});
    audit({actor:req.user.email,actorRole:req.user.role,action:'data_ingestion.analysis_retried',resourceType:'data_ingestion_run',resourceId:run.id,outcome:'analysed',metadata:{files:report.files.length,failedFiles:failedFiles.length,rowsObserved:report.summary?.rowsObserved||0}});
    return res.json({run:saved,u75:{version:U75_BULK_INTEGRATION_VERSION,sourceState:classifyU75Source({sourceClassification:saved.sourceClassification}),ingestionState:buildU75IntakeState(report),profiled:true},diagnostics:{runtime:'node-in-process',files:report.files.length,failedFiles:failedFiles.length,rowsObserved:report.summary?.rowsObserved||0}});
  } catch(e) {
    return res.status(400).json({error:e?.message||'Forensic retry failed safely.'});
  }
});

app.get('/api/data-ingestion/runs/:id/diagnostics',requireAuth,requirePermission('projects:edit'),(req,res)=>{
  const run=getDataIngestionRun(req.params.id);
  if(!run) return res.status(404).json({error:'Ingestion run not found.'});
  res.json({run,diagnostics:{status:run.status,errorMessage:run.errorMessage||null,reportSummary:run.report?.summary||null,failedFiles:(run.report?.files||[]).filter(x=>x?.error)}});
});

app.post('/api/data-ingestion/upload',requireAuth,requirePermission('projects:edit'),async(req,res)=>{
  let file=null; let saved=null;
  try {
    file=await readMultipartFile(req,100*1024*1024);
    const ext=path.extname(file.filename).toLowerCase();
    const allowed=new Set(['.csv','.tsv','.json','.ndjson','.xlsx']);
    if(!allowed.has(ext)) return res.status(400).json({error:'Dataset upload supports CSV, TSV, JSON, NDJSON and XLSX only.'});
    const digest=crypto.createHash('sha256').update(file.buffer).digest('hex');
    const safeName=`${new Date().toISOString().replace(/[:.]/g,'-')}-${digest.slice(0,12)}-${file.filename.replace(/[^A-Za-z0-9._-]/g,'_')}`;
    const storedPath=path.join(DATA_INCOMING_DIR,safeName);
    fs.writeFileSync(storedPath,file.buffer,{flag:'wx'});
    saved=createDataIngestionRun({originalFilename:file.filename,storedPath:path.relative(path.resolve(SERVER_DIR,'..'),storedPath),contentType:file.contentType,extension:ext,bytes:file.buffer.length,sha256:digest,createdBy:req.user.email});
    const reportFile=path.join(DATA_ROOT_DIR,'forensics',`${saved.id}.json`);
    try {
      // U75.7 reliability path: run forensic analysis in-process so CSV/TSV/JSON/NDJSON
      // uploads never depend on a Windows Python launcher, PATH alias, or child-process state.
      // XLSX still uses the existing Python standard-library inspector internally.
      const report=writeForensicsReport(storedPath,reportFile);
      const failedFiles=(report.files||[]).filter(x=>x?.error);
      if(failedFiles.length===report.files.length) {
        throw new Error(failedFiles.map(x=>`${x.file}: ${x.error}`).join(' | ')||'All files failed forensic analysis.');
      }
      saved=updateDataIngestionRun(saved.id,{status:'ANALYZED',report,errorMessage:failedFiles.length?`Partial forensic analysis: ${failedFiles.length}/${report.files.length} file(s) failed.`:null});
    } catch(e) {
      // One bounded compatibility fallback preserves the previous CLI path for environments
      // where a custom runtime has changed the in-process analyzer dependencies.
      let fallbackLast=''; let fallbackOk=false;
      const candidates=process.platform==='win32'?['python','py','python3']:['python3','python'];
      for(const exe of candidates){
        const r=spawnSync(exe,['scripts/data-forensics.cjs',`--input=${storedPath}`,`--output=${reportFile}`],{cwd:path.resolve(SERVER_DIR,'..'),encoding:'utf8',timeout:120000,windowsHide:true});
        if(r.status===0 && fs.existsSync(reportFile)){fallbackOk=true;break;}
        fallbackLast=(r.stderr||r.stdout||`${exe} exited ${r.status}`).trim();
      }
      if(fallbackOk){
        const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));
        const failedFiles=(report.files||[]).filter(x=>x?.error);
        if(failedFiles.length===report.files.length) throw new Error(failedFiles.map(x=>`${x.file}: ${x.error}`).join(' | '));
        saved=updateDataIngestionRun(saved.id,{status:'ANALYZED',report,errorMessage:failedFiles.length?`Partial forensic analysis: ${failedFiles.length}/${report.files.length} file(s) failed.`:null});
      } else {
        const detail=`${e?.message||'Forensic analysis failed.'}${fallbackLast?` | fallback: ${fallbackLast.slice(0,1600)}`:''}`;
        saved=updateDataIngestionRun(saved.id,{status:'ANALYSIS_FAILED',errorMessage:detail});
        audit({actor:req.user.email,actorRole:req.user.role,action:'data_ingestion.analysis_failed',resourceType:'data_ingestion_run',resourceId:saved.id,outcome:'analysis_failed',metadata:{error:detail,extension:ext,bytes:file.buffer.length,sha256:digest}});
        return res.status(422).json({run:saved,error:'Dataset stored safely, but forensic analysis failed. No model was trained or promoted.',diagnostics:{stage:'forensic_analysis',extension:ext,bytes:file.buffer.length,sha256:digest,detail}});
      }
    }
    audit({actor:req.user.email,actorRole:req.user.role,action:'data_ingestion.analysed',resourceType:'data_ingestion_run',resourceId:saved.id,outcome:'analysed',metadata:{bytes:file.buffer.length,sha256:digest,sourceClassification:saved.sourceClassification,rowsObserved:saved.report?.summary?.rowsObserved||0}});
    return res.status(201).json({run:saved,u75:{version:U75_BULK_INTEGRATION_VERSION,sourceState:classifyU75Source({sourceClassification:saved.sourceClassification}),ingestionState:buildU75IntakeState(saved.report||{}),profiled:true},note:'Dataset was stored and structurally analysed. It remains USER_UPLOADED / NOT_GOVERNMENT_VERIFIED until provenance is established.'});
  } catch(e){
    if(saved) updateDataIngestionRun(saved.id,{status:'ANALYSIS_FAILED',errorMessage:e?.message||'Dataset ingestion failed safely.'});
    return res.status(400).json({error:e?.message||'Dataset ingestion failed safely.'});
  }
});

app.post('/api/projects',requireAuth,requirePermission('projects:edit'),(req,res)=>{try{
  const existing=req.body?.id?getProject(String(req.body.id)):null;
  const requestedDepartment=String(req.body?.responsibleDepartment||req.body?.responsible_department||'').trim();
  if(req.user.role==='Department Officer' && requestedDepartment && String(req.user.organisation||'').trim().toLowerCase()!==requestedDepartment.toLowerCase()) return res.status(403).json({error:'Department Officer may create or assign projects only to the officer’s configured responsible work unit.'});
  if(existing && !isProjectAuthorised(req.user,existing)) return res.status(403).json({error:'Project is outside your authorised scope.'});
  if(!existing && req.user.role!=='Administrator'){
    const state=String(req.body?.state||'').trim(); const district=String(req.body?.district||'').trim(); const j=req.user.jurisdiction||{};
    if(j.state && !['Unassigned','National',''].includes(j.state) && state.toLowerCase()!==String(j.state).toLowerCase()) return res.status(403).json({error:'New project state is outside your authorised scope.'});
    if(j.district && !['Unassigned','National',''].includes(j.district) && district.toLowerCase()!==String(j.district).toLowerCase()) return res.status(403).json({error:'New project district is outside your authorised scope.'});
  }
  const project=upsertProject(req.body,req.user);
  const bootstrap=buildProjectBootstrap(project,{listRecommendations,createRecommendation,upsertOperationalAlert,appendProjectEvent,createPredictionRun,persistCandidatePrediction,audit});
  let dataBackbone=null;
  try { dataBackbone=refreshUnifiedProjectSnapshot(project,{generatedBy:req.user.email}); } catch(error) { audit({actor:req.user.email,actorRole:req.user.role,action:'project.data_backbone.refresh_failed',resourceType:'project',resourceId:project.id,outcome:'degraded',metadata:{error:String(error?.message||error)}}); }
  res.status(201).json({project,bootstrap,lifecycleVersion:PROJECT_LIFECYCLE_VERSION,dataBackbone:{version:UNIFIED_DATA_BACKBONE_VERSION,status:dataBackbone?'READY':'DEGRADED',snapshotId:dataBackbone?.id||null}});
}catch(e){res.status(400).json({error:e?.message||'Unable to save project.'});}});
app.get('/api/projects/:id/intelligence',requireAuth,requirePermission('projects:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});res.json({intelligence:buildProjectIntelligence(project)});});
app.get('/api/projects/:id/data-hub',requireAuth,requirePermission('projects:read'),(req,res)=>{try{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});let snapshot=getLatestProjectIntelligenceSnapshot(project.id);if(!snapshot || new Date(snapshot.projectUpdatedAt).getTime() < new Date(project.updatedAt).getTime()){try{snapshot=refreshUnifiedProjectSnapshot(project,{generatedBy:'system-on-read'});}catch(_){}}res.json({version:UNIFIED_DATA_BACKBONE_VERSION,hub:getUnifiedProjectDataHub(project.id),snapshot});}catch(e){res.status(500).json({error:'Unified project data hub unavailable.'});}});
app.post('/api/projects/:id/data-hub/refresh',requireAuth,requirePermission('projects:edit'),(req,res)=>{try{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});const snapshot=refreshUnifiedProjectSnapshot(project,{generatedBy:req.user.email});audit({actor:req.user.email,actorRole:req.user.role,action:'project.data_backbone.refreshed',resourceType:'project_intelligence_snapshot',resourceId:snapshot.id,outcome:'success',metadata:{projectId:project.id,snapshotVersion:snapshot.snapshotVersion}});res.json({version:UNIFIED_DATA_BACKBONE_VERSION,snapshot});}catch(e){res.status(400).json({error:e?.message||'Unified project data hub refresh failed safely.'});}});
app.get('/api/projects/:id/timeline',requireAuth,requirePermission('projects:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});const stored=listProjectEvents(req.params.id);res.json({events:stored.length?stored:buildTimeline(project),source:stored.length?'stored':'derived'});});
app.get('/api/projects/:id/workflow',requireAuth,requirePermission('workflow:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});const workflow=inferDemoWorkflow(project);const events=listProjectEvents(req.params.id);const state=buildWorkflowState({project,workflow,events});res.json({workflow:{...state,dependencies:listProjectDependencies(req.params.id)}});});
app.get('/api/projects/:id/legal-clocks',requireAuth,requirePermission('workflow:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});const workflow=inferDemoWorkflow(project);const events=listProjectEvents(req.params.id);const clocks=evaluateLegalClocks({workflowCode:workflow.code,events,asOf:req.query.asOf||new Date()});res.json({workflowCode:workflow.code,clocks});});
app.get('/api/projects/:id/intelligence-trust',requireAuth,requirePermission('projects:read'),(req,res)=>{ const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'}); if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'}); const latest=listPredictions(req.params.id,2); const current=latest[0]||null; const previous=latest[1]||null; const evidenceReadiness=calculateEvidenceReadiness({project, sourceRows:[]}); const applicability=calculatePredictionApplicability({project,prediction:current||{},historicalSignals:{}}); let predictionDiff=buildPredictionDiff(current,previous); const persistedDiff=getLatestPredictionDiff(project.id); res.json({evidenceReadiness,applicability,predictionDiff,persistedDiff}); });
app.get('/api/projects/:id/evidence',requireAuth,requirePermission('projects:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});const stored=listProjectEvidence(req.params.id);res.json({projectEvidence:stored,evidenceCards:buildEvidence(project),dataFacts:getProjectDataFacts(req.params.id),dataBackboneVersion:UNIFIED_DATA_BACKBONE_VERSION});});
app.get('/api/projects/:id/recommendations',requireAuth,requirePermission('projects:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});res.json({recommendations:listRecommendations(req.params.id)});});
app.post('/api/projects/:id/events',requireAuth,requirePermission('workflow:action'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});try{const event=appendProjectEvent({projectId:req.params.id,eventType:String(req.body?.eventType||'WORKFLOW_EVENT'),eventCode:String(req.body?.eventCode||'').trim()||null,occurredAt:req.body?.occurredAt||new Date().toISOString(),effectiveAt:req.body?.effectiveAt||req.body?.occurredAt||new Date().toISOString(),sourceLabel:String(req.body?.sourceLabel||'user_recorded'),sourceId:req.body?.sourceId||null,payload:req.body?.payload||{}},req.user);res.status(201).json({event});}catch(e){res.status(400).json({error:e?.message||'Unable to record event.'});}});
app.post('/api/projects/:id/recommendations',requireAuth,requirePermission('workflow:action'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});const actionText=String(req.body?.actionText||'').trim();if(!actionText)return res.status(400).json({error:'Action text is required.'});const recommendation=createRecommendation({projectId:req.params.id,ownerRole:String(req.body?.ownerRole||req.user.role),actionText,basisType:String(req.body?.basisType||'policy_configured'),priority:Number(req.body?.priority||3),dueAt:req.body?.dueAt||null},req.user);res.status(201).json({recommendation});});
app.patch('/api/projects/:id/recommendations/:recommendationId',requireAuth,requirePermission('workflow:action'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});const recommendation=getRecommendation(req.params.recommendationId);if(!recommendation||String(recommendation.projectId)!==String(project.id))return res.status(404).json({error:'Recommendation not found.'});const updated=updateRecommendation(req.params.recommendationId,{status:req.body?.status,dueAt:req.body?.dueAt});audit({actor:req.user.email,actorRole:req.user.role,action:'recommendation.updated',resourceType:'recommendation',resourceId:req.params.recommendationId,outcome:updated.status,metadata:{projectId:project.id}});res.json({recommendation:updated});});

app.get('/api/projects/:id/feedback',requireAuth,requirePermission('projects:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});res.json({feedback:listOfficerFeedback(req.params.id)});});
app.post('/api/projects/:id/feedback',requireAuth,requirePermission('feedback:write'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});const signalType=String(req.body?.signalType||'New issue').trim();const category=String(req.body?.category||'General').trim();const observation=String(req.body?.observation||'').trim();if(!observation)return res.status(400).json({error:'Observation is required.'});const feedback=createOfficerFeedback({projectId:req.params.id,userId:req.user.id,signalType,category,observation,linkedPredictionId:req.body?.linkedPredictionId||null});audit({actor:req.user.email,actorRole:req.user.role,action:'feedback.created',resourceType:'officer_feedback',resourceId:feedback.id,outcome:'success',metadata:{projectId:req.params.id,category,signalType}});res.status(201).json({feedback});});
app.post('/api/feedback/:id/review',requireAuth,requirePermission('workflow:action'),(req,res)=>{const existing=getOfficerFeedback(req.params.id);if(!existing)return res.status(404).json({error:'Feedback record not found.'});const project=getProject(existing.projectId);if(!project||!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Feedback record is outside your authorised scope.'});const status=String(req.body?.status||'unreviewed').toLowerCase();const feedback=reviewOfficerFeedback(req.params.id,{reviewerId:req.user.id,status,learningEligible:Boolean(req.body?.learningEligible),reviewNote:String(req.body?.reviewNote||'')});if(!feedback)return res.status(404).json({error:'Feedback record not found.'});audit({actor:req.user.email,actorRole:req.user.role,action:'feedback.reviewed',resourceType:'officer_feedback',resourceId:req.params.id,outcome:feedback.verificationStatus,metadata:{learningEligible:Boolean(feedback.learningEligible)}});res.json({feedback});});
app.get('/api/projects/:id/interventions',requireAuth,requirePermission('projects:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});res.json({actions:listInterventionActions(req.params.id)});});
app.post('/api/projects/:id/interventions',requireAuth,requirePermission('workflow:action'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});const actionText=String(req.body?.actionText||'').trim();if(!actionText)return res.status(400).json({error:'Action text is required.'});const intervention=createIntervention({projectId:req.params.id,recommendationId:req.body?.recommendationId||null,scenario:req.body?.scenario||{type:'officer_action',label:actionText},estimatedEffect:req.body?.estimatedEffect||{note:'No effect estimate supplied.'},createdBy:req.user.id});const action=createInterventionAction({interventionId:intervention.id,projectId:req.params.id,recommendationId:req.body?.recommendationId||null,actionText,ownerRole:String(req.body?.ownerRole||req.user.role),dueAt:req.body?.dueAt||null,actorId:req.user.id});audit({actor:req.user.email,actorRole:req.user.role,action:'intervention.created',resourceType:'intervention',resourceId:intervention.id,outcome:'success',metadata:{projectId:req.params.id,actionId:action.id,hypothetical:true}});res.status(201).json({intervention,action});});
app.patch('/api/intervention-actions/:id',requireAuth,requirePermission('workflow:action'),(req,res)=>{const existing=getInterventionAction(req.params.id);if(!existing)return res.status(404).json({error:'Intervention action not found.'});const project=getProject(existing.projectId);if(!project||!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Intervention action is outside your authorised scope.'});const action=updateInterventionAction(req.params.id,{status:req.body?.status,dueAt:req.body?.dueAt,outcome:req.body?.outcome});audit({actor:req.user.email,actorRole:req.user.role,action:'intervention_action.updated',resourceType:'intervention_action',resourceId:req.params.id,outcome:action.status,metadata:{projectId:action.projectId,hasOutcome:Boolean(action.outcome)}});res.json({action});});
app.post('/api/intervention-actions/:id/outcome-review',requireAuth,requirePermission('workflow:action'),(req,res)=>{const existing=getInterventionAction(req.params.id);if(!existing)return res.status(404).json({error:'Intervention action not found.'});const project=getProject(existing.projectId);if(!project||!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Intervention action is outside your authorised scope.'});const status=String(req.body?.status||'unreviewed').toLowerCase();if(status==='verified'&&!existing.outcome)return res.status(400).json({error:'Record an observed outcome before verifying it.'});const action=reviewInterventionOutcome(req.params.id,{reviewerId:req.user.id,status,learningEligible:Boolean(req.body?.learningEligible),reviewNote:String(req.body?.reviewNote||'')});audit({actor:req.user.email,actorRole:req.user.role,action:'intervention_outcome.reviewed',resourceType:'intervention_action',resourceId:req.params.id,outcome:action.outcomeVerificationStatus,metadata:{projectId:action.projectId,learningEligible:Boolean(action.learningEligible)}});res.json({action});});
app.get('/api/projects/:id/predictions',requireAuth,requirePermission('risk:read'),(req,res)=>{const project=getProject(req.params.id);if(!project)return res.status(404).json({error:'Project not found.'});if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});res.json({predictions:listPredictions(req.params.id)});});
app.get('/api/projects/:id/predictive-intelligence',requireAuth,requirePermission('risk:read'),(req,res)=>{
  const project=getProject(req.params.id);
  if(!project)return res.status(404).json({error:'Project not found.'});
  if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
  const prediction=scoreCandidatePrediction(project);
  const workflow=inferDemoWorkflow(project);
  const saved=persistCandidatePrediction(project,prediction,workflow.code,workflow.currentStageCode||null);
  const previous=listPredictions(project.id,2).find((p)=>String(p.id)!==String(saved.id))||null;
  const previousForDiff=previous ? {delayLikelihoodPct:(Number(previous.delayProbability||0)*100),expectedAdditionalDays:previous.expectedAdditionalDays} : null;
  const diff=buildPredictionDiff({...prediction,delayLikelihoodPct:prediction.delayLikelihoodPct||null},previousForDiff);
  const storedDiff=createPredictionDiff({projectId:project.id,currentPredictionId:saved.id,previousPredictionId:previous?.id||null,diff});
  const run=createPredictionRun({modelVersion:prediction.modelVersion,modelStatus:prediction.modelStatus,projectCount:1,featurePolicy:'strict_as_of_fields_only',validationStatus:prediction.validation.status,metadata:{projectId:project.id}});
  res.json({prediction:{...prediction,predictionId:saved.id,runId:run.id},stored:saved,previousPrediction:previous,diff:diff,persistedDiff:storedDiff,features:featureDictionary()});
});
app.get('/api/predictive/portfolio',requireAuth,requirePermission('risk:read'),(req,res)=>{
  const projects=authorisedProjects(req.user);
  const summary=buildPortfolioPredictionSummary(projects);
  const run=createPredictionRun({modelVersion:summary.modelVersion,modelStatus:summary.modelStatus,projectCount:summary.projectsScored,featurePolicy:'strict_as_of_fields_only',validationStatus:'NOT_VALIDATED',metadata:{scope:'authorised_projects'}});
  res.json({summary,runId:run.id});
});
app.get('/api/predictive/features',requireAuth,requirePermission('risk:read'),(req,res)=>res.json({modelVersion:PREDICTIVE_MODEL_VERSION,modelStatus:PREDICTIVE_MODEL_STATUS,features:featureDictionary()}));
app.get('/api/predictive/dataset/forensics',requireAuth,requirePermission('risk:read'),(req,res)=>{
  const dataset=latestDatasetVersion();
  if(!dataset) return res.json({dataset:null,temporalDatasetVersion:TEMPORAL_DATASET_VERSION,featurePolicy:TEMPORAL_FEATURE_POLICY,message:'No temporal dataset has been built yet.'});
  res.json({dataset,splitSummary:listDatasetSplits(dataset.id),leakageAudits:listLeakageAudits(dataset.id).slice(0,200)});
});
app.post('/api/predictive/dataset/build',requireAuth,requirePermission('workflow:admin'),(req,res)=>{
  try {
    const dataset=buildTemporalDataset({createdBy:req.user.email});
    audit({actor:req.user.email,actorRole:req.user.role,action:'predictive.dataset.build',resourceType:'dataset_version',resourceId:dataset.id,outcome:dataset.status,metadata:{version:dataset.version,examples:dataset.exampleCount,observedLabels:dataset.observedLabelCount,leakageViolations:dataset.leakageViolations}});
    res.status(201).json({dataset,splitSummary:listDatasetSplits(dataset.id),leakageAudits:listLeakageAudits(dataset.id)});
  } catch(e) { res.status(400).json({error:e?.message||'Temporal dataset build failed safely.'}); }
});
app.get('/api/predictive/datasets/latest',requireAuth,requirePermission('risk:read'),(req,res)=>{ const dataset=latestDatasetVersion(); res.json({dataset,splitSummary:dataset?listDatasetSplits(dataset.id):[],leakageAudits:dataset?listLeakageAudits(dataset.id):[]}); });
app.get('/api/predictive/datasets/:id/examples',requireAuth,requirePermission('risk:read'),(req,res)=>{ const dataset=getDatasetVersion(req.params.id); if(!dataset)return res.status(404).json({error:'Dataset version not found.'}); res.json({dataset,examples:listTemporalExamples(dataset.id,Math.min(Math.max(Number(req.query.limit||200),1),1000))}); });
app.get('/api/predictions/:id/explanations',requireAuth,requirePermission('risk:read'),(req,res)=>res.json({explanations:listPredictionExplanations(req.params.id),features:listPredictionFeatures(req.params.id)}));
app.get('/api/rules',requireAuth,(req,res)=>res.json({workflows:Object.values(WORKFLOW_TEMPLATES).map(w=>({code:w.code,label:w.label,act:w.act,sourceUrl:w.sourceUrl,stages:w.stages,clocks:w.clocks})),count:Object.keys(WORKFLOW_TEMPLATES).length}));
app.get('/api/data-health',requireAuth,requirePermission('dashboard:read'),(req,res)=>res.json({health:buildDataHealth(getDataHealthRows(),authorisedProjects(req.user))}));

async function readMultipartFile(req, maxBytes = 25 * 1024 * 1024) {
  const contentType = String(req.headers['content-type'] || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error('Multipart boundary is missing.');
  const rawBoundary = boundaryMatch[1] || boundaryMatch[2];
  if (!rawBoundary) throw new Error('Multipart boundary is missing.');
  const boundary = Buffer.from(`--${rawBoundary}`);
  const chunks=[]; let total=0;
  for await (const chunk of req) { total += chunk.length; if(total > maxBytes) throw new Error(`Uploaded file exceeds ${Math.floor(maxBytes/1024/1024)} MB limit.`); chunks.push(chunk); }
  const body=Buffer.concat(chunks);
  const delimiter=Buffer.from(`\r\n--${rawBoundary}`);
  let cursor=body.indexOf(boundary);
  if(cursor<0) throw new Error('Multipart payload could not be parsed.');
  while(cursor>=0) {
    const partStart=cursor + boundary.length;
    if(body.slice(partStart,partStart+2).toString('latin1')==='--') break;
    const headerStart=body.slice(partStart,partStart+2).toString('latin1')==='\r\n' ? partStart+2 : partStart;
    const headerEnd=body.indexOf(Buffer.from('\r\n\r\n'),headerStart);
    if(headerEnd<0) throw new Error('Multipart headers are invalid.');
    const headers=body.slice(headerStart,headerEnd).toString('utf8');
    const disposition=headers.match(/content-disposition\s*:\s*form-data\s*;\s*name="([^"]*)"(?:\s*;\s*filename="([^"]*)")?/i);
    const dataStart=headerEnd+4;
    const nextBoundary=body.indexOf(delimiter,dataStart);
    const finalBoundary=nextBoundary>=0 ? nextBoundary : body.indexOf(boundary,dataStart);
    if(finalBoundary<0) throw new Error('Multipart file terminator is missing.');
    const fileEnd=finalBoundary;
    if(disposition?.[2] !== undefined) {
      const filename=path.basename(disposition[2]).replace(/[\r\n]/g,'_').slice(0,180) || 'upload.bin';
      const contentTypeHeader=headers.match(/content-type\s*:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';
      if(fileEnd<=dataStart) throw new Error('Uploaded file is empty.');
      return {filename,contentType:contentTypeHeader,buffer:body.slice(dataStart,fileEnd)};
    }
    cursor=body.indexOf(boundary, finalBoundary + 2);
  }
  throw new Error('No file field was supplied.');
}
function extractUploadedFile({filename,buffer}) {
  const ext=path.extname(filename).toLowerCase();
  const allowed=new Set(['.pdf','.docx','.xlsx','.csv','.tsv','.json','.ndjson','.txt','.png','.jpg','.jpeg','.tif','.tiff','.bmp','.webp']);
  if(!allowed.has(ext)) throw new Error(`Unsupported file type: ${ext || 'unknown'}.`);
  const temp=path.join(INTAKE_TMP_DIR, `${crypto.randomUUID()}${ext}`); fs.writeFileSync(temp,buffer,{flag:'wx'});
  try {
    if(ext==='.txt'||ext==='.csv'||ext==='.tsv'||ext==='.json'||ext==='.ndjson') return {text:fs.readFileSync(temp,'utf8'),parser:'node:plain-text'};
    const localDocPython=process.platform==='win32'?path.join(path.resolve(SERVER_DIR,'..'),'.venv-u72-ocr','Scripts','python.exe'):path.join(path.resolve(SERVER_DIR,'..'),'.venv-u72-ocr','bin','python'); const candidates=fs.existsSync(localDocPython)?[localDocPython,...(process.platform==='win32'?['py','python','python3']:['python3','python'])]:(process.platform==='win32'?['py','python','python3']:['python3','python']); let last='';
    for(const exe of candidates){ const r=spawnSync(exe,['scripts/extract-document.py',temp],{cwd:path.resolve(SERVER_DIR,'..'),encoding:'utf8',timeout:60000,windowsHide:true}); if(r.status===0&&r.stdout){try{return JSON.parse(r.stdout)}catch{throw new Error('Document extractor returned invalid JSON.');}} last=(r.stderr||'').trim()||`Python exited with code ${r.status}`; }
    throw new Error(`Document extraction unavailable. ${last}`);
  } finally { try{fs.rmSync(temp,{force:true})}catch{} }
}


app.post('/api/project-intake/extract',requireAuth,requirePermission('projects:edit'),async(req,res)=>{
  try{
    const file=await readMultipartFile(req);
    const out=extractUploadedFile(file);
    const sha256=crypto.createHash('sha256').update(file.buffer).digest('hex');
    audit({actor:req.user.email,actorRole:req.user.role,action:'project_intake.file_extracted',resourceType:'project_intake_file',resourceId:sha256.slice(0,16),outcome:'success',metadata:{fileName:file.filename,bytes:file.buffer.length,parser:out.parser||'unknown',textChars:String(out.text||'').length}});
    res.json({document:{name:file.filename,size:file.buffer.length,type:file.contentType,sha256,text:String(out.text||'').slice(0,900000),parser:out.parser||'unknown',textChars:Number(out.textChars||String(out.text||'').length),ocr:out.ocr||{used:false,engine:null,pages:0,reason:'not_applicable'}}});
  }catch(e){res.status(400).json({error:e?.message||'Document extraction failed safely.'});}
});
app.post('/api/project-intake/analyze',requireAuth,requirePermission('projects:edit'),(req,res)=>{
  try {
    const documents=Array.isArray(req.body?.documents)?req.body.documents:[];
    if(!documents.length) return res.status(400).json({error:'At least one extracted document is required.'});
    if(documents.length>20) return res.status(400).json({error:'Maximum 20 documents per intake.'});
    const safe=documents.map(d=>({name:String(d.name||'untitled').slice(0,180),size:Number(d.size||0),type:String(d.type||'application/octet-stream').slice(0,120),sha256:String(d.sha256||'').slice(0,128),parser:String(d.parser||'browser').slice(0,80),text:String(d.text||'').slice(0,900000)}));
    const analysis=analyseProjectIntake({documents:safe});
    const intake=createProjectIntake({createdBy:req.user.email,analysis});
    // Persist every extracted candidate field into the review queue. These are
    // still non-canonical until an authorised verifier reviews them. This makes
    // the U72 document-intelligence review workflow durable across reloads.
    const fieldReviews=upsertIntakeFieldReviews(intake.id,analysis.fieldEvidence||[],req.user.email);
    audit({actor:req.user.email,actorRole:req.user.role,action:'project_intake.analysed',resourceType:'project_intake',resourceId:intake.id,outcome:'success',metadata:{documentCount:safe.length,completenessPct:analysis.completenessPct,evidenceCoveragePct:analysis.evidenceCoveragePct,fieldReviewCandidates:fieldReviews.length}});
    res.status(201).json({intake,analysis,fieldReviews});
  } catch(e) { res.status(400).json({error:e?.message||'Project intake analysis failed safely.'}); }
});

app.get('/api/project-intake/:id/field-reviews',requireAuth,requirePermission('projects:edit'),(req,res)=>{
  const intake=getProjectIntake(req.params.id); if(!intake)return res.status(404).json({error:'Intake not found.'});
  res.json({reviews:listIntakeFieldReviews(req.params.id)});
});
app.post('/api/project-intake/:id/field-reviews/:fieldKey',requireAuth,requirePermission('documents:verify'),(req,res)=>{
  try {
    const intake=getProjectIntake(req.params.id); if(!intake)return res.status(404).json({error:'Intake not found.'});
    const review=reviewIntakeField(req.params.id,decodeURIComponent(req.params.fieldKey),{status:String(req.body?.status||'verified'),reviewedValue:req.body?.reviewedValue??null,reviewNote:String(req.body?.reviewNote||'')},req.user);
    if(!review)return res.status(404).json({error:'Field review candidate not found.'});
    res.json({review});
  } catch(e){res.status(400).json({error:e?.message||'Field verification failed safely.'});}
});

app.post('/api/project-intake/:id/reconcile',requireAuth,requirePermission('projects:edit'),(req,res)=>{
  try {
    const intake=getProjectIntake(req.params.id); if(!intake)return res.status(404).json({error:'Intake not found.'});
    const canonical=buildCanonicalProject({analysis:intake.analysis,createdBy:req.user.email});
    const saved=createCanonicalProject({intakeId:intake.id,canonical,createdBy:req.user.email,projectId:intake.projectId||null});
    res.status(201).json({canonical:saved});
  } catch(e){res.status(400).json({error:e?.message||'Canonical reconciliation failed safely.'});}
});
app.get('/api/project-intake/:id/canonical',requireAuth,requirePermission('projects:edit'),(req,res)=>{const canonical=getCanonicalProjectForIntake(req.params.id);if(!canonical)return res.status(404).json({error:'Canonical record not found.'});res.json({canonical});});
app.post('/api/project-intake/:id/temporal-reconcile',requireAuth,requirePermission('projects:edit'),(req,res)=>{try{const intake=getProjectIntake(req.params.id);if(!intake)return res.status(404).json({error:'Intake not found.'});const canonical=getCanonicalProjectForIntake(req.params.id);if(!canonical)return res.status(409).json({error:'Build the canonical project before temporal reconciliation.'});const snapshot=reconcileTemporalEvidence({canonical:canonical.canonical,asOf:req.body?.asOf||null});const saved=createTemporalEvidenceSnapshot({canonicalId:canonical.id,snapshot,createdBy:req.user.email});res.status(201).json({snapshot:saved});}catch(e){res.status(400).json({error:e?.message||'Temporal reconciliation failed safely.'});}});

app.post('/api/project-intake/:id/prepare-intelligence',requireAuth,requirePermission('projects:edit'),(req,res)=>{
  try {
    const intake=getProjectIntake(req.params.id); if(!intake)return res.status(404).json({error:'Intake not found.'});
    let canonical=getCanonicalProjectForIntake(intake.id);
    if(!canonical){
      const built=buildCanonicalProject({analysis:intake.analysis,createdBy:req.user.email});
      canonical=createCanonicalProject({intakeId:intake.id,canonical:built,createdBy:req.user.email,projectId:intake.projectId||null});
    }
    const snapshot=reconcileTemporalEvidence({canonical:canonical.canonical,asOf:req.body?.asOf||null});
    const savedSnapshot=createTemporalEvidenceSnapshot({canonicalId:canonical.id,snapshot,createdBy:req.user.email});
    const prepared=prepareSIH26017Intelligence({intake,canonical,temporalSnapshot:savedSnapshot,predictiveStatus:PREDICTIVE_MODEL_STATUS || 'NOT_VALIDATED'});
    audit({actor:req.user.email,actorRole:req.user.role,action:'project_intake.intelligence_prepared',resourceType:'project_intake',resourceId:intake.id,outcome:'success',metadata:{version:INTELLIGENCE_PREPARATION_VERSION,gate:prepared.gate,readinessPct:prepared.readinessPct,runSha256:prepared.runSha256}});
    res.status(201).json({prepared,canonical,temporalSnapshot:savedSnapshot});
  } catch(e){res.status(400).json({error:e?.message||'SIH26017 intelligence preparation failed safely.'});}
});
app.get('/api/project-intake/:id/temporal-snapshot',requireAuth,requirePermission('projects:edit'),(req,res)=>{try{const canonical=getCanonicalProjectForIntake(req.params.id);if(!canonical)return res.status(404).json({error:'Canonical record not found.'});const snapshot=getLatestTemporalEvidenceSnapshot(canonical.id);if(!snapshot)return res.status(404).json({error:'Temporal snapshot not found.'});res.json({snapshot});}catch(e){res.status(400).json({error:e?.message||'Temporal snapshot unavailable.'});}});
app.get('/api/project-intake',requireAuth,requirePermission('projects:edit'),(req,res)=>res.json({intakes:listProjectIntakes(req.query.limit)}));
app.get('/api/project-intake/:id',requireAuth,requirePermission('projects:edit'),(req,res)=>{const intake=getProjectIntake(req.params.id);if(!intake)return res.status(404).json({error:'Intake not found.'});res.json({intake});});
app.post('/api/project-intake/:id/create-project',requireAuth,requirePermission('projects:edit'),(req,res)=>{
  try {
    const intake=getProjectIntake(req.params.id); if(!intake)return res.status(404).json({error:'Intake not found.'});
    const draft=intake.analysis?.projectDraft||{};
    const project={...draft,...(req.body?.project||{}),sourceLabel:'user_uploaded',sourceId:`${intake.id}:${draft.sourceId||''}`,sourceChecksum:intake.combinedSha256};
    const saved=upsertProject(project,req.user);
    const bootstrap=buildProjectBootstrap(saved,{listRecommendations,createRecommendation,upsertOperationalAlert,appendProjectEvent,createPredictionRun,persistCandidatePrediction,audit});
    let dataBackbone=null;
    try { dataBackbone=refreshUnifiedProjectSnapshot(saved,{generatedBy:req.user.email}); } catch(error) { audit({actor:req.user.email,actorRole:req.user.role,action:'project.data_backbone.refresh_failed',resourceType:'project',resourceId:saved.id,outcome:'degraded',metadata:{error:String(error?.message||error)}}); }
    attachProjectToIntake(intake.id,saved.id,req.user);
    const canonical=getCanonicalProjectForIntake(intake.id); if(canonical && canonical.status!=='ATTACHED') attachCanonicalProjectToProject(canonical.id,saved.id,req.user);
    res.status(201).json({project:saved,intake:getProjectIntake(intake.id),bootstrap,lifecycleVersion:PROJECT_LIFECYCLE_VERSION,dataBackbone:{version:UNIFIED_DATA_BACKBONE_VERSION,status:dataBackbone?'READY':'DEGRADED',snapshotId:dataBackbone?.id||null}});
  } catch(e){res.status(400).json({error:e?.message||'Project creation from intake failed safely.'});}
});

app.get('/api/map/status',requireAuth,requirePermission('map:read'),(req,res)=>res.json({version:GEOCODER_VERSION,provider:GEOCODER_PROVIDER,timestamp:new Date().toISOString(),liveTiles:true,projectLocationPolicy:'authoritative geometry/coordinates preferred; approximate place/district locations explicitly labelled'}));
app.get('/api/geocode/search',requireAuth,requirePermission('map:read'),async(req,res)=>{
  try {
    const q=String(req.query?.q||'').trim();
    if(!q)return res.status(400).json({error:'Location search text is required.'});
    const key=mappingCacheKey(q);
    const cached=getMapGeocodeCache(key);
    if(cached)return res.json({provider:GEOCODER_PROVIDER,cached:true,query:q,results:cached.results});
    const results=await searchGeocoder(q);
    const rec=makeCacheRecord(q,results);
    saveMapGeocodeCache(rec);
    res.json({provider:GEOCODER_PROVIDER,cached:false,query:q,results});
  } catch(e) { res.status(502).json({error:e?.message||'Location search failed safely.'}); }
});
app.patch('/api/projects/:id/location',requireAuth,requirePermission('projects:edit'),(req,res)=>{
  try {
    const project=getProject(req.params.id); if(!project)return res.status(404).json({error:'Project not found.'});
    if(!isProjectAuthorised(req.user,project))return res.status(403).json({error:'Project is outside your authorised scope.'});
    const updated=updateProjectLocation(req.params.id,req.body||{},req.user);
    if(!updated)return res.status(404).json({error:'Project location could not be updated.'});
    let dataBackbone=null; try { dataBackbone=refreshUnifiedProjectSnapshot(updated,{generatedBy:req.user.email}); } catch(_) {}
    res.json({project:updated,dataBackbone:{version:UNIFIED_DATA_BACKBONE_VERSION,status:dataBackbone?'READY':'DEGRADED',snapshotId:dataBackbone?.id||null}});
  } catch(e){res.status(400).json({error:e?.message||'Project location update failed safely.'});}
});
app.get('/api/models/registry',requireAuth,requirePermission('risk:read'),(req,res)=>res.json({models:listModelRegistry()}));

function buildContextHash(user, projectId, projects) {
  const scope = JSON.stringify({role:user?.role||'',organisation:user?.organisation||'',jurisdiction:user?.jurisdiction||{},projectId:projectId||null,projects:projects.map(p=>p.id)});
  return crypto.createHash('sha256').update(scope).digest('hex');
}
function buildAIWelcome() {
  return {role:'assistant',text:'I\'m Bhoomi AI. Ask about project risk, evidence or priorities.',analysis:{evidenceCoverage:0.95,uncertainty:0.05,evidence:['Answers are grounded in the authorised project records available to this session.'],recommendations:[]},messageId:null,createdAt:new Date().toISOString()};
}
function responseEvidence(result,{focusProject=null,projects=[]}={}) {
  const refs=[];
  if(focusProject){
    const cards=buildEvidence(focusProject);
    const textBlob=[...(result.evidence||[]).map(String),String(result.text||'')].join(' ').toLowerCase();
    for(const card of cards){
      const category=String(card.category||'').toLowerCase();
      if(category==='model' || textBlob.includes(category==='compensation'?'compensation':category==='documentation'?'documentation':category==='legal'?'legal':'risk')) {
        refs.push({evidenceKey:card.id,projectId:focusProject.id,evidenceType:card.category,label:card.category==='MODEL'?'Stored risk output':`${card.category.charAt(0)+card.category.slice(1).toLowerCase()} record`,claim:card.claim,source:card.source,provenance:card.provenance});
      }
    }
    if(!refs.length) refs.push(...cards.map(card=>({evidenceKey:card.id,projectId:focusProject.id,evidenceType:card.category,label:card.category==='MODEL'?'Stored risk output':`${card.category.charAt(0)+card.category.slice(1).toLowerCase()} record`,claim:card.claim,source:card.source,provenance:card.provenance})));
  } else {
    refs.push({evidenceKey:'PORTFOLIO:AUTHORISED_SCOPE',projectId:null,evidenceType:'SCOPE',label:'Authorised project scope',claim:`Response uses ${projects.length} authorised project records visible to this user.`,source:'BhoomiDrishti authorised project repository',provenance:'DERIVED'});
    if((result.evidence||[]).some(e=>/risk/i.test(String(e)))) refs.push({evidenceKey:'PORTFOLIO:RISK_OUTPUT',projectId:null,evidenceType:'MODEL',label:'Stored portfolio risk outputs',claim:'Portfolio risk ranking uses stored application risk outputs; it is not a fresh model-training run.',source:'BhoomiDrishti risk engine',provenance:'DERIVED'});
  }
  return refs.slice(0,8);
}

app.get('/api/ai/sessions',requireAuth,requirePermission('ai:use'),(req,res)=>{
  const projectId=String(req.query?.projectId||'').trim()||null;
  const projects=authorisedProjects(req.user);
  if(projectId && !projects.some(p=>String(p.id)===projectId)) return res.status(403).json({error:'The selected project is outside your authorised scope.'});
  const sessions=listAISessions(req.user.id,{projectId,limit:10});
  res.json({sessions});
});
app.post('/api/ai/sessions',requireAuth,requirePermission('ai:use'),(req,res)=>{
  const projectId=String(req.body?.projectId||'').trim()||null;
  const projects=authorisedProjects(req.user);
  if(projectId && !projects.some(p=>String(p.id)===projectId)) return res.status(403).json({error:'The selected project is outside your authorised scope.'});
  const session=createAISession({userId:req.user.id,projectId,title:String(req.body?.title||'Bhoomi AI session').slice(0,120),contextHash:buildContextHash(req.user,projectId,projects)});
  audit({actor:req.user.email,actorRole:req.user.role,action:'ai.session.created',resourceType:'ai_session',resourceId:session.id,outcome:'success',metadata:{projectId}});
  res.status(201).json({session,messages:[]});
});
app.get('/api/ai/sessions/:id',requireAuth,requirePermission('ai:use'),(req,res)=>{
  const session=getAISession(req.params.id,req.user.id);
  if(!session) return res.status(404).json({error:'AI session not found.'});
  if(session.projectId && !authorisedProjects(req.user).some(p=>String(p.id)===String(session.projectId))) return res.status(403).json({error:'AI session is outside your authorised project scope.'});
  const messages=listAIMessages(session.id,{limit:30}).map(m=>({...m,analysis:{confidence:m.confidence,evidenceCoverage:m.evidenceCoverage,uncertainty:m.uncertainty,evidence:[],recommendations:[],relatedProjects:[],evidenceRefs:listAIMessageEvidence(m.id),...(() => { try { return JSON.parse(m.metadataJson || '{}'); } catch (_) { return {}; } })()}}));
  res.json({session,messages});
});
app.delete('/api/ai/sessions/:id',requireAuth,requirePermission('ai:use'),(req,res)=>{
  const session=getAISession(req.params.id,req.user.id);
  if(!session) return res.status(404).json({error:'AI session not found.'});
  const ok=archiveAISession(session.id,req.user.id);
  audit({actor:req.user.email,actorRole:req.user.role,action:'ai.session.archived',resourceType:'ai_session',resourceId:session.id,outcome:ok?'success':'not_found'});
  res.json({ok});
});


async function callGemini(systemInstruction, userPrompt) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key is not configured.');
  if (AI_DATA_MODE !== 'external_allowed') throw new Error('External AI use is disabled by AI_DATA_MODE.');
  if (Date.now() < geminiUnavailableUntil) {
    throw new Error('Gemini provider is temporarily circuit-broken after a recent provider failure.');
  }

  const schema = {
    type: 'object',
    properties: {
      text: { type: 'string' },
      evidence: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
      relatedProjects: { type: 'array', items: { type: 'object', properties: { id:{type:'string'}, name:{type:'string'}, risk:{type:'number'}, band:{type:'string'} }, required:['id','name','risk','band'] } },
      confidence: { type: 'number' },
    },
    required: ['text','evidence','recommendations','relatedProjects','confidence'],
  };

  const candidates = [...new Set([AI_MODEL, ...AI_FALLBACK_MODELS])].slice(0, 3);
  const errors = [];
  const started = Date.now();
  let attempted = 0;

  for (const model of candidates) {
    const elapsed = Date.now() - started;
    const remaining = AI_PROVIDER_TOTAL_BUDGET_MS - elapsed;
    if (remaining <= 500) break;
    attempted += 1;
    const timeout = Math.min(AI_PROVIDER_TIMEOUT_MS, remaining);
    const endpoint = `https://generativelanguage.googleapis.com/${AI_API_VERSION}/interactions`;
    const body = {
      model,
      input: userPrompt,
      system_instruction: systemInstruction,
      response_format: { type: 'json_schema', schema },
      generation_config: { thinking_level: AI_THINKING_LEVEL, max_output_tokens: AI_MAX_OUTPUT_TOKENS },
      store: false,
    };
    try {
      const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY}, body:JSON.stringify(body), signal:AbortSignal.timeout(timeout) });
      const raw = await response.text();
      if (!response.ok) {
        const short=raw.slice(0,500);
        errors.push(`${model}: Gemini Interactions request failed (${response.status}): ${short}`);
        if ([429,500,502,503,504].includes(response.status)) continue;
        if ([400,404].includes(response.status)) continue;
        break;
      }
      const json=JSON.parse(raw);
      const direct=typeof json?.output_text==='string' ? json.output_text.trim() : '';
      const stepText=Array.isArray(json?.steps) ? json.steps.flatMap(step=>Array.isArray(step?.content)?step.content:[]).filter(c=>c?.type==='text'&&typeof c.text==='string').map(c=>c.text).join('').trim() : '';
      const text=direct||stepText;
      if(!text){ errors.push(`${model}: Gemini Interactions returned no text output.`); continue; }
      const result=normaliseModelJson(text);
      geminiUnavailableUntil=0;
      return { ...result, providerModel:model, providerAttempts:attempted, apiVersion:AI_API_VERSION };
    } catch(error){
      const msg=String(error?.message||error);
      errors.push(`${model}: ${msg.slice(0,260)}`);
      if(error?.name==='AbortError' || /timed? ?out/i.test(msg)) break;
    }
  }
  geminiUnavailableUntil = Date.now() + AI_PROVIDER_FAILURE_COOLDOWN_MS;
  const err=new Error(errors.join(' | ')||'Gemini Interactions provider failed.');
  err.providerAttempts=attempted;
  throw err;
}
async function callAnthropic(systemInstruction, userPrompt) {
  if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API key is not configured.');
  if (AI_DATA_MODE !== 'external_allowed') throw new Error('External AI use is disabled by AI_DATA_MODE.');
  const endpoint = 'https://api.anthropic.com/v1/messages';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: AI_MODEL || 'claude-sonnet-4-5-20250929', max_tokens: 1400, temperature: 0.1, system: systemInstruction + '\nReturn JSON only.', messages: [{ role: 'user', content: userPrompt }] }),
    signal: AbortSignal.timeout(30000)
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Anthropic request failed (${response.status}): ${raw.slice(0, 300)}`);
  const json = JSON.parse(raw);
  const text = json?.content?.map(part => part?.text || '').join('').trim() || '';
  if (!text) throw new Error('Anthropic returned an empty response.');
  return normaliseModelJson(text);
}

function normaliseModelJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('AI returned an empty response.');
  try { return JSON.parse(raw); } catch (_) {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch (_) {}
  }
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(raw.slice(first, last + 1)); } catch (_) {}
  }
  throw new Error('AI returned malformed structured output.');
}

function projectContext(p) {
  return {
    id:p.id,name:p.name,code:p.code,type:p.type,state:p.state,district:p.district,status:p.status,
    stageIndex:p.stageIndex,totalParcels:p.totalParcels,parcelsAcquired:p.parcelsAcquired,
    familiesAffected:p.familiesAffected,familiesPending:p.familiesPending,avgDelayDays:p.avgDelayDays,
    disputes:p.disputes,courtCases:p.courtCases,approvalPct:p.approvalPct,docsMissing:p.docsMissing,
    resettlementPct:p.resettlementPct,rehabPct:p.rehabPct,depts:p.depts,prevDelays:p.prevDelays,
    risk:p.risk ? {overall:p.risk.overall,band:p.risk.band,bottleneck:p.risk.bottleneck?.label||null,drivers:(p.risk.drivers||[]).slice(0,6).map(d=>({key:d.key,label:d.label,value:d.value,contribution:d.contribution}))}:null,
    provenance:p.sourceLabel||p.source_label||'unspecified'
  };
}

function localAssistant(projects,q,focusProjectId='',recentMessages=[],systemContext={}) {
  return answerWithEvidence({
    projects,
    query:q,
    focusProjectId,
    recentMessages,
    systemContext,
  });
}

app.post('/api/ai/chat',requireAuth,requirePermission('ai:use'),async (req,res)=>{
  const requestStarted=Date.now();
  res.setHeader('X-Bhoomi-AI-Started-At', new Date(requestStarted).toISOString());
  try {
    const projects=authorisedProjects(req.user);
    const requestedProjectId=String(req.body?.projectId||'').trim();
    if(requestedProjectId && !projects.some(p=>String(p.id)===requestedProjectId)) return res.status(403).json({error:'The selected project is outside your authorised scope.'});
    // Keep the UI/session project as the default context, but let an explicit
    // authorized project name in the user's question override that focus.
    // The query engine resolves the target against the full authorized scope.
    const aiProjects=projects;
    let sessionId=String(req.body?.sessionId||'').trim();
    let session=sessionId ? getAISession(sessionId,req.user.id) : null;
    if(session && session.status!=='active') session=null;
    if(session && String(session.projectId||'')!==String(requestedProjectId||'')) return res.status(409).json({error:'AI session context does not match the selected project. Start a new session.'});
    if(session && !aiProjects.some(p=>!session.projectId || String(p.id)===String(session.projectId))) return res.status(403).json({error:'AI session is outside your authorised project scope.'});
    if(!session){
      session=createAISession({userId:req.user.id,projectId:requestedProjectId||null,title:requestedProjectId ? `Bhoomi AI · ${aiProjects[0]?.name||'Project'}` : 'Bhoomi AI · Portfolio',contextHash:buildContextHash(req.user,requestedProjectId||null,projects)});
      sessionId=session.id;
    }

    const incomingQuestion=String(req.body?.question||'').trim();
    const clientMessages=Array.isArray(req.body?.messages)?req.body.messages:[];
    const q=incomingQuestion || String(clientMessages[clientMessages.length-1]?.text||'').trim();
    if(!q)return res.status(400).json({error:'Question is required.'});
    if(q.length>12000)return res.status(400).json({error:'Question is too long (maximum 12,000 characters).'});

    const prior=listAIMessages(session.id,{limit:12});
    appendAIMessage({sessionId:session.id,role:'user',content:q});
    const recentMessages=prior.map(m=>({role:m.role,text:m.text})).slice(-10);
    const local=localAssistant(aiProjects,q,requestedProjectId,recentMessages,{predictiveModelStatus:PREDICTIVE_MODEL_STATUS,predictiveModelVersion:PREDICTIVE_MODEL_VERSION});
    const selected=local?.selectedProjectId
      ? (projects.find(p=>String(p.id)===String(local.selectedProjectId)) || null)
      : (projects.find(p=>String(p.id)===String(requestedProjectId)) || null);
    const evidenceRefs=responseEvidence(local,{focusProject:selected,projects:aiProjects});

    if(!AI_LOCAL_FIRST && (AI_PROVIDER === 'gemini' && GEMINI_API_KEY || AI_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) && AI_DATA_MODE === 'external_allowed' && !req.user.publicDemo && !(AI_PROVIDER === 'gemini' && Date.now() < geminiUnavailableUntil)) {
      const system = `You are Bhoomi AI, an evidence-grounded decision-support assistant for an Indian land-acquisition system. Maintain continuity with the supplied conversation. When a follow-up refers to \'that\', \'this\', \'the above\', \'why\', or \'what evidence supports that\', resolve the reference using the conversation and supplied records instead of asking the user to repeat context. Use only authorised project records. Never invent government records, officer identities, approvals, documents, statutory deadlines, case outcomes or legal conclusions. Treat stored risk as an existing application output, not a fresh prediction. Distinguish observed records from modelled recommendations. If evidence is insufficient, say so explicitly. Return JSON only with keys: text (string), evidence (array of strings), recommendations (array of strings), relatedProjects (array of objects with id,name,risk,band), confidence (number 0..1).`;
      const compact=aiProjects.map(projectContext);
      const scope=req.user.jurisdiction||{};
      const prompt=`USER ROLE:\n${req.user.role}\nORGANISATION:\n${req.user.organisation||'not recorded'}\nAUTHORISED SCOPE:\n${JSON.stringify(scope)}\n\nRECENT AUTHORITATIVE CONVERSATION:\n${JSON.stringify(recentMessages)}\n\nCURRENT USER QUESTION:\n${q}\n\nAUTHORISED PROJECT CONTEXT:\n${JSON.stringify(compact)}\n\nINSTRUCTIONS: Answer the current question in continuity with the conversation. Resolve pronouns and follow-ups from prior turns. An explicit authorized project named in the current question takes precedence over the UI-selected project context; otherwise remain within the selected project when one is active, and otherwise use portfolio scope. Use only authorised records. If information is absent, say it is unavailable. Do not create legal conclusions, official decisions or unsupported deadlines.`;
      try {
        const ai=AI_PROVIDER==='anthropic' ? await callAnthropic(system,prompt) : await callGemini(system,prompt);
        const result={text:String(ai.text||''),evidence:Array.isArray(ai.evidence)?ai.evidence:[],recommendations:Array.isArray(ai.recommendations)?ai.recommendations:[],relatedProjects:Array.isArray(ai.relatedProjects)?ai.relatedProjects:[],confidence:Math.max(0,Math.min(1,Number(ai.confidence??0.72))),mode:`${AI_PROVIDER}-private-proxy`,model:ai.providerModel||AI_MODEL,providerAttempts:ai.providerAttempts||1,apiVersion:ai.apiVersion||null,focusProjectId:requestedProjectId||null};
        const refs=responseEvidence(result,{focusProject:selected,projects:aiProjects});
        const message=appendAIMessage({sessionId:session.id,role:'assistant',content:result.text,mode:result.mode,model:result.model,apiVersion:result.apiVersion,confidence:result.confidence,evidenceCoverage:result.confidence,uncertainty:1-result.confidence,evidence:refs,metadata:{recommendations:result.recommendations,relatedProjects:result.relatedProjects,evidence:result.evidence}});
        audit({actor:req.user.email,actorRole:req.user.role,action:'ai.query',resourceType:'ai_session',resourceId:session.id,outcome:'success',metadata:{mode:result.mode,model:result.model,providerAttempts:result.providerAttempts,apiVersion:result.apiVersion,dataMode:AI_DATA_MODE,messageId:message.id,evidenceCount:refs.length}});
        res.setHeader('X-Bhoomi-AI-Latency-Ms',String(Date.now()-requestStarted));
        return res.json({...result,sessionId:session.id,messageId:message.id,evidenceRefs:refs,conversationContinuity:true});
      } catch(error) {
        console.warn(`${AI_PROVIDER} provider failed; falling back to local evidence engine:`,String(error?.message||error).replace(GEMINI_API_KEY,'[redacted]').replace(ANTHROPIC_API_KEY,'[redacted]'));
        const result={...local,mode:AI_LOCAL_FIRST?'local-evidence-engine':'local-evidence-engine-fallback',warning:AI_LOCAL_FIRST?null:'External AI provider was unavailable; response generated by the local evidence engine.',focusProjectId:requestedProjectId||null};
        const message=appendAIMessage({sessionId:session.id,role:'assistant',content:result.text,mode:result.mode,model:null,confidence:result.confidence,evidenceCoverage:result.evidenceCoverage,uncertainty:result.uncertainty,evidence:evidenceRefs,metadata:{recommendations:result.recommendations,relatedProjects:result.relatedProjects,evidence:result.evidence}});
        audit({actor:req.user.email,actorRole:req.user.role,action:'ai.query',resourceType:'ai_session',resourceId:session.id,outcome:'fallback',metadata:{provider:AI_PROVIDER,error:String(error?.message||error),messageId:message.id,evidenceCount:evidenceRefs.length}});
        res.setHeader('X-Bhoomi-AI-Latency-Ms',String(Date.now()-requestStarted));
        return res.json({...result,sessionId:session.id,messageId:message.id,evidenceRefs,conversationContinuity:true});
      }
    }
    const message=appendAIMessage({sessionId:session.id,role:'assistant',content:local.text,mode:local.mode,confidence:local.confidence,evidenceCoverage:local.evidenceCoverage,uncertainty:local.uncertainty,evidence:evidenceRefs,metadata:{recommendations:local.recommendations,relatedProjects:local.relatedProjects,evidence:local.evidence}});
    audit({actor:req.user.email,actorRole:req.user.role,action:'ai.query',resourceType:'ai_session',resourceId:session.id,outcome:'success',metadata:{mode:local.mode,focusProjectId:requestedProjectId||null,messageId:message.id,evidenceCount:evidenceRefs.length}});
    res.setHeader('X-Bhoomi-AI-Latency-Ms',String(Date.now()-requestStarted));
    return res.json({...local,sessionId:session.id,messageId:message.id,evidenceRefs,conversationContinuity:true});
  } catch(e) {
    console.error('BHOOMI AI ROUTE ERROR:',e?.stack||e?.message||e);
    res.status(500).json({error:'Bhoomi AI could not complete this request safely.'});
  }
});

const SERVE_FRONTEND = String(process.env.SERVE_FRONTEND || 'false').toLowerCase() === 'true';
if (SERVE_FRONTEND) {
  const distDir = path.resolve(SERVER_DIR, '..', 'dist');
  app.use(express.static(distDir, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
  app.get(/^(?!\/api\/).*/, (req,res,next) => { const indexFile=path.join(distDir,'index.html'); if(!fs.existsSync(indexFile)) return res.status(503).send('Frontend build is not available.'); return res.sendFile(indexFile); });
}

app.listen(PORT,()=>{console.log(`BhoomiDrishti backend listening on http://localhost:${PORT}`);console.log(`Frontend origin: ${ALLOWED_ORIGIN}`);console.log(`Persistent database: ${RUNTIME_DB_PATH}`);const configured=(AI_PROVIDER==='gemini'?Boolean(GEMINI_API_KEY):AI_PROVIDER==='anthropic'?Boolean(ANTHROPIC_API_KEY):false);console.log(configured && AI_DATA_MODE==='external_allowed' ? `${AI_PROVIDER === 'gemini' ? 'Gemini' : 'Anthropic'} AI enabled with server-side provider mode (${AI_MODEL}).` : 'External AI provider unavailable or disabled; using local evidence engine.'); if (AI_PROVIDER === 'gemini') console.log(`Gemini API: ${AI_API_VERSION}/interactions; fallbacks: ${AI_FALLBACK_MODELS.join(', ') || 'none'}; thinking: ${AI_THINKING_LEVEL}; timeout: ${AI_PROVIDER_TIMEOUT_MS}ms`);});
