import crypto from 'node:crypto';

export const ML_BASELINE_VERSION = 'sih26017-logistic-v1';

const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, Number(v)));
const sigmoid = z => 1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;

function dot(a,b){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;}
function safeNum(v){const n=Number(v);return Number.isFinite(n)?n:0;}

export function fitStandardizer(rows, featureKeys){
  const stats={};
  for(const k of featureKeys){const vals=rows.map(r=>safeNum(r[k]));const m=mean(vals);const variance=mean(vals.map(v=>(v-m)**2));stats[k]={mean:m,std:Math.sqrt(variance)||1};}
  return stats;
}
export function transformRows(rows, featureKeys, stats){
  return rows.map(r=>featureKeys.map(k=>(safeNum(r[k])-stats[k].mean)/stats[k].std));
}

export function fitLogistic(rows, featureKeys, {epochs=1200, learningRate=0.06, l2=0.002}={}){
  if(!rows.length) throw new Error('No training rows.');
  const labels=rows.map(r=>Number(r.label));
  if(!labels.some(y=>y===0) || !labels.some(y=>y===1)) throw new Error('Training data must contain both label classes.');
  const stats=fitStandardizer(rows,featureKeys); const X=transformRows(rows,featureKeys,stats); const w=new Array(featureKeys.length+1).fill(0);
  for(let epoch=0;epoch<epochs;epoch++){
    const grad=new Array(w.length).fill(0);
    for(let i=0;i<X.length;i++){
      const xi=[1,...X[i]]; const p=sigmoid(dot(w,xi)); const e=p-labels[i];
      for(let j=0;j<w.length;j++) grad[j]+=e*xi[j];
    }
    for(let j=0;j<w.length;j++){grad[j]/=X.length;if(j>0)grad[j]+=l2*w[j];w[j]-=learningRate*grad[j];}
  }
  return {version:ML_BASELINE_VERSION,featureKeys,standardizer:stats,weights:w,algorithm:'logistic_regression',trainedRows:rows.length};
}
export function predictProba(model, rows){const X=transformRows(rows,model.featureKeys,model.standardizer);return X.map(x=>sigmoid(dot(model.weights,[1,...x])));}

function rankPairs(scores,labels){return scores.map((s,i)=>({s,y:Number(labels[i])})).sort((a,b)=>b.s-a.s);}
export function rocAuc(scores, labels){
  const pos=labels.filter(y=>Number(y)===1).length, neg=labels.length-pos;
  if(!pos||!neg) return null;
  const sorted=rankPairs(scores,labels); let tp=0,fp=0, prevScore=Infinity, prevTPR=0, prevFPR=0, auc=0;
  for(const item of sorted){ if(item.s!==prevScore){const tpr=tp/pos,fpr=fp/neg;auc+=(fpr-prevFPR)*(tpr+prevTPR)/2;prevFPR=fpr;prevTPR=tpr;prevScore=item.s;} if(item.y===1)tp++;else fp++; }
  auc+=(1-prevFPR)*(1+prevTPR)/2; return auc;
}
export function prAuc(scores, labels){
  const pos=labels.filter(y=>Number(y)===1).length; if(!pos)return null; const sorted=rankPairs(scores,labels);let tp=0,fp=0,lastRecall=0,auc=0;
  for(const item of sorted){if(item.y===1)tp++;else fp++;const recall=tp/pos,precision=tp/(tp+fp);auc+=(recall-lastRecall)*precision;lastRecall=recall;}return auc;
}
export function brier(scores,labels){if(!labels.length)return null;return mean(scores.map((p,i)=>(clamp(p)-Number(labels[i]))**2));}
export function expectedCalibrationError(scores,labels,bins=10){if(!labels.length)return null;let total=0;for(let b=0;b<bins;b++){const lo=b/bins,hi=(b+1)/bins;const idx=scores.map((p,i)=>({p,y:Number(labels[i])})).filter(x=>x.p>=lo&&(b===bins-1?x.p<=hi:x.p<hi));if(!idx.length)continue;const conf=mean(idx.map(x=>x.p)),acc=mean(idx.map(x=>x.y));total+=(idx.length/labels.length)*Math.abs(conf-acc);}return total;}
export function thresholdMetrics(scores,labels,threshold=.5){let tp=0,fp=0,tn=0,fn=0;for(let i=0;i<scores.length;i++){const pred=scores[i]>=threshold?1:0,y=Number(labels[i]);if(pred&&y)tp++;else if(pred&&!y)fp++;else if(!pred&&!y)tn++;else fn++;}return{threshold,tp,fp,tn,fn,precision:tp+fp?tp/(tp+fp):0,recall:tp+fn?tp/(tp+fn):0,falseAlertRate:fp/(fp+tn||1)};}
export function topKMetrics(scores,labels,k=Math.max(1,Math.ceil(scores.length*.1))){const idx=scores.map((s,i)=>({s,y:Number(labels[i])})).sort((a,b)=>b.s-a.s).slice(0,k);const tp=idx.filter(x=>x.y===1).length;const positives=labels.filter(y=>Number(y)===1).length;return{k,precisionAtK:tp/k,recallAtK:positives?tp/positives:0};}
export function evaluateModel(model, rows, {threshold=.5}={}){
  const labels=rows.map(r=>Number(r.label)); const scores=predictProba(model,rows);return{sampleCount:rows.length,rocAuc:rocAuc(scores,labels),prAuc:prAuc(scores,labels),brier:brier(scores,labels),calibrationError:expectedCalibrationError(scores,labels),threshold:thresholdMetrics(scores,labels,threshold),topK:topKMetrics(scores,labels),predictionCoverage:1};
}

export function projectTemporalSplit(rows,{trainPct=.7,valPct=.15}={}){
  if(!rows.length) throw new Error('No rows supplied.');
  const byProject=new Map();for(const r of rows){const pid=String(r.project_id||'').trim();if(!pid)throw new Error('project_id is required for project-level temporal split.');const t=Date.parse(r.prediction_time);if(!Number.isFinite(t))throw new Error('prediction_time must be a valid date/time.');if(!byProject.has(pid)||t<byProject.get(pid))byProject.set(pid,t);}
  const projects=[...byProject.entries()].sort((a,b)=>a[1]-b[1]).map(x=>x[0]);
  const n=projects.length;const trainN=Math.max(1,Math.floor(n*trainPct));const valN=Math.max(1,Math.floor(n*valPct));const trainSet=new Set(projects.slice(0,trainN));const valSet=new Set(projects.slice(trainN,trainN+valN));
  const train=rows.filter(r=>trainSet.has(String(r.project_id)));const validation=rows.filter(r=>valSet.has(String(r.project_id)));const test=rows.filter(r=>!trainSet.has(String(r.project_id))&&!valSet.has(String(r.project_id)));
  if(!test.length) throw new Error('Temporal split produced no test projects; more project cohorts are required.');
  return {mode:'project_cohort_temporal',projects:{total:n,train:trainSet.size,validation:valSet.size,test:n-trainSet.size-valSet.size},rows:{train:train.length,validation:validation.length,test:test.length},train,validation,test};
}

export function artifactDigest(model){return crypto.createHash('sha256').update(JSON.stringify(model)).digest('hex');}
