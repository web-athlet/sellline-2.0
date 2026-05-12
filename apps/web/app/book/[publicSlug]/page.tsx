'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Calendar, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { createBooking, getAvailableSlots, getPublicProfile } from '@/lib/activities-api';

function isoDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function PublicBookingPage() {
  const params = useParams<{ publicSlug: string }>();
  const slug = params.publicSlug;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [guestNotes, setGuestNotes] = useState('');
  const [booked, setBooked] = useState(false);
  const [bookedTime, setBookedTime] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['booking-profile', slug],
    queryFn: () => getPublicProfile(slug),
  });

  const slotsQuery = useQuery({
    queryKey: ['booking-slots', slug, isoDateStr(selectedDate)],
    queryFn: () => getAvailableSlots(slug, isoDateStr(selectedDate)),
    enabled: Boolean(slug),
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      createBooking(slug, {
        startTime: selectedSlot!,
        guestName,
        guestEmail,
        subject: subject || `Meeting mit ${guestName}`,
        guestNotes,
      }),
    onSuccess: (data) => {
      setBooked(true);
      setBookedTime(data.startTime);
    },
  });

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Calendar className="mx-auto mb-4 h-16 w-16 text-slate-300" />
          <h1 className="text-xl font-semibold text-slate-700">Buchungsseite nicht gefunden</h1>
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;
  const slots = slotsQuery.data?.slots ?? [];

  if (booked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
          <h1 className="text-2xl font-semibold text-slate-900">Gebucht!</h1>
          <p className="mt-2 text-slate-600">
            Ihr Termin bei <strong>{profile.name}</strong> wurde bestätigt.
          </p>
          {bookedTime && (
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {new Date(bookedTime).toLocaleString('de-DE', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              Uhr
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Termin buchen bei {profile.name}</h1>
          <p className="mt-2 text-slate-500">Wählen Sie einen Termin aus dem Kalender.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Date picker */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {selectedDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedDate((d) => addDays(d, -1))}
                  className="rounded-lg p-1.5 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
                <button
                  onClick={() => setSelectedDate((d) => addDays(d, 1))}
                  className="rounded-lg p-1.5 hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </button>
              </div>
            </div>

            {/* 7-day strip */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                <div key={d} className="py-1 text-xs font-medium text-slate-400">
                  {d}
                </div>
              ))}
              {Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i - 3)).map((d) => {
                const isSelected = isoDateStr(d) === isoDateStr(selectedDate);
                const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <button
                    key={isoDateStr(d)}
                    onClick={() => {
                      if (!isPast) {
                        setSelectedDate(d);
                        setSelectedSlot(null);
                      }
                    }}
                    disabled={isPast}
                    className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : isPast
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Available slots */}
            <div className="mt-6">
              <p className="mb-3 text-sm font-medium text-slate-700">
                Verfügbare Slots am{' '}
                {selectedDate.toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}
              </p>
              {slotsQuery.isLoading && (
                <div className="flex justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              )}
              {!slotsQuery.isLoading && slots.length === 0 && (
                <p className="text-sm text-slate-400">Keine freien Slots an diesem Tag.</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const time = new Date(slot.startTime).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <button
                      key={slot.startTime}
                      onClick={() => setSelectedSlot(slot.startTime)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                        selectedSlot === slot.startTime
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Booking form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Ihre Daten</h2>
            {!selectedSlot && (
              <p className="text-sm text-slate-400">Bitte wählen Sie zuerst einen Slot aus.</p>
            )}
            {selectedSlot && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  bookMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Gewählter Termin:{' '}
                  <strong>
                    {new Date(selectedSlot).toLocaleString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                  <input
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ihr Name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">E-Mail *</label>
                  <input
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ihre@email.de"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Thema</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Meeting mit ${profile.name}`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Notizen</label>
                  <textarea
                    rows={3}
                    value={guestNotes}
                    onChange={(e) => setGuestNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Was möchten Sie besprechen?"
                  />
                </div>

                {bookMutation.isError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    {(bookMutation.error as Error)?.message ?? 'Buchung fehlgeschlagen.'}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={bookMutation.isPending || !guestName || !guestEmail}
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {bookMutation.isPending ? 'Wird gebucht…' : 'Termin bestätigen'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
