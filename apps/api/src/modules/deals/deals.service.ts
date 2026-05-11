import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@nextgen/db';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ChangeStageDto } from './dto/change-stage.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { LostDealDto } from './dto/lost-deal.dto';
import { QueryDealsDto } from './dto/query-deals.dto';
import { SnoozeGhostingDto } from './dto/snooze-ghosting.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { UpsertDealProductDto } from './dto/upsert-deal-product.dto';

// Deal-card selection used by every list/kanban response. Keeps payload tight
// and avoids leaking unrelated columns (e.g. internal scoreUpdatedAt). The web
// `Deal` type mirrors this shape.
const DEAL_LIST_SELECT = {
  id: true,
  title: true,
  value: true,
  currency: true,
  pipelineId: true,
  stageId: true,
  ownerId: true,
  orgId: true,
  probability: true,
  rotIndicator: true,
  ghostingSnoozedUntil: true,
  score: true,
  order: true,
  closingDate: true,
  closedAt: true,
  wonAt: true,
  lostAt: true,
  lostReason: true,
  createdAt: true,
  updatedAt: true,
  org: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  participants: {
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.DealSelect;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  // ── Queries ────────────────────────────────────────────────────────────────

  async findAll(query: QueryDealsDto) {
    const {
      page = 1,
      limit = 50,
      pipelineId,
      stageId,
      ownerId,
      orgId,
      search,
      rotIndicator,
      sort,
    } = query;

    const where: Prisma.DealWhereInput = {
      deletedAt: null,
      ...(pipelineId ? { pipelineId } : {}),
      ...(stageId ? { stageId } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(orgId ? { orgId } : {}),
      ...(rotIndicator !== undefined ? { rotIndicator: rotIndicator === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { org: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const orderBy = this.buildOrderBy(sort);
    const skip = (page - 1) * limit;

    const [total, deals] = await this.prisma.$transaction([
      this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: DEAL_LIST_SELECT,
      }),
    ]);

    return {
      data: deals,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, deletedAt: null },
      include: {
        org: { select: { id: true, name: true, domain: true } },
        owner: { select: { id: true, name: true, email: true } },
        pipeline: { select: { id: true, name: true, rotThresholdDays: true } },
        stage: { select: { id: true, name: true, color: true, order: true } },
        participants: {
          where: { deletedAt: null },
          select: { id: true, firstName: true, lastName: true, emails: true },
        },
        products: {
          include: { product: { select: { id: true, name: true, code: true, unit: true } } },
        },
        _count: {
          select: {
            activities: { where: { deletedAt: null } },
            emails: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!deal) throw new NotFoundException(`Deal ${id} not found`);
    return deal;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  async create(dto: CreateDealDto, user: AuthenticatedUser) {
    await this.assertStageInPipeline(dto.stageId, dto.pipelineId);

    // Server picks the next free `order` in the target column. Clients cannot
    // game this — if two creates race, both still land in the same column with
    // distinct sequential orders.
    const maxOrder = await this.prisma.deal.aggregate({
      where: { stageId: dto.stageId, deletedAt: null },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const deal = await this.prisma.deal.create({
      data: {
        title: dto.title,
        value: dto.value ?? 0,
        currency: dto.currency ?? 'EUR',
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        ownerId: dto.ownerId ?? user.id,
        orgId: dto.orgId ?? null,
        probability: dto.probability ?? 0,
        closingDate: dto.closingDate ? new Date(dto.closingDate) : null,
        order: nextOrder,
        ...(dto.participantIds?.length
          ? { participants: { connect: dto.participantIds.map((id) => ({ id })) } }
          : {}),
      },
      select: DEAL_LIST_SELECT,
    });

    await this.audit(user.id, 'deal.create', deal.id, { stageId: deal.stageId });
    this.events.emitDealCreated({
      ts: Date.now(),
      userId: user.id,
      dealId: deal.id,
      pipelineId: deal.pipelineId,
      stageId: deal.stageId,
    });
    return deal;
  }

  async update(id: string, dto: UpdateDealDto, user: AuthenticatedUser) {
    const existing = await this.assertEditable(id, user);
    if (dto.stageId && dto.stageId !== existing.stageId) {
      throw new BadRequestException(
        'Stage changes must go through PATCH /deals/:id/stage (preserves order + audit).',
      );
    }

    const deal = await this.prisma.deal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
        ...(dto.orgId !== undefined ? { orgId: dto.orgId } : {}),
        ...(dto.probability !== undefined ? { probability: dto.probability } : {}),
        ...(dto.closingDate !== undefined
          ? { closingDate: dto.closingDate ? new Date(dto.closingDate) : null }
          : {}),
        ...(dto.participantIds
          ? { participants: { set: dto.participantIds.map((id) => ({ id })) } }
          : {}),
      },
      select: DEAL_LIST_SELECT,
    });

    await this.audit(user.id, 'deal.update', id, this.diff(existing, deal));
    this.events.emitDealUpdated({
      ts: Date.now(),
      userId: user.id,
      dealId: deal.id,
      pipelineId: deal.pipelineId,
    });
    return deal;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const deal = await this.assertEditable(id, user);
    await this.prisma.deal.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(user.id, 'deal.delete', id, null);
    this.events.emitDealDeleted({
      ts: Date.now(),
      userId: user.id,
      dealId: id,
      pipelineId: deal.pipelineId,
    });
  }

  async changeStage(id: string, dto: ChangeStageDto, user: AuthenticatedUser) {
    const deal = await this.assertEditable(id, user);
    await this.assertStageInPipeline(dto.stageId, deal.pipelineId);

    const oldStageId = deal.stageId;

    // Order is server-authoritative. If the client passes `order`, we use it;
    // otherwise the deal lands at the bottom of the target column.
    let targetOrder = dto.order;
    if (targetOrder === undefined) {
      const max = await this.prisma.deal.aggregate({
        where: { stageId: dto.stageId, deletedAt: null, NOT: { id } },
        _max: { order: true },
      });
      targetOrder = (max._max.order ?? -1) + 1;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Shift higher-ordered cards in the destination column down by one to
      // make room — same trick as Notion/Linear use for sortable columns.
      if (oldStageId !== dto.stageId) {
        await tx.deal.updateMany({
          where: {
            stageId: dto.stageId,
            deletedAt: null,
            order: { gte: targetOrder },
            NOT: { id },
          },
          data: { order: { increment: 1 } },
        });
      }

      const next = await tx.deal.update({
        where: { id },
        data: { stageId: dto.stageId, order: targetOrder },
        select: DEAL_LIST_SELECT,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'deal.stage_change',
          tableName: 'Deal',
          recordId: id,
          changes: { from: oldStageId, to: dto.stageId, order: targetOrder },
        },
      });

      return next;
    });

    this.events.emitDealStageChanged({
      ts: Date.now(),
      userId: user.id,
      dealId: id,
      pipelineId: deal.pipelineId,
      oldStageId,
      newStageId: dto.stageId,
      order: targetOrder,
    });
    this.events.emitDealUpdated({
      ts: Date.now(),
      userId: user.id,
      dealId: id,
      pipelineId: deal.pipelineId,
    });
    return updated;
  }

  async markWon(id: string, user: AuthenticatedUser) {
    const deal = await this.assertEditable(id, user);
    if (deal.wonAt) throw new BadRequestException('Deal is already marked as won');

    const now = new Date();
    const updated = await this.prisma.deal.update({
      where: { id },
      data: { wonAt: now, closedAt: now, lostAt: null, lostReason: null, probability: 100 },
      select: DEAL_LIST_SELECT,
    });
    await this.audit(user.id, 'deal.won', id, { wonAt: now.toISOString() });
    this.events.emitDealUpdated({
      ts: Date.now(),
      userId: user.id,
      dealId: id,
      pipelineId: deal.pipelineId,
    });
    return updated;
  }

  async markLost(id: string, dto: LostDealDto, user: AuthenticatedUser) {
    const deal = await this.assertEditable(id, user);
    if (deal.lostAt) throw new BadRequestException('Deal is already marked as lost');

    const now = new Date();
    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        lostAt: now,
        closedAt: now,
        lostReason: dto.lostReason,
        wonAt: null,
        probability: 0,
      },
      select: DEAL_LIST_SELECT,
    });
    await this.audit(user.id, 'deal.lost', id, {
      lostAt: now.toISOString(),
      lostReason: dto.lostReason,
    });
    this.events.emitDealUpdated({
      ts: Date.now(),
      userId: user.id,
      dealId: id,
      pipelineId: deal.pipelineId,
    });
    return updated;
  }

  async snoozeGhosting(id: string, dto: SnoozeGhostingDto, user: AuthenticatedUser) {
    const deal = await this.assertEditable(id, user);
    const until = new Date(Date.now() + dto.days * 86_400_000);
    const updated = await this.prisma.deal.update({
      where: { id },
      data: { ghostingSnoozedUntil: until, rotIndicator: false },
      select: DEAL_LIST_SELECT,
    });
    await this.audit(user.id, 'deal.snooze_ghosting', id, {
      until: until.toISOString(),
      days: dto.days,
    });
    this.events.emitDealRotIndicator({
      ts: Date.now(),
      userId: user.id,
      dealId: id,
      pipelineId: deal.pipelineId,
      rotIndicator: false,
    });
    this.events.emitDealUpdated({
      ts: Date.now(),
      userId: user.id,
      dealId: id,
      pipelineId: deal.pipelineId,
    });
    return updated;
  }

  // ── Products on Deals ──────────────────────────────────────────────────────

  async getProducts(dealId: string) {
    await this.assertExists(dealId);
    return this.prisma.dealProduct.findMany({
      where: { dealId },
      include: { product: { select: { id: true, name: true, code: true, unit: true } } },
    });
  }

  async addProduct(dealId: string, dto: UpsertDealProductDto, user: AuthenticatedUser) {
    const deal = await this.assertEditable(dealId, user);
    const total = this.computeLineTotal(dto);

    const created = await this.prisma.dealProduct.create({
      data: {
        dealId,
        productId: dto.productId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        discount: dto.discount ?? 0,
        discountType: dto.discountType ?? 'PERCENT',
        taxPct: dto.taxPct ?? 0,
        total,
      },
      include: { product: { select: { id: true, name: true, code: true, unit: true } } },
    });

    await this.recomputeDealValue(dealId);
    this.events.emitDealUpdated({
      ts: Date.now(),
      userId: user.id,
      dealId,
      pipelineId: deal.pipelineId,
    });
    return created;
  }

  async removeProduct(dealId: string, dealProductId: string, user: AuthenticatedUser) {
    const deal = await this.assertEditable(dealId, user);
    const dp = await this.prisma.dealProduct.findFirst({
      where: { id: dealProductId, dealId },
      select: { id: true },
    });
    if (!dp) throw new NotFoundException(`DealProduct ${dealProductId} not found`);
    await this.prisma.dealProduct.delete({ where: { id: dealProductId } });
    await this.recomputeDealValue(dealId);
    this.events.emitDealUpdated({
      ts: Date.now(),
      userId: user.id,
      dealId,
      pipelineId: deal.pipelineId,
    });
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private computeLineTotal(dto: UpsertDealProductDto): Prisma.Decimal {
    const base = new Prisma.Decimal(dto.unitPrice).mul(dto.quantity);
    const discount = new Prisma.Decimal(dto.discount ?? 0);
    const afterDiscount =
      dto.discountType === 'ABSOLUTE' ? base.sub(discount) : base.sub(base.mul(discount).div(100));
    const taxPct = new Prisma.Decimal(dto.taxPct ?? 0);
    return afterDiscount.add(afterDiscount.mul(taxPct).div(100));
  }

  private async recomputeDealValue(dealId: string): Promise<void> {
    const agg = await this.prisma.dealProduct.aggregate({
      where: { dealId },
      _sum: { total: true },
    });
    await this.prisma.deal.update({
      where: { id: dealId },
      data: { value: agg._sum.total ?? 0 },
    });
  }

  private async assertExists(id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        ownerId: true,
        pipelineId: true,
        stageId: true,
        wonAt: true,
        lostAt: true,
      },
    });
    if (!deal) throw new NotFoundException(`Deal ${id} not found`);
    return deal;
  }

  private async assertEditable(id: string, user: AuthenticatedUser) {
    const deal = await this.assertExists(id);
    const canEdit =
      deal.ownerId === user.id || user.role === Role.ADMIN || user.role === Role.MANAGER;
    if (!canEdit) {
      throw new ForbiddenException('Only the deal owner, a manager, or an admin can change it');
    }
    return deal;
  }

  private async assertStageInPipeline(stageId: string, pipelineId: string) {
    const stage = await this.prisma.stage.findFirst({
      where: { id: stageId, pipelineId, deletedAt: null },
      select: { id: true },
    });
    if (!stage) {
      throw new BadRequestException(`Stage ${stageId} does not belong to pipeline ${pipelineId}`);
    }
  }

  private diff<T extends Record<string, unknown>>(before: T, after: T): Prisma.JsonObject {
    const changes: Prisma.JsonObject = {};
    for (const key of Object.keys(after)) {
      const a = before[key];
      const b = after[key];
      if (a instanceof Date && b instanceof Date) {
        if (a.getTime() !== b.getTime())
          changes[key] = { from: a.toISOString(), to: b.toISOString() };
      } else if (JSON.stringify(a) !== JSON.stringify(b)) {
        changes[key] = { from: a as Prisma.JsonValue, to: b as Prisma.JsonValue };
      }
    }
    return changes;
  }

  private async audit(
    userId: string,
    action: string,
    recordId: string,
    changes: Prisma.JsonValue | null,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { userId, action, tableName: 'Deal', recordId, changes: changes ?? Prisma.DbNull },
    });
  }

  private buildOrderBy(sort?: string): Prisma.DealOrderByWithRelationInput[] {
    if (!sort) return [{ stageId: 'asc' }, { order: 'asc' }];
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    const dir: Prisma.SortOrder = desc ? 'desc' : 'asc';
    switch (field) {
      case 'value':
        return [{ value: dir }];
      case 'probability':
        return [{ probability: dir }];
      case 'updatedAt':
        return [{ updatedAt: dir }];
      case 'createdAt':
        return [{ createdAt: dir }];
      case 'closingDate':
        return [{ closingDate: dir }];
      case 'title':
        return [{ title: dir }];
      case 'order':
        return [{ stageId: 'asc' }, { order: dir }];
      default:
        return [{ stageId: 'asc' }, { order: 'asc' }];
    }
  }
}
