import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactsService } from './contacts.service';

const mockPrisma = {
  person: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  activity: { updateMany: vi.fn(), findMany: vi.fn() },
  campaignContact: { updateMany: vi.fn() },
  email: { findMany: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
};

describe('ContactsService', () => {
  let service: ContactsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated persons with computed deal counts', async () => {
      const now = new Date();
      const mockPerson = {
        id: 'p1',
        firstName: 'Anna',
        lastName: 'Müller',
        emails: ['anna@example.com'],
        phones: [],
        org: { id: 'o1', name: 'Acme GmbH' },
        dealParticipations: [
          { id: 'd1', closedAt: null },
          { id: 'd2', closedAt: now },
        ],
        activities: [{ id: 'a1', type: 'CALL', subject: 'Follow-up', dueDate: now }],
        ownerId: 'u1',
        optIn: false,
        createdAt: now,
      };

      mockPrisma.$transaction.mockResolvedValue([1, [mockPerson]]);

      const result = await service.findAll({ page: 1, limit: 25 });

      expect(result.meta.total).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.data[0]!.openDeals).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.data[0]!.closedDeals).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.data[0]!.nextActivity).toEqual(mockPerson.activities[0]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns person with relations', async () => {
      const person = {
        id: 'p1',
        firstName: 'Max',
        org: null,
        dealParticipations: [],
        activities: [],
      };
      mockPrisma.person.findFirst.mockResolvedValue(person);
      const result = await service.findOne('p1');
      expect(result).toEqual(person);
    });
  });

  describe('create', () => {
    it('throws ConflictException when email already exists', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({
        id: 'existing',
        firstName: 'Existing',
        lastName: 'Person',
      });
      await expect(
        service.create(
          { firstName: 'New', lastName: 'Person', emails: ['taken@example.com'] },
          'user1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates person and assigns ownerId from caller when not provided', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);
      mockPrisma.person.create.mockResolvedValue({ id: 'new', firstName: 'New', ownerId: 'user1' });
      await service.create(
        { firstName: 'New', lastName: 'Person', emails: ['new@example.com'] },
        'user1',
      );
      expect(mockPrisma.person.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ownerId: 'user1' }) }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('soft-deletes the person', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.person.update.mockResolvedValue({});
      await service.remove('p1');
      expect(mockPrisma.person.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });

  describe('merge', () => {
    it('throws BadRequestException when masterId === duplicateId', async () => {
      await expect(service.merge({ masterId: 'x', duplicateId: 'x' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when master not found', async () => {
      mockPrisma.person.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'dup', notes: null });
      await expect(service.merge({ masterId: 'missing', duplicateId: 'dup' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('transfers activities and soft-deletes duplicate', async () => {
      mockPrisma.person.findFirst
        .mockResolvedValueOnce({ id: 'master' })
        .mockResolvedValueOnce({ id: 'dup', notes: null });
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);
      mockPrisma.$executeRaw.mockResolvedValue(0);

      const result = await service.merge({ masterId: 'master', duplicateId: 'dup' });

      expect(result).toEqual({ success: true, masterId: 'master' });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('appends merge note to existing notes of duplicate', async () => {
      mockPrisma.person.findFirst
        .mockResolvedValueOnce({ id: 'master' })
        .mockResolvedValueOnce({ id: 'dup', notes: 'Existing note' });
      mockPrisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.campaignContact.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.person.update.mockResolvedValue({ id: 'dup' });
      mockPrisma.$executeRaw.mockResolvedValue(0);

      await service.merge({ masterId: 'master', duplicateId: 'dup' });

      expect(mockPrisma.person.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: 'Existing note\nmerged into master',
          }),
        }),
      );
    });
  });

  describe('getTimeline', () => {
    it('throws NotFoundException for unknown person', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);
      await expect(service.getTimeline('ghost')).rejects.toThrow(NotFoundException);
    });

    it('returns merged timeline sorted by date', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: 'p1' });
      const now = new Date();
      const earlier = new Date(now.getTime() - 60_000);
      mockPrisma.activity.findMany = vi.fn().mockResolvedValue([
        {
          id: 'a1',
          type: 'CALL',
          subject: 'Call',
          notes: null,
          dueDate: now,
          done: false,
          createdAt: earlier,
        },
      ]);
      mockPrisma.email.findMany = vi.fn().mockResolvedValue([
        {
          id: 'e1',
          subject: 'Hi',
          fromAddress: 'a@b.com',
          toAddresses: [],
          bodyPreview: '',
          isRead: true,
          isSent: false,
          sentAt: earlier,
        },
      ]);
      const result = await service.getTimeline('p1');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]!._type).toBe('activity');
    });
  });

  describe('update', () => {
    it('throws NotFoundException for unknown person', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);
      await expect(service.update('ghost', { firstName: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('updates the person', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.person.update.mockResolvedValue({ id: 'p1', firstName: 'X' });
      const result = await service.update('p1', { firstName: 'X' });
      expect(result.firstName).toBe('X');
    });
  });

  describe('findAll — sort branches', () => {
    const makeResult = (sort: string) => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);
      return service.findAll({ page: 1, limit: 10, sort });
    };

    it('sorts by lastName', async () => {
      await expect(makeResult('lastName')).resolves.toBeDefined();
    });
    it('sorts by -lastName desc', async () => {
      await expect(makeResult('-lastName')).resolves.toBeDefined();
    });
    it('sorts by org', async () => {
      await expect(makeResult('org')).resolves.toBeDefined();
    });
    it('sorts by deals', async () => {
      await expect(makeResult('deals')).resolves.toBeDefined();
    });
    it('sorts by createdAt', async () => {
      await expect(makeResult('createdAt')).resolves.toBeDefined();
    });
    it('falls back for unknown sort', async () => {
      await expect(makeResult('unknown')).resolves.toBeDefined();
    });
  });

  describe('findDuplicates', () => {
    it('returns empty list when fewer than 2 persons', async () => {
      mockPrisma.person.findMany.mockResolvedValue([
        { id: 'p1', firstName: 'Anna', lastName: 'Müller', emails: ['anna@test.com'] },
      ]);
      const result = await service.findDuplicates();
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('detects duplicate when names are very similar', async () => {
      mockPrisma.person.findMany.mockResolvedValue([
        { id: 'p1', firstName: 'Anna', lastName: 'Mueller', emails: ['anna@test.com'] },
        { id: 'p2', firstName: 'Anna', lastName: 'Mueller', emails: ['annamueller@test.com'] },
      ]);
      const result = await service.findDuplicates();
      expect(result.total).toBeGreaterThan(0);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.data[0]!.score).toBeGreaterThan(0.85);
    });

    it('does not flag distinct persons as duplicates', async () => {
      mockPrisma.person.findMany.mockResolvedValue([
        { id: 'p1', firstName: 'Anna', lastName: 'Müller', emails: ['anna@test.com'] },
        { id: 'p2', firstName: 'Thomas', lastName: 'Schmidt', emails: ['t.schmidt@corp.de'] },
      ]);
      const result = await service.findDuplicates();
      expect(result.total).toBe(0);
    });
  });
});
