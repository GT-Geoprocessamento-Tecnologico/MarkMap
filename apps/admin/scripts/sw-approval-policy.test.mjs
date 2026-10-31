import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://markmap.example';
class LocalCache {
  constructor(name, fetcher) { this.name = name; this.fetcher = fetcher; this.items = new Map(); }
  key(request) { return new URL(typeof request === 'string' ? request : request.url, ORIGIN).href; }
  async addAll(assets) {
    for (const url of assets) {
      const response = await this.fetcher({ url: this.key(url) });
      if (!response.ok) throw new Error('addAll failed: ' + url);
      await this.put(url, response);
    }
  }
  async put(request, response) { this.items.set(this.key(request), response.clone()); }
  async match(request) { return this.items.get(this.key(request))?.clone(); }
  // One-time PWA recovery consent relies on Cache.delete on CacheStorage entries.
  async delete(request) { return this.items.delete(this.key(request)); }
}
class LocalCaches {
  constructor(env) { this.env=env; this.stores=new Map(); this.deleted=[]; }
  async open(name) {
    if (!this.stores.has(name)) this.stores.set(name, new LocalCache(name, this.env.fetcher));
    return this.stores.get(name);
  }
  async keys() { return [...this.stores.keys()]; }
  async delete(name) { this.deleted.push(name); return this.stores.delete(name); }
}
function setup() {
  const env={release:'A', network:true, userCaches:[], syncBusy:false, dbMissing:false, dbVersion:2};
  env.indexedDB = { open(){
    const db = {version:env.dbVersion,objectStoreNames:{contains:()=>true},close(){},
      transaction(){
        const tx={error:null,oncomplete:null,onerror:null,onabort:null,objectStore(){return {get(){
          const req={result:env.syncBusy?{key:'syncInProgress',value:true}:undefined,error:null,onerror:null};
          queueMicrotask(()=>tx.oncomplete?.()); return req;
        }}}};return tx;
      }};
    const req={result:db,transaction:{abort(){}},onsuccess:null,onerror:null,onupgradeneeded:null};
    queueMicrotask(()=>{ if(env.dbMissing)req.onupgradeneeded?.();else req.onsuccess?.();}); return req;
  }};
  env.fetcher = async (request) => {
    if (!env.network) throw new Error('offline');
    const pathname = new URL(request.url).pathname;
    const txt = pathname === '/version.json' ? JSON.stringify({appVersion:env.release}) :
      pathname === '/index.html' || pathname === '/' ? `<html>MarkMap ${env.release}</html>` :
      `asset-${env.release}-${pathname}`;
    return new Response(txt,{status:200,headers:{'Content-Type':pathname.endsWith('.html')?'text/html':pathname==='/version.json'?'application/json':'text/javascript'}});
  };
  const caches=new LocalCaches(env);
  const windows=[{id:'one',url:ORIGIN+'/workspace'}];
  const assets=['/index.html','/assets/main-a1b2c3d4.js','/manifest.json'];
  const makeWorker=(release) => {
    env.release=release;
    const listeners=new Map(); let skipCalls=0,claimCalls=0;
    const self={location:{origin:ORIGIN},addEventListener(t,h){listeners.set(t,h);},clients:{claim(){claimCalls++;return Promise.resolve()},async matchAll(){return windows}},skipWaiting(){skipCalls++;return Promise.resolve()}};
    vm.runInNewContext(source,{
      self,caches,fetch:env.fetcher,Response,URL,Promise,Date,console,crypto:globalThis.crypto,indexedDB:env.indexedDB,
      Request, __MARKMAP_SHELL_MANIFEST__:assets,
      __MARKMAP_SHELL_VERSION__:'release-'+release,
      __MARKMAP_APP_VERSION__:'0.5.'+(release==='A'?18:19),
      __MARKMAP_BUILD_SHA__:(release==='A'?'a':'b').repeat(40),
    });
    const run=async (type, opts={}) => {
      const event={waited:[],waitUntil(p){this.waited.push(Promise.resolve(p))},respondWith(p){this.response=Promise.resolve(p)},...opts};
      listeners.get(type)?.(event);
      await Promise.all(event.waited);
      return event.response ? await event.response : undefined;
    };
    const fetchRequest=(path, mode='navigate', method='GET', origin=ORIGIN)=> {
      const req={url:origin+path,mode,method};
      const event={request:req,respondWith(p){this.response=Promise.resolve(p)},waitUntil(p){this.waited.push(p)},waited:[]};
      listeners.get('fetch')?.(event);
      return event.response || null;
    };
    const msg=async (type,data={},options={})=>{
      let result;
      const event={data:{type,...data},source:{id:options.id||'one',url:options.url||ORIGIN+'/workspace'},ports:options.noPort?[]:[{postMessage(v){result=v}}],waited:[],waitUntil(p){this.waited.push(Promise.resolve(p))}};
      listeners.get('message')?.(event);
      await Promise.all(event.waited);
      return result;
    };
    return {run,fetchRequest,msg,get skipCalls(){return skipCalls},get claimCalls(){return claimCalls}};
  };
  return {env,caches,windows,makeWorker};
}

