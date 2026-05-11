import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nextgen/db';
import { fuzzy } from 'fast-fuzzy';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { MergeContactsDto } from './dto/merge-contacts.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

const DUPLICATE_THRESHOLD = 0.85;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryContactsDto) {
    const { page = 1, limit = 25, search, orgId, ownerId, sort } = query;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.PersonWhereInput = {
      deletedAt: null,
      ...(orgId ? { orgId } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { emails: { hasSome: [search] } },
            ],
          }
        : {}),
    };

    const orderBy = this.buildOrderBy(sort);

    const [total, persons] = await this.prisma.$transaction([
      this.prisma.person.count({ where }),
      this.prisma.person.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          org: { select: { id: true, name: true } },
          dealParticipations: {
            where: { deletedAt: null },
            select: { id: true, closedAt: true },
          },
          activities: {
            where: { deletedAt: null, done: false, dueDate: { gte: now } },
            select: { id: true, type: true, subject: true, dueDate: true },
            orderBy: { dueDate: 'asc' },
            take: 1,
          },
        },
      }),
    ]);

    return {
      data: persons.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        emails: p.emails,
        phones: p.phones,
        org: p.org,
        openDeals: p.dealParticipations.filter((d) => !d.closedAt).length,
        closedDeals: p.dealParticipations.filter((d) => d.closedAt !== null).length,
        nextActivity: p.activities[0] ?? null,
        ownerId: p.ownerId,
        optIn: p.optIn,
        createdAt: p.createdAt,
      })),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const person = await this.prisma.person.findFirst({
      where: { id, deletedAt: null },
      include: {
        org: { select: { id: true, name: true, domain: true, industry: true } },
        dealParticipations: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            value: true,
            currency: true,
            closedAt: true,
            wonAt: true,
            stage: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          where: { deletedAt: null },
          select: {
            id: true,
            type: true,
            subject: true,
            notes: true,
            dueDate: true,
            done: true,
            priority: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  async getTimeline(id: string) {
    const person = await this.prisma.person.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!person) throw new NotFoundException(`Person ${id} not found`);

    const [activities, dealEmails] = await Promise.all([
      this.prisma.activity.findMany({
        where: { personId: id, deletedAt: null },
        select: {
          id: true,
          type: true,
          subject: true,
          notes: true,
          dueDate: true,
          done: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.email.findMany({
        where: {
          deal: { participants: { some: { id } } },
          deletedAt: null,
        },
        select: {
          id: true,
          subject: true,
          fromAddress: true,
          toAddresses: true,
          bodyPreview: true,
          isRead: true,
          isSent: true,
          sentAt: true,
        },
        orderBy: { sentAt: 'desc' },
        take: 100,
      }),
    ]);

    const timeline = [
      ...activities.map((a) => ({ ...a, _type: 'activity' as const })),
      ...dealEmails.map((e) => ({ ...e, _type: 'email' as const })),
    ].sort((a, b) => {
      const getDate = (item: (typeof timeline)[number]): number => {
        if (item._type === 'activity') return new Date(item.dueDate ?? item.createdAt).getTime();
        return item.sentAt ? new Date(item.sentAt).getTime() : Date.now();
      };
      return getDate(b) - getDate(a);
    });

    return { data: timeline };
  }

  async create(dto: CreateContactDto, ownerId: string) {
    const { emails = [], ...rest } = dto;

    if (emails.length > 0) {
      const existing = await this.prisma.person.findFirst({
        where: { emails: { hasSome: emails }, deletedAt: null },
        select: { id: true, firstName: true, lastName: true },
      });
      if (existing) {
        throw new ConflictException(
          `A contact with one of these emails already exists (id: ${existing.id})`,
        );
      }
    }

    return this.prisma.person.create({
      data: { ...rest, emails, ownerId: dto.ownerId ?? ownerId },
      include: { org: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateContactDto) {
    const person = await this.prisma.person.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!person) throw new NotFoundException(`Person ${id} not found`);

    return this.prisma.person.update({
      where: { id },
      data: dto,
      include: { org: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    const person = await this.prisma.person.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!person) throw new NotFoundException(`Person ${id} not found`);

    await this.prisma.person.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findDuplicates() {
    const persons = await this.prisma.person.findMany({
      where: { deletedAt: null },
      select: { id: true, firstName: true, lastName: true, emails: true },
      take: 1000,
    });

    const pairs: Array<{
      personA: (typeof persons)[0];
      personB: (typeof persons)[0];
      score: number;
    }> = [];

    for (let i = 0; i < persons.length; i++) {
      for (let j = i + 1; j < persons.length; j++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const a = persons[i]!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const b = persons[j]!;

        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        const nameScore = fuzzy(nameA, nameB);

        let score = nameScore;

        if (a.emails.length > 0 && b.emails.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const localA = (a.emails[0]!.split('@')[0] ?? '').toLowerCase();
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const localB = (b.emails[0]!.split('@')[0] ?? '').toLowerCase();
          const emailScore = fuzzy(localA, localB);
          score = emailScore * 0.6 + nameScore * 0.4;
        }

        if (score > DUPLICATE_THRESHOLD) {
          pairs.push({ personA: a, personB: b, score: Math.round(score * 100) / 100 });
        }
      }
    }

    return { data: pairs, total: pairs.length };
  }

  async merge(dto: MergeContactsDto) {
    const { masterId, duplicateId } = dto;

    if (masterId === duplicateId) {
      throw new BadRequestException('Cannot merge a person with itself');
    }

    const [master, duplicate] = await Promise.all([
      this.prisma.person.findFirst({
        where: { id: masterId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.person.findFirst({
        where: { id: duplicateId, deletedAt: null },
        select: { id: true, notes: true },
      }),
    ]);

    if (!master) throw new NotFoundException(`Master person ${masterId} not found`);
    if (!duplicate) throw new NotFoundException(`Duplicate person ${duplicateId} not found`);

    await this.prisma.$transaction([
      // Transfer activities
      this.prisma.activity.updateMany({
        where: { personId: duplicateId },
        data: { personId: masterId },
      }),
      // Transfer campaign contacts
      this.prisma.campaignContact.updateMany({
        where: { personId: duplicateId },
        data: { personId: masterId },
      }),
      // Soft-delete duplicate, appending audit note to existing notes
      this.prisma.person.update({
        where: { id: duplicateId },
        data: {
          deletedAt: new Date(),
          notes: [duplicate.notes, `merged into ${masterId}`].filter(Boolean).join('\n'),
        },
      }),
    ]);

    // Transfer deal participations via raw SQL (many-to-many join table)
    await this.prisma.$executeRaw`
      UPDATE "_DealParticipants"
      SET "B" = ${masterId}
      WHERE "B" = ${duplicateId}
        AND "A" NOT IN (
          SELECT "A" FROM "_DealParticipants" WHERE "B" = ${masterId}
        )
    `;

    return { success: true, masterId };
  }

  private buildOrderBy(
    sort?: string,
  ): Prisma.PersonOrderByWithRelationInput | Prisma.PersonOrderByWithRelationInput[] {
    if (!sort) return { createdAt: 'desc' };

    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    const dir: Prisma.SortOrder = desc ? 'desc' : 'asc';

    switch (field) {
      case 'name':
      case 'firstName':
        return [{ firstName: dir }, { lastName: dir }];
      case 'lastName':
        return [{ lastName: dir }, { firstName: dir }];
      case 'org':
        return { org: { name: dir } };
      case 'deals':
        return { dealParticipations: { _count: dir } };
      case 'createdAt':
        return { createdAt: dir };
      default:
        return { createdAt: 'desc' };
    }
  }
}
