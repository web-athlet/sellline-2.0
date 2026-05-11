import { io, type Socket } from 'socket.io-client';

let cached: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (cached) {
    if (token) {
      const next = cached.auth as { token?: string } | undefined;
      if (!next || next.token !== token) {
        cached.auth = { token };
      }
    }
    return cached;
  }
  const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
  cached = io(url, {
    transports: ['websocket'],
    autoConnect: false,
    withCredentials: true,
    auth: token ? { token } : {},
  });
  return cached;
}

export function resetSocketForTests(): void {
  cached?.disconnect();
  cached = null;
}
