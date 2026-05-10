import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './ui-store';

beforeEach(() => {
  useUIStore.setState({ navExpanded: false, sidebarOpen: false });
});

describe('useUIStore', () => {
  it('has correct initial state', () => {
    const { navExpanded, sidebarOpen } = useUIStore.getState();
    expect(navExpanded).toBe(false);
    expect(sidebarOpen).toBe(false);
  });

  it('toggleNav toggles navExpanded true → false → true', () => {
    const { toggleNav } = useUIStore.getState();
    toggleNav();
    expect(useUIStore.getState().navExpanded).toBe(true);
    toggleNav();
    expect(useUIStore.getState().navExpanded).toBe(false);
  });

  it('setNavExpanded sets a specific value', () => {
    useUIStore.getState().setNavExpanded(true);
    expect(useUIStore.getState().navExpanded).toBe(true);
    useUIStore.getState().setNavExpanded(false);
    expect(useUIStore.getState().navExpanded).toBe(false);
  });

  it('toggleSidebar toggles sidebarOpen', () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it('setSidebarOpen sets a specific value', () => {
    useUIStore.getState().setSidebarOpen(true);
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().setSidebarOpen(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });
});
