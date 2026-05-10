'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  type LucideIcon,
  Radar,
  Target,
  DollarSign,
  CheckSquare,
  Megaphone,
  Mail,
  Calendar,
  Users,
  BarChart3,
  Package,
  Settings,
  HelpCircle,
  Bell,
  Menu,
  LogOut,
} from 'lucide-react';
import { cn } from '@nextgen/utils';
import { useUIStore } from '@/stores/ui-store';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Radar, label: 'Pulse', href: '/pulse' },
  { icon: Target, label: 'Leads', href: '/leads' },
  { icon: DollarSign, label: 'Deals', href: '/deals' },
  { icon: CheckSquare, label: 'Projekte', href: '/projects' },
  { icon: Megaphone, label: 'Campaigns', href: '/campaigns' },
  { icon: Mail, label: 'Inbox', href: '/inbox' },
  { icon: Calendar, label: 'Aktivitäten', href: '/activities' },
  { icon: Users, label: 'Kontakte', href: '/contacts' },
  { icon: BarChart3, label: 'Einblicke', href: '/insights' },
  { icon: Package, label: 'Produkte', href: '/products' },
];

export interface NavRailProps {
  inboxCount?: number;
  overdueCount?: number;
}

export function NavRail({ inboxCount = 0, overdueCount = 0 }: NavRailProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { navExpanded, toggleNav } = useUIStore();
  const [hovered, setHovered] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isExpanded = navExpanded || hovered;

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [userMenuOpen]);

  const userInitials =
    session?.user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '?';

  const getBadge = (href: string) => {
    if (href === '/inbox') return inboxCount;
    if (href === '/activities') return overdueCount;
    return 0;
  };

  return (
    <>
      {/* ── Desktop Side NavRail ─────────────────────────────────────── */}
      <nav
        data-testid="nav-rail"
        className={cn(
          'hidden md:flex flex-col h-screen sticky top-0 bg-[#1B2559] transition-[width] duration-200 overflow-hidden z-30 shrink-0',
          isExpanded ? 'w-[220px]' : 'w-[60px]',
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setUserMenuOpen(false);
        }}
        aria-label="Hauptnavigation"
      >
        {/* Header */}
        <div className="flex items-center h-14 px-[10px] shrink-0">
          <button
            onClick={toggleNav}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:bg-[#252F7A] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            aria-label={navExpanded ? 'Navigation einklappen' : 'Navigation ausklappen'}
          >
            <Menu size={20} />
          </button>
          {isExpanded && (
            <span className="ml-2 text-white font-semibold text-sm tracking-wide truncate select-none">
              NextGen CRM
            </span>
          )}
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
          <ul role="list" className="space-y-0.5 px-[6px]">
            {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              const badge = getBadge(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 pl-[6px] pr-2 py-2 rounded-lg transition-colors relative border-l-4',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400',
                      isActive
                        ? 'border-indigo-500 bg-[#2D3882] text-white'
                        : 'border-transparent text-white/70 hover:bg-[#252F7A] hover:text-white',
                    )}
                  >
                    <span className="relative shrink-0">
                      <Icon size={20} strokeWidth={1.8} />
                      {badge > 0 && (
                        <span
                          aria-label={`${badge} ungelesen`}
                          className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none"
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </span>
                    {isExpanded && <span className="text-sm truncate">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/10 pt-2 pb-3 px-[6px] space-y-0.5">
          <Link
            href="/settings/security"
            aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 pl-[6px] pr-2 py-2 rounded-lg transition-colors border-l-4',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400',
              pathname.startsWith('/settings')
                ? 'border-indigo-500 bg-[#2D3882] text-white'
                : 'border-transparent text-white/70 hover:bg-[#252F7A] hover:text-white',
            )}
          >
            <Settings size={20} strokeWidth={1.8} className="shrink-0" />
            {isExpanded && <span className="text-sm">Einstellungen</span>}
          </Link>

          <Link
            href="/help"
            className="flex items-center gap-3 pl-[6px] pr-2 py-2 rounded-lg transition-colors border-l-4 border-transparent text-white/70 hover:bg-[#252F7A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
          >
            <HelpCircle size={20} strokeWidth={1.8} className="shrink-0" />
            {isExpanded && <span className="text-sm">Hilfe</span>}
          </Link>

          <button
            type="button"
            aria-label="Benachrichtigungen"
            className="w-full flex items-center gap-3 pl-[6px] pr-2 py-2 rounded-lg transition-colors border-l-4 border-transparent text-white/70 hover:bg-[#252F7A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
          >
            <Bell size={20} strokeWidth={1.8} className="shrink-0" />
            {isExpanded && <span className="text-sm">Benachrichtigungen</span>}
          </button>

          {/* User Avatar + Dropdown */}
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-label="Benutzermenü öffnen"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="w-full flex items-center gap-3 pl-[6px] pr-2 py-2 rounded-lg transition-colors text-white/70 hover:bg-[#252F7A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
            >
              <span className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
                {userInitials}
              </span>
              {isExpanded && (
                <span className="text-sm truncate flex-1 text-left">
                  {session?.user?.name ?? session?.user?.email ?? 'Benutzer'}
                </span>
              )}
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 mb-1 w-52 rounded-lg bg-[#252F7A] shadow-lg border border-white/10 py-1 z-50"
              >
                {session?.user?.email && (
                  <div className="px-3 py-2 text-xs text-white/50 truncate border-b border-white/10 mb-1">
                    {session.user.email}
                  </div>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
                >
                  <LogOut size={16} />
                  Abmelden
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mobile Bottom Navigation ─────────────────────────────────── */}
      <nav
        data-testid="bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1B2559] border-t border-white/10 z-30 safe-area-pb"
        aria-label="Mobile Navigation"
      >
        <div className="flex overflow-x-auto scrollbar-hide">
          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            const badge = getBadge(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center min-w-[64px] py-2 px-1 relative transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400',
                  isActive ? 'text-white' : 'text-white/60 hover:text-white',
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-500 rounded-full" />
                )}
                <span className="relative">
                  <Icon size={20} strokeWidth={1.8} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] mt-0.5 truncate max-w-[56px] text-center leading-tight">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
