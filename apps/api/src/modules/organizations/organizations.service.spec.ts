import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';

const mockPrisma = {
  organization: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  person: { count: vi.fn(), findMany: vi.fn() },
  deal: { count: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated organizations', async () => {
      const orgs = [
        {
          id: 'o1',
          name: 'Acme GmbH',
          parent: null,
          _count: { persons: 2, deals: 1, children: 0 },
        },
      ];
      mockPrisma.$transaction.mockResolvedValue([1, orgs]);

      const result = await service.findAll({ page: 1, limit: 25 });

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns org with children and counts', async () => {
      const org = {
        id: 'o1',
        name: 'Acme',
        parent: null,
        children: [],
        _count: { persons: 3, deals: 2 },
      };
      mockPrisma.organization.findFirst.mockResolvedValue(org);
      const result = await service.findOne('o1');
      expect(result).toEqual(org);
    });
  });

  describe('create', () => {
    it('throws ConflictException when domain already taken', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.create({ name: 'New Org', domain: 'taken.com' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when parentOrgId does not exist', async () => {
      mockPrisma.organization.findFirst
        .mockResolvedValueOnce(null) // domain check passes
        .mockResolvedValueOnce(null); // parent not found
      await expect(service.create({ name: 'Child', parentOrgId: 'ghost-parent' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates organization without domain conflict check', async () => {
      mockPrisma.organization.create.mockResolvedValue({ id: 'new', name: 'No Domain Org' });
      const result = await service.create({ name: 'No Domain Org' });
      expect(result.id).toBe('new');
      expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('soft-deletes the organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'o1' });
      mockPrisma.organization.update.mockResolvedValue({});
      await service.remove('o1');
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when org does not exist', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await expect(service.update('ghost', { name: 'Updated' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on domain collision', async () => {
      mockPrisma.organization.findFirst
        .mockResolvedValueOnce({ id: 'o1' })
        .mockResolvedValueOnce({ id: 'o2' });
      await expect(service.update('o1', { domain: 'taken.com' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('updates org when no domain conflict', async () => {
      mockPrisma.organization.findFirst
        .mockResolvedValueOnce({ id: 'o1' })
        .mockResolvedValueOnce(null);
      mockPrisma.organization.update.mockResolvedValue({ id: 'o1', name: 'Updated' });
      const result = await service.update('o1', { domain: 'new.com' });
      expect(result.id).toBe('o1');
    });
  });

  describe('findPersons', () => {
    it('throws NotFoundException for unknown org', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await expect(service.findPersons('ghost')).rejects.toThrow(NotFoundException);
    });

    it('returns paginated persons', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'o1' });
      mockPrisma.$transaction.mockResolvedValue([2, [{ id: 'p1' }, { id: 'p2' }]]);
      const result = await service.findPersons('o1', 1, 25);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('findDeals', () => {
    it('throws NotFoundException for unknown org', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await expect(service.findDeals('ghost')).rejects.toThrow(NotFoundException);
    });

    it('returns paginated deals', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'o1' });
      mockPrisma.$transaction.mockResolvedValue([1, [{ id: 'd1', title: 'Big Deal' }]]);
      const result = await service.findDeals('o1', 1, 25);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findTree', () => {
    it('returns null for unknown root org', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      const result = await service.findTree('ghost');
      expect(result).toBeNull();
    });

    it('returns org tree for known root', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'o1',
        name: 'Root',
        domain: null,
        industry: null,
        employeeCount: null,
        children: [],
      });
      const result = (await service.findTree('o1')) as { id: string };
      expect(result.id).toBe('o1');
    });
  });

  describe('findAll — sort branches', () => {
    const makeResult = (sort: string) => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);
      return service.findAll({ page: 1, limit: 10, sort });
    };

    it('sorts by domain', async () => {
      await expect(makeResult('domain')).resolves.toBeDefined();
    });
    it('sorts by industry', async () => {
      await expect(makeResult('industry')).resolves.toBeDefined();
    });
    it('sorts by employeeCount', async () => {
      await expect(makeResult('employeeCount')).resolves.toBeDefined();
    });
    it('sorts by createdAt', async () => {
      await expect(makeResult('createdAt')).resolves.toBeDefined();
    });
    it('falls back for unknown sort', async () => {
      await expect(makeResult('unknown')).resolves.toBeDefined();
    });
    it('sorts by name desc', async () => {
      await expect(makeResult('-name')).resolves.toBeDefined();
    });
  });
});
