'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pulse.banner_dismissed';

interface InfoBannerProps {
  itemCount: number;
}

export function InfoBanner({ itemCount }: InfoBannerProps) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setDismissed(stored === '1');
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800"
    >
      <span>
        Die KI hat <strong>{itemCount}</strong> {itemCount === 1 ? 'Task' : 'Tasks'} priorisiert.{' '}
        <button
          type="button"
          className="underline hover:no-underline focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
          onClick={() => {
            // Placeholder — AI detail view in Session 14
          }}
        >
          Mehr
        </button>
      </span>
      <button
        type="button"
        aria-label="Banner schließen"
        onClick={dismiss}
        className="flex-shrink-0 rounded p-0.5 hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <X size={16} />
      </button>
    </div>
  );
}
