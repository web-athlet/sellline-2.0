import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@nextgen/db';
import { PulseTab } from './dto/query-pulse-feed.dto';
import { PulseFeedController } from './pulse-feed.controller';
import { PulseFeedService } from './pulse-feed.service';

const mockService = {
  getFeed: vi.fn(),
  getCounts: vi.fn(),
  completeActivity: vi.fn(),
};

const user = { id: 'user-1', email: 'u@e.de', role: Role.SALES_REP, twoFactorEnabled: false };
const emptyFeed = { items: [], total: 0, hasMore: false };

describe('PulseFeedController', () => {
  let controller: PulseFeedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PulseFeedController],
      providers: [{ provide: PulseFeedService, useValue: mockService }],
    }).compile();

    controller = module.get<PulseFeedController>(PulseFeedController);
    vi.clearAllMocks();
  });

  describe('getFeed', () => {
    it('returns feed for followups tab', async () => {
      mockService.getFeed.mockResolvedValue(emptyFeed);
      const result = await controller.getFeed({ tab: PulseTab.FOLLOWUPS }, user);
      expect(result).toEqual(emptyFeed);
      expect(mockService.getFeed).toHaveBeenCalledWith({ tab: PulseTab.FOLLOWUPS }, user);
    });

    it('propagates service errors', async () => {
      mockService.getFeed.mockRejectedValue(new BadRequestException('bad date'));
      await expect(controller.getFeed({ date: 'bad' }, user)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCounts', () => {
    it('returns counts', async () => {
      const counts = { followups: 3, missed: 1, opportunities: 5 };
      mockService.getCounts.mockResolvedValue(counts);
      const result = await controller.getCounts('2026-05-11', user);
      expect(result).toEqual(counts);
    });
  });

  describe('completeActivity', () => {
    it('calls service and returns void', async () => {
      mockService.completeActivity.mockResolvedValue(undefined);
      await controller.completeActivity('550e8400-e29b-41d4-a716-446655440000', user);
      expect(mockService.completeActivity).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        user,
      );
    });

    it('propagates NotFoundException', async () => {
      mockService.completeActivity.mockRejectedValue(new NotFoundException());
      await expect(
        controller.completeActivity('550e8400-e29b-41d4-a716-446655440000', user),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
