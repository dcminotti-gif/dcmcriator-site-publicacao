// Run with: node tests/hero-preview.cjs
// Tests the hero through file:// in an isolated headless Chrome.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dcm-consent-'));
fs.mkdirSync(path.join(profile, 'Default'));
fs.writeFileSync(path.join(profile, 'Default', 'Preferences'), JSON.stringify({
  devtools: { preferences: { 'panel-selectedTab': '"network"' } }
}));
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) p.reject(new Error(JSON.stringify(data.error))); else p.resolve(data.result);
    } else listeners.forEach(fn => fn(data));
  };
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(fn) { listeners.push(fn); },
    close() { ws.close(); }
  };
}


const {pathToFileURL} = require('node:url');
let chrome, cdp;
(async () => {
  try {
    chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
      '--headless=new', '--disable-gpu', '--no-first-run',
      '--remote-debugging-port=0', '--user-data-dir='+profile, 'about:blank'
    ], {stdio:'ignore'});
    let targets;
    for (let n=0; n<100 && !targets; n++) {
      try {
        const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
        targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
      } catch { await sleep(100); }
    }
    assert.ok(targets, 'Chrome debugging ready');
    cdp=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    const evaluate=async expression=>{
      const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    await cdp.send('Page.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: `
      window.heroProbe={starts:[], decoded:[]};
      const decode=HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode=async function(){
        await decode.call(this);
        window.heroProbe.decoded.push({src:this.src,complete:this.complete,width:this.naturalWidth});
      };
      const animate=Element.prototype.animate;
      Element.prototype.animate=function(...args){
        if(this.closest('.hero-art-stage')) window.heroProbe.starts.push({
          visibility:document.visibilityState,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
          decoded:window.heroProbe.decoded.slice(),className:document.querySelector('#hero').className
        });
        return animate.apply(this,args);
      };
    `});
    const snapshot=()=>evaluate(`(()=>{
      const h=document.querySelector('#hero');
      const state=(el,pseudo)=>{const s=getComputedStyle(el,pseudo);return {
        animationName:s.animationName,playState:s.animationPlayState,opacity:s.opacity,display:s.display,
        animations:el.getAnimations().map(a=>({playState:a.playState,currentTime:a.currentTime}))
      }};
      return {reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
        visibility:document.visibilityState,pieces:[...document.querySelectorAll('.hero-piece')].map(e=>state(e)),
        assemblyBefore:document.querySelector('.hero-assembly') ? state(document.querySelector('.hero-assembly'),'::before') : null,
        stage:!!h.querySelector('.hero-art-stage'),animating:h.classList.contains('is-animating'),
        running:h.getAnimations({subtree:true}).filter(a=>a.playState==='running').length,
        background:getComputedStyle(h).backgroundImage,probe:window.heroProbe};
    })()`);
    const waitFor=async expression=>{
      for(let n=0;n<100;n++){if(await evaluate(expression))return;await sleep(20)}
      throw Error('Timeout: '+expression);
    };
    const url=pathToFileURL(path.join(root,'index.html')).href;

    for (const width of [1440,390]) {
      await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
      await cdp.send('Page.navigate',{url});
      await waitFor('window.heroProbe?.starts.length > 0');
      const active=await snapshot();
      console.log('NORMAL '+width,JSON.stringify(active));
      assert.equal(active.reduced,false);
      assert.equal(active.visibility,'visible');
      assert.ok(active.animating && active.running>0,'hero running immediately after controlled trigger');
      assert.equal(active.pieces.length,width===390 ? 2 : 4);
      for(const start of active.probe.starts){
        assert.equal(start.visibility,'visible');
        assert.ok(start.className.includes('is-animating'));
        assert.ok(start.decoded.some(i=>i.complete && i.width>0 && i.src.includes(width===390 ? 'mobile.webp' : 'horizontal.webp')),'matching artwork decoded before start');
      }
      await waitFor('!document.querySelector("#hero").classList.contains("is-animating")');
      const finished=await snapshot();
      assert.equal(finished.stage,false);
      assert.equal(finished.running,0);
      assert.equal(finished.background,active.background,'original approved background unchanged');
      await evaluate('document.dispatchEvent(new Event("visibilitychange"));window.dispatchEvent(new Event("resize"));window.dispatchEvent(new Event("scroll"))');
      await sleep(100);
      assert.equal((await snapshot()).probe.starts.length,active.probe.starts.length,'entry runs once');
      console.log('PASS '+width+': artwork intact after entry; no replay');
    }
    // A real background tab must not spend the entry before activation.
    const other=await cdp.send('Target.createTarget',{url:'about:blank'});
    await cdp.send('Target.activateTarget',{targetId:other.targetId});
    await cdp.send('Page.navigate',{url});
    await waitFor('!!window.DcmEncaixes');
    const hidden=await snapshot();
    console.log('BACKGROUND',JSON.stringify(hidden));
    assert.equal(hidden.visibility,'hidden');
    assert.equal(hidden.probe.starts.length,0);
    assert.equal(hidden.stage,false);
    await cdp.send('Target.activateTarget',{targetId:targets.find(t=>t.type==='page').id});
    await waitFor('window.heroProbe.starts.length > 0');
    assert.ok((await snapshot()).running>0);
    await waitFor('!document.querySelector("#hero").classList.contains("is-animating")');
    await cdp.send('Target.closeTarget',{targetId:other.targetId});
    console.log('PASS: background load waits for visibilitychange');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:
      'document.addEventListener("DOMContentLoaded",()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"}),{once:true})'}).then(async ({identifier})=>{
      await cdp.send('Page.navigate',{url});
      await waitFor('!!window.DcmEncaixes');
      await sleep(150);
      assert.equal((await snapshot()).probe.starts.length,0,'offscreen hero waits');
      await evaluate('window.scrollTo({top:0,behavior:"instant"})');
      await waitFor('window.heroProbe.starts.length > 0');
      assert.ok((await snapshot()).running>0);
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
    });
    console.log('PASS: offscreen hero waits until it enters the viewport');
    await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await cdp.send('Page.navigate',{url});
    await waitFor('!!window.DcmEncaixes');
    await sleep(1000);
    const reduced=await snapshot();
    console.log('REDUCED',JSON.stringify(reduced));
    assert.equal(reduced.reduced,true);
    assert.equal(reduced.stage,false);
    assert.equal(reduced.animating,false);
    assert.equal(reduced.running,0);
    assert.equal(reduced.probe.starts.length,0);
    console.log('PASS: file:// normal, background, viewport, once-only and reduced-motion checks');
  } finally { cdp?.close(); chrome?.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1});
