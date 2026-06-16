import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@nextgen/db';
import { addDays, differenceInDays, formatDistanceToNow, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_INSIGHT_TYPE } from '../ai.constants';

const GHOSTING_DAYS = 14;
const GHOST_FOLLOWUP_PREFIX = 'Ghosting-Follow-up';

@Injectable()
export class GhostingService {
  private readonly logger = new Logger(GhostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  @Cron('0 6 * * *', { timeZone: 'UTC' })
  async detectGhostingCron(): Promise<void> {
    const count = await this.detectGhosting();
    this.logger.log(`ghosting scan complete: ${count} deal(s) newly flagged`);
  }

  /** Marks open deals silent for ≥14 days as ghosted, creating one follow-up task each. */
  async detectGhosting(): Promise<number> {
    const now = new Date();
    const threshold = subDays(now, GHOSTING_DAYS);
    const finalStageIds = await this.finalStageIds();

    const candidates = await this.prisma.deal.findMany({
      where: {
        deletedAt: null,
        wonAt: null,
        lostAt: null,
        stageId: { notIn: finalStageIds },
        OR: [{ ghostingSnoozedUntil: null }, { ghostingSnoozedUntil: { lt: now } }],
      },
      select: {
        id: true,
        title: true,
        ownerId: true,
        pipelineId: true,
        createdAt: true,
        ghostedAt: true,
        activities: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, doneAt: true },
        },
        emails: {
          where: { isSent: false, deletedAt: null },
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { sentAt: true },
        },
      },
    });

    let flagged = 0;
    for (const deal of candidates) {
      const lastTouch = this.lastTouch(deal);
      if (lastTouch >= threshold) continue; // still active
      if (deal.ghostedAt) continue; // already flagged in a previous run → idempotent

      const daysSilent = differenceInDays(now, lastTouch);
      await this.prisma.deal.update({ where: { id: deal.id }, data: { ghostedAt: now } });
      await this.ensureFollowupTask(deal.id, deal.title, deal.ownerId, lastTouch, daysSilent);
      await this.prisma.aIInsight.create({
        data: {
          type: AI_INSIGHT_TYPE.GHOSTING,
          content: { dealId: deal.id, daysSilent } as unknown as Prisma.InputJsonValue,
          validUntil: addDays(now, 30),
        },
      });
      this.events.emitDealUpdated({
        dealId: deal.id,
        pipelineId: deal.pipelineId,
        userId: null,
        ts: Date.now(),
      });
      flagged++;
    }
    return flagged;
  }

  /** Final stage per pipeline = the stage with the highest `order` (not ghostable). */
  private async finalStageIds(): Promise<string[]> {
    const stages = await this.prisma.stage.findMany({
      where: { deletedAt: null },
      select: { id: true, pipelineId: true, order: true },
    });
    const maxOrder = new Map<string, number>();
    for (const s of stages) {
      maxOrder.set(s.pipelineId, Math.max(maxOrder.get(s.pipelineId) ?? -1, s.order));
    }
    return stages.filter((s) => s.order === maxOrder.get(s.pipelineId)).map((s) => s.id);
  }

  private lastTouch(deal: {
    createdAt: Date;
    activities: { createdAt: Date; doneAt: Date | null }[];
    emails: { sentAt: Date }[];
  }): Date {
    const times = [deal.createdAt];
    const act = deal.activities[0];
    if (act) times.push(act.doneAt ?? act.createdAt);
    const email = deal.emails[0];
    if (email) times.push(email.sentAt);
    return new Date(Math.max(...times.map((t) => t.getTime())));
  }

  private async ensureFollowupTask(
    dealId: string,
    title: string,
    ownerId: string,
    lastTouch: Date,
    daysSilent: number,
  ): Promise<void> {
    const existing = await this.prisma.activity.findFirst({
      where: {
        dealId,
        type: 'TASK',
        done: false,
        deletedAt: null,
        subject: { startsWith: GHOST_FOLLOWUP_PREFIX },
      },
      select: { id: true },
    });
    if (existing) return;

    await this.prisma.activity.create({
      data: {
        type: 'TASK',
        subject: `${GHOST_FOLLOWUP_PREFIX}: ${title}`,
        notes: `Seit ${formatDistanceToNow(lastTouch, { locale: de })} ohne Antwort (${daysSilent} Tage).`,
        priority: 'HIGH',
        dueDate: addDays(new Date(), 1),
        assigneeId: ownerId,
        dealId,
      },
    });
  }
}
