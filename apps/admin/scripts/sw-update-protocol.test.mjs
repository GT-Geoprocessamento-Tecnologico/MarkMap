import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const serviceWorkerUrl = new URL('../public/sw.js', import.meta.url);

async function fixture() {
  const listeners = new Map();
  let activationCount = 0;
  const self = {
    location: { origin: 'https://markmap.example' },
    addEventListener(type, handler) { listeners.set(type, handler); },
    skipWaiting() { activationCount++; return Promise.resolve(); },
  };
  const source = await readFile(serviceWorkerUrl, 'utf8');
  // A minimal service worker event harness; it does not emulate a browser.
  runInNewContext(source, { self, URL, Date, Promise, Response, console });
  const send = (data, options = {}) => {
    let reply = null;
    const event = {
      data,
      source: { id: options.id ?? 'tab-a', url: options.url ?? 'https://markmap.example/workspace' },
      ports: options.withPort === false ? [] : [{ postMessage(msg) { reply = msg; } }],
      waitUntil(promise) { Promise.resolve(promise).catch((error) => { throw error; }); },
    };
    listeners.get('message')(event);
    return reply;
  };
  return { send, get count() { return activationCount; } };
}

test('SW: unapproved SKIP_WAITING cannot activate a worker', async () => {
  const sw = await fixture();
  sw.send({ type:'SKIP_WAITING', durableWritesReady:true, compatibilityVersion:1 });
  assert.equal(sw.count,0);
  assert.equal(sw.send({ type:'CHECK_COMPATIBILITY' },{url:'https://evil.example/'}),null);
  assert.equal(sw.count,0);
});

test('SW: compatibility negotiation authorizes only the same tab', async () => {
  const sw = await fixture();
  const reply=sw.send({ type:'CHECK_COMPATIBILITY' },{id:'tab-a'});
  assert.equal(reply.type,'MARKMAP_COMPATIBILITY');
  assert.equal(reply.regionPackageSchemaVersion,2);
  sw.send({type:'SKIP_WAITING',durableWritesReady:true,compatibilityVersion:1},{id:'tab-b'});
  assert.equal(sw.count,0);
  sw.send({type:'SKIP_WAITING',durableWritesReady:false,compatibilityVersion:1},{id:'tab-a'});
  assert.equal(sw.count,0);
  sw.send({type:'SKIP_WAITING',durableWritesReady:true,compatibilityVersion:1},{id:'tab-a'});
  assert.equal(sw.count,1);
  sw.send({type:'SKIP_WAITING',durableWritesReady:true,compatibilityVersion:1},{id:'tab-a'});
  assert.equal(sw.count,1);
});

test('SW: missing MessageChannel does not authorize activation', async () => {
  const sw=await fixture();
  assert.equal(sw.send({type:'CHECK_COMPATIBILITY'},{withPort:false}),null);
  sw.send({type:'SKIP_WAITING',durableWritesReady:true,compatibilityVersion:1});
  assert.equal(sw.count,0);
});
