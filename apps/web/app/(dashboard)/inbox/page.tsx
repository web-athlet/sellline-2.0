'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pen, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { InboxSidebar } from '@/components/email/InboxSidebar';
import { ThreadView } from '@/components/email/ThreadView';
import { ComposeModal } from '@/components/email/ComposeModal';
import { getThread, listThreads } from '@/lib/email-api';

const THREADS_KEY = ['email-threads'];
const THREAD_KEY = (id: string) => ['email-thread', id];

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: threadsData,
    isLoading: threadsLoading,
    refetch: refetchThreads,
  } = useQuery({
    queryKey: [...THREADS_KEY, search],
    queryFn: () => listThreads({ search: search || undefined }),
  });

  const { data: threadDetail, isLoading: threadLoading } = useQuery({
    queryKey: THREAD_KEY(selectedThreadId ?? ''),
    queryFn: () => getThread(selectedThreadId!),
    enabled: !!selectedThreadId,
  });

  const handleSearch = (q: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(q), 300);
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleRefresh = () => {
    void refetchThreads();
    if (selectedThreadId) {
      void queryClient.invalidateQueries({ queryKey: THREAD_KEY(selectedThreadId) });
    }
  };

  // Invalidate thread query after read (thread detail marks emails as read)
  useEffect(() => {
    if (selectedThreadId) {
      void queryClient.invalidateQueries({ queryKey: THREADS_KEY });
    }
  }, [selectedThreadId, queryClient]);

  const threads = threadsData?.data ?? [];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left panel — thread list */}
      <div className="w-80 shrink-0 flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
          <h1 className="text-base font-semibold text-gray-900">Posteingang</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="Aktualisieren"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowCompose(true)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="Neue E-Mail"
            >
              <Pen className="h-4 w-4" />
            </button>
          </div>
        </div>

        <InboxSidebar
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelect={handleSelectThread}
          isLoading={threadsLoading}
          onSearch={handleSearch}
        />
      </div>

      {/* Right panel — thread detail */}
      <div className="flex-1 min-w-0 border-l border-gray-200 bg-white">
        <ThreadView
          thread={threadDetail ?? null}
          isLoading={threadLoading && !!selectedThreadId}
          onRefresh={handleRefresh}
        />
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            void refetchThreads();
          }}
        />
      )}
    </div>
  );
}
