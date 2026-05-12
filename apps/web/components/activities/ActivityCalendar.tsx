'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { useState } from 'react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import {
  activitiesKeys,
  checkConflicts,
  TYPE_COLOR,
  TYPE_LABEL,
  updateActivity,
  type Activity,
  type ActivityType,
} from '@/lib/activities-api';

const locales = { de };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop(Calendar as any);

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Activity;
}

interface Props {
  activities: Activity[];
  token?: string;
  onSlotSelect?: (date: Date) => void;
}

export function ActivityCalendar({ activities, token, onSlotSelect }: Props) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<(typeof Views)[keyof typeof Views]>(Views.WEEK);
  const [date, setDate] = useState(new Date());

  const updateMutation = useMutation({
    mutationFn: ({ id, startTime, endTime }: { id: string; startTime: string; endTime: string }) =>
      updateActivity(id, { startTime, endTime, dueDate: startTime }, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activitiesKeys.all() });
    },
  });

  const events: CalEvent[] = activities
    .filter((a) => a.startTime && a.endTime)
    .map((a) => ({
      id: a.id,
      title: a.subject,
      start: new Date(a.startTime!),
      end: new Date(a.endTime!),
      resource: a,
    }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleEventDrop({ event, start, end }: any) {
    const s = new Date(start as Date);
    const e = new Date(end as Date);
    const calEvent = event as CalEvent;

    if (calEvent.resource.type === 'MEETING') {
      try {
        const result = await checkConflicts(
          { startTime: s.toISOString(), endTime: e.toISOString(), excludeId: calEvent.id },
          token,
        );
        if (result.conflicts.length > 0) {
          const list = result.conflicts.map((c) => `• ${c.subject}`).join('\n');
          const confirmed = confirm(`Terminkollision erkannt:\n${list}\n\nTrotzdem verschieben?`);
          if (!confirmed) return;
        }
      } catch {
        // Non-blocking
      }
    }

    updateMutation.mutate({
      id: calEvent.id,
      startTime: s.toISOString(),
      endTime: e.toISOString(),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEventResize({ event, start, end }: any) {
    const calEvent = event as CalEvent;
    updateMutation.mutate({
      id: calEvent.id,
      startTime: new Date(start as Date).toISOString(),
      endTime: new Date(end as Date).toISOString(),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function eventStyleGetter(event: any) {
    const calEvent = event as CalEvent;
    const color = TYPE_COLOR[calEvent.resource.type as ActivityType] ?? '#3b82f6';
    return {
      style: {
        backgroundColor: color,
        borderRadius: '6px',
        color: 'white',
        border: 'none',
        opacity: calEvent.resource.done ? 0.5 : 1,
        fontSize: '12px',
        padding: '2px 6px',
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSelectSlot({ start }: any) {
    onSlotSelect?.(new Date(start as Date));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {(Object.entries(TYPE_COLOR) as [ActivityType, string][]).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            {TYPE_LABEL[type]}
          </span>
        ))}
      </div>

      <div style={{ height: 640 }}>
        <DnDCalendar
          localizer={localizer}
          events={events}
          view={view}
          date={date}
          onView={(v: (typeof Views)[keyof typeof Views]) => setView(v)}
          onNavigate={(d: Date) => setDate(d)}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onSelectSlot={handleSelectSlot}
          selectable
          resizable
          eventPropGetter={eventStyleGetter}
          messages={{
            today: 'Heute',
            previous: '‹',
            next: '›',
            month: 'Monat',
            week: 'Woche',
            day: 'Tag',
            agenda: 'Agenda',
            showMore: (count: number) => `+${count} weitere`,
          }}
          culture="de"
        />
      </div>
    </div>
  );
}
