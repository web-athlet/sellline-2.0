import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from './api-client';
import { getLossInsight, getReport, insightsKeys, triggerLossAnalysis } from './insights-api';

vi.mock('./api-client', () => ({
  apiFetch: vi.fn(),
}));

const apiFetch = vi.mocked(apiClient.apiFetch);

const makeReport = () => ({
  labels: ['KW1', 'KW2'],
  datasets: [{ label: 'Test', data: [1, 2] }],
  summary: { total: 3 },
});

const makeInsight = () => ({
  id: 'ins-1',
  type: 'loss_analysis',
  content: {
    reasons: [
      { pattern: 'Price', count: 5, recommendation: 'Improve pricing', priority: 'high' as const },
    ],
  },
  validUntil: '2026-06-05T09:00:00.000Z',
  createdAt: '2026-05-29T09:00:00.000Z',
});

describe('insights-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getReport', () => {
    it('calls correct endpoint for each report type', async () => {
      apiFetch.mockResolvedValue(makeReport());
      await getReport('dealConversionRate', {});
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/insights/reports/dealConversionRate',
        expect.any(Object),
      );
    });

    it('appends from/to query params', async () => {
      apiFetch.mockResolvedValue(makeReport());
      await getReport('leadSources', { from: '2026-01-01', to: '2026-01-31' });
      const url = apiFetch.mock.calls[0]?.[0];
      expect(url).toContain('from=2026-01-01');
      expect(url).toContain('to=2026-01-31');
    });

    it('appends pipelineId and userId when provided', async () => {
      apiFetch.mockResolvedValue(makeReport());
      await getReport('revenueByUser', { pipelineId: 'pipe-1', userId: 'user-1' });
      const url = apiFetch.mock.calls[0]?.[0];
      expect(url).toContain('pipelineId=pipe-1');
      expect(url).toContain('userId=user-1');
    });

    it('omits empty query string when no params', async () => {
      apiFetch.mockResolvedValue(makeReport());
      await getReport('wonVsLostDeals', {});
      const url = apiFetch.mock.calls[0]?.[0];
      expect(url).not.toContain('?');
    });

    it('passes accessToken to apiFetch', async () => {
      apiFetch.mockResolvedValue(makeReport());
      await getReport('emailPerformance', {}, 'tok-123');
      expect(apiFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ accessToken: 'tok-123' }),
      );
    });
  });

  describe('getLossInsight', () => {
    it('calls correct endpoint', async () => {
      apiFetch.mockResolvedValue(makeInsight());
      await getLossInsight('tok-abc');
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/insights/loss-analysis',
        expect.objectContaining({ accessToken: 'tok-abc' }),
      );
    });

    it('returns null when no insight', async () => {
      apiFetch.mockResolvedValue(null);
      const result = await getLossInsight();
      expect(result).toBeNull();
    });
  });

  describe('triggerLossAnalysis', () => {
    it('calls POST endpoint', async () => {
      apiFetch.mockResolvedValue(makeInsight());
      await triggerLossAnalysis('tok-xyz');
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/insights/loss-analysis/trigger',
        expect.objectContaining({ method: 'POST', accessToken: 'tok-xyz' }),
      );
    });
  });

  describe('insightsKeys', () => {
    it('generates stable query keys', () => {
      const key = insightsKeys.report('dealConversionRate', { from: '2026-01-01' });
      expect(key).toEqual(['insights', 'reports', 'dealConversionRate', { from: '2026-01-01' }]);
    });

    it('generates loss insight key', () => {
      expect(insightsKeys.lossInsight()).toEqual(['insights', 'loss-analysis']);
    });
  });
});
