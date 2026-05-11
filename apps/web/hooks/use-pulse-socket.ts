'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import type { PulseFeedUpdatedEvent } from '@nextgen/types';
import { getSocket } from '@/lib/socket';
import { pulseKeys, type PulseTab } from '@/lib/pulse-api';

export function usePulseSocket(date: string, tab: PulseTab): void {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (!accessToken) return;

    const socket = getSocket(accessToken);

    const handleFeedUpdated = (evt: PulseFeedUpdatedEvent) => {
      // Invalidate the active tab if it matches or the event targets all tabs
      if (evt.tab === null || evt.tab === tab) {
        void queryClient.invalidateQueries({ queryKey: pulseKeys.feed(date, tab, 1) });
      }
      void queryClient.invalidateQueries({ queryKey: pulseKeys.counts(date) });
    };

    socket.on('pulse:feed_updated', handleFeedUpdated);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('pulse:feed_updated', handleFeedUpdated);
    };
  }, [accessToken, date, tab, queryClient]);
}
