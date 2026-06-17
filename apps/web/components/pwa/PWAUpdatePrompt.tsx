'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Explicit service-worker update prompt (Session 16b, Block 2).
 *
 * The SW is registered with `skipWaiting: false`, so a freshly installed version
 * stays in the `waiting` state instead of silently taking over — a background swap
 * could blow away unsaved form data. When a new worker is waiting we show a toast;
 * the user opts in, we post `SKIP_WAITING`, and reload once the new worker takes
 * control. Renders nothing until an update is actually waiting.
 */
export function PWAUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    const trackInstalling = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        // `installed` + an active controller means this is an *update*, not the
        // first install (first install has no controller and shouldn't prompt).
        if (worker.state === 'installed' && navigator.serviceWorker.controller && !cancelled) {
          setWaitingWorker(worker);
        }
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || cancelled) return;
      // A worker may already be waiting if the update landed before mount.
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
      }
      reg.addEventListener('updatefound', () => trackInstalling(reg.installing));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!waitingWorker) return null;

  const applyUpdate = () => {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    // The new worker calls clients.claim(); reload to render the fresh assets.
    window.location.reload();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-update-prompt"
      className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-200 bg-surface px-4 py-3 shadow-xl"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="text-sm text-slate-700">Neue Version verfügbar.</span>
      <button
        type="button"
        onClick={applyUpdate}
        className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-white hover:bg-primary-dark"
      >
        Jetzt aktualisieren
      </button>
    </div>
  );
}
