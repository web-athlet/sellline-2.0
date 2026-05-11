import { apiFetch } from './api-client';

export interface DealOwner {
  id: string;
  name: string;
  email: string;
}

export interface DealOrgSummary {
  id: string;
  name: string;
}

export interface DealParticipant {
  id: string;
  firstName: string;
  lastName: string;
  emails?: string[];
}

export interface DealCard {
  id: string;
  title: string;
  value: string;
  currency: string;
  pipelineId: string;
  stageId: string;
  ownerId: string;
  orgId: string | null;
  probability: number;
  rotIndicator: boolean;
  ghostingSnoozedUntil: string | null;
  score: number;
  order: number;
  closingDate: string | null;
  closedAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  org: DealOrgSummary | null;
  owner: DealOwner;
  participants: DealParticipant[];
}

export interface DealDetail extends DealCard {
  pipeline: { id: string; name: string; rotThresholdDays: number };
  stage: { id: string; name: string; color: string | null; order: number };
  products: DealProductLine[];
  _count: { activities: number; emails: number };
}

export interface DealProductLine {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  discountType: 'PERCENT' | 'ABSOLUTE';
  taxPct: string;
  total: string;
  product: { id: string; name: string; code: string | null; unit: string | null };
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DealsResponse {
  data: DealCard[];
  meta: PaginatedMeta;
}

export interface Pipeline {
  id: string;
  name: string;
  rotThresholdDays: number;
  isDefault: boolean;
  stages: Stage[];
}

export interface Stage {
  id: string;
  name: string;
  color: string | null;
  order: number;
}

export interface PipelineStageSummary {
  id: string;
  name: string;
  color: string | null;
  order: number;
  count: number;
  totalValue: number;
  avgProbability: number;
  weightedValue: number;
}

export interface PipelineSummaryResponse {
  pipelineId: string;
  stages: PipelineStageSummary[];
}

export interface DealsQuery {
  page?: number;
  limit?: number;
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  orgId?: string;
  search?: string;
  rotIndicator?: boolean;
  view?: 'kanban' | 'list';
  sort?: string;
}

const buildQs = (params: Record<string, unknown> | DealsQuery) => {
  const qs = new URLSearchParams(
    Object.entries(params as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return qs ? `?${qs}` : '';
};

export async function listDeals(
  query: DealsQuery = {},
  accessToken?: string,
): Promise<DealsResponse> {
  return apiFetch<DealsResponse>(`/api/v1/deals${buildQs(query)}`, { accessToken });
}

export async function getDeal(id: string, accessToken?: string): Promise<DealDetail> {
  return apiFetch<DealDetail>(`/api/v1/deals/${id}`, { accessToken });
}

export interface CreateDealInput {
  title: string;
  value?: number;
  currency?: string;
  pipelineId: string;
  stageId: string;
  ownerId?: string;
  orgId?: string;
  probability?: number;
  closingDate?: string;
  participantIds?: string[];
}

export async function createDeal(data: CreateDealInput, accessToken?: string): Promise<DealCard> {
  return apiFetch<DealCard>('/api/v1/deals', {
    method: 'POST',
    body: JSON.stringify(data),
    accessToken,
  });
}

export async function updateDeal(
  id: string,
  data: Partial<CreateDealInput>,
  accessToken?: string,
): Promise<DealCard> {
  return apiFetch<DealCard>(`/api/v1/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    accessToken,
  });
}

export async function deleteDeal(id: string, accessToken?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/deals/${id}`, { method: 'DELETE', accessToken });
}

export async function changeDealStage(
  id: string,
  body: { stageId: string; order?: number },
  accessToken?: string,
): Promise<DealCard> {
  return apiFetch<DealCard>(`/api/v1/deals/${id}/stage`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    accessToken,
  });
}

export async function markDealWon(id: string, accessToken?: string): Promise<DealCard> {
  return apiFetch<DealCard>(`/api/v1/deals/${id}/won`, { method: 'POST', accessToken });
}

export async function markDealLost(
  id: string,
  lostReason: string,
  accessToken?: string,
): Promise<DealCard> {
  return apiFetch<DealCard>(`/api/v1/deals/${id}/lost`, {
    method: 'POST',
    body: JSON.stringify({ lostReason }),
    accessToken,
  });
}

export async function snoozeDealGhosting(
  id: string,
  days: number,
  accessToken?: string,
): Promise<DealCard> {
  return apiFetch<DealCard>(`/api/v1/deals/${id}/snooze-ghosting`, {
    method: 'POST',
    body: JSON.stringify({ days }),
    accessToken,
  });
}

export async function listPipelines(accessToken?: string): Promise<Pipeline[]> {
  return apiFetch<Pipeline[]>('/api/v1/pipelines', { accessToken });
}

export async function getPipelineSummary(
  pipelineId: string,
  accessToken?: string,
): Promise<PipelineSummaryResponse> {
  return apiFetch<PipelineSummaryResponse>(`/api/v1/pipelines/${pipelineId}/summary`, {
    accessToken,
  });
}

export const dealsKeys = {
  all: ['deals'] as const,
  list: (query: DealsQuery) => ['deals', 'list', query] as const,
  detail: (id: string) => ['deals', 'detail', id] as const,
  pipelines: () => ['pipelines'] as const,
  summary: (pipelineId: string) => ['pipelines', pipelineId, 'summary'] as const,
};
