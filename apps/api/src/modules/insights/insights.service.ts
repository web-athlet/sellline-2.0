import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@nextgen/db';
import {
  addDays,
  differenceInDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  format,
  startOfDay,
  subDays,
} from 'date-fns';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import type { QueryReportDto } from './dto/query-report.dto';

export interface ReportResult {
  labels: string[];
  datasets: { label: string; data: number[] }[];
  summary: Record<string, number | string>;
}

@Injectable()
export class InsightsService {
  private readonly openai: OpenAI | null;

  constructor(private readonly prisma: PrismaService) {
    this.openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private parseDateRange(dto: QueryReportDto): { from: Date; to: Date } {
    const to = dto.to ? endOfDay(new Date(dto.to)) : endOfDay(new Date());
    const from = dto.from ? startOfDay(new Date(dto.from)) : startOfDay(subDays(to, 30));
    return { from, to };
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async dealConversionRate(dto: QueryReportDto): Promise<ReportResult> {
    const { from, to } = this.parseDateRange(dto);
    const where = {
      deletedAt: null,
      createdAt: { gte: from, lte: to },
      ...(dto.pipelineId ? { pipelineId: dto.pipelineId } : {}),
      ...(dto.userId ? { ownerId: dto.userId } : {}),
    };

    const weeks = eachWeekOfInterval({ start: from, end: to });
    const wonCounts: number[] = [];
    const lostCounts: number[] = [];
    const openCounts: number[] = [];

    for (let i = 0; i < weeks.length; i++) {
      const wStart = weeks[i];
      const wEnd = weeks[i + 1] ?? to;
      const [won, lost, open] = await Promise.all([
        this.prisma.deal.count({
          where: { ...where, createdAt: { gte: wStart, lte: wEnd }, wonAt: { not: null } },
        }),
        this.prisma.deal.count({
          where: { ...where, createdAt: { gte: wStart, lte: wEnd }, lostAt: { not: null } },
        }),
        this.prisma.deal.count({
          where: { ...where, createdAt: { gte: wStart, lte: wEnd }, wonAt: null, lostAt: null },
        }),
      ]);
      wonCounts.push(won);
      lostCounts.push(lost);
      openCounts.push(open);
    }

    const totalWon = wonCounts.reduce((a, b) => a + b, 0);
    const totalClosed = totalWon + lostCounts.reduce((a, b) => a + b, 0);
    const conversionRate = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;

    return {
      labels: weeks.map((w) => format(w, 'dd.MM')),
      datasets: [
        { label: 'Gewonnen', data: wonCounts },
        { label: 'Verloren', data: lostCounts },
        { label: 'Offen', data: openCounts },
      ],
      summary: { conversionRate, totalWon, totalClosed },
    };
  }

  async revenueForecast(dto: QueryReportDto): Promise<ReportResult> {
    const today = new Date();
    const endDate = addDays(today, 90);
    const months = eachMonthOfInterval({ start: today, end: endDate });

    const deals = await this.prisma.deal.findMany({
      where: {
        deletedAt: null,
        wonAt: null,
        lostAt: null,
        closingDate: { gte: today, lte: endDate },
        ...(dto.pipelineId ? { pipelineId: dto.pipelineId } : {}),
        ...(dto.userId ? { ownerId: dto.userId } : {}),
      },
      select: { value: true, probability: true, closingDate: true },
    });

    const forecastData = months.map((m) => {
      const monthStr = format(m, 'yyyy-MM');
      return deals
        .filter((d) => d.closingDate && format(d.closingDate, 'yyyy-MM') === monthStr)
        .reduce((sum, d) => sum + (Number(d.value) * d.probability) / 100, 0);
    });

    const totalForecast = forecastData.reduce((a, b) => a + b, 0);

    return {
      labels: months.map((m) => format(m, 'MMM yyyy')),
      datasets: [{ label: 'Prognose (€)', data: forecastData.map(Math.round) }],
      summary: { totalForecast: Math.round(totalForecast), openDeals: deals.length },
    };
  }

  async activityPerformance(dto: QueryReportDto): Promise<ReportResult> {
    const { from, to } = this.parseDateRange(dto);
    const where = {
      deletedAt: null,
      createdAt: { gte: from, lte: to },
      ...(dto.userId ? { assigneeId: dto.userId } : {}),
    };

    const grouped = await this.prisma.activity.groupBy({
      by: ['type', 'done'],
      where,
      _count: { id: true },
    });

    const types = [...new Set(grouped.map((g) => g.type))];
    const doneData = types.map((t) => grouped.find((g) => g.type === t && g.done)?._count.id ?? 0);
    const pendingData = types.map(
      (t) => grouped.find((g) => g.type === t && !g.done)?._count.id ?? 0,
    );

    const totalDone = doneData.reduce((a, b) => a + b, 0);
    const total = totalDone + pendingData.reduce((a, b) => a + b, 0);
    const completionRate = total > 0 ? Math.round((totalDone / total) * 100) : 0;

    return {
      labels: types,
      datasets: [
        { label: 'Erledigt', data: doneData },
        { label: 'Ausstehend', data: pendingData },
      ],
      summary: { completionRate, totalDone, total },
    };
  }

  async wonVsLostDeals(dto: QueryReportDto): Promise<ReportResult> {
    const { from, to } = this.parseDateRange(dto);
    const baseWhere = {
      deletedAt: null,
      ...(dto.pipelineId ? { pipelineId: dto.pipelineId } : {}),
      ...(dto.userId ? { ownerId: dto.userId } : {}),
    };

    const weeks = eachWeekOfInterval({ start: from, end: to });
    const wonData: number[] = [];
    const lostData: number[] = [];

    for (let i = 0; i < weeks.length; i++) {
      const wStart = weeks[i];
      const wEnd = weeks[i + 1] ?? to;
      const [won, lost] = await Promise.all([
        this.prisma.deal.count({ where: { ...baseWhere, wonAt: { gte: wStart, lte: wEnd } } }),
        this.prisma.deal.count({ where: { ...baseWhere, lostAt: { gte: wStart, lte: wEnd } } }),
      ]);
      wonData.push(won);
      lostData.push(lost);
    }

    const totalWon = wonData.reduce((a, b) => a + b, 0);
    const totalLost = lostData.reduce((a, b) => a + b, 0);
    const winRate =
      totalWon + totalLost > 0 ? Math.round((totalWon / (totalWon + totalLost)) * 100) : 0;

    return {
      labels: weeks.map((w) => format(w, 'dd.MM')),
      datasets: [
        { label: 'Gewonnen', data: wonData },
        { label: 'Verloren', data: lostData },
      ],
      summary: { winRate, totalWon, totalLost },
    };
  }

  async pipelineVelocity(dto: QueryReportDto): Promise<ReportResult> {
    const { from, to } = this.parseDateRange(dto);

    const closedDeals = await this.prisma.deal.findMany({
      where: {
        deletedAt: null,
        closedAt: { gte: from, lte: to },
        ...(dto.pipelineId ? { pipelineId: dto.pipelineId } : {}),
        ...(dto.userId ? { ownerId: dto.userId } : {}),
      },
      select: {
        createdAt: true,
        closedAt: true,
        value: true,
        stage: { select: { name: true } },
      },
    });

    const stageMap = new Map<string, { totalDays: number; count: number; totalValue: number }>();
    for (const deal of closedDeals) {
      const stageName = deal.stage.name;
      const days = differenceInDays(deal.closedAt!, deal.createdAt);
      const existing = stageMap.get(stageName) ?? { totalDays: 0, count: 0, totalValue: 0 };
      stageMap.set(stageName, {
        totalDays: existing.totalDays + days,
        count: existing.count + 1,
        totalValue: existing.totalValue + Number(deal.value),
      });
    }

    const stages = [...stageMap.keys()];
    const avgDays = stages.map((s) => {
      const entry = stageMap.get(s)!;
      return Math.round(entry.totalDays / entry.count);
    });

    const overallAvg =
      closedDeals.length > 0
        ? Math.round(
            closedDeals.reduce((sum, d) => sum + differenceInDays(d.closedAt!, d.createdAt), 0) /
              closedDeals.length,
          )
        : 0;

    return {
      labels: stages,
      datasets: [{ label: 'Ø Tage bis Abschluss', data: avgDays }],
      summary: { overallAvgDays: overallAvg, closedDealsCount: closedDeals.length },
    };
  }

  async leadSources(dto: QueryReportDto): Promise<ReportResult> {
    const { from, to } = this.parseDateRange(dto);

    const grouped = await this.prisma.lead.groupBy({
      by: ['source'],
      where: { deletedAt: null, createdAt: { gte: from, lte: to } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const labels = grouped.map((g) => g.source);
    const data = grouped.map((g) => g._count.id);
    const total = data.reduce((a, b) => a + b, 0);

    return {
      labels,
      datasets: [{ label: 'Leads', data }],
      summary: {
        total,
        topSource: labels[0] ?? 'N/A',
        topSourceCount: data[0] ?? 0,
      },
    };
  }

  async emailPerformance(dto: QueryReportDto): Promise<ReportResult> {
    const { from, to } = this.parseDateRange(dto);

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        deletedAt: null,
        sentAt: { gte: from, lte: to },
        ...(dto.userId ? { senderId: dto.userId } : {}),
      },
      select: {
        name: true,
        totalRecipients: true,
        openCount: true,
        clickCount: true,
        bounceCount: true,
        unsubCount: true,
      },
      orderBy: { sentAt: 'asc' },
    });

    const labels = campaigns.map((c) => c.name);
    const openRates = campaigns.map((c) =>
      c.totalRecipients > 0 ? Math.round((c.openCount / c.totalRecipients) * 100) : 0,
    );
    const clickRates = campaigns.map((c) =>
      c.totalRecipients > 0 ? Math.round((c.clickCount / c.totalRecipients) * 100) : 0,
    );
    const bounceRates = campaigns.map((c) =>
      c.totalRecipients > 0 ? Math.round((c.bounceCount / c.totalRecipients) * 100) : 0,
    );

    const avgOpenRate =
      openRates.length > 0
        ? Math.round(openRates.reduce((a, b) => a + b, 0) / openRates.length)
        : 0;

    return {
      labels,
      datasets: [
        { label: 'Öffnungsrate (%)', data: openRates },
        { label: 'Klickrate (%)', data: clickRates },
        { label: 'Bounces (%)', data: bounceRates },
      ],
      summary: { avgOpenRate, campaignsCount: campaigns.length },
    };
  }

  async revenueByUser(dto: QueryReportDto): Promise<ReportResult> {
    const { from, to } = this.parseDateRange(dto);

    const deals = await this.prisma.deal.findMany({
      where: {
        deletedAt: null,
        wonAt: { gte: from, lte: to },
        ...(dto.pipelineId ? { pipelineId: dto.pipelineId } : {}),
      },
      select: {
        value: true,
        owner: { select: { id: true, name: true } },
      },
    });

    const userMap = new Map<string, { name: string; revenue: number; count: number }>();
    for (const deal of deals) {
      const existing = userMap.get(deal.owner.id) ?? {
        name: deal.owner.name,
        revenue: 0,
        count: 0,
      };
      userMap.set(deal.owner.id, {
        name: existing.name,
        revenue: existing.revenue + Number(deal.value),
        count: existing.count + 1,
      });
    }

    const sorted = [...userMap.values()].sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = sorted.reduce((sum, u) => sum + u.revenue, 0);

    return {
      labels: sorted.map((u) => u.name),
      datasets: [{ label: 'Umsatz (€)', data: sorted.map((u) => Math.round(u.revenue)) }],
      summary: {
        totalRevenue: Math.round(totalRevenue),
        topPerformer: sorted[0]?.name ?? 'N/A',
        wonDealsCount: deals.length,
      },
    };
  }

  // ── AI Loss Analysis ───────────────────────────────────────────────────────

  @Cron('0 9 * * 1', { timeZone: 'Europe/Berlin' })
  async weeklyLossAnalysis(): Promise<void> {
    await this.runLossAnalysis();
  }

  async triggerLossAnalysis(): Promise<{ type: string; content: unknown; createdAt: Date }> {
    return this.runLossAnalysis();
  }

  private async runLossAnalysis() {
    if (!this.openai) {
      return this.prisma.aIInsight.create({
        data: {
          type: 'loss_analysis',
          content: {
            reasons: [],
            error: 'OpenAI not configured (OPENAI_API_KEY missing)',
          },
          validUntil: addDays(new Date(), 7),
        },
      });
    }

    const lost = await this.prisma.deal.findMany({
      where: {
        lostAt: { gte: subDays(new Date(), 90) },
        deletedAt: null,
      },
      include: {
        activities: { where: { deletedAt: null }, select: { type: true, done: true } },
        emails: { select: { bodyPreview: true } },
      },
    });

    // DSGVO: keine E-Mail-Bodies, nur Metadaten + lostReason
    const payload = lost.map((d) => ({
      value: Number(d.value),
      lostReason: d.lostReason,
      daysInPipeline: differenceInDays(d.lostAt!, d.createdAt),
      activityCount: d.activities.length,
      emailCount: d.emails.length,
    }));

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: `Analysiere verlorene Deals und identifiziere 3 häufigste Verlustgründe mit konkreten Empfehlungen.
Daten: ${JSON.stringify(payload)}
JSON: { "reasons": [{ "pattern": "...", "count": N, "recommendation": "...", "priority": "high"|"medium"|"low" }] }`,
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0]!.message.content!) as Prisma.InputJsonValue;

    return this.prisma.aIInsight.create({
      data: {
        type: 'loss_analysis',
        content: raw,
        validUntil: addDays(new Date(), 7),
      },
    });
  }

  async getLatestLossInsight() {
    return this.prisma.aIInsight.findFirst({
      where: { type: 'loss_analysis' },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Dispatch ───────────────────────────────────────────────────────────────

  async getReport(type: string, dto: QueryReportDto): Promise<ReportResult> {
    switch (type) {
      case 'dealConversionRate':
        return this.dealConversionRate(dto);
      case 'revenueForecast':
        return this.revenueForecast(dto);
      case 'activityPerformance':
        return this.activityPerformance(dto);
      case 'wonVsLostDeals':
        return this.wonVsLostDeals(dto);
      case 'pipelineVelocity':
        return this.pipelineVelocity(dto);
      case 'leadSources':
        return this.leadSources(dto);
      case 'emailPerformance':
        return this.emailPerformance(dto);
      case 'revenueByUser':
        return this.revenueByUser(dto);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }
}
