import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardLayout } from './DashboardLayout';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/pulse'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  signOut: vi.fn(),
}));

const mockSetSidebarOpen = vi.fn();
const defaultStore = {
  navExpanded: false,
  toggleNav: vi.fn(),
  sidebarOpen: false,
  setSidebarOpen: mockSetSidebarOpen,
  toggleSidebar: vi.fn(),
  setNavExpanded: vi.fn(),
};

vi.mock('@/stores/ui-store', () => ({
  useUIStore: vi.fn(() => defaultStore),
}));

const { useUIStore } = await import('@/stores/ui-store');

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.mocked(useUIStore).mockReturnValue({ ...defaultStore, setSidebarOpen: mockSetSidebarOpen });
    mockSetSidebarOpen.mockClear();
  });
  it('renders children inside main', () => {
    render(
      <DashboardLayout>
        <p>Page content</p>
      </DashboardLayout>,
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('renders nav rail', () => {
    render(
      <DashboardLayout>
        <p>content</p>
      </DashboardLayout>,
    );
    expect(screen.getByTestId('nav-rail')).toBeInTheDocument();
  });

  it('does not render sidebar slot when no sidebar prop', () => {
    render(
      <DashboardLayout>
        <p>content</p>
      </DashboardLayout>,
    );
    expect(screen.queryByTestId('context-sidebar')).toBeNull();
  });

  it('renders context sidebar when sidebar prop is provided', () => {
    render(
      <DashboardLayout sidebar={<div>Sidebar</div>}>
        <p>content</p>
      </DashboardLayout>,
    );
    expect(screen.getByTestId('context-sidebar')).toBeInTheDocument();
    // Sidebar content appears in both desktop aside and mobile sheet
    expect(screen.getAllByText('Sidebar').length).toBeGreaterThanOrEqual(1);
  });

  it('renders mobile sheet when sidebar prop is provided', () => {
    render(
      <DashboardLayout sidebar={<div>Sidebar</div>}>
        <p>content</p>
      </DashboardLayout>,
    );
    expect(screen.getByTestId('context-sidebar-sheet')).toBeInTheDocument();
  });

  it('does not render mobile sheet without sidebar prop', () => {
    render(
      <DashboardLayout>
        <p>content</p>
      </DashboardLayout>,
    );
    expect(screen.queryByTestId('context-sidebar-sheet')).toBeNull();
  });

  it('calls setSidebarOpen(false) when window resizes above sm breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, writable: true, configurable: true });
    render(
      <DashboardLayout>
        <p>content</p>
      </DashboardLayout>,
    );
    fireEvent(window, new Event('resize'));
    expect(mockSetSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('closes mobile sheet backdrop on click', () => {
    vi.mocked(useUIStore).mockReturnValue({
      ...defaultStore,
      sidebarOpen: true,
      setSidebarOpen: mockSetSidebarOpen,
    });
    render(
      <DashboardLayout sidebar={<div>Sidebar</div>}>
        <p>content</p>
      </DashboardLayout>,
    );
    const backdrop = screen.getByTestId('sidebar-backdrop');
    fireEvent.click(backdrop);
    expect(mockSetSidebarOpen).toHaveBeenCalledWith(false);
  });
});
