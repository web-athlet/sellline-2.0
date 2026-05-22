'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { NavRail, type NavRailProps } from './NavRail';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@nextgen/utils';
import { getUnreadCount } from '@/lib/email-api';

interface DashboardLayoutProps extends NavRailProps {
  children: React.ReactNode;
  /** Optional context sidebar content (200px column, hidden on mobile) */
  sidebar?: React.ReactNode;
}

/**
 * 3-column app shell:
 *   [NavRail 60/220px] | [Sidebar 200px, optional] | [Main flex-1]
 *
 * On mobile (< md):
 *   NavRail → bottom navigation (fixed)
 *   Sidebar → Sheet (slide-over, toggled via sidebarOpen in UIStore)
 *   Main → full-width with bottom padding for bottom nav
 */
export function DashboardLayout({
  children,
  sidebar,
  inboxCount: inboxCountProp,
  overdueCount,
}: DashboardLayoutProps) {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  // Fetch live unread email count — closes Tech-Debt #10
  const { data: countData } = useQuery({
    queryKey: ['email-unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
    retry: false,
  });
  const inboxCount = inboxCountProp ?? countData?.unread ?? 0;

  // Auto-close sidebar on resize to ≥ sm breakpoint
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 640) setSidebarOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* NavRail (desktop: sticky sidebar; mobile: renders fixed bottom nav) */}
      <NavRail inboxCount={inboxCount} overdueCount={overdueCount} />

      {/* Context Sidebar — desktop */}
      {sidebar && (
        <aside
          data-testid="context-sidebar"
          className="hidden sm:block w-[200px] shrink-0 border-r border-slate-200 bg-surface overflow-y-auto"
        >
          {sidebar}
        </aside>
      )}

      {/* Context Sidebar — mobile Sheet (slide-over) */}
      {sidebar && (
        <>
          {/* Backdrop */}
          {sidebarOpen && (
            <div
              data-testid="sidebar-backdrop"
              className="fixed inset-0 bg-black/40 z-40 sm:hidden"
              aria-hidden="true"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          {/* Sheet panel */}
          <aside
            data-testid="context-sidebar-sheet"
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-[200px] bg-surface shadow-xl transition-transform duration-200 sm:hidden overflow-y-auto',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            )}
            aria-label="Kontext-Sidebar"
          >
            {sidebar}
          </aside>
        </>
      )}

      {/* Main content area — only this scrolls */}
      <main
        className={cn(
          'flex-1 overflow-y-auto',
          /* Extra bottom padding on mobile so content isn't hidden behind bottom nav */
          'pb-[64px] md:pb-0',
        )}
      >
        {children}
      </main>
    </div>
  );
}
