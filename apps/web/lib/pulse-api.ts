import { apiFetch } from './api-client';

export type PulseTab = 'followups' | 'missed' | 'opportunities';

export interface FeedItem {
  id: string;
  activityId: string | null;
  dealId: string | null;
  subject: string;
  activityType: string | null;
  activityDone: boolean;
  activityDueDate: string | null;
  dealTitle: string | null;
  dealValue: number;
  dealCurrency: string;
  dealStageIndex: number;
  dealTotalStages: number;
  dealOwnerId: string;
  dealOwnerName: string;
  dealOrgName: string | null;
  activitiesLast7d: number;
  priorityScore: number;
  isUrgent: boolean;
}

export interface PulseFeedResponse {
  items: FeedItem[];
  total: number;
  hasMore: boolean;
}

export interface PulseCounts {
  followups: number;
  missed: number;
  opportunities: number;
}

export const pulseKeys = {
  all: ['pulse'] as const,
  feed: (date: string, tab: PulseTab, page: number) => ['pulse', 'feed', date, tab, page] as const,
  counts: (date: string) => ['pulse', 'counts', date] as const,
};

export async function getPulseFeed(
  params: { date: string; tab: PulseTab; page?: number; limit?: number },
  accessToken?: string,
): Promise<PulseFeedResponse> {
  const search = new URLSearchParams({
    date: params.date,
    tab: params.tab,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  return apiFetch<PulseFeedResponse>(`/api/v1/pulse-feed?${search.toString()}`, { accessToken });
}

export async function getPulseCounts(date: string, accessToken?: string): Promise<PulseCounts> {
  return apiFetch<PulseCounts>(`/api/v1/pulse-feed/counts?date=${date}`, { accessToken });
}

export async function completeActivity(activityId: string, accessToken?: string): Promise<void> {
  await apiFetch<void>(`/api/v1/pulse-feed/activity/${activityId}/complete`, {
    method: 'PATCH',
    accessToken,
  });
}

export function formatActivityType(type: string | null): string {
  const map: Record<string, string> = {
    CALL: 'Anruf',
    MEETING: 'Meeting',
    TASK: 'Aufgabe',
    DEADLINE: 'Frist',
    EMAIL: 'E-Mail',
    LUNCH: 'Mittagessen',
  };
  return type ? (map[type] ?? type) : '';
}

export function formatDueDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Heute';
  if (diffDays === -1) return 'Gestern';
  if (diffDays < -1) return `${Math.abs(diffDays)} Tage überfällig`;
  if (diffDays === 1) return 'Morgen';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
