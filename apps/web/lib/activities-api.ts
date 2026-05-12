import { apiFetch } from './api-client';

export type ActivityType = 'CALL' | 'MEETING' | 'TASK' | 'DEADLINE' | 'EMAIL' | 'LUNCH';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ActivityFilter =
  | 'todo'
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'next_week'
  | 'range';

export interface ActivityDeal {
  id: string;
  title: string;
  value: string;
  currency: string;
}

export interface ActivityPerson {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ActivityOrg {
  id: string;
  name: string;
}

export interface ActivityAssignee {
  id: string;
  name: string;
  email: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  notes: string | null;
  dueDate: string | null;
  startTime: string | null;
  endTime: string | null;
  done: boolean;
  doneAt: string | null;
  priority: Priority;
  dealId: string | null;
  personId: string | null;
  orgId: string | null;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
  deal: ActivityDeal | null;
  person: ActivityPerson | null;
  org: ActivityOrg | null;
  assignee: ActivityAssignee;
}

export interface ActivitiesResponse {
  data: Activity[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface ConflictSlot {
  id: string;
  subject: string;
  startTime: string | null;
  endTime: string | null;
}

export interface CreateActivityInput {
  type: ActivityType;
  subject: string;
  notes?: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  priority?: Priority;
  dealId?: string;
  personId?: string;
  orgId?: string;
  assigneeId?: string;
}

export interface UpdateActivityInput extends Partial<CreateActivityInput> {
  done?: boolean;
}

// ── Query key factory ──────────────────────────────────────────────────────

export const activitiesKeys = {
  all: () => ['activities'] as const,
  list: (params: object) => ['activities', 'list', params] as const,
  detail: (id: string) => ['activities', 'detail', id] as const,
};

// ── API functions ──────────────────────────────────────────────────────────

export async function listActivities(
  params: {
    filter?: ActivityFilter;
    type?: ActivityType;
    dealId?: string;
    personId?: string;
    assigneeId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  },
  accessToken?: string,
): Promise<ActivitiesResponse> {
  const qs = new URLSearchParams();
  if (params.filter) qs.set('filter', params.filter);
  if (params.type) qs.set('type', params.type);
  if (params.dealId) qs.set('dealId', params.dealId);
  if (params.personId) qs.set('personId', params.personId);
  if (params.assigneeId) qs.set('assigneeId', params.assigneeId);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiFetch<ActivitiesResponse>(`/api/v1/activities${q ? `?${q}` : ''}`, { accessToken });
}

export async function getActivity(id: string, accessToken?: string): Promise<Activity> {
  return apiFetch<Activity>(`/api/v1/activities/${id}`, { accessToken });
}

export async function createActivity(
  input: CreateActivityInput,
  accessToken?: string,
): Promise<Activity> {
  return apiFetch<Activity>('/api/v1/activities', {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken,
  });
}

export async function updateActivity(
  id: string,
  input: UpdateActivityInput,
  accessToken?: string,
): Promise<Activity> {
  return apiFetch<Activity>(`/api/v1/activities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    accessToken,
  });
}

export async function deleteActivity(id: string, accessToken?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/activities/${id}`, { method: 'DELETE', accessToken });
}

export async function markActivityDone(id: string, accessToken?: string): Promise<Activity> {
  return apiFetch<Activity>(`/api/v1/activities/${id}/done`, { method: 'PATCH', accessToken });
}

export async function checkConflicts(
  input: { startTime: string; endTime: string; excludeId?: string },
  accessToken?: string,
): Promise<{ conflicts: ConflictSlot[] }> {
  return apiFetch<{ conflicts: ConflictSlot[] }>('/api/v1/activities/check-conflicts', {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken,
  });
}

// ── Booking API ────────────────────────────────────────────────────────────

export interface BookingConfig {
  slotDuration: number;
  workdayStart: number;
  workdayEnd: number;
  timezone: string;
  activeDays: number[];
  bookingSlug: string | null;
  name: string;
  bookingUrl: string | null;
}

export interface BookingSlot {
  startTime: string;
  endTime: string;
}

export interface PublicProfile {
  userId: string;
  name: string;
  avatarUrl: string | null;
  config: {
    slotDuration: number;
    workdayStart: number;
    workdayEnd: number;
    timezone: string;
    activeDays: number[];
  };
}

export async function getBookingConfig(accessToken?: string): Promise<BookingConfig> {
  return apiFetch<BookingConfig>('/api/v1/booking/config', { accessToken });
}

export async function updateBookingConfig(
  input: Partial<Omit<BookingConfig, 'bookingSlug' | 'name' | 'bookingUrl'>>,
  accessToken?: string,
): Promise<BookingConfig> {
  return apiFetch<BookingConfig>('/api/v1/booking/config', {
    method: 'PATCH',
    body: JSON.stringify(input),
    accessToken,
  });
}

export async function generateBookingSlug(accessToken?: string): Promise<{ bookingSlug: string }> {
  return apiFetch<{ bookingSlug: string }>('/api/v1/booking/config/generate-slug', {
    method: 'POST',
    accessToken,
  });
}

export async function getPublicProfile(slug: string): Promise<PublicProfile> {
  return apiFetch<PublicProfile>(`/api/v1/booking/public/${slug}`);
}

export async function getAvailableSlots(
  slug: string,
  date: string,
): Promise<{ slots: BookingSlot[] }> {
  return apiFetch<{ slots: BookingSlot[] }>(`/api/v1/booking/public/${slug}/slots?date=${date}`);
}

export async function createBooking(
  slug: string,
  input: {
    startTime: string;
    guestName: string;
    guestEmail: string;
    subject: string;
    guestNotes?: string;
  },
): Promise<{ activityId: string; startTime: string; endTime: string }> {
  return apiFetch<{ activityId: string; startTime: string; endTime: string }>(
    `/api/v1/booking/public/${slug}/book`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

// ── Formatters ─────────────────────────────────────────────────────────────

export const TYPE_LABEL: Record<ActivityType, string> = {
  CALL: 'Anruf',
  MEETING: 'Meeting',
  TASK: 'Aufgabe',
  DEADLINE: 'Frist',
  EMAIL: 'E-Mail',
  LUNCH: 'Mittagessen',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Niedrig',
  NORMAL: 'Normal',
  HIGH: 'Hoch',
  URGENT: 'Dringend',
};

export const FILTER_LABEL: Record<ActivityFilter, string> = {
  todo: 'Ausstehend',
  overdue: 'Überfällig',
  today: 'Heute',
  tomorrow: 'Morgen',
  this_week: 'Diese Woche',
  next_week: 'Nächste Woche',
  range: 'Zeitraum',
};

export const TYPE_COLOR: Record<ActivityType, string> = {
  CALL: '#3b82f6',
  MEETING: '#8b5cf6',
  TASK: '#f59e0b',
  DEADLINE: '#ef4444',
  EMAIL: '#06b6d4',
  LUNCH: '#10b981',
};

export function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  if (d >= todayStart && d <= todayEnd) return 'Heute';
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);
  if (d >= tomorrowStart && d <= tomorrowEnd) return 'Morgen';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