async function initialized() {
  const e=setup(); const a=e.makeWorker('A');
  await a.run('install'); await a.run('activate');
  return {...e,a};
}

async function upgrade() {
  const e=await initialized();const b=e.makeWorker('B');await b.run('install');await b.run('activate');return {...e,b};
}

async function approve(worker,opts={}) {
  const status=await worker.msg('GET_SHELL_STATUS');
  await worker.msg('CHECK_COMPATIBILITY');
  return worker.msg('APPROVE_SHELL',{targetShell:status.availableShell,durableWritesReady:true,compatibilityVersion:1},opts);
}

test('first install pins the installed shell and serves its HTML from cache online',async()=>{
  const {a,env,caches}=await initialized();
  const status=await a.msg('GET_SHELL_STATUS');
  assert.equal(status.approvedVersion,'0.5.18');
  assert.equal(status.updateAvailable,false);
  env.release='B';
  const page=await a.fetchRequest('/workspace');
  assert.match(await page.text(),/MarkMap A/);
  assert.ok((await caches.keys()).includes('markmap-shell-approval-v1'));
});

test('new worker can activate naturally but must keep the prior approved HTML',async()=>{
  const {b,env,caches}=await upgrade();
  env.release='B';
  const html=await b.fetchRequest('/workspace');
  assert.match(await html.text(),/MarkMap A/);
  const status=await b.msg('GET_SHELL_STATUS');
  assert.equal(status.updateAvailable,true);
  assert.equal(status.availableVersion,'0.5.19');
  assert.equal(status.approvedVersion,'0.5.18');
  assert.ok((await caches.keys()).includes('markmap-cache-release-A'));
  assert.ok((await caches.keys()).includes('markmap-cache-release-B'));
});

test('no approval occurs from a status query or an unapproved message',async()=>{
  const {b}=await upgrade();
  const state=await b.msg('GET_SHELL_STATUS');
  assert.equal((await b.msg('APPROVE_SHELL',{targetShell:state.availableShell,durableWritesReady:true,compatibilityVersion:1})).approved,false);
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
  await b.msg('CHECK_COMPATIBILITY');
  assert.equal((await b.msg('APPROVE_SHELL',{targetShell:state.availableShell,durableWritesReady:false,compatibilityVersion:1})).approved,false);
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
});

