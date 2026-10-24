import { create } from 'zustand';

export type LayoutMode = 'dashboard' | 'command-center' | 'canvas';

interface LayoutState {
  mode: LayoutMode;
  sidebarOpen: boolean;
  setMode: (mode: LayoutMode) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  mode: 'dashboard',
  sidebarOpen: false,
  setMode: (mode) => set({ mode }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
}));
