import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

const makeReport = () => ({
  labels: ['KW1', 'KW2'],
  datasets: [{ label: 'Test', data: [1, 2] }],
  summary: { total: 3 },
});

const serviceMock = {
  getReport: vi.fn(),
  getLatestLossInsight: vi.fn(),
  triggerLossAnalysis: vi.fn(),
};

describe('InsightsController', () => {
  let controller: InsightsController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [{ provide: InsightsService, useValue: serviceMock }],
    }).compile();
    controller = module.get(InsightsController);
  });

  describe('getReport', () => {
    it('delegates to service for valid type', async () => {
      serviceMock.getReport.mockResolvedValue(makeReport());
      const result = await controller.getReport('dealConversionRate', {});
      expect(serviceMock.getReport).toHaveBeenCalledWith('dealConversionRate', {});
      expect(result.labels).toBeDefined();
    });

    it('throws BadRequest for unknown type', async () => {
      await expect(controller.getReport('unknownType', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('passes query params to service', async () => {
      serviceMock.getReport.mockResolvedValue(makeReport());
      await controller.getReport('leadSources', { from: '2026-01-01', to: '2026-01-31' });
      expect(serviceMock.getReport).toHaveBeenCalledWith(
        'leadSources',
        expect.objectContaining({ from: '2026-01-01', to: '2026-01-31' }),
      );
    });

    it.each([
      'dealConversionRate',
      'revenueForecast',
      'activityPerformance',
      'wonVsLostDeals',
      'pipelineVelocity',
      'leadSources',
      'emailPerformance',
      'revenueByUser',
    ])('accepts valid type: %s', async (type) => {
      serviceMock.getReport.mockResolvedValue(makeReport());
      await expect(controller.getReport(type, {})).resolves.toBeDefined();
    });
  });

  describe('getLatestLossInsight', () => {
    it('delegates to service', async () => {
      const insight = {
        id: 'ins-1',
        type: 'loss_analysis',
        content: { reasons: [] },
        createdAt: new Date(),
      };
      serviceMock.getLatestLossInsight.mockResolvedValue(insight);
      const result = await controller.getLatestLossInsight();
      expect(result).toEqual(insight);
    });
  });

  describe('triggerLossAnalysis', () => {
    it('delegates to service', async () => {
      serviceMock.triggerLossAnalysis.mockResolvedValue({ id: 'ins-2' });
      const result = await controller.triggerLossAnalysis();
      expect(serviceMock.triggerLossAnalysis).toHaveBeenCalled();
      expect(result).toEqual({ id: 'ins-2' });
    });
  });
});