test('explicit approval pins the new release and persists on worker restart',async()=>{
  const {b,makeWorker}=await upgrade();
  assert.equal((await approve(b)).approved,true);
  assert.equal((await b.msg('GET_SHELL_STATUS')).updateAvailable,false);
  assert.match(await (await b.fetchRequest('/workspace')).text(),/MarkMap B/);
  const restarted=makeWorker('B');
  await restarted.run('activate');
  assert.equal((await restarted.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.19');
  assert.match(await (await restarted.fetchRequest('/workspace')).text(),/MarkMap B/);
});

test('SKIP_WAITING requires a matching same-origin compatibility handshake',async()=>{
  const {b}=await upgrade();
  await b.msg('SKIP_WAITING',{durableWritesReady:true,compatibilityVersion:1});
  assert.equal(b.skipCalls,0);
  assert.equal(await b.msg('CHECK_COMPATIBILITY',{}, {url:'https://attacker.example/'}),undefined);
  await b.msg('SKIP_WAITING',{durableWritesReady:true,compatibilityVersion:1});
  assert.equal(b.skipCalls,0);
  await b.msg('CHECK_COMPATIBILITY');
  await b.msg('SKIP_WAITING',{durableWritesReady:true,compatibilityVersion:1});
  assert.equal(b.skipCalls,1);
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
});

test('two windows deny approval and preserve pinned version',async()=>{
  const {b,windows}=await upgrade();
  windows.push({id:'two',url:ORIGIN+'/projects'});
  const result=await approve(b);
  assert.equal(result.approved,false);
  assert.equal(result.reason,'other-tabs');
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
});

test('unrelated origin window does not block same-origin approval',async()=>{
  const {b,windows}=await upgrade();
  windows.push({id:'two',url:'https://other-app.example/'});
  const result=await approve(b);
  assert.equal(result.approved,true);
});

test('pinned cache eviction fails closed rather than loading a new release',async()=>{
  const {b,caches}=await upgrade();
  await caches.delete('markmap-cache-release-A');
  const response=await b.fetchRequest('/workspace');
  assert.equal(response.status,503);
  assert.equal((await b.msg('GET_SHELL_STATUS')).updateAvailable,true);
});

test('version.json always goes to network and never returns pinned cached metadata',async()=>{
  const {b,env}=await upgrade();
  const response=await b.fetchRequest('/version.json','cors');
  assert.deepEqual(await response.json(),{appVersion:'B'});
  env.network=false;
  const offline=await b.fetchRequest('/version.json','cors');
  assert.equal(offline.type,'error');
});

test('API and foreign-origin requests are never intercepted',async()=>{
  const {b}=await upgrade();
  assert.equal(b.fetchRequest('/api/health','cors'),null);
  assert.equal(b.fetchRequest('/layers','cors'),null);
  assert.equal(b.fetchRequest('/workspace','navigate','GET','https://outside.example'),null);
});

test('unrelated user caches (maps, backups) survive worker activation and approval',async()=>{
  const {b,caches}=await upgrade();
  for (const name of ['markmap-offline-regions-v1','markmap-user-backups-v1','geonexo-user-files-v1']) await caches.open(name);
  await approve(b);
  await b.run('activate');
  const names=await caches.keys();
  assert.ok(names.includes('markmap-offline-regions-v1'));
  assert.ok(names.includes('markmap-user-backups-v1'));
  assert.ok(names.includes('geonexo-user-files-v1'));
  assert.ok(caches.deleted.every((name) => name.includes('-installing-')));
  assert.ok(caches.deleted.every((name) => !name.includes('offline') && !name.includes('backups')));
});

test('malformed approval metadata blocks unsanctioned navigation',async()=>{
  const {a,caches}=await initialized();
  const meta=await caches.open('markmap-shell-approval-v1');
  await meta.put('/__markmap_approved_shell_v1__',new Response('{bad json'));
  const page = await a.fetchRequest('/workspace');
  assert.equal(page.status, 503);
});

test('missing JS never returns index.html as a fallback',async()=>{
  const {b,env}=await upgrade();
  env.network=false;
  const response=await b.fetchRequest('/assets/unlisted-missing.js','cors');
  assert.equal(response.type,'error');
});

async function recoveryClick(worker, html, tokenOverride) {
  const token = tokenOverride ?? html.match(/name="token" value="([^"]+)"/)?.[1];
  const request = { url: ORIGIN + '/__markmap_recover_shell__', method: 'POST', mode: 'navigate',
    formData: async () => new Map([['token', token]]) };
  return worker.run('fetch', { request });
}

test('pinned-cache eviction offers explicit HTML consent but does not auto-adopt a new shell',async()=>{
  const {b,caches}=await upgrade();
  await caches.delete('markmap-cache-release-A');
  const response=await b.fetchRequest('/workspace');
  const html=await response.text();
  assert.equal(response.status,503);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(html,/Verificar dados e aprovar recuperação/);
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
});

test('explicit recovery click waits for local IndexedDB and adopts prepared release only after user consent',async()=>{
  const {b,caches}=await upgrade();
  await caches.delete('markmap-cache-release-A');
  const first=await b.fetchRequest('/workspace');
  const result=await recoveryClick(b,await first.text());
  assert.equal(result.status,303);
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.19');
  assert.match(await (await b.fetchRequest('/workspace')).text(),/MarkMap B/);
});

test('recovery rejects forged or replayed tokens and retains previous approval',async()=>{
  const {b,caches}=await upgrade();await caches.delete('markmap-cache-release-A');
  const html=await (await b.fetchRequest('/workspace')).text();
  const forged=await recoveryClick(b,html,'fake-token');
  assert.equal(forged.status,503);
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
  const fresh=await recoveryClick(b,await forged.text());
  assert.equal(fresh.status,303);
  const replay=await recoveryClick(b,html);
  assert.equal(replay.status,503);
});

test('recovery refuses when another tab is open or sync is pending',async()=>{
  const {b,caches,windows,env}=await upgrade();await caches.delete('markmap-cache-release-A');
  windows.push({id:'two',url:ORIGIN+'/projects'});
  let resp=await recoveryClick(b,await (await b.fetchRequest('/workspace')).text());
  assert.equal(resp.status,503);assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
  windows.pop();env.syncBusy=true;
  resp=await recoveryClick(b,await (await b.fetchRequest('/workspace')).text());
  assert.equal(resp.status,503);assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
});

test('new worker can install with corrupted approval metadata, requiring explicit recovery',async()=>{
  const {a,caches,makeWorker}=await initialized();
  const approvals=await caches.open('markmap-shell-approval-v1');
  await approvals.put('/__markmap_approved_shell_v1__',new Response('{bad json'));
  const b=makeWorker('B'); await b.run('install');
  const response=await b.fetchRequest('/workspace');assert.equal(response.status,503);
  assert.match(await response.text(),/Verificar dados e aprovar recuperação/);
});

test('recovery approval survives service worker termination between form and click', async () => {
  const { b, caches, makeWorker } = await upgrade();
  await caches.delete('markmap-cache-release-A');
  const response = await b.fetchRequest('/workspace');
  const html = await response.text();
  assert.match(html, /name="token"/);
  // A browser can terminate a worker at any time after serving the recovery page.
  const restarted = makeWorker('B');
  await restarted.run('activate');
  const result = await recoveryClick(restarted, html);
  assert.equal(result.status, 303);
  assert.equal((await restarted.msg('GET_SHELL_STATUS')).approvedVersion, '0.5.19');
  const replay = await recoveryClick(restarted, html);
  assert.equal(replay.status, 503);
});

test('failed recovery consent cannot be reused after a worker restart', async () => {
  const { b, caches, makeWorker, env } = await upgrade();
  await caches.delete('markmap-cache-release-A');
  const html = await (await b.fetchRequest('/workspace')).text();
  env.syncBusy = true;
  const failed = await recoveryClick(b, html);
  assert.equal(failed.status, 503);
  const restarted = makeWorker('B');
  env.syncBusy = false;
  const replay = await recoveryClick(restarted, html);
  assert.equal(replay.status, 503);
  assert.equal((await restarted.msg('GET_SHELL_STATUS')).approvedVersion, '0.5.18');
});

test('candidate with missing JavaScript is never offered for consent after cache eviction', async () => {
  const { b, caches } = await upgrade();
  const candidate = await caches.open('markmap-cache-release-B');
  candidate.items.delete(candidate.key('/assets/main-a1b2c3d4.js'));
  const status = await b.msg('GET_SHELL_STATUS');
  assert.equal(status.candidateReady, false);
  assert.equal(status.updateAvailable, false);
  const rejected = await approve(b);
  assert.equal(rejected.approved, false);
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion, '0.5.18');
});

