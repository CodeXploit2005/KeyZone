import { createLicenseServer } from '../license-server/server.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const directory=resolve(root,'release-build/qa-reload-074');mkdirSync(directory,{recursive:true});
const backend=createLicenseServer({password:'fixture-tests-only-password',database:':memory:'});
await new Promise(r=>backend.listen(0,'127.0.0.1',r));
const license=`http://127.0.0.1:${backend.address().port}`;
const children=[];
const pg=resolve(root,'release-build/payload/runtime/postgres/bin');
const pgData=mkdtempSync(resolve(directory,'postgres-'));
let pgStarted=false,dbPort;
async function run(file,args) {
  const child=spawn(file,args,{windowsHide:true,stdio:'ignore'});
  const [code]=await once(child,'exit');assert.equal(code,0,`${file} failed`);
}
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function start(name) {
  const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));
  const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const log=openSync(resolve(directory,`${name}.log`),'a');
  const process=spawn(resolve(root,'release-build/payload/runtime/node/node.exe'),['node_modules/next/dist/bin/next','start','--hostname','localhost','--port',String(port)],{
    cwd:resolve(root,'release-build/payload/app'),windowsHide:true,stdio:['ignore',log,log],
    env:{...globalThis.process.env,PORT:String(port),HOSTNAME:'localhost',KEYZONE_LICENSE_URL:license,
      KEYZONE_LICENSE_DIR:resolve(directory,name,'license'),STORAGE_DIR:resolve(directory,name,'storage'),
      MUSE2API_KEY:'fixture-only',DATABASE_URL:`postgresql://postgres@127.0.0.1:${dbPort}/keyzone`}
  });closeSync(log);children.push(process);
  const base=`http://localhost:${port}`;
  for(let i=0;i<50;i++) {try{const r=await fetch(base+'/api/license');await r.arrayBuffer();return {base,process};}catch{await new Promise(r=>setTimeout(r,200));}}
  throw new Error('Temporary app did not start');
}
async function api(base,path,body,headers={}) {
  return fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:base,...headers},body:body?JSON.stringify(body):undefined,redirect:'manual'});
}
try {
  dbPort=await freePort();
  await run(resolve(pg,'initdb.exe'),['-D',pgData,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']);
  await run(resolve(pg,'pg_ctl.exe'),['-D',pgData,'-l',resolve(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${dbPort}`,'-w','start']);pgStarted=true;
  await run(resolve(pg,'createdb.exe'),['-h','127.0.0.1','-p',String(dbPort),'-U','postgres','keyzone']);
  await run(resolve(pg,'psql.exe'),['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(dbPort),'-U','postgres','-d','keyzone','-f',resolve(root,'release-build/payload/schema.sql')]);
  const login=await api(license,'/api/admin/login',{password:'fixture-tests-only-password'},{Origin:'http://127.0.0.1:4320'});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const created=await api(license,'/api/admin/keys',{customer:'Reload fixture',maxDevices:1,expiresAt:new Date(Date.now()+3600000).toISOString()},{Cookie:cookie,Origin:'http://127.0.0.1:4320'});
  const {key,id}=await created.json();assert.ok(key);
  const one=await start('one'),two=await start('two');
  const activated=await api(one.base,'/api/license',{key});
  assert.equal(activated.status,200,(await activated.json()).error);
  assert.equal((await (await api(one.base,'/api/license')).json()).valid,true,'saved session survives absent cookie');
  assert.equal((await (await api(one.base,'/api/license',undefined,{Cookie:'keyzone_license=stale'})).json()).valid,true,'stale cookie does not override saved session');
  const reload=await api(one.base,'/activate');assert.equal(reload.status,307);assert.equal(new URL(reload.headers.get('location'),one.base).pathname,'/');
  const workspace=await api(one.base,'/guides/facebook');
  assert.equal(workspace.status,200);
  assert.doesNotMatch(await workspace.text(),/id="license-key"|Kích hoạt quyền sử dụng/,'verified document reload must render without activation form');
  const rejected=await api(two.base,'/api/license',{key});assert.equal(rejected.status,403);assert.match((await rejected.json()).error,/Key đang được sử dụng/);
  assert.equal((await (await api(one.base,'/api/license')).json()).valid,true,'second machine cannot evict the first');
  const spoof=await api(two.base,'/activate',undefined,{'x-keyzone-license-state':encodeURIComponent(JSON.stringify({valid:true}))});
  assert.match(await spoof.text(),/Kích hoạt quyền sử dụng/,'caller cannot forge server verified UI state');
  one.process.kill();await once(one.process,'exit');const restarted=await start('one');
  assert.equal((await (await api(restarted.base,'/api/license')).json()).valid,true,'activation survives process restart');
  const revoked=await fetch(license+'/api/admin/keys/'+id,{method:'PATCH',headers:{Origin:'http://127.0.0.1:4320',Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({action:'revoke'})});assert.equal(revoked.status,200);
  assert.equal((await (await api(restarted.base,'/api/license')).json()).valid,false,'revocation still blocks saved sessions');
  console.log('PASS real production app: saved session without cookie, stale cookie, reload redirect, second device denied, first device retained, spoofed state rejected, restart, revocation');
} finally {
  for(const child of children)if(child.exitCode===null&&!child.killed){child.kill();await once(child,'exit');}
  if(pgStarted)await run(resolve(pg,'pg_ctl.exe'),['-D',pgData,'-m','fast','-w','stop']);
  await new Promise(r=>backend.close(r));
}
