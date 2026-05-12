'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, List, Plus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { ActivityCalendar } from '@/components/activities/ActivityCalendar';
import { ActivityList } from '@/components/activities/ActivityList';
import { CreateActivityModal } from '@/components/activities/CreateActivityModal';
import { TimeFilterDropdown } from '@/components/activities/TimeFilterDropdown';
import { useActivitiesSocket } from '@/hooks/use-activities-socket';
import {
  activitiesKeys,
  listActivities,
  TYPE_LABEL,
  type ActivityFilter,
  type ActivityType,
} from '@/lib/activities-api';

type View = 'list' | 'calendar';

const TYPE_TABS: Array<{ label: string; value: ActivityType | undefined }> = [
  { label: 'Alle', value: undefined },
  { label: TYPE_LABEL.CALL, value: 'CALL' },
  { label: TYPE_LABEL.MEETING, value: 'MEETING' },
  { label: TYPE_LABEL.TASK, value: 'TASK' },
  { label: TYPE_LABEL.DEADLINE, value: 'DEADLINE' },
  { label: TYPE_LABEL.EMAIL, value: 'EMAIL' },
  { label: TYPE_LABEL.LUNCH, value: 'LUNCH' },
];

export default function ActivitiesPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [view, setView] = useState<View>('list');
  const [activeType, setActiveType] = useState<ActivityType | undefined>(undefined);
  const [filter, setFilter] = useState<ActivityFilter | undefined>(undefined);
  const [fromDate, setFromDate] = useState<string | undefined>(undefined);
  const [toDate, setToDate] = useState<string | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>(undefined);

  useActivitiesSocket();

  const activitiesQuery = useQuery({
    queryKey: activitiesKeys.list({
      type: activeType,
      filter,
      from: fromDate,
      to: toDate,
      limit: 200,
    }),
    queryFn: () =>
      listActivities({ type: activeType, filter, from: fromDate, to: toDate, limit: 200 }, token),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const activities = activitiesQuery.data?.data ?? [];
  const total = activitiesQuery.data?.meta.total ?? 0;

  function handleFilterChange(f: ActivityFilter | undefined, from?: string, to?: string) {
    setFilter(f);
    setFromDate(from);
    setToDate(to);
  }

  function handleSlotSelect(date: Date) {
    setCreateDate(date.toISOString().slice(0, 10));
    setShowCreate(true);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Aktivitäten</h1>
          {!activitiesQuery.isLoading && (
            <p className="mt-0.5 text-sm text-slate-500">{total} Aktivitäten</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-4 w-4" /> Liste
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="h-4 w-4" /> Kalender
            </button>
          </div>

          <button
            onClick={() => {
              setCreateDate(undefined);
              setShowCreate(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Neu
          </button>
        </div>
      </div>

      {/* Type tabs + Time filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setActiveType(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeType === tab.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <TimeFilterDropdown value={filter} onChange={handleFilterChange} />
      </div>

      {activitiesQuery.isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {activitiesQuery.isError && (
        <div className="rounded-xl bg-red-50 p-6 text-center text-red-600">
          Fehler beim Laden der Aktivitäten.
        </div>
      )}

      {!activitiesQuery.isLoading && !activitiesQuery.isError && (
        <>
          {view === 'list' && <ActivityList activities={activities} token={token} />}
          {view === 'calendar' && (
            <ActivityCalendar
              activities={activities}
              token={token}
              onSlotSelect={handleSlotSelect}
            />
          )}
        </>
      )}

      <CreateActivityModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultDate={createDate}
      />
    </div>
  );
}
