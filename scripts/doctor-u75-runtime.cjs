const fs=require('node:fs'), path=require('node:path'), net=require('node:net');
const root=path.resolve(__dirname,'..');
const {DB_PATH}=require(path.join(root,'backend','runtime-paths.cjs'));
const checks=[
  ['root',fs.existsSync(root)],
  ['package',fs.existsSync(path.join(root,'package.json'))],
  ['backend',fs.existsSync(path.join(root,'backend','server.js'))],
  ['runtime-paths',fs.existsSync(path.join(root,'backend','runtime-paths.cjs'))],
  ['persistent-db',fs.existsSync(DB_PATH)],
  ['u75-module',fs.existsSync(path.join(root,'backend','domain','u75-bulk-integration.js'))],
];
console.log(JSON.stringify({ok:checks.every(x=>x[1]),version:'u75-runtime-doctor-v2',dbPath:DB_PATH,checks},null,2));
function testPort(port){return new Promise(resolve=>{const s=net.createConnection({host:'127.0.0.1',port});let done=false;const finish=v=>{if(done)return;done=true;try{s.destroy()}catch{};resolve(v)};s.once('connect',()=>finish(true));s.once('error',()=>finish(false));s.setTimeout(500,()=>finish(false));});}
Promise.all([testPort(8787),testPort(5173)]).then(([backend,frontend])=>{console.log(JSON.stringify({ports:{8787:backend,5173:frontend},note:'true means the port is currently occupied/listening; false means it is free.'},null,2));});
