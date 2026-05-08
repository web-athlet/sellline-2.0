'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { PingPayload, PongPayload } from '@nextgen/types';
import { getSocket } from '@/lib/socket';

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface UseSocketResult {
  status: SocketStatus;
  lastPong: PongPayload | null;
  sendPing: (msg: string) => Promise<PongPayload>;
}

const PONG_TIMEOUT_MS = 5000;

export function useSocket(): UseSocketResult {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>('idle');
  const [lastPong, setLastPong] = useState<PongPayload | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('idle');
    const onError = () => setStatus('error');
    const onPong = (data: PongPayload) => setLastPong(data);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('pong', onPong);

    setStatus('connecting');
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('pong', onPong);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const sendPing = useCallback((msg: string): Promise<PongPayload> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        reject(new Error('socket not connected'));
        return;
      }
      const handler = (data: PongPayload) => {
        socket.off('pong', handler);
        clearTimeout(timer);
        resolve(data);
      };
      const timer = setTimeout(() => {
        socket.off('pong', handler);
        reject(new Error('pong timeout'));
      }, PONG_TIMEOUT_MS);
      socket.on('pong', handler);
      const payload: PingPayload = { msg, ts: Date.now() };
      socket.emit('ping', payload);
    });
  }, []);

  return { status, lastPong, sendPing };
}
