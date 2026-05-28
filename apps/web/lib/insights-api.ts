import { apiFetch } from './api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportDataset {
  label: string;
  data: number[];
}

export interface ReportResult {
  labels: string[];
  datasets: ReportDataset[];
  summary: Record<string, number | string>;
}

export type ReportType =
  | 'dealConversionRate'
  | 'revenueForecast'
  | 'activityPerformance'
  | 'wonVsLostDeals'
  | 'pipelineVelocity'
  | 'leadSources'
  | 'emailPerformance'
  | 'revenueByUser';

export interface ReportQuery {
  from?: string;
  to?: string;
  pipelineId?: string;
  userId?: string;
}

export interface LossReason {
  pattern: string;
  count: number;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}

export interface LossInsight {
  id: string;
  type: string;
  content: { reasons: LossReason[]; error?: string };
  validUntil: string | null;
  createdAt: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const insightsKeys = {
  report: (type: ReportType, query: ReportQuery) => ['insights', 'reports', type, query] as const,
  lossInsight: () => ['insights', 'loss-analysis'] as const,
};

// ─── API Functions ────────────────────────────────────────────────────────────

const buildQs = (query: ReportQuery) => {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.pipelineId) params.set('pipelineId', query.pipelineId);
  if (query.userId) params.set('userId', query.userId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const getReport = (type: ReportType, query: ReportQuery, accessToken?: string) =>
  apiFetch<ReportResult>(`/api/v1/insights/reports/${type}${buildQs(query)}`, { accessToken });

export const getLossInsight = (accessToken?: string) =>
  apiFetch<LossInsight | null>('/api/v1/insights/loss-analysis', { accessToken });

export const triggerLossAnalysis = (accessToken?: string) =>
  apiFetch<LossInsight>('/api/v1/insights/loss-analysis/trigger', {
    method: 'POST',
    accessToken,
  });