test('recovery never offers an incomplete candidate shell even if its install marker remains', async () => {
  const { b, caches } = await upgrade();
  const candidate = await caches.open('markmap-cache-release-B');
  candidate.items.delete(candidate.key('/assets/main-a1b2c3d4.js'));
  await caches.delete('markmap-cache-release-A');
  const response = await b.fetchRequest('/workspace');
  assert.equal(response.status, 503);
  const html = await response.text();
  assert.match(html, /A versão disponível ainda não está pronta/);
  assert.doesNotMatch(html, /name="token"/);
});

test('legacy installation retains old HTML and requires consent before new shell', async () => {
  const { caches, makeWorker } = setup();
  const legacy = await caches.open('markmap-cache-legacy-old');
  await legacy.put('/index.html', new Response('<html>Legacy MarkMap</html>'));
  await legacy.put('/__geonexo_install_complete__', new Response('ok'));
  const latest = makeWorker('B');
  await latest.run('install');
  await latest.run('activate');
  const status = await latest.msg('GET_SHELL_STATUS');
  assert.equal(status.approvedShell, 'markmap-cache-legacy-old');
  assert.equal(status.updateAvailable, true);
  const page = await latest.fetchRequest('/workspace');
  assert.match(await page.text(), /Legacy MarkMap/);
  assert.equal(latest.skipCalls, 0);
});

