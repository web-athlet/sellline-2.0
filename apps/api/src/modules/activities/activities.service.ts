import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ActivityType, Prisma, Role } from '@nextgen/db';
import { Queue } from 'bullmq';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { PulseFeedService } from '../pulse-feed/pulse-feed.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CheckConflictsDto } from './dto/check-conflicts.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ActivityFilter, QueryActivitiesDto } from './dto/query-activities.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

export const DEAL_SCORING_QUEUE = 'deal-scoring';

const ACTIVITY_SELECT = {
  id: true,
  type: true,
  subject: true,
  notes: true,
  dueDate: true,
  startTime: true,
  endTime: true,
  done: true,
  doneAt: true,
  priority: true,
  dealId: true,
  personId: true,
  orgId: true,
  assigneeId: true,
  createdAt: true,
  updatedAt: true,
  deal: { select: { id: true, title: true, value: true, currency: true } },
  person: { select: { id: true, firstName: true, lastName: true } },
  org: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ActivitySelect;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly pulseFeed: PulseFeedService,
    @InjectQueue(DEAL_SCORING_QUEUE) private readonly scoringQueue: Queue,
  ) {}

  // ── Queries ────────────────────────────────────────────────────────────────

  async findAll(query: QueryActivitiesDto) {
    const { page = 1, limit = 50, filter, type, dealId, personId, assigneeId, from, to } = query;

    const dateFilter = this.buildDateFilter(filter, from, to);

    const where: Prisma.ActivityWhereInput = {
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(dealId ? { dealId } : {}),
      ...(personId ? { personId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...dateFilter,
    };

    const [total, activities] = await this.prisma.$transaction([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        select: ACTIVITY_SELECT,
      }),
    ]);

    return {
      data: activities,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, deletedAt: null },
      select: ACTIVITY_SELECT,
    });
    if (!activity) throw new NotFoundException(`Activity ${id} not found`);
    const canView =
      activity.assigneeId === user.id || user.role === Role.ADMIN || user.role === Role.MANAGER;
    if (!canView) {
      throw new ForbiddenException(
        'Only the assignee, a manager, or an admin can view this activity',
      );
    }
    return activity;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  async create(dto: CreateActivityDto, user: AuthenticatedUser) {
    if (dto.type === ActivityType.MEETING && dto.startTime && dto.endTime) {
      const conflicts = await this.checkConflictsInternal(
        dto.assigneeId ?? user.id,
        new Date(dto.startTime),
        new Date(dto.endTime),
      );
      if (conflicts.length > 0) {
        throw new BadRequestException({
          message: 'Terminkollision erkannt',
          conflicts: conflicts.map((c) => ({
            id: c.id,
            subject: c.subject,
            startTime: c.startTime,
            endTime: c.endTime,
          })),
        });
      }
    }

    const activity = await this.prisma.activity.create({
      data: {
        type: dto.type,
        subject: dto.subject,
        notes: dto.notes ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        endTime: dto.endTime ? new Date(dto.endTime) : null,
        priority: dto.priority ?? 'NORMAL',
        dealId: dto.dealId ?? null,
        personId: dto.personId ?? null,
        orgId: dto.orgId ?? null,
        assigneeId: dto.assigneeId ?? user.id,
      },
      select: ACTIVITY_SELECT,
    });

    await this.audit(user.id, 'activity.create', activity.id, null);
    this.events.emitActivityCreated({
      userId: user.id,
      activityId: activity.id,
      dealId: activity.dealId,
      ts: Date.now(),
    });
    return activity;
  }

  async update(id: string, dto: UpdateActivityDto, user: AuthenticatedUser) {
    await this.assertEditable(id, user);

    if (dto.type === ActivityType.MEETING && dto.startTime && dto.endTime) {
      const conflicts = await this.checkConflictsInternal(
        dto.assigneeId ?? user.id,
        new Date(dto.startTime),
        new Date(dto.endTime),
        id,
      );
      if (conflicts.length > 0) {
        throw new BadRequestException({
          message: 'Terminkollision erkannt',
          conflicts: conflicts.map((c) => ({
            id: c.id,
            subject: c.subject,
            startTime: c.startTime,
            endTime: c.endTime,
          })),
        });
      }
    }

    const activity = await this.prisma.activity.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.startTime !== undefined
          ? { startTime: dto.startTime ? new Date(dto.startTime) : null }
          : {}),
        ...(dto.endTime !== undefined
          ? { endTime: dto.endTime ? new Date(dto.endTime) : null }
          : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.dealId !== undefined ? { dealId: dto.dealId } : {}),
        ...(dto.personId !== undefined ? { personId: dto.personId } : {}),
        ...(dto.orgId !== undefined ? { orgId: dto.orgId } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
      },
      select: ACTIVITY_SELECT,
    });

    await this.audit(user.id, 'activity.update', id, null);
    this.events.emitActivityUpdated({
      userId: user.id,
      activityId: id,
      dealId: activity.dealId,
      ts: Date.now(),
    });
    return activity;
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.assertEditable(id, user);
    await this.prisma.activity.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(user.id, 'activity.delete', id, null);
  }

  async markDone(id: string, user: AuthenticatedUser) {
    const existing = await this.assertEditable(id, user);
    if (existing.done) throw new BadRequestException('Activity is already marked as done');

    const now = new Date();
    const activity = await this.prisma.activity.update({
      where: { id },
      data: { done: true, doneAt: now },
      select: ACTIVITY_SELECT,
    });

    await this.audit(user.id, 'activity.done', id, { doneAt: now.toISOString() });

    // Debounced deal-scoring job (60 s window, dedup by jobId)
    if (activity.dealId) {
      await this.scoringQueue.add(
        'score-deal',
        { dealId: activity.dealId, triggeredBy: user.id },
        {
          jobId: `scoring-${activity.dealId}`,
          delay: 60_000,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }

    // Invalidate Pulse-Feed cache + emit WS
    await this.pulseFeed.invalidateForUser(user.id);
    this.events.emitActivityCompleted({
      userId: user.id,
      activityId: id,
      dealId: activity.dealId,
      ts: Date.now(),
    });

    return activity;
  }

  // ── Conflict Detection ─────────────────────────────────────────────────────

  async checkConflicts(dto: CheckConflictsDto, user: AuthenticatedUser) {
    const conflicts = await this.checkConflictsInternal(
      user.id,
      new Date(dto.startTime),
      new Date(dto.endTime),
      dto.excludeId,
    );
    return {
      conflicts: conflicts.map((c) => ({
        id: c.id,
        subject: c.subject,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
    };
  }

  private async checkConflictsInternal(userId: string, start: Date, end: Date, excludeId?: string) {
    return this.prisma.activity.findMany({
      where: {
        assigneeId: userId,
        type: ActivityType.MEETING,
        deletedAt: null,
        done: false,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
      select: { id: true, subject: true, startTime: true, endTime: true },
    });
  }

  // ── Date Filter Builder ────────────────────────────────────────────────────

  private buildDateFilter(
    filter?: ActivityFilter,
    from?: string,
    to?: string,
  ): Prisma.ActivityWhereInput {
    if (!filter) return {};

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    switch (filter) {
      case ActivityFilter.TODO:
        return { dueDate: { gte: todayStart }, done: false };

      case ActivityFilter.OVERDUE:
        return { dueDate: { lt: todayStart }, done: false };

      case ActivityFilter.TODAY:
        return { dueDate: { gte: todayStart, lte: todayEnd } };

      case ActivityFilter.TOMORROW: {
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setHours(23, 59, 59, 999);
        return { dueDate: { gte: tomorrowStart, lte: tomorrowEnd } };
      }

      case ActivityFilter.THIS_WEEK: {
        const weekStart = this.getWeekStart(now, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { dueDate: { gte: weekStart, lte: weekEnd } };
      }

      case ActivityFilter.NEXT_WEEK: {
        const nextWeekStart = this.getWeekStart(now, 1);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
        nextWeekEnd.setHours(23, 59, 59, 999);
        return { dueDate: { gte: nextWeekStart, lte: nextWeekEnd } };
      }

      case ActivityFilter.RANGE: {
        if (!from || !to)
          throw new BadRequestException('from and to are required for range filter');
        return { dueDate: { gte: new Date(from), lte: new Date(to) } };
      }

      default:
        return {};
    }
  }

  private getWeekStart(date: Date, weekOffset: number): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Monday-based week (ISO 8601)
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday + weekOffset * 7);
    return d;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async assertEditable(id: string, user: AuthenticatedUser) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, assigneeId: true, done: true, dealId: true },
    });
    if (!activity) throw new NotFoundException(`Activity ${id} not found`);
    const canEdit =
      activity.assigneeId === user.id || user.role === Role.ADMIN || user.role === Role.MANAGER;
    if (!canEdit) {
      throw new ForbiddenException(
        'Only the assignee, a manager, or an admin can modify this activity',
      );
    }
    return activity;
  }

  private async audit(
    userId: string,
    action: string,
    recordId: string,
    changes: Prisma.JsonValue | null,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { userId, action, tableName: 'Activity', recordId, changes: changes ?? Prisma.DbNull },
    });
  }
}
