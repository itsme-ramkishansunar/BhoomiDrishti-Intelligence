const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const readmes=fs.readdirSync(root).filter(f=>/^README(?:_UPGRADE.*)?\.md$/i.test(f));
if(readmes.length!==1 || readmes[0]!=='README.md') throw new Error(`Expected exactly one root README.md; found: ${readmes.join(', ')}`);
const master=fs.readFileSync(path.join(root,'README.md'),'utf8');
for(const marker of ['BHOOMIDHRISHTI — Master Project README','Upgrade 32','Historical note from `README_UPGRADE_01.md`']){
  if(!master.includes(marker)) throw new Error(`Master README missing required continuity marker: ${marker}`);
}
console.log('README consolidation smoke passed: one root master README with preserved continuity history.');
