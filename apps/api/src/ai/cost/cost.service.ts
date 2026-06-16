import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@nextgen/db';
import { Queue } from 'bullmq';
import { addDays, startOfMonth } from 'date-fns';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_INSIGHT_TYPE, LEAD_ENRICHMENT_QUEUE } from '../ai.constants';

const WARN_RATIO = 0.9;

export type BudgetAction = 'ok' | 'warn' | 'paused' | 'resumed';

export interface BudgetStatus {
  spent: number;
  budget: number;
  ratio: number;
  action: BudgetAction;
}

@Injectable()
export class CostService {
  private readonly logger = new Logger(CostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @InjectQueue(LEAD_ENRICHMENT_QUEUE) private readonly enrichmentQueue: Queue,
  ) {}

  @Cron('0 7 * * *', { timeZone: 'UTC' })
  async dailyBudgetCheck(): Promise<void> {
    await this.checkBudget();
  }

  /**
   * Sums this month's enrichment cost and enforces the budget: pause the enrichment
   * queue at ≥100 %, auto-resume when back under (e.g. month rollover), warn at ≥90 %.
   */
  async checkBudget(): Promise<BudgetStatus> {
    const budget = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 100);
    const spent = await this.monthlySpend();
    const ratio = budget > 0 ? spent / budget : 0;
    let action: BudgetAction = 'ok';

    if (ratio >= 1) {
      if (!(await this.enrichmentQueue.isPaused())) await this.enrichmentQueue.pause();
      action = 'paused';
      await this.alert('paused', spent, budget, ratio);
    } else if (await this.enrichmentQueue.isPaused()) {
      await this.enrichmentQueue.resume();
      action = 'resumed';
      this.logger.warn(
        `AI budget back under limit ($${spent.toFixed(2)}/$${budget}) — enrichment resumed`,
      );
    } else if (ratio >= WARN_RATIO) {
      action = 'warn';
      await this.alert('warn', spent, budget, ratio);
    }

    return { spent, budget, ratio, action };
  }

  private async monthlySpend(): Promise<number> {
    const insights = await this.prisma.aIInsight.findMany({
      where: {
        type: AI_INSIGHT_TYPE.ENRICHMENT,
        deletedAt: null,
        createdAt: { gte: startOfMonth(new Date()) },
      },
      select: { content: true },
    });
    let total = 0;
    for (const i of insights) {
      const cost = (i.content as { cost?: { estCostUsd?: number } } | null)?.cost;
      if (cost && typeof cost.estCostUsd === 'number') total += cost.estCostUsd;
    }
    return Math.round(total * 1_000_000) / 1_000_000;
  }

  private async alert(
    action: 'warn' | 'paused',
    spent: number,
    budget: number,
    ratio: number,
  ): Promise<void> {
    const pct = Math.round(ratio * 100);
    const message =
      action === 'paused'
        ? `AI monthly budget exhausted: $${spent.toFixed(2)}/$${budget} (${pct}%). Enrichment queue paused.`
        : `AI monthly budget at ${pct}%: $${spent.toFixed(2)}/$${budget}.`;
    this.logger.error(message);
    await this.prisma.aIInsight.create({
      data: {
        type: AI_INSIGHT_TYPE.BUDGET_ALERT,
        content: { action, spent, budget, ratio, message } as unknown as Prisma.InputJsonValue,
        validUntil: addDays(new Date(), 30),
      },
    });
    await this.notifyAdmin(message);
  }

  private async notifyAdmin(message: string): Promise<void> {
    const to = process.env.AI_ALERT_EMAIL;
    if (!to) return;
    await this.mail
      .sendCampaignEmail(to, '[NextGen CRM] AI Budget Alert', `<p>${message}</p>`)
      .catch((err) => this.logger.warn(`budget alert mail failed: ${String(err)}`));
  }
}
