'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import type {
  ActivityCompletedEvent,
  ActivityCreatedEvent,
  ActivityUpdatedEvent,
} from '@nextgen/types';
import { getSocket } from '@/lib/socket';
import { activitiesKeys } from '@/lib/activities-api';

export function useActivitiesSocket(): void {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (!accessToken) return;

    const socket = getSocket(accessToken);

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: activitiesKeys.all() });
    };

    socket.on('activity:created', (_: ActivityCreatedEvent) => invalidate());
    socket.on('activity:updated', (_: ActivityUpdatedEvent) => invalidate());
    socket.on('activity:completed', (_: ActivityCompletedEvent) => invalidate());

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('activity:created');
      socket.off('activity:updated');
      socket.off('activity:completed');
    };
  }, [accessToken, queryClient]);
}
