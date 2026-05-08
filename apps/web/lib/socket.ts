import { io, type Socket } from 'socket.io-client';

let cached: Socket | null = null;

export function getSocket(): Socket {
  if (cached) {
    return cached;
  }
  const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
  cached = io(url, {
    transports: ['websocket'],
    autoConnect: false,
    withCredentials: true,
  });
  return cached;
}

export function resetSocketForTests(): void {
  cached = null;
}
