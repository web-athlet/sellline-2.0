'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import type { LeadEnrichedEvent } from '@nextgen/types';
import { getSocket } from '@/lib/socket';
import { leadsKeys } from '@/lib/leads-api';

export function useLeadsSocket(): void {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (!accessToken) return;

    const socket = getSocket(accessToken);

    const handleLeadEnriched = (_: LeadEnrichedEvent) => {
      void queryClient.invalidateQueries({ queryKey: leadsKeys.all() });
    };

    socket.on('lead:enriched', handleLeadEnriched);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('lead:enriched', handleLeadEnriched);
    };
  }, [accessToken, queryClient]);
}
