#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
for(const [name,command] of Object.entries(pkg.scripts||{})){
  const m=String(command).match(/node (scripts\/[^\s&;]+)/g)||[];
  for(const raw of m){
    const rel=raw.replace(/^node /,'');
    if(!fs.existsSync(path.join(root,rel))) throw new Error(`Missing script target for ${name}: ${rel}`);
  }
}
console.log('RELEASE PATH CONTRACT PASSED');
