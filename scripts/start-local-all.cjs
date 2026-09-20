#!/usr/bin/env node
const { spawn, spawnSync } = require('node:child_process');
const process = require('node:process');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const { DATA_ROOT_DIR, DB_PATH, ensureRuntimeDirs, RUNTIME_LOCK_PATH } = require(path.join(ROOT, 'backend', 'runtime-paths.cjs'));
if (!pkg.scripts?.backend || !pkg.scripts?.dev) throw new Error('backend/dev scripts are required.');
const node = process.execPath;
const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
if (!fs.existsSync(viteBin)) throw new Error('Vite dependency is missing. Run npm install before npm run start:all.');
ensureRuntimeDirs();
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

function portBusy(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host:'127.0.0.1', port });
    let settled = false;
    const finish = value => { if (settled) return; settled = true; try { socket.destroy(); } catch (_) {} resolve(value); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(600, () => finish(false));
  });
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (_) { return false; }
}

(async () => {
  if (await portBusy(8787)) throw new Error('Port 8787 is already in use. Stop the existing BHOOMIDHRISHTI backend before starting another release.');
  if (await portBusy(5173)) throw new Error('Port 5173 is already in use. Stop the existing BHOOMIDHRISHTI frontend before starting another release.');

  // Prove the actual shared DB is writable before spawning either server.
  let db=null; let preflightError=null;
  for(let attempt=1;attempt<=20;attempt+=1){
    try{ db=new DatabaseSync(DB_PATH,{timeout:10000}); const check=db.prepare('PRAGMA quick_check').get(); if(String(check?.quick_check||'').toLowerCase()!=='ok') throw new Error('SQLite quick_check did not return ok'); db.exec('BEGIN IMMEDIATE; ROLLBACK;'); preflightError=null; break; }
    catch(e){ preflightError=e; if(!/unable to open database file|locked|busy/i.test(String(e?.message||''))||attempt===20) break; await new Promise(r=>setTimeout(r,300)); }
    finally{ try{db?.close();}catch(_){} db=null; }
  }
  if(preflightError) throw new Error(`Persistent database preflight failed: ${preflightError.message}`);
  await new Promise(r=>setTimeout(r,750));

  const lockPath = RUNTIME_LOCK_PATH;
  if (fs.existsSync(lockPath)) {
    try {
      const old = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (pidAlive(Number(old.pid))) throw new Error(`A BHOOMIDHRISHTI runtime is already using the shared store (PID ${old.pid}).`);
    } catch (error) {
      if (/already using the shared store/.test(error.message)) throw error;
      try { fs.unlinkSync(lockPath); } catch (_) {}
    }
  }
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), root: ROOT }, null, 2), 'utf8');

  const common = { cwd: ROOT, stdio: 'inherit', env: { ...process.env }, shell: false };
  const children = [];
  let shuttingDown = false;
  function cleanupLock() { try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch (_) {} }
  function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) { try { child.kill('SIGINT'); } catch (_) {} }
    cleanupLock();
    setTimeout(() => process.exit(code || 0), 500);
  }
  function start(label,args) {
    const child = spawn(node,args,common);
    children.push(child);
    child.on('error',(err)=>{ console.error(`[${label}] ${err.message}`); shutdown(1); });
    child.on('exit',(code,signal)=>{ if(!shuttingDown && code!==0){ console.error(`[${label}] exited with code=${code} signal=${signal||'none'}`); shutdown(code||1); } });
  }
  process.on('SIGINT',()=>shutdown(0));
  process.on('SIGTERM',()=>shutdown(0));
  process.on('exit', cleanupLock);
  console.log('BhoomiDrishti local stack');
  console.log(`Project root: ${ROOT}`);
  console.log('Backend: http://localhost:8787');
  console.log('Frontend: http://localhost:5173');
  console.log(`Persistent data root: ${DATA_ROOT_DIR}`);
  console.log(`Persistent database: ${DB_PATH}`);
  console.log('Persistent DB preflight: PASS');
  console.log('Press Ctrl+C once to stop both processes.');
  start('backend',['backend/server.js']);
  start('frontend',[viteBin]);
})().catch(error => {
  console.error(`BhoomiDrishti startup preflight failed: ${error.message}`);
  process.exit(1);
});
