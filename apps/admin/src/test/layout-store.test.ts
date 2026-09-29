import { describe, it, expect } from 'vitest';
import { useLayoutStore } from '../lib/store/layout';

describe('useLayoutStore', () => {
  it('should initialize with dashboard mode and sidebar open', () => {
    const { mode, sidebarOpen } = useLayoutStore.getState();
    expect(mode).toBe('dashboard');
    expect(sidebarOpen).toBe(true);
  });

  it('should toggle sidebar', () => {
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarOpen).toBe(false);
  });

  it('should set mode', () => {
    useLayoutStore.getState().setMode('canvas');
    expect(useLayoutStore.getState().mode).toBe('canvas');
  });
});
