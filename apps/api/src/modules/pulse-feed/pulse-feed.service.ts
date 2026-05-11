import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@nextgen/db';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PulseTab, QueryPulseFeedDto } from './dto/query-pulse-feed.dto';

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

export function calculatePriorityScore(params: {
  dealValue: number;
  dueDate: Date | null;
  activitiesLast7d: number;
  stageIndex: number;
  totalStages: number;
}): number {
  const dealValueScore = Math.min((params.dealValue / 10_000) * 30, 30);

  const now = new Date();
  const daysOverdue =
    params.dueDate !== null
      ? Math.max(0, (now.getTime() - params.dueDate.getTime()) / 86_400_000)
      : 0;
  const overdueScore = Math.min(daysOverdue * 20, 30);

  const activityDensityScore = Math.min(params.activitiesLast7d * 10, 30);

  const stageProgressScore =
    params.totalStages > 0 ? (params.stageIndex / params.totalStages) * 10 : 0;

  return Math.round(dealValueScore + overdueScore + activityDensityScore + stageProgressScore);
}

const CACHE_TTL = 30;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class PulseFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: EventsGateway,
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async getFeed(query: QueryPulseFeedDto, user: AuthenticatedUser): Promise<PulseFeedResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const tab = query.tab ?? PulseTab.FOLLOWUPS;
    const date = this.parseDate(query.date);

    const cacheKey = `pulse:${user.id}:${this.dateStr(date)}:${tab}:${page}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as PulseFeedResponse;

    const result = await this.buildFeed(tab, date, user.id, page, limit);
    await this.redis.set(cacheKey, JSON.stringify(result), CACHE_TTL);
    return result;
  }

  async getCounts(dateStr: string | undefined, user: AuthenticatedUser): Promise<PulseCounts> {
    const date = this.parseDate(dateStr);
    const cacheKey = `pulse:${user.id}:${this.dateStr(date)}:counts`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as PulseCounts;

    const sevenDaysAgo = new Date(date.getTime() - SEVEN_DAYS_MS);
    const endOfDay = endOfDayUTC(date);

    const [followups, missed, opportunities] = await Promise.all([
      this.prisma.activity.count({
        where: this.followupsWhere(user.id, endOfDay),
      }),
      this.prisma.deal.count({
        where: this.missedWhere(user.id, sevenDaysAgo),
      }),
      this.prisma.deal.count({
        where: this.opportunitiesWhere(user.id),
      }),
    ]);

    const counts: PulseCounts = { followups, missed, opportunities };
    await this.redis.set(cacheKey, JSON.stringify(counts), CACHE_TTL);
    return counts;
  }

  async completeActivity(activityId: string, user: AuthenticatedUser): Promise<void> {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, deletedAt: null },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.assigneeId !== user.id) throw new ForbiddenException('Not your activity');
    if (activity.done) return;

    await this.prisma.activity.update({
      where: { id: activityId },
      data: { done: true, doneAt: new Date() },
    });

    await this.invalidateForUser(user.id);
    this.events.emitPulseFeedUpdated(user.id, 'followups');
  }

  async invalidateForUser(userId: string): Promise<void> {
    await this.redis.delByPattern(`pulse:${userId}:*`);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async buildFeed(
    tab: PulseTab,
    date: Date,
    userId: string,
    page: number,
    limit: number,
  ): Promise<PulseFeedResponse> {
    const sevenDaysAgo = new Date(date.getTime() - SEVEN_DAYS_MS);
    const endOfDay = endOfDayUTC(date);
    const skip = (page - 1) * limit;

    switch (tab) {
      case PulseTab.FOLLOWUPS:
        return this.buildFollowups(userId, endOfDay, sevenDaysAgo, skip, limit);
      case PulseTab.MISSED:
        return this.buildMissed(userId, sevenDaysAgo, skip, limit);
      case PulseTab.OPPORTUNITIES:
        return this.buildOpportunities(userId, sevenDaysAgo, skip, limit);
    }
  }

  private async buildFollowups(
    userId: string,
    endOfDay: Date,
    sevenDaysAgo: Date,
    skip: number,
    limit: number,
  ): Promise<PulseFeedResponse> {
    const where = this.followupsWhere(userId, endOfDay);

    const [total, activities] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        include: {
          deal: {
            include: {
              stage: { select: { order: true } },
              owner: { select: { id: true, name: true } },
              org: { select: { id: true, name: true } },
              _count: {
                select: {
                  activities: {
                    where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    // Batch-load total stage counts per pipeline
    const pipelineIds = [
      ...new Set(activities.map((a) => a.deal?.pipelineId).filter((id): id is string => !!id)),
    ];
    const stageCountMap = await this.getStageCountMap(pipelineIds);

    const items: FeedItem[] = activities.map((activity) => {
      const deal = activity.deal;
      const dealValue = deal ? Number(deal.value) : 0;
      const dealStageIndex = deal?.stage.order ?? 0;
      const dealTotalStages = deal ? (stageCountMap[deal.pipelineId] ?? 6) : 6;
      const activitiesLast7d = deal?._count.activities ?? 0;

      const score = calculatePriorityScore({
        dealValue,
        dueDate: activity.dueDate,
        activitiesLast7d,
        stageIndex: dealStageIndex,
        totalStages: dealTotalStages,
      });

      return {
        id: `activity:${activity.id}`,
        activityId: activity.id,
        dealId: deal?.id ?? null,
        subject: activity.subject,
        activityType: activity.type,
        activityDone: activity.done,
        activityDueDate: activity.dueDate?.toISOString() ?? null,
        dealTitle: deal?.title ?? null,
        dealValue,
        dealCurrency: deal?.currency ?? 'EUR',
        dealStageIndex,
        dealTotalStages,
        dealOwnerId: deal?.owner.id ?? userId,
        dealOwnerName: deal?.owner.name ?? '',
        dealOrgName: deal?.org?.name ?? null,
        activitiesLast7d,
        priorityScore: score,
        isUrgent: score > 75,
      };
    });

    items.sort((a, b) => b.priorityScore - a.priorityScore);

    return { items, total, hasMore: skip + limit < total };
  }

  private async buildMissed(
    userId: string,
    sevenDaysAgo: Date,
    skip: number,
    limit: number,
  ): Promise<PulseFeedResponse> {
    const where = this.missedWhere(userId, sevenDaysAgo);

    const [total, deals] = await Promise.all([
      this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({
        where,
        include: {
          stage: { select: { order: true } },
          owner: { select: { id: true, name: true } },
          org: { select: { id: true, name: true } },
          _count: {
            select: {
              activities: { where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null } },
            },
          },
        },
        orderBy: { value: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const pipelineIds = [...new Set(deals.map((d) => d.pipelineId))];
    const stageCountMap = await this.getStageCountMap(pipelineIds);

    const items: FeedItem[] = deals.map((deal) => {
      const dealValue = Number(deal.value);
      const dealTotalStages = stageCountMap[deal.pipelineId] ?? 6;
      const activitiesLast7d = deal._count.activities;

      const score = calculatePriorityScore({
        dealValue,
        dueDate: deal.closingDate,
        activitiesLast7d,
        stageIndex: deal.stage.order,
        totalStages: dealTotalStages,
      });

      return {
        id: `deal:${deal.id}`,
        activityId: null,
        dealId: deal.id,
        subject: deal.title,
        activityType: null,
        activityDone: false,
        activityDueDate: null,
        dealTitle: deal.title,
        dealValue,
        dealCurrency: deal.currency,
        dealStageIndex: deal.stage.order,
        dealTotalStages,
        dealOwnerId: deal.owner.id,
        dealOwnerName: deal.owner.name,
        dealOrgName: deal.org?.name ?? null,
        activitiesLast7d,
        priorityScore: score,
        isUrgent: score > 75,
      };
    });

    items.sort((a, b) => b.priorityScore - a.priorityScore);
    return { items, total, hasMore: skip + limit < total };
  }

  private async buildOpportunities(
    userId: string,
    sevenDaysAgo: Date,
    skip: number,
    limit: number,
  ): Promise<PulseFeedResponse> {
    const where = this.opportunitiesWhere(userId);

    const [total, deals] = await Promise.all([
      this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({
        where,
        include: {
          stage: { select: { order: true } },
          owner: { select: { id: true, name: true } },
          org: { select: { id: true, name: true } },
          _count: {
            select: {
              activities: { where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null } },
            },
          },
        },
        orderBy: [{ probability: 'desc' }, { value: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const pipelineIds = [...new Set(deals.map((d) => d.pipelineId))];
    const stageCountMap = await this.getStageCountMap(pipelineIds);

    const items: FeedItem[] = deals.map((deal) => {
      const dealValue = Number(deal.value);
      const dealTotalStages = stageCountMap[deal.pipelineId] ?? 6;
      const activitiesLast7d = deal._count.activities;

      const score = calculatePriorityScore({
        dealValue,
        dueDate: deal.closingDate,
        activitiesLast7d,
        stageIndex: deal.stage.order,
        totalStages: dealTotalStages,
      });

      return {
        id: `deal:${deal.id}`,
        activityId: null,
        dealId: deal.id,
        subject: deal.title,
        activityType: null,
        activityDone: false,
        activityDueDate: null,
        dealTitle: deal.title,
        dealValue,
        dealCurrency: deal.currency,
        dealStageIndex: deal.stage.order,
        dealTotalStages,
        dealOwnerId: deal.owner.id,
        dealOwnerName: deal.owner.name,
        dealOrgName: deal.org?.name ?? null,
        activitiesLast7d,
        priorityScore: score,
        isUrgent: score > 75,
      };
    });

    items.sort((a, b) => b.priorityScore - a.priorityScore);
    return { items, total, hasMore: skip + limit < total };
  }

  private followupsWhere(userId: string, endOfDay: Date): Prisma.ActivityWhereInput {
    return {
      assigneeId: userId,
      done: false,
      deletedAt: null,
      dueDate: { lte: endOfDay },
    };
  }

  private missedWhere(userId: string, sevenDaysAgo: Date): Prisma.DealWhereInput {
    return {
      ownerId: userId,
      deletedAt: null,
      wonAt: null,
      lostAt: null,
      OR: [
        { rotIndicator: true },
        {
          activities: {
            none: { deletedAt: null, createdAt: { gte: sevenDaysAgo } },
          },
        },
      ],
    };
  }

  private opportunitiesWhere(userId: string): Prisma.DealWhereInput {
    return {
      ownerId: userId,
      deletedAt: null,
      wonAt: null,
      lostAt: null,
      probability: { gt: 60 },
      stage: { name: { not: 'Vertrag unterschrieben' } },
    };
  }

  private async getStageCountMap(pipelineIds: string[]): Promise<Record<string, number>> {
    if (pipelineIds.length === 0) return {};
    const rows = await this.prisma.stage.groupBy({
      by: ['pipelineId'],
      where: { pipelineId: { in: pipelineIds }, deletedAt: null },
      _count: true,
    });
    return Object.fromEntries(rows.map((r) => [r.pipelineId, r._count]));
  }

  private parseDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) throw new BadRequestException('Invalid date, expected YYYY-MM-DD');
    return d;
  }

  private dateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}

function endOfDayUTC(d: Date): Date {
  const eod = new Date(d);
  eod.setUTCHours(23, 59, 59, 999);
  return eod;
}
