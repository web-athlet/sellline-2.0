import { type Socket, io } from 'socket.io-client';

/** Opens a socket.io connection without waiting — so callers can attach listeners first. */
export function openSocket(port: number, token: string): Socket {
  return io(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
}

/** Opens an authenticated socket.io connection and resolves once connected. */
export async function connectTestSocket(port: number, token: string): Promise<Socket> {
  const socket = openSocket(port, token);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

/**
 * Resolves with the first payload for `event`, or rejects after `ms`. The
 * listener is attached eagerly (before any triggering action) so events that
 * arrive immediately are never missed.
 */
export function waitForEvent<T = unknown>(socket: Socket, event: string, ms = 3_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}
