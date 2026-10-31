import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UpdatePrompt from './UpdatePrompt';
import { requestAppUpdate } from '../../lib/pwa-update-request';

class MockMessageChannel {
  port1 = { onmessage: null as ((event: MessageEvent) => void) | null, close() {} };
  port2 = { postMessage: (data: unknown) => this.port1.onmessage?.({ data } as MessageEvent), close() {} };
}

function setup(mode: 'current' | 'active-update' | 'waiting-update') {
  const listeners = new Map<string, Set<() => void>>();
  const on = (event: string, fn: () => void) => {
    const set = listeners.get(event) || new Set<() => void>();
    set.add(fn);
    listeners.set(event, set);
  };
  const off = (event: string, fn: () => void) => { listeners.get(event)?.delete(fn); };
  const dispatch = (event: string) => { for (const fn of listeners.get(event) || []) fn(); };
  let approved = mode === 'current';
  const events: string[] = [];
  const status = () => ({
    type: 'MARKMAP_SHELL_STATUS', protocol: 1,
    approvedShell: approved ? 'markmap-cache-new' : 'markmap-cache-old',
    approvedVersion: approved ? '0.5.19' : '0.5.18',
    availableShell: 'markmap-cache-new',
    availableVersion: '0.5.19', updateAvailable: !approved, candidateReady: true,
  });
  const worker = {
    state: 'installed',
    postMessage: vi.fn((message: {type: string}, ports?: Array<{postMessage(data: unknown): void}>) => {
      events.push(message.type);
      if (message.type === 'GET_SHELL_STATUS') ports?.[0]?.postMessage(status());
      if (message.type === 'CHECK_COMPATIBILITY') ports?.[0]?.postMessage({
        type: 'MARKMAP_COMPATIBILITY', shellProtocolVersion: 1,
        localSchemaVersion: 1, regionPackageSchemaVersion: 2,
      });
      if (message.type === 'APPROVE_SHELL') {
        approved = true;
        ports?.[0]?.postMessage({type:'MARKMAP_SHELL_APPROVAL',approved:true});
      }
      if (message.type === 'SKIP_WAITING') {
        registration.waiting = null;
        registration.active = worker;
        sw.controller = worker;
        dispatch('controllerchange');
      }
    }),
  };
  const oldWorker = { state: 'activated', postMessage: vi.fn() };
  const registration = {
    scope: window.location.origin+'/',
    waiting: mode === 'waiting-update' ? worker : null as typeof worker | null,
    installing: null,
    active: mode === 'waiting-update' ? oldWorker : worker,
    update: vi.fn(async () => undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const sw = {
    ready: Promise.resolve(registration),
    controller: mode === 'waiting-update' ? oldWorker : worker,
    addEventListener: vi.fn(on),
    removeEventListener: vi.fn(off),
  };
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:sw});
  return { worker, registration, sw, events, get approved() {return approved;} };
}

beforeEach(() => {
  vi.stubGlobal('MessageChannel', MockMessageChannel);
  window.localStorage.removeItem('markmap:pwa-update-deferred');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('explicit PWA upgrade consent', () => {
  it('shows no prompt when the currently approved version is installed', async () => {
    const mock=setup('current');
    render(<UpdatePrompt />);
    await waitFor(() => expect(mock.registration.update).toHaveBeenCalled());
    expect(screen.queryByRole('button',{name:'Atualizar agora'})).toBeNull();
  });

  it('shows update even if the new SW activated naturally (waiting=null)', async () => {
    const mock=setup('active-update');
    render(<UpdatePrompt />);
    expect(await screen.findByRole('dialog',{name:/Nova versão do MarkMap/})).toHaveAttribute('aria-modal','true');
    expect(screen.getByRole('button',{name:'Atualizar agora'})).toBeVisible();
    expect(screen.getByText(/MarkMap 0\.5\.19/)).toBeVisible();
    expect(mock.events).not.toContain('APPROVE_SHELL');
  });

  it('does not approve update if the durability check fails', async () => {
    const mock=setup('active-update');
    render(<UpdatePrompt durableWritesReady={() => false} compatibilityReady={() => true} />);
    fireEvent.click(await screen.findByRole('button',{name:'Atualizar agora'}));
    await screen.findByText(/Salve as alterações/);
    expect(mock.events).not.toContain('APPROVE_SHELL');
    expect(mock.approved).toBe(false);
  });

  it('saves Later and never approves by itself', async () => {
    const mock=setup('active-update');
    render(<UpdatePrompt />);
    fireEvent.click(await screen.findByRole('button',{name:'Depois'}));
    await waitFor(() => expect(screen.queryByRole('button',{name:'Atualizar agora'})).toBeNull());
    const saved=JSON.parse(window.localStorage.getItem('markmap:pwa-update-deferred')||'{}');
    expect(saved.shell).toBe('markmap-cache-new');
    expect(mock.approved).toBe(false);
  });

  it('approves active candidate only after explicit click, then requests a reload', async () => {
    const mock=setup('active-update');
    render(<UpdatePrompt durableWritesReady={() => true} compatibilityReady={() => true} />);
    fireEvent.click(await screen.findByRole('button',{name:'Atualizar agora'}));
    await waitFor(() => expect(mock.events).toContain('APPROVE_SHELL'));
    expect(mock.approved).toBe(true);
    expect(mock.events.filter(x=>x==='CHECK_COMPATIBILITY').length).toBeGreaterThanOrEqual(2);
  });

  it('activates waiting SW first but persists approval only after handshake', async () => {
    const mock=setup('waiting-update');
    render(<UpdatePrompt durableWritesReady={() => true} compatibilityReady={() => true} />);
    fireEvent.click(await screen.findByRole('button',{name:'Atualizar agora'}));
    await waitFor(() => expect(mock.events).toContain('APPROVE_SHELL'));
    expect(mock.events.indexOf('SKIP_WAITING')).toBeLessThan(mock.events.indexOf('APPROVE_SHELL'));
    expect(mock.approved).toBe(true);
  });

  it('Settings reopens the dialog after Later but never approves without a new click', async () => {
    const mock=setup('active-update');
    render(<UpdatePrompt durableWritesReady={() => true} compatibilityReady={() => true} />);
    fireEvent.click(await screen.findByRole('button',{name:'Depois'}));
    let outcome: unknown;
    await act(async () => { outcome = await requestAppUpdate(); });
    expect(outcome).toEqual({ status: 'pending' });
    expect(await screen.findByRole('dialog',{name:/Nova versão/})).toBeVisible();
    expect(mock.events).not.toContain('APPROVE_SHELL');
    expect(mock.approved).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Atualizar agora'}));
    await waitFor(() => expect(mock.events).toContain('APPROVE_SHELL'));
    expect(mock.approved).toBe(true);
  });

  it('Escape dismisses the modal without approving the shell', async () => {
    const mock=setup('active-update');
    render(<UpdatePrompt />);
    const dialog = await screen.findByRole('dialog', { name:/Nova versão/ });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog,{key:'Escape'});
    expect(screen.queryByRole('dialog',{name:/Nova versão/})).toBeNull();
    expect(mock.approved).toBe(false);
    expect(mock.events).not.toContain('APPROVE_SHELL');
  });
});