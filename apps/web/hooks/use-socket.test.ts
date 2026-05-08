import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (...args: unknown[]) => void;

class FakeSocket {
  connected = false;
  disconnectCalls = 0;
  emitted: Array<{ event: string; payload: unknown }> = [];
  private listeners = new Map<string, Listener[]>();

  on(event: string, cb: Listener) {
    const arr = this.listeners.get(event) ?? [];
    arr.push(cb);
    this.listeners.set(event, arr);
    return this;
  }
  off(event: string, cb: Listener) {
    const arr = this.listeners.get(event) ?? [];
    this.listeners.set(
      event,
      arr.filter((fn) => fn !== cb),
    );
    return this;
  }
  trigger(event: string, ...args: unknown[]) {
    [...(this.listeners.get(event) ?? [])].forEach((fn) => fn(...args));
  }
  // Real socket.io.connect() initiates an async handshake; `connected` flips
  // only when the 'connect' event fires. Tests drive state via simulateConnect().
  connect() {
    return this;
  }
  simulateConnect() {
    this.connected = true;
    this.trigger('connect');
  }
  disconnect() {
    this.disconnectCalls += 1;
    const wasConnected = this.connected;
    this.connected = false;
    if (wasConnected) {
      this.trigger('disconnect');
    }
    return this;
  }
  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
    return this;
  }
}

const fakeSocket = new FakeSocket();

vi.mock('@/lib/socket', () => ({
  getSocket: () => fakeSocket,
  resetSocketForTests: () => undefined,
}));

import { useSocket } from './use-socket';

describe('useSocket', () => {
  beforeEach(() => {
    fakeSocket.connected = false;
    fakeSocket.disconnectCalls = 0;
    fakeSocket.emitted = [];
    vi.useRealTimers();
  });

  it('starts in connecting state and transitions to connected on socket open', async () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.status).toBe('connecting');
    act(() => {
      fakeSocket.simulateConnect();
    });
    await waitFor(() => expect(result.current.status).toBe('connected'));
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderHook(() => useSocket());
    act(() => {
      fakeSocket.simulateConnect();
    });
    unmount();
    expect(fakeSocket.disconnectCalls).toBeGreaterThan(0);
    expect(fakeSocket.connected).toBe(false);
  });

  it('rejects sendPing when the socket is not connected', async () => {
    const { result } = renderHook(() => useSocket());
    await expect(result.current.sendPing('x')).rejects.toThrow('socket not connected');
  });

  it('resolves sendPing on the next pong event and updates lastPong', async () => {
    const { result } = renderHook(() => useSocket());
    act(() => {
      fakeSocket.simulateConnect();
    });
    await waitFor(() => expect(result.current.status).toBe('connected'));

    const promise = result.current.sendPing('hi');
    expect(fakeSocket.emitted).toHaveLength(1);
    expect(fakeSocket.emitted[0]?.event).toBe('ping');

    act(() => {
      fakeSocket.trigger('pong', { msg: 'echo', ts: 42 });
    });

    const pong = await promise;
    expect(pong.msg).toBe('echo');
    expect(pong.ts).toBe(42);
    await waitFor(() => expect(result.current.lastPong).toEqual({ msg: 'echo', ts: 42 }));
  });

  it('rejects sendPing when no pong arrives before the timeout', async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useSocket());
    act(() => {
      fakeSocket.simulateConnect();
    });
    const promise = result.current.sendPing('hi');
    // Pre-attach the rejection assertion so the rejection is awaited before
    // it surfaces as an unhandled rejection.
    const assertion = expect(promise).rejects.toThrow('pong timeout');
    vi.advanceTimersByTime(5000);
    await assertion;
    vi.useRealTimers();
    unmount();
  });

  it('reports error status when connect_error fires', async () => {
    const { result } = renderHook(() => useSocket());
    act(() => {
      fakeSocket.trigger('connect_error');
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('returns to idle status when the socket emits disconnect', async () => {
    const { result } = renderHook(() => useSocket());
    act(() => {
      fakeSocket.simulateConnect();
    });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    act(() => {
      fakeSocket.disconnect();
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
  });
});
