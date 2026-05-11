import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nextgen/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { QueryOrganizationsDto } from './dto/query-organizations.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryOrganizationsDto) {
    const { page = 1, limit = 25, search, parentId, sort } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(parentId !== undefined ? { parentOrgId: parentId === 'null' ? null : parentId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { domain: { contains: search, mode: 'insensitive' } },
              { industry: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy = this.buildOrderBy(sort);

    const [total, organizations] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          parent: { select: { id: true, name: true } },
          _count: {
            select: {
              persons: { where: { deletedAt: null } },
              deals: { where: { deletedAt: null } },
              children: { where: { deletedAt: null } },
            },
          },
        },
      }),
    ]);

    return {
      data: organizations,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, domain: true, industry: true, employeeCount: true },
        },
        _count: {
          select: {
            persons: { where: { deletedAt: null } },
            deals: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async findTree(id: string) {
    return this.buildSubTree(id, 5);
  }

  async findPersons(id: string, page = 1, limit = 25) {
    const org = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);

    const skip = (page - 1) * limit;
    const where: Prisma.PersonWhereInput = { orgId: id, deletedAt: null };

    const [total, persons] = await this.prisma.$transaction([
      this.prisma.person.count({ where }),
      this.prisma.person.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          emails: true,
          phones: true,
          ownerId: true,
          createdAt: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
    ]);

    return { data: persons, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async findDeals(id: string, page = 1, limit = 25) {
    const org = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);

    const skip = (page - 1) * limit;
    const where: Prisma.DealWhereInput = { orgId: id, deletedAt: null };

    const [total, deals] = await this.prisma.$transaction([
      this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          value: true,
          currency: true,
          closedAt: true,
          wonAt: true,
          stage: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { data: deals, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async create(dto: CreateOrganizationDto) {
    if (dto.domain) {
      const existing = await this.prisma.organization.findFirst({
        where: { domain: dto.domain, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(`An organization with domain "${dto.domain}" already exists`);
      }
    }

    if (dto.parentOrgId) {
      const parent = await this.prisma.organization.findFirst({
        where: { id: dto.parentOrgId, deletedAt: null },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException(`Parent organization ${dto.parentOrgId} not found`);
    }

    return this.prisma.organization.create({
      data: dto,
      include: { parent: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);

    if (dto.domain) {
      const conflict = await this.prisma.organization.findFirst({
        where: { domain: dto.domain, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException(`Domain "${dto.domain}" is already taken`);
      }
    }

    return this.prisma.organization.update({
      where: { id },
      data: dto,
      include: { parent: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);

    await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async buildSubTree(id: string, maxDepth: number): Promise<unknown> {
    if (maxDepth <= 0) return null;

    const org = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        domain: true,
        industry: true,
        employeeCount: true,
        children: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });

    if (!org) return null;

    const children = await Promise.all(
      org.children.map((c) => this.buildSubTree(c.id, maxDepth - 1)),
    );

    return { ...org, children };
  }

  private buildOrderBy(sort?: string): Prisma.OrganizationOrderByWithRelationInput {
    if (!sort) return { name: 'asc' };

    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    const dir: Prisma.SortOrder = desc ? 'desc' : 'asc';

    switch (field) {
      case 'name':
        return { name: dir };
      case 'domain':
        return { domain: dir };
      case 'industry':
        return { industry: dir };
      case 'employeeCount':
        return { employeeCount: dir };
      case 'createdAt':
        return { createdAt: dir };
      default:
        return { name: 'asc' };
    }
  }
}
