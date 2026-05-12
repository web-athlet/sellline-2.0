'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Settings } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { generateBookingSlug, getBookingConfig, updateBookingConfig } from '@/lib/activities-api';

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const ISO_DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function PlannerPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const configQuery = useQuery({
    queryKey: ['booking-config'],
    queryFn: () => getBookingConfig(token),
    enabled: Boolean(token),
  });

  const config = configQuery.data;

  const [slotDuration, setSlotDuration] = useState<number>(30);
  const [workdayStart, setWorkdayStart] = useState<number>(9);
  const [workdayEnd, setWorkdayEnd] = useState<number>(17);
  const [timezone, setTimezone] = useState<string>('Europe/Berlin');
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Sync state from fetched config
  const configLoaded = configQuery.isSuccess;
  if (configLoaded && config && slotDuration === 30 && config.slotDuration !== 30) {
    setSlotDuration(config.slotDuration);
    setWorkdayStart(config.workdayStart);
    setWorkdayEnd(config.workdayEnd);
    setTimezone(config.timezone);
    setActiveDays(config.activeDays);
  }

  const slugMutation = useMutation({
    mutationFn: () => generateBookingSlug(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking-config'] }),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      updateBookingConfig({ slotDuration, workdayStart, workdayEnd, timezone, activeDays }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function copyLink() {
    const url = config?.bookingUrl ? `${window.location.origin}${config.bookingUrl}` : '';
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  function toggleDay(day: number) {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  const bookingUrl = config?.bookingSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${config.bookingSlug}`
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Meeting-Planer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Veröffentlichen Sie einen Buchungslink — Kunden wählen selbst einen freien Slot.
        </p>
      </div>

      {/* Booking link */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
          <ExternalLink className="h-5 w-5 text-blue-500" /> Buchungslink
        </h2>

        {config?.bookingSlug ? (
          <div className="flex items-center gap-3">
            <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {bookingUrl}
            </code>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Kopiert!' : 'Kopieren'}
            </button>
            <a
              href={`/book/${config.bookingSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4 text-slate-500" />
            </a>
          </div>
        ) : (
          <div className="text-center">
            <p className="mb-4 text-sm text-slate-500">Sie haben noch keinen Buchungslink.</p>
            <button
              onClick={() => slugMutation.mutate()}
              disabled={slugMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {slugMutation.isPending ? 'Wird erstellt…' : 'Buchungslink generieren'}
            </button>
          </div>
        )}
      </div>

      {/* Availability config */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
          <Settings className="h-5 w-5 text-slate-500" /> Verfügbarkeit
        </h2>

        <div className="space-y-5">
          {/* Slot duration */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Slot-Dauer (Minuten)
            </label>
            <select
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[15, 30, 45, 60, 90, 120].map((d) => (
                <option key={d} value={d}>
                  {d} Min.
                </option>
              ))}
            </select>
          </div>

          {/* Working hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Arbeitstag von
              </label>
              <select
                value={workdayStart}
                onChange={(e) => setWorkdayStart(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">bis</label>
              <select
                value={workdayEnd}
                onChange={(e) => setWorkdayEnd(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active days */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Verfügbare Tage</label>
            <div className="flex gap-2">
              {ISO_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`h-10 w-10 rounded-full text-sm font-medium transition-colors ${
                    activeDays.includes(day)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {DAYS[day]}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Zeitzone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Europe/Berlin"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {saved && <span className="text-sm font-medium text-emerald-600">Gespeichert ✓</span>}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Wird gespeichert…' : 'Einstellungen speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
