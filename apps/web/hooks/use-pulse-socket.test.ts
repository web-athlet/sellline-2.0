import { renderHook } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSocket, resetSocketForTests } from '@/lib/socket';
import { usePulseSocket } from './use-pulse-socket';

vi.mock('next-auth/react');
vi.mock('@/lib/socket');
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueryClient: vi.fn() };
});

const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockConnect = vi.fn();
const fakeSocket = {
  on: mockOn,
  off: mockOff,
  emit: mockEmit,
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

describe('usePulseSocket', () => {
  it('registers pulse:feed_updated listener on mount', () => {
    renderHook(() => usePulseSocket('2026-05-11', 'followups'));
    expect(mockOn).toHaveBeenCalledWith('pulse:feed_updated', expect.any(Function));
  });

  it('connects socket if not connected', () => {
    renderHook(() => usePulseSocket('2026-05-11', 'followups'));
    expect(mockConnect).toHaveBeenCalled();
  });

  it('invalidates feed and counts queries on event for matching tab', () => {
    renderHook(() => usePulseSocket('2026-05-11', 'followups'));

    const handler = mockOn.mock.calls.find(
      ([evt]: [string]) => evt === 'pulse:feed_updated',
    )?.[1] as (e: unknown) => void;
    handler({ userId: 'u', tab: 'followups', ts: Date.now() });

    expect(mockInvalidate).toHaveBeenCalledTimes(2);
  });

  it('does not invalidate feed query for non-matching tab', () => {
    renderHook(() => usePulseSocket('2026-05-11', 'followups'));

    const handler = mockOn.mock.calls.find(
      ([evt]: [string]) => evt === 'pulse:feed_updated',
    )?.[1] as (e: unknown) => void;
    handler({ userId: 'u', tab: 'missed', ts: Date.now() });

    // Only counts invalidated, not feed
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it('invalidates both feed and counts when tab is null', () => {
    renderHook(() => usePulseSocket('2026-05-11', 'followups'));

    const handler = mockOn.mock.calls.find(
      ([evt]: [string]) => evt === 'pulse:feed_updated',
    )?.[1] as (e: unknown) => void;
    handler({ userId: 'u', tab: null, ts: Date.now() });

    expect(mockInvalidate).toHaveBeenCalledTimes(2);
  });

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => usePulseSocket('2026-05-11', 'followups'));
    unmount();
    expect(mockOff).toHaveBeenCalledWith('pulse:feed_updated', expect.any(Function));
  });

  it('does nothing when no access token', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    });
    renderHook(() => usePulseSocket('2026-05-11', 'followups'));
    expect(mockOn).not.toHaveBeenCalled();
  });
});
