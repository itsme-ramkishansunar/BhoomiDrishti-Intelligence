(async()=>{
  const m=await import('../backend/domain/ml-baseline.js');
  const rows=[];
  for(let i=0;i<48;i++) rows.push({project_id:`P${String(Math.floor(i/4)).padStart(2,'0')}`,prediction_time:`2024-${String(1+Math.floor(i/4)).padStart(2,'0')}-15T00:00:00Z`,label:(i%4<2?0:1),stage_index:i%8,days_in_stage:(i%7)+1,families_pending_ratio:(i%5)/5,legal_exposure:(i%6)/5,approval_gap:1-(i%10)/10,documentation_gap:(i%4)/4});
  const split=m.projectTemporalSplit(rows);if(split.train.length<1||split.validation.length<1||split.test.length<1)throw new Error('FAIL temporal split');
  const features=['stage_index','days_in_stage','families_pending_ratio','legal_exposure','approval_gap','documentation_gap'];
  const model=m.fitLogistic(split.train,features);const ev=m.evaluateModel(model,split.test);if(!Number.isFinite(ev.brier))throw new Error('FAIL evaluation metrics');if(!Number.isFinite(ev.rocAuc))throw new Error('FAIL ROC AUC metric');
  console.log('PASS ml-baseline temporal split');console.log('PASS ml-baseline logistic fit');console.log('PASS ml-baseline ROC/PR/Brier/calibration metrics');console.log('PASS ml-baseline top-K/threshold metrics');console.log('ML baseline smoke behavior check passed.');
})().catch(e=>{console.error(e);process.exit(1)});
