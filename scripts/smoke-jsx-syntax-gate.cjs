const fs=require('fs');const path=require('path');
const root=process.cwd();const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','dist','.git'].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(jsx|tsx)$/.test(entry.name))files.push(p);}}
walk(path.join(root,'src'));
let failed=false;
for(const file of files){
  const s=fs.readFileSync(file,'utf8');
  const checks=[['braces',s.match(/{/g)?.length||0,s.match(/}/g)?.length||0],['parens',s.match(/\(/g)?.length||0,s.match(/\)/g)?.length||0],['brackets',s.match(/\[/g)?.length||0,s.match(/\]/g)?.length||0]];
  for(const [label,a,b] of checks)if(a!==b){console.error(`FAIL JSX SYNTAX GATE: ${path.relative(root,file)} unmatched ${label} (${a}/${b})`);failed=true;}
}
if(!files.length){console.error('FAIL JSX SYNTAX GATE: no JSX/TSX source files found');failed=true;}
if(failed)process.exit(1);
console.log(`JSX SYNTAX GATE PASSED · ${files.length} JSX/TSX files structurally balanced.`);
