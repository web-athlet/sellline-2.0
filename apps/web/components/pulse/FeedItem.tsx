'use client';

import { ChevronDown, Link2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@nextgen/utils';
import {
  formatActivityType,
  formatCurrency,
  formatDueDate,
  type FeedItem as FeedItemType,
} from '@/lib/pulse-api';

interface FeedItemProps {
  item: FeedItemType;
  onComplete: (activityId: string) => void;
  isCompleting?: boolean;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(score, 100);
  const filled = Math.round(pct / 20);
  return (
    <span className="flex gap-0.5" aria-label={`Score ${score}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'inline-block h-2 w-4 rounded-sm',
            i < filled ? 'bg-indigo-500' : 'bg-slate-200',
          )}
        />
      ))}
    </span>
  );
}

export function FeedItem({ item, onComplete, isCompleting }: FeedItemProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleComplete = () => {
    if (!item.activityId) return;
    setDismissed(true);
    onComplete(item.activityId);
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-300',
        isCompleting && 'opacity-50 pointer-events-none',
      )}
    >
      {/* Checkbox — only shown for followup activities */}
      {item.activityId ? (
        <button
          type="button"
          aria-label={`Aktivität erledigen: ${item.subject}`}
          onClick={handleComplete}
          className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-2 border-slate-300 hover:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        />
      ) : (
        <span className="mt-0.5 h-5 w-5 flex-shrink-0" />
      )}

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Subject */}
        <p className="text-sm font-medium text-slate-900 truncate">{item.subject}</p>

        {/* Deal link */}
        {item.dealTitle && (
          <button
            type="button"
            onClick={() => item.dealId && router.push(`/deals/${item.dealId}`)}
            className="mt-0.5 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none"
          >
            <Link2 size={11} />
            <span className="truncate">{item.dealTitle}</span>
          </button>
        )}

        {/* Score row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <ScoreBar score={item.priorityScore} />
          <span className="font-medium text-slate-700">Score {item.priorityScore}</span>
          {item.isUrgent && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              Dringend
            </span>
          )}
          {item.activityType && (
            <span className="text-slate-400">{formatActivityType(item.activityType)}</span>
          )}
          {item.activityDueDate && (
            <span className={cn(item.isUrgent ? 'text-red-500' : 'text-slate-400')}>
              {formatDueDate(item.activityDueDate)}
            </span>
          )}
        </div>

        {/* Value + owner */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {item.dealValue > 0 && (
            <span className="font-medium text-slate-700">
              {formatCurrency(item.dealValue, item.dealCurrency)}
            </span>
          )}
          {item.dealOwnerName && (
            <span className="before:content-['•'] before:mr-1.5">{item.dealOwnerName}</span>
          )}
          {item.dealOrgName && (
            <span className="before:content-['•'] before:mr-1.5 text-slate-400">
              {item.dealOrgName}
            </span>
          )}
        </div>
      </div>

      {/* Action dropdown */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          aria-label="Aktionen"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        >
          Aktion
          <ChevronDown size={12} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          >
            {item.dealId && (
              <button
                role="menuitem"
                type="button"
                className="block w-full px-4 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setMenuOpen(false);
                  router.push(`/deals/${item.dealId}`);
                }}
              >
                Deal anzeigen
              </button>
            )}
            <button
              role="menuitem"
              type="button"
              className="block w-full px-4 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              Verschieben
            </button>
            <button
              role="menuitem"
              type="button"
              className="block w-full px-4 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              Neue Aktivität
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
