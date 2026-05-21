import { renderHook } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSocket, resetSocketForTests } from '@/lib/socket';
import { useLeadsSocket } from './use-leads-socket';

vi.mock('next-auth/react');
vi.mock('@/lib/socket');
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueryClient: vi.fn() };
});

const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockConnect = vi.fn();
const fakeSocket = {
  on: mockOn,
  off: mockOff,
  connect: mockConnect,
  connected: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  resetSocketForTests();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: 'tok', expires: '' } as never,
    status: 'authenticated',
    update: vi.fn(),
  });
  vi.mocked(getSocket).mockReturnValue(fakeSocket as never);
  vi.mocked(useQueryClient).mockReturnValue({
    invalidateQueries: mockInvalidate,
  } as never);
});

describe('useLeadsSocket', () => {
  it('registers lead:enriched listener on mount', () => {
    renderHook(() => useLeadsSocket());
    expect(mockOn).toHaveBeenCalledWith('lead:enriched', expect.any(Function));
  });

  it('connects socket if not connected', () => {
    renderHook(() => useLeadsSocket());
    expect(mockConnect).toHaveBeenCalled();
  });

  it('invalidates leads queries on lead:enriched event', () => {
    renderHook(() => useLeadsSocket());
    const handler = mockOn.mock.calls.find(([evt]: [string]) => evt === 'lead:enriched')?.[1] as (
      e: unknown,
    ) => void;
    handler({ leadId: 'lead-1', status: 'DONE', ts: Date.now() });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['leads'] });
  });

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useLeadsSocket());
    unmount();
    expect(mockOff).toHaveBeenCalledWith('lead:enriched', expect.any(Function));
  });

  it('does nothing when no access token', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    });
    renderHook(() => useLeadsSocket());
    expect(mockOn).not.toHaveBeenCalled();
  });
});