test('corrupt legacy shell requires explicit recovery instead of auto approval', async () => {
  const { caches, makeWorker } = setup();
  const broken = await caches.open('markmap-cache-legacy-broken');
  await broken.put('/index.html', new Response('Broken old shell'));
  // Install-complete marker missing: not a valid approved release.
  const latest = makeWorker('B');
  await latest.run('install');
  const status = await latest.msg('GET_SHELL_STATUS');
  assert.equal(status.approvedShell, null);
  assert.equal(status.updateAvailable, false);
  assert.equal(status.candidateReady, true);
  const response = await latest.fetchRequest('/workspace');
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Versão local indisponível/);
});

test('legacy shell never replaces a previously approved version', async () => {
  const { caches, makeWorker } = await initialized();
  const legacy = await caches.open('markmap-cache-legacy-other');
  await legacy.put('/index.html', new Response('Stale old shell'));
  await legacy.put('/__geonexo_install_complete__', new Response('ok'));
  const latest = makeWorker('B');
  await latest.run('install');
  const status = await latest.msg('GET_SHELL_STATUS');
  assert.equal(status.approvedShell, 'markmap-cache-release-A');
  assert.equal(status.approvedVersion, '0.5.18');
});

test('approved HTML never opens when a referenced offline asset is missing', async()=>{
  const {b,caches,env}=await upgrade();
  const pinned=await caches.open('markmap-cache-release-A');
  await pinned.put('/index.html', new Response('<html>MarkMap A<script type="module" src="/assets/main-a1b2c3d4.js"></script></html>'));
  assert.equal(await pinned.delete('/assets/main-a1b2c3d4.js'),true);
  env.network=false;
  const response=await b.fetchRequest('/workspace');
  assert.equal(response.status,503);
  assert.match(await response.text(),/Versão local indisponível/);
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
  assert.equal((await b.msg('GET_SHELL_STATUS')).updateAvailable,true);
});

test('approved older shell still opens when its own referenced assets exist', async()=>{
  const {b,caches}=await upgrade();
  const pinned=await caches.open('markmap-cache-release-A');
  await pinned.put('/index.html', new Response('<html>MarkMap A<link rel="stylesheet" href="/assets/main-a1b2c3d4.js"><script type="module" src="/assets/main-a1b2c3d4.js"></script></html>'));
  const html=await b.fetchRequest('/workspace');
  assert.equal(html.status,200);
  assert.match(await html.text(),/MarkMap A/);
  assert.equal((await b.msg('GET_SHELL_STATUS')).approvedVersion,'0.5.18');
});
