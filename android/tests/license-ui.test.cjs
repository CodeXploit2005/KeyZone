const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('Android activation gate, settings expiry and relocking preserve private project data', async () => {
  const events={}, root={innerHTML:''}, nav={}, settings={}, notice={style:{}};
  let entitlement={valid:false,error:'Nhập key để kích hoạt.'};
  const calls=[];
  const document={hidden:false,activeElement:null,
    querySelector:selector=>selector==='#app'?root:selector==='nav'?nav:selector==='#notice'?notice:settings,
    querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn};
  const context={document,console,Date,Error,Promise,FormData:class {constructor(form){this.form=form;}get(name){return this.form.values[name];}},
    setTimeout:(fn,ms)=>{if(ms===20)queueMicrotask(fn);return 1;},clearTimeout:()=>{},setInterval:()=>{},
    window:{addEventListener:()=>{},scrollTo:()=>{}},confirm:()=>true,
    KeyZoneNative:{request:raw=>{
      const {action,data}=JSON.parse(raw);calls.push({action,data});
      if(action==='license.activate'){
        assert.equal(data.key,'KZ-1234567890-ABCDEF');
        entitlement={valid:true,error:'',customer:'Khách thử',expiresAt:'2099-01-01T00:00:00Z'};
      }
      if(action==='license.deactivate')entitlement={valid:false,error:'Đã gỡ kích hoạt.'};
      const result=action==='snapshot'?{license:entitlement,...(entitlement.valid?{projects:[{id:'private',title:'Dự án riêng',status:'draft'}],niches:[],characters:[],accounts:[],settings:{},job:{},busy:false}:{})}:entitlement;
      return JSON.stringify({ok:true,data:result});
    }}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/assets/app.js'),'utf8'),context);
  const flush=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
  await flush();
  assert.match(root.innerHTML,/id="license-form"/);assert.equal(nav.hidden,true);assert.equal(settings.hidden,true);
  assert.doesNotMatch(root.innerHTML,/Dự án riêng/);
  const submit={disabled:false,textContent:''};
  await events.submit({preventDefault(){},target:{id:'license-form',values:{licenseKey:'KZ-1234567890-ABCDEF'},querySelector:()=>submit}});
  assert.match(root.innerHTML,/Dự án riêng/);assert.equal(nav.hidden,false);assert.doesNotMatch(root.innerHTML,/data-action="project-new"[^>]*disabled/);
  const click=async action=>events.click({preventDefault(){},target:{closest:()=>({dataset:{action},disabled:false})}});
  await click('settings');assert.match(root.innerHTML,/Bản quyền đang hoạt động/);assert.match(root.innerHTML,/Khách thử/);assert.match(root.innerHTML,/2099/);
  entitlement={valid:false,error:'Key đã bị thu hồi.'};
  await events.visibilitychange();
  assert.match(root.innerHTML,/Key đã bị thu hồi/);assert.equal(nav.hidden,true);assert.doesNotMatch(root.innerHTML,/Dự án riêng/);
  assert.ok(calls.some(c=>c.action==='license.status'&&c.data.force));
  entitlement={valid:true,error:'',customer:'Khách thử',expiresAt:'2099-01-01T00:00:00Z'};
  await click('license-retry');await click('settings');await click('license-deactivate');
  assert.match(root.innerHTML,/id="license-form"/);assert.equal(nav.hidden,true);
  assert.ok(calls.some(c=>c.action==='license.deactivate'));
});
