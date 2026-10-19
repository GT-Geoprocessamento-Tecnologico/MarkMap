import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const workerSource = readFileSync(
  resolve(process.cwd(), 'public/sw.js'),
  'utf8',
);

class TestRequest {
  readonly method: string;
  readonly url: string;
  readonly mode: RequestMode;

  constructor(url: string, options: { method?: string; mode?: RequestMode } = {}) {
    this.url = new URL(url, 'https://geonexo.test').href;
    this.method = options.method ?? 'GET';
    this.mode = options.mode ?? 'no-cors';
  }
}

class TestCache {
  readonly entries = new Map<string, Response>();

  private key(request: { url: string } | string): string {
    return typeof request === 'string' ? new URL(request, 'https://geonexo.test').href : request.url;
  }

  async addAll(urls: string[]): Promise<void> {
    for (const url of urls) {
      await this.put(url, new Response(`precache:${url}`, { status: 200 }));
    }
  }

  async match(request: { url: string } | string): Promise<Response | undefined> {
    const response = this.entries.get(this.key(request));
    return response?.clone();
  }

  async put(request: { url: string } | string, response: Response): Promise<void> {
    this.entries.set(this.key(request), response);
  }
}

class TestCaches {
  readonly stores = new Map<string, TestCache>();
  readonly deleted: string[] = [];

  async open(name: string): Promise<TestCache> {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new TestCache();
      this.stores.set(name, cache);
    }
    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async delete(name: string): Promise<boolean> {
    this.deleted.push(name);
    return this.stores.delete(name);
  }
}

interface WorkerEvent {
  request?: TestRequest;
  data?: unknown;
  source?: { id: string; url: string };
  ports?: { postMessage(message: unknown): void }[];
  responsePromise?: Promise<Response>;
  waited: Promise<unknown>[];
  waitUntil(promise: Promise<unknown>): void;
  respondWith(promise: Promise<Response>): void;
}

function createWorker(fetchImpl: (request: TestRequest) => Promise<Response>) {
  const caches = new TestCaches();
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const client = { id: 'test-client', url: 'https://geonexo.test/' };
  let skipWaitingCalls = 0;
  const self = {
    location: { origin: 'https://geonexo.test' },
    clients: { claim: () => Promise.resolve() },
    skipWaiting: () => { skipWaitingCalls += 1; return Promise.resolve(); },
    addEventListener(type: string, listener: (event: WorkerEvent) => void) {
      listeners.set(type, listener);
    },
  };

  vm.runInNewContext(workerSource, {
    Response,
    URL,
    Promise,
    fetch: fetchImpl,
    caches,
    self,
  });

  return {
    caches,
    get skipWaitingCalls() { return skipWaitingCalls; },
    dispatch(type: string, request?: TestRequest, data?: unknown): WorkerEvent {
      const event: WorkerEvent = {
        request,
        data,
        source: client,
        ports: type === 'message' && (data as { type?: string } | undefined)?.type === 'CHECK_COMPATIBILITY'
          ? [{ postMessage: () => undefined }]
          : [],
        waited: [],
        waitUntil(promise) {
          this.waited.push(promise);
        },
        respondWith(promise) {
          this.responsePromise = promise;
        },
      };
      listeners.get(type)?.(event);
      return event;
    },
  };
}

describe('service worker cache policy', () => {
  it('waits for install work and removes only owned old caches', async () => {
    const worker = createWorker(async () => new Response('network', { status: 200 }));
    const install = worker.dispatch('install');
    expect(install.waited).toHaveLength(1);
    await Promise.all(install.waited);

    await worker.caches.open('geonexo-cache-v1');
    await worker.caches.open('other-application-cache');
    const activate = worker.dispatch('activate');
    expect(activate.waited).toHaveLength(1);
    await Promise.all(activate.waited);

    expect(worker.caches.deleted).toHaveLength(2);
    expect(worker.caches.deleted.some((name) => name.startsWith('geonexo-cache-v2-installing-'))).toBe(true);
    expect(worker.caches.deleted).toContain('geonexo-cache-v1');
    expect(worker.caches.stores.has('other-application-cache')).toBe(true);
  });

  it('bypasses APIs, non-GET requests, and arbitrary origins', () => {
    const worker = createWorker(async () => new Response('network', { status: 200 }));

    for (const request of [
      new TestRequest('/api/v1/projects'),
      new TestRequest('/projects'),
      new TestRequest('/storage/telemetry'),
      new TestRequest('/api', { mode: 'navigate' }),
      new TestRequest('/assets/app.js', { method: 'POST' }),
      new TestRequest('https://cdn.example.test/assets/app.js'),
    ]) {
      const event = worker.dispatch('fetch', request);
      expect(event.responsePromise).toBeUndefined();
    }
  });

  it('uses the shell for app navigations and never serves HTML for a missing asset', async () => {
    const worker = createWorker(async (request) => {
      if (request.mode === 'navigate') throw new Error('offline');
      throw new Error('missing asset');
    });
    const install = worker.dispatch('install');
    await Promise.all(install.waited);

    for (const path of ['/workspace', '/projects', '/projects/project-1/map']) {
      const navigation = worker.dispatch('fetch', new TestRequest(path, { mode: 'navigate' }));
      const navigationResponse = await navigation.responsePromise;
      expect(await navigationResponse?.text()).toBe('precache:/');
    }

    const asset = worker.dispatch('fetch', new TestRequest('/assets/app.js'));
    const assetResponse = await asset.responsePromise;
    expect(assetResponse?.status).toBe(0);
    expect(assetResponse?.headers.get('content-type')).toBeNull();
  });

  it('tracks background cache writes with waitUntil', async () => {
    const worker = createWorker(async () => new Response('asset', { status: 200 }));
    const event = worker.dispatch('fetch', new TestRequest('/assets/app.js'));
    expect(event.responsePromise).toBeDefined();
    expect(await (await event.responsePromise!).text()).toBe('asset');
    expect(event.waited).toHaveLength(1);
    await Promise.all(event.waited);
    expect(await (await worker.caches.open('geonexo-cache-v2')).match('/assets/app.js')).toBeDefined();
  });

  it('does not activate an update until the user handshake is complete', async () => {
    const worker = createWorker(async () => new Response('network', { status: 200 }));
    worker.dispatch('message', undefined, { type: 'SKIP_WAITING' });
    worker.dispatch('message', undefined, { type: 'SKIP_WAITING', durableWritesReady: false, compatibilityVersion: 1 });
    expect(worker.skipWaitingCalls).toBe(0);
    worker.dispatch('message', undefined, { type: 'CHECK_COMPATIBILITY' });
    worker.dispatch('message', undefined, { type: 'SKIP_WAITING', durableWritesReady: true, compatibilityVersion: 1 });
    expect(worker.skipWaitingCalls).toBe(1);
  });
});
