import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UpdatePrompt from '../components/pwa/UpdatePrompt';
import { requestAppUpdate } from '../lib/pwa-update-request';

beforeEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('PWA update safe defaults', () => {
  it('does not show an update without a registered service worker', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByRole('button',{name:'Atualizar agora'})).toBeNull();
  });
  it('does not bypass the update prompt when Settings requests an upgrade', async () => {
    render(<UpdatePrompt />);
    const result = await requestAppUpdate();
    expect(result).toEqual({status:'unavailable'});
  });
});