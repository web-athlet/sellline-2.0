import { apiFetch } from './api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'PAUSED' | 'FAILED';

export interface CampaignSender {
  id: string;
  name: string;
  email: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  previewText: string | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  senderId: string;
  totalRecipients: number;
  openCount: number;
  clickCount: number;
  unsubCount: number;
  bounceCount: number;
  createdAt: string;
  updatedAt: string;
  sender: CampaignSender;
}

export interface CampaignContact {
  id: string;
  personId: string;
  trackingToken: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  unsubscribedAt: string | null;
  bouncedAt: string | null;
  person: { id: string; firstName: string; lastName: string; emails: string[]; optIn: boolean };
}

export interface CampaignDetail extends Campaign {
  contacts: CampaignContact[];
}

export interface CampaignsResponse {
  data: Campaign[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface AiSubjectSuggestion {
  subject: string;
  reasoning: string;
  estimatedOpenRate: number;
}

export interface CreateCampaignInput {
  name: string;
  subject: string;
  bodyHtml: string;
  previewText?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  subject?: string;
  bodyHtml?: string;
  previewText?: string;
}

export interface CampaignQuery {
  page?: number;
  limit?: number;
  status?: CampaignStatus;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const campaignsKeys = {
  all: () => ['campaigns'] as const,
  lists: () => ['campaigns', 'list'] as const,
  list: (q: CampaignQuery) => ['campaigns', 'list', q] as const,
  detail: (id: string) => ['campaigns', 'detail', id] as const,
};

// ─── API Functions ────────────────────────────────────────────────────────────

export const listCampaigns = (query: CampaignQuery = {}, token?: string | null) => {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.status) params.set('status', query.status);
  const qs = params.toString();
  return apiFetch<CampaignsResponse>(`/api/v1/campaigns${qs ? `?${qs}` : ''}`, {
    accessToken: token ?? undefined,
  });
};

export const getCampaign = (id: string, token?: string | null) =>
  apiFetch<CampaignDetail>(`/api/v1/campaigns/${id}`, { accessToken: token ?? undefined });

export const createCampaign = (data: CreateCampaignInput, token?: string | null) =>
  apiFetch<Campaign>('/api/v1/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
    accessToken: token ?? undefined,
  });

export const updateCampaign = (id: string, data: UpdateCampaignInput, token?: string | null) =>
  apiFetch<Campaign>(`/api/v1/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    accessToken: token ?? undefined,
  });

export const deleteCampaign = (id: string, token?: string | null) =>
  apiFetch<void>(`/api/v1/campaigns/${id}`, {
    method: 'DELETE',
    accessToken: token ?? undefined,
  });

export const addCampaignContacts = (
  campaignId: string,
  personIds: string[],
  token?: string | null,
) =>
  apiFetch<{ added: number; total: number }>(`/api/v1/campaigns/${campaignId}/contacts`, {
    method: 'POST',
    body: JSON.stringify({ personIds }),
    accessToken: token ?? undefined,
  });

export const removeCampaignContact = (
  campaignId: string,
  personId: string,
  token?: string | null,
) =>
  apiFetch<void>(`/api/v1/campaigns/${campaignId}/contacts/${personId}`, {
    method: 'DELETE',
    accessToken: token ?? undefined,
  });

export const sendCampaign = (id: string, token?: string | null) =>
  apiFetch<void>(`/api/v1/campaigns/${id}/send`, {
    method: 'POST',
    accessToken: token ?? undefined,
  });

export const testSendCampaign = (id: string, token?: string | null) =>
  apiFetch<{ to: string; preview: string }>(`/api/v1/campaigns/${id}/test-send`, {
    method: 'POST',
    accessToken: token ?? undefined,
  });

export const getAiSubjects = (id: string, token?: string | null) =>
  apiFetch<AiSubjectSuggestion[]>(`/api/v1/campaigns/${id}/ai-subjects`, {
    method: 'POST',
    accessToken: token ?? undefined,
  });
