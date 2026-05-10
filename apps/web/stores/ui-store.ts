import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
  navExpanded: boolean;
  sidebarOpen: boolean;
  toggleNav: () => void;
  setNavExpanded: (v: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      navExpanded: false,
      sidebarOpen: false,
      toggleNav: () => set((s) => ({ navExpanded: !s.navExpanded })),
      setNavExpanded: (v) => set({ navExpanded: v }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
    }),
    {
      name: 'ui-store',
      partialize: (s) => ({ navExpanded: s.navExpanded }),
    },
  ),
);
