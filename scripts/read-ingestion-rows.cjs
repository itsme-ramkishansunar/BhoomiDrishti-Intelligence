#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function arg(name){const p=`--${name}=`;const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):null;}
const file=path.resolve(root,arg('input')||'');
const SUPPORTED_FORMATS=['csv','tsv','json','ndjson','xlsx'];
const limit=Math.min(Math.max(Number(arg('limit')||10000),1),50000);
if(!file || !fs.existsSync(file)) throw new Error('Input dataset was not found.');
function split(line,delim=','){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===delim&&!q){out.push(cur.trim());cur='';}else cur+=c;}out.push(cur.trim());return out;}
function delimited(text,delim){const lines=text.split(/\r?\n/).filter(x=>x.trim());if(!lines.length)return {headers:[],rows:[]};const headers=split(lines[0],delim);const rows=lines.slice(1,limit+1).map(line=>{const vals=split(line,delim);const o={};headers.forEach((h,i)=>o[h||`column_${i+1}`]=vals[i]??'');return o;});return {headers,rows};}
function jsonRows(raw){const v=JSON.parse(raw);const rows=Array.isArray(v)?v:(Array.isArray(v?.data)?v.data:[v]);const limited=rows.slice(0,limit);const headers=[...new Set(limited.flatMap(r=>Object.keys(r||{})))];return {headers,rows:limited};}
function xlsx(file){const candidates=process.platform==='win32'?['python','py','python3']:['python3','python'];let last='';for(const exe of candidates){const r=cp.spawnSync(exe,['scripts/xlsx-inspect.py',file],{cwd:root,encoding:'utf8'});if(r.status===0&&r.stdout){const sheets=JSON.parse(r.stdout);const rows=[];const headers=new Set();for(const s of sheets){for(const r of (s.rows||[])){if(rows.length>=limit)break;rows.push({...r,__sheet:s.sheet});Object.keys(r||{}).forEach(k=>headers.add(k));}if(rows.length>=limit)break;}return {headers:[...headers],rows,sheets:sheets.map(s=>({name:s.sheet,rows:(s.rows||[]).length,columns:(s.headers||[]).length}))};}last=r.stderr||r.stdout||'';}throw new Error(`XLSX parsing requires Python 3: ${last}`);}
const ext=path.extname(file).toLowerCase();let out;if(ext==='.xlsx')out=xlsx(file);else if(ext==='.json'||ext==='.ndjson'){if(ext==='.ndjson'){const rows=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).slice(0,limit).map(x=>JSON.parse(x));const headers=[...new Set(rows.flatMap(r=>Object.keys(r||{})))];out={headers,rows};}else out=jsonRows(fs.readFileSync(file,'utf8'));}else out=delimited(fs.readFileSync(file,'utf8'),ext==='.tsv'?'\t':',');
console.log(JSON.stringify({file:path.relative(root,file),extension:ext,limit,truncated:out.rows.length>=limit,headers:out.headers,rows:out.rows,sheets:out.sheets||null}));
