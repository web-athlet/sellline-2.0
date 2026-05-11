import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NavRail } from './NavRail';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/pulse'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { name: 'Ada Lovelace', email: 'ada@example.com' } },
    status: 'authenticated',
  })),
  signOut: vi.fn(),
}));

const mockToggleNav = vi.fn();
vi.mock('@/stores/ui-store', () => ({
  useUIStore: vi.fn(() => ({
    navExpanded: false,
    toggleNav: mockToggleNav,
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
  })),
}));

// ── Helpers ──────────────────────────────────────────────────────────

const { usePathname } = await import('next/navigation');
const { useUIStore } = await import('@/stores/ui-store');

function renderNavRail(props = {}) {
  return render(<NavRail {...props} />);
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('NavRail', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/pulse');
    vi.mocked(useUIStore).mockReturnValue({
      navExpanded: false,
      toggleNav: mockToggleNav,
      sidebarOpen: false,
      setSidebarOpen: vi.fn(),
      toggleSidebar: vi.fn(),
      setNavExpanded: vi.fn(),
    });
  });

  it('renders the desktop nav rail', () => {
    renderNavRail();
    expect(screen.getByTestId('nav-rail')).toBeInTheDocument();
  });

  it('renders all 10 navigation items', () => {
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    const links = nav.querySelectorAll('a[href]');
    const navLinks = Array.from(links).filter((el) =>
      [
        '/pulse',
        '/leads',
        '/deals',
        '/projects',
        '/campaigns',
        '/inbox',
        '/activities',
        '/contacts',
        '/insights',
        '/products',
      ].includes(el.getAttribute('href') ?? ''),
    );
    expect(navLinks).toHaveLength(10);
  });

  it('marks the active route with aria-current="page"', () => {
    vi.mocked(usePathname).mockReturnValue('/deals');
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    const activeLink = nav.querySelector('a[href="/deals"][aria-current="page"]');
    expect(activeLink).toBeInTheDocument();
  });

  it('does not mark inactive routes as current', () => {
    vi.mocked(usePathname).mockReturnValue('/pulse');
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    const inactiveLink = nav.querySelector('a[href="/deals"][aria-current="page"]');
    expect(inactiveLink).toBeNull();
  });

  it('calls toggleNav when hamburger button is clicked', () => {
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    const hamburger = nav.querySelector('button[aria-label]') as HTMLButtonElement;
    fireEvent.click(hamburger);
    expect(mockToggleNav).toHaveBeenCalledTimes(1);
  });

  it('shows user initials from session name', () => {
    renderNavRail();
    // "Ada Lovelace" → "AL"
    const nav = screen.getByTestId('nav-rail');
    expect(nav.textContent).toContain('AL');
  });

  it('shows inbox badge when inboxCount > 0', () => {
    renderNavRail({ inboxCount: 5 });
    const badges = screen.getAllByLabelText('5 ungelesen');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('hides badge when count is 0', () => {
    renderNavRail({ inboxCount: 0 });
    expect(screen.queryByLabelText('0 ungelesen')).toBeNull();
  });

  it('shows overdue badge on activities when overdueCount > 0', () => {
    renderNavRail({ overdueCount: 3 });
    const badges = screen.getAllByLabelText('3 ungelesen');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('renders mobile bottom nav', () => {
    renderNavRail();
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
  });

  it('mobile nav contains all 10 nav items', () => {
    renderNavRail();
    const bottomNav = screen.getByTestId('bottom-nav');
    const links = bottomNav.querySelectorAll('a[href]');
    expect(links).toHaveLength(10);
  });

  it('toggle button has accessible label when collapsed', () => {
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    const btn = nav.querySelector('button[aria-label="Navigation ausklappen"]');
    expect(btn).toBeInTheDocument();
  });

  it('toggle button aria-label changes when expanded', () => {
    vi.mocked(useUIStore).mockReturnValue({
      navExpanded: true,
      toggleNav: mockToggleNav,
      sidebarOpen: false,
      setSidebarOpen: vi.fn(),
      toggleSidebar: vi.fn(),
      setNavExpanded: vi.fn(),
    });
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    const btn = nav.querySelector('button[aria-label="Navigation einklappen"]');
    expect(btn).toBeInTheDocument();
  });

  it('opens user menu on avatar click', () => {
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    const avatarBtn = nav.querySelector(
      'button[aria-label="Benutzermenü öffnen"]',
    ) as HTMLButtonElement;
    fireEvent.click(avatarBtn);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Abmelden')).toBeInTheDocument();
  });

  it('nav rail has accessible landmark label', () => {
    renderNavRail();
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
  });

  it('all nav links are keyboard-focusable (tabIndex not -1)', () => {
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    const links = nav.querySelectorAll('a');
    links.forEach((link) => {
      expect(link.tabIndex).not.toBe(-1);
    });
  });

  it('closes user menu when clicking outside', async () => {
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    const avatarBtn = nav.querySelector(
      'button[aria-label="Benutzermenü öffnen"]',
    ) as HTMLButtonElement;
    fireEvent.click(avatarBtn);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('hovering nav sets hovered style (expanded width class)', () => {
    renderNavRail();
    const nav = screen.getByTestId('nav-rail');
    fireEvent.mouseEnter(nav);
    expect(nav.className).toContain('w-[220px]');
    fireEvent.mouseLeave(nav);
    expect(nav.className).toContain('w-[60px]');
  });
});
