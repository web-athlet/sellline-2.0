'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { DayNav } from '@/components/pulse/DayNav';
import { FeedList } from '@/components/pulse/FeedList';
import { InfoBanner } from '@/components/pulse/InfoBanner';
import { TabBar } from '@/components/pulse/TabBar';
import { usePulseSocket } from '@/hooks/use-pulse-socket';
import {
  completeActivity,
  getPulseCounts,
  getPulseFeed,
  pulseKeys,
  todayISO,
  type FeedItem,
  type PulseTab,
} from '@/lib/pulse-api';

const EMPTY_COUNTS = { followups: 0, missed: 0, opportunities: 0 };

export default function PulsePage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const [date, setDate] = useState<string>(todayISO());
  const [tab, setTab] = useState<PulseTab>('followups');
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<FeedItem[]>([]);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  usePulseSocket(date, tab);

  const countsQuery = useQuery({
    queryKey: pulseKeys.counts(date),
    queryFn: () => getPulseCounts(date, accessToken),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
  });

  const feedQuery = useQuery({
    queryKey: pulseKeys.feed(date, tab, page),
    queryFn: () => getPulseFeed({ date, tab, page }, accessToken),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // Append new page items to allItems when page changes
  const prevItems = feedQuery.data?.items ?? [];
  const mergedItems =
    page === 1 ? prevItems : [...allItems.slice(0, (page - 1) * 20), ...prevItems];

  const completeMutation = useMutation({
    mutationFn: (activityId: string) => completeActivity(activityId, accessToken),
    onMutate: (activityId) => {
      setCompletingIds((prev) => new Set(prev).add(activityId));
    },
    onSettled: (_, __, activityId) => {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: pulseKeys.all });
    },
  });

  const handleTabChange = (next: PulseTab) => {
    setTab(next);
    setPage(1);
    setAllItems([]);
  };

  const handleDateChange = (delta: -1 | 1) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().slice(0, 10);
    if (delta === 1 && next > todayISO()) return;
    setDate(next);
    setPage(1);
    setAllItems([]);
  };

  const handleLoadMore = () => {
    setAllItems(mergedItems);
    setPage((p) => p + 1);
  };

  const counts = countsQuery.data ?? EMPTY_COUNTS;
  const isLoading = feedQuery.isFetching && page === 1;
  const isEmpty = !isLoading && mergedItems.length === 0;

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold text-slate-900">Pulse</h1>
        <DayNav
          date={date}
          onPrev={() => handleDateChange(-1)}
          onNext={() => handleDateChange(1)}
        />
      </div>

      {/* Tabs */}
      <div className="bg-white px-6">
        <TabBar activeTab={tab} counts={counts} onTabChange={handleTabChange} />
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-hidden px-6 py-4 flex flex-col gap-3">
        <InfoBanner itemCount={counts[tab]} />

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Lädt…</div>
        )}

        {!isLoading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <p className="text-sm">
              {tab === 'followups' && 'Keine offenen Follow-Ups für diesen Tag.'}
              {tab === 'missed' && 'Keine übersehenen Deals.'}
              {tab === 'opportunities' && 'Keine Verkaufschancen über 60 % Wahrscheinlichkeit.'}
            </p>
          </div>
        )}

        {!isLoading && mergedItems.length > 0 && (
          <FeedList
            items={mergedItems}
            completingIds={completingIds}
            onComplete={(id) => completeMutation.mutate(id)}
            onLoadMore={handleLoadMore}
            hasMore={feedQuery.data?.hasMore ?? false}
            isLoading={feedQuery.isFetching && page > 1}
          />
        )}
      </div>
    </div>
  );
}
