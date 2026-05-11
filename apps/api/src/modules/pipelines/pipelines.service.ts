import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.pipeline.findMany({
      where: { deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        stages: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          select: { id: true, name: true, color: true, order: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, deletedAt: null },
      include: {
        stages: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          select: { id: true, name: true, color: true, order: true },
        },
      },
    });
    if (!pipeline) throw new NotFoundException(`Pipeline ${id} not found`);
    return pipeline;
  }

  /**
   * Server-side aggregates per stage. Computed in SQL (groupBy) to keep the
   * Trust Boundary intact — clients never see the underlying deal-value rows
   * and cannot manipulate totals.
   */
  async summary(id: string): Promise<{ pipelineId: string; stages: PipelineStageSummary[] }> {
    const pipeline = await this.findOne(id);

    // Only deals that are still open (closedAt IS NULL) contribute to the
    // "forecast" totals shown above each Kanban column.
    const grouped = await this.prisma.deal.groupBy({
      by: ['stageId'],
      where: { pipelineId: id, deletedAt: null, closedAt: null },
      _count: { _all: true },
      _sum: { value: true },
      _avg: { probability: true },
    });

    const byStageId = new Map(grouped.map((row) => [row.stageId, row]));

    const stages: PipelineStageSummary[] = pipeline.stages.map((stage) => {
      const row = byStageId.get(stage.id);
      const totalValue = row?._sum.value ? Number(row._sum.value) : 0;
      const avgProbability = row?._avg.probability ? Number(row._avg.probability) : 0;
      return {
        id: stage.id,
        name: stage.name,
        color: stage.color,
        order: stage.order,
        count: row?._count._all ?? 0,
        totalValue,
        avgProbability: Math.round(avgProbability * 10) / 10,
        weightedValue: Math.round(((totalValue * avgProbability) / 100) * 100) / 100,
      };
    });

    return { pipelineId: id, stages };
  }
}
