'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { FeedItem as FeedItemType } from '@/lib/pulse-api';
import { FeedItem } from './FeedItem';

interface FeedListProps {
  items: FeedItemType[];
  completingIds: Set<string>;
  onComplete: (activityId: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

export function FeedList({
  items,
  completingIds,
  onComplete,
  onLoadMore,
  hasMore,
  isLoading,
}: FeedListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="overflow-y-auto h-full" style={{ contain: 'strict' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualItems.map((vItem) => {
          const isLoaderRow = vItem.index === items.length;

          return (
            <div
              key={vItem.key}
              data-index={vItem.index}
              ref={virtualizer.measureElement}
              style={{ position: 'absolute', top: vItem.start, left: 0, width: '100%' }}
              className="pb-2"
            >
              {isLoaderRow ? (
                <div className="flex justify-center py-4">
                  {isLoading ? (
                    <span className="text-sm text-slate-400">Lädt…</span>
                  ) : (
                    <button
                      type="button"
                      onClick={onLoadMore}
                      className="text-sm text-indigo-600 hover:underline focus:outline-none"
                    >
                      Mehr laden
                    </button>
                  )}
                </div>
              ) : (
                <FeedItem
                  item={items[vItem.index]!}
                  onComplete={onComplete}
                  isCompleting={
                    !!items[vItem.index]?.activityId &&
                    completingIds.has(items[vItem.index]!.activityId!)
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
