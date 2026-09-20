#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const skipDirs = new Set(['.git','node_modules','dist','.tmp-public-demo-smoke']);
const blockedFiles = [/^\.env$/i,/^\.env\.(?!example$)/i,/\.sqlite(?:-|$)/i,/\.db(?:-|$)/i,/\.pem$/i,/\.key$/i,/\.p12$/i,/\.pfx$/i,/\.jks$/i];

// Build the high-risk literals from fragments so the audit script does not
// report its own test signatures when scanning repository text.
const suspiciousLiterals = [
  ['Bhoomi@','(?:Admin|Gov|Dept|Legal|View)','#2026!'],
  ['RuntimeOnly','!2026-Admin'],
  ['U45Runtime','!2026'],
  ['SmokeOnly-Change','-2026-Long'],
].map(parts => parts.join(''));

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  ...suspiciousLiterals.map(v => new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
];

const findings=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name); const rel=path.relative(root,full);
    if(entry.isDirectory()){ if(!skipDirs.has(entry.name)) walk(full); continue; }
    if(blockedFiles.some(r=>r.test(entry.name))) findings.push(`blocked sensitive file: ${rel}`);
    let text=''; try{text=fs.readFileSync(full,'utf8');}catch{continue;}
    // Never scan this audit script against its own internal test signatures.
    if(rel !== path.join('scripts','audit-public-repo.cjs')) {
      for(const re of secretPatterns) if(re.test(text)) findings.push(`secret pattern detected in ${rel}`);
    }
  }
}
walk(root);
if(findings.length){ console.error('PUBLIC REPOSITORY AUDIT FAILED'); for(const f of findings) console.error(`- ${f}`); process.exit(1); }
console.log('PUBLIC REPOSITORY AUDIT PASSED');
console.log('No tracked credentials/private-key patterns or local database files detected.');
