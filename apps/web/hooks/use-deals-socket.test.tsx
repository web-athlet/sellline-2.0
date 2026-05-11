import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const socketHandlers = new Map<string, (...args: unknown[]) => void>();
const mockSocket = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    socketHandlers.set(event, handler);
  }),
  off: vi.fn((event: string) => {
    socketHandlers.delete(event);
  }),
  connect: vi.fn(),
  connected: false,
};

vi.mock('@/lib/socket', () => ({
  getSocket: vi.fn(() => mockSocket),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'jwt' } }),
}));

const getDealMock = vi.fn();
vi.mock('@/lib/deals-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/deals-api')>('@/lib/deals-api');
  return { ...actual, getDeal: (...args: unknown[]) => getDealMock(...args) };
});

import { useDealsSocket } from './use-deals-socket';

const makeWrapper = (qc: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryProvider';
  return Wrapper;
};

beforeEach(() => {
  socketHandlers.clear();
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
  mockSocket.connect.mockClear();
  getDealMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDealsSocket', () => {
  it('subscribes to all 5 deal events when a pipeline id is supplied', () => {
    const qc = new QueryClient();
    renderHook(() => useDealsSocket('pipe-1'), { wrapper: makeWrapper(qc) });
    expect(socketHandlers.has('deal:created')).toBe(true);
    expect(socketHandlers.has('deal:updated')).toBe(true);
    expect(socketHandlers.has('deal:stage_changed')).toBe(true);
    expect(socketHandlers.has('deal:deleted')).toBe(true);
    expect(socketHandlers.has('deal:rot_indicator')).toBe(true);
  });

  it('skips subscription if no pipeline id', () => {
    const qc = new QueryClient();
    renderHook(() => useDealsSocket(undefined), { wrapper: makeWrapper(qc) });
    expect(socketHandlers.size).toBe(0);
  });

  it('unsubscribes on unmount', () => {
    const qc = new QueryClient();
    const { unmount } = renderHook(() => useDealsSocket('pipe-1'), {
      wrapper: makeWrapper(qc),
    });
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('deal:created', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('deal:stage_changed', expect.any(Function));
  });

  it('removes detail cache and patches list on deal:deleted', () => {
    const qc = new QueryClient();
    qc.setQueryData(['deals', 'list', { pipelineId: 'pipe-1' }], {
      data: [{ id: 'd1', pipelineId: 'pipe-1', stageId: 's1' }],
      meta: {},
    });
    renderHook(() => useDealsSocket('pipe-1'), { wrapper: makeWrapper(qc) });
    socketHandlers.get('deal:deleted')?.({
      ts: 1,
      userId: 'u',
      dealId: 'd1',
      pipelineId: 'pipe-1',
    });
    const list = qc.getQueryData<{ data: { id: string }[] }>([
      'deals',
      'list',
      { pipelineId: 'pipe-1' },
    ]);
    expect(list?.data ?? []).toHaveLength(0);
  });

  it('patches list on deal:stage_changed', () => {
    const qc = new QueryClient();
    qc.setQueryData(['deals', 'list', { pipelineId: 'pipe-1' }], {
      data: [{ id: 'd1', stageId: 's1', order: 0 }],
      meta: {},
    });
    renderHook(() => useDealsSocket('pipe-1'), { wrapper: makeWrapper(qc) });
    socketHandlers.get('deal:stage_changed')?.({
      ts: 1,
      userId: 'u',
      dealId: 'd1',
      pipelineId: 'pipe-1',
      oldStageId: 's1',
      newStageId: 's2',
      order: 3,
    });
    const list = qc.getQueryData<{ data: { id: string; stageId: string; order: number }[] }>([
      'deals',
      'list',
      { pipelineId: 'pipe-1' },
    ]);
    expect(list?.data[0]?.stageId).toBe('s2');
    expect(list?.data[0]?.order).toBe(3);
  });

  it('toggles rot indicator on deal:rot_indicator', () => {
    const qc = new QueryClient();
    qc.setQueryData(['deals', 'list', { pipelineId: 'pipe-1' }], {
      data: [{ id: 'd1', rotIndicator: false }],
      meta: {},
    });
    renderHook(() => useDealsSocket('pipe-1'), { wrapper: makeWrapper(qc) });
    socketHandlers.get('deal:rot_indicator')?.({
      ts: 1,
      userId: 'u',
      dealId: 'd1',
      pipelineId: 'pipe-1',
      rotIndicator: true,
    });
    const list = qc.getQueryData<{ data: { id: string; rotIndicator: boolean }[] }>([
      'deals',
      'list',
      { pipelineId: 'pipe-1' },
    ]);
    expect(list?.data[0]?.rotIndicator).toBe(true);
  });

  it('ignores events for a different pipeline', () => {
    const qc = new QueryClient();
    qc.setQueryData(['deals', 'list', { pipelineId: 'pipe-1' }], {
      data: [{ id: 'd1', stageId: 's1', order: 0 }],
      meta: {},
    });
    renderHook(() => useDealsSocket('pipe-1'), { wrapper: makeWrapper(qc) });
    socketHandlers.get('deal:stage_changed')?.({
      ts: 1,
      userId: 'u',
      dealId: 'd1',
      pipelineId: 'OTHER-PIPELINE',
      oldStageId: 's1',
      newStageId: 's2',
      order: 9,
    });
    const list = qc.getQueryData<{ data: { id: string; stageId: string }[] }>([
      'deals',
      'list',
      { pipelineId: 'pipe-1' },
    ]);
    expect(list?.data[0]?.stageId).toBe('s1');
  });

  it('fetches full deal on created event', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['deals', 'list', { pipelineId: 'pipe-1' }], { data: [], meta: {} });
    getDealMock.mockResolvedValue({
      id: 'new-d',
      pipelineId: 'pipe-1',
      stageId: 's1',
      updatedAt: 'x',
    });
    renderHook(() => useDealsSocket('pipe-1'), { wrapper: makeWrapper(qc) });
    socketHandlers.get('deal:created')?.({
      ts: 1,
      userId: 'u',
      dealId: 'new-d',
      pipelineId: 'pipe-1',
      stageId: 's1',
    });
    await waitFor(() => expect(getDealMock).toHaveBeenCalled());
  });
});
