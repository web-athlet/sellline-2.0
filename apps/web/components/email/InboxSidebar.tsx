'use client';

import { cn } from '@nextgen/utils';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Mail, MailOpen, Search } from 'lucide-react';
import { useState } from 'react';
import type { EmailSummary } from '@/lib/email-api';

interface Props {
  threads: EmailSummary[];
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
  isLoading?: boolean;
  onSearch?: (q: string) => void;
}

function groupByDate(threads: EmailSummary[]): { label: string; items: EmailSummary[] }[] {
  const now = new Date();
  const today: EmailSummary[] = [];
  const yesterday: EmailSummary[] = [];
  const older: EmailSummary[] = [];

  for (const t of threads) {
    const d = new Date(t.sentAt);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diffDays === 0) today.push(t);
    else if (diffDays === 1) yesterday.push(t);
    else older.push(t);
  }

  const groups = [];
  if (today.length) groups.push({ label: 'Heute', items: today });
  if (yesterday.length) groups.push({ label: 'Gestern', items: yesterday });
  if (older.length) groups.push({ label: 'Älter', items: older });
  return groups;
}

export function InboxSidebar({ threads, selectedThreadId, onSelect, isLoading, onSearch }: Props) {
  const [search, setSearch] = useState('');

  const handleSearch = (v: string) => {
    setSearch(v);
    onSearch?.(v);
  };

  const groups = groupByDate(threads);

  return (
    <div className="flex flex-col h-full border-r border-gray-200">
      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">Laden…</div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-gray-400">
            <Mail className="h-8 w-8 mb-2 opacity-40" />
            <span>Keine E-Mails</span>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                {g.label}
              </div>
              {g.items.map((t) => (
                <ThreadRow
                  key={t.id}
                  thread={t}
                  isSelected={t.threadId === selectedThreadId}
                  onClick={() => onSelect(t.threadId)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  isSelected,
  onClick,
}: {
  thread: EmailSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors',
        isSelected && 'bg-blue-50 border-l-2 border-l-blue-600',
        !thread.isRead && 'bg-white',
        thread.isRead && !isSelected && 'bg-gray-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {thread.isRead ? (
            <MailOpen className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <Mail className="h-4 w-4 shrink-0 text-blue-600" />
          )}
          <span
            className={cn(
              'text-sm truncate',
              !thread.isRead ? 'font-semibold text-gray-900' : 'text-gray-600',
            )}
          >
            {thread.isSent ? `An: ${thread.toAddresses[0] ?? ''}` : thread.fromAddress}
          </span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {formatDistanceToNow(new Date(thread.sentAt), { addSuffix: false, locale: de })}
        </span>
      </div>
      <p
        className={cn(
          'text-sm truncate mt-0.5',
          !thread.isRead ? 'font-medium text-gray-800' : 'text-gray-500',
        )}
      >
        {thread.subject}
      </p>
      <p className="text-xs text-gray-400 truncate mt-0.5">{thread.bodyPreview}</p>
      {thread.deal && (
        <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
          {thread.deal.title}
        </span>
      )}
    </button>
  );
}
