const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', 'src');
const BUILT_INS = new Set(['React','Fragment','Suspense','StrictMode']);

function files(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const full=path.join(dir,e.name);
    return e.isDirectory() ? files(full) : (/\.jsx$/.test(e.name) ? [full] : []);
  });
}

function addNames(names, clause) {
  const text = clause.trim();
  // Side-effect import: import 'module';
  if (!text || /^['"]/ .test(text)) return;

  const namedMatch = text.match(/\{([\s\S]*?)\}/);
  if (namedMatch) {
    namedMatch[1].split(',').forEach(part=>{
      const item=part.trim();
      if(!item) return;
      const bits=item.split(/\s+as\s+/);
      const local=(bits[1]||bits[0]).trim();
      if(/^[A-Za-z_$][\w$]*$/.test(local)) names.add(local);
    });
  }

  const namespaceMatch = text.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespaceMatch) names.add(namespaceMatch[1]);

  const beforeNamed = text.split('{')[0].split('*')[0].replace(/,$/,'').trim();
  if (/^[A-Za-z_$][\w$]*$/.test(beforeNamed)) names.add(beforeNamed);
}

function bindings(source) {
  const names = new Set();
  // Parse only imports that have a `from` clause; side-effect imports cannot
  // contribute bindings and must never consume a following named import.
  const importFromRe = /\bimport\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]\s*;?/g;
  for (const m of source.matchAll(importFromRe)) addNames(names,m[1]);

  // Local declarations.
  for (const m of source.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);

  // Destructured function parameters used as JSX components in a few legacy
  // render-helper patterns.
  for (const m of source.matchAll(/\bfunction\s+[A-Za-z_$][\w$]*\s*\(\s*\{([^}]*)\}\s*\)/g)) {
    for (const part of m[1].split(',')) {
      const clean=part.trim();
      const alias=clean.match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)$/);
      const name=(alias?alias[2]:clean.match(/^([A-Za-z_$][\w$]*)$/)?.[1]);
      if(name) names.add(name);
    }
  }
  return names;
}

const failures=[];
for(const file of files(ROOT)) {
  const source=fs.readFileSync(file,'utf8');
  const bound=bindings(source);
  const rel=path.relative(path.resolve(__dirname,'..'),file);

  for(const m of source.matchAll(/\bicon\s*:\s*([A-Za-z_$][\w$]*)/g)) {
    const n=m[1];
    if(!bound.has(n) && !BUILT_INS.has(n)) failures.push(`${rel}: icon reference '${n}' is not imported or locally defined`);
  }
  for(const m of source.matchAll(/<([A-Z][A-Za-z0-9_$]*)(?:\s|\/?>)/g)) {
    const n=m[1];
    if(!bound.has(n) && !BUILT_INS.has(n)) failures.push(`${rel}: JSX component '${n}' is not imported or locally defined`);
  }
}

if(failures.length) {
  console.error('Frontend symbol contract failed:');
  failures.forEach(x=>console.error('FAIL '+x));
  process.exit(1);
}
console.log('Frontend symbol contract passed: JSX components and icon references resolve to imports/local bindings.');
