import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UpdatePrompt from '../components/pwa/UpdatePrompt';

function installServiceWorkerStub() {
  const waiting = { postMessage: vi.fn() };
  const ready = new EventTarget() as ServiceWorkerRegistration;
  Object.defineProperty(ready, 'waiting', { configurable: true, value: waiting });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve(ready),
      controller: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  return waiting;
}

describe('PWA update handshake', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('fails closed when readiness callbacks are absent', async () => {
    const waiting = installServiceWorkerStub();
    render(<UpdatePrompt />);
    expect(await screen.findByRole('button', { name: 'Atualizar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(waiting.postMessage).not.toHaveBeenCalled());
  });

  it('waits for both callbacks before accepting the update', async () => {
    const waiting = installServiceWorkerStub();
    render(<UpdatePrompt durableWritesReady={() => true} compatibilityReady={() => true} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(waiting.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING', durableWritesReady: true, compatibilityVersion: 1,
    }));
  });

  it('does not accept while either callback reports unsafe state', async () => {
    const waiting = installServiceWorkerStub();
    render(<UpdatePrompt durableWritesReady={() => true} compatibilityReady={() => false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(waiting.postMessage).not.toHaveBeenCalled());
  });
});
