import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';

const makeProduct = (overrides = {}) => ({
  id: 'prod-1',
  name: 'Widget Pro',
  code: 'WGT-001',
  category: 'Software',
  unit: 'Lizenz',
  billingFreq: 'monthly',
  price: '99.00',
  taxPct: '19.00',
  currency: 'EUR',
  visibleFor: ['ADMIN'],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const prismaMock = {
  $transaction: vi.fn(),
  product: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    vi.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(ProductsService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated products', async () => {
      prismaMock.$transaction.mockResolvedValue([
        2,
        [makeProduct(), makeProduct({ id: 'prod-2', code: 'WGT-002' })],
      ]);
      const result = await service.findAll({});
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('applies category filter', async () => {
      prismaMock.$transaction.mockResolvedValue([0, []]);
      await service.findAll({ category: 'Software' });
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('applies search filter', async () => {
      prismaMock.$transaction.mockResolvedValue([0, []]);
      await service.findAll({ search: 'Widget' });
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('returns empty list and correct meta', async () => {
      prismaMock.$transaction.mockResolvedValue([0, []]);
      const result = await service.findAll({ page: 2, limit: 10 });
      expect(result.data).toHaveLength(0);
      expect(result.meta.pages).toBe(0);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns product when found', async () => {
      prismaMock.product.findFirst.mockResolvedValue(makeProduct());
      const result = await service.findOne('prod-1');
      expect(result.id).toBe('prod-1');
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a product successfully', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(makeProduct());
      const result = await service.create({
        name: 'Widget Pro',
        code: 'WGT-001',
        price: 99,
        taxPct: 19,
      });
      expect(result.name).toBe('Widget Pro');
    });

    it('creates product without code (no uniqueness check)', async () => {
      prismaMock.product.create.mockResolvedValue(makeProduct({ code: null }));
      const result = await service.create({ name: 'Widget Lite', price: 49 });
      expect(result).toBeDefined();
      expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
    });

    it('throws ConflictException when code already in use', async () => {
      prismaMock.product.findFirst.mockResolvedValue(makeProduct());
      await expect(
        service.create({ name: 'Widget Dupe', code: 'WGT-001', price: 99 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a product successfully', async () => {
      // name-only change: findOne (1 call) — assertCodeUnique is NOT triggered
      prismaMock.product.findFirst.mockResolvedValueOnce(makeProduct());
      prismaMock.product.update.mockResolvedValue(makeProduct({ name: 'Widget Pro v2' }));
      const result = await service.update('prod-1', { name: 'Widget Pro v2' });
      expect(result.name).toBe('Widget Pro v2');
    });

    it('updates without code does not trigger uniqueness check', async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce(makeProduct());
      prismaMock.product.update.mockResolvedValue(makeProduct({ price: '199.00' }));
      await service.update('prod-1', { price: 199 });
      expect(prismaMock.product.findFirst).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when product not found', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when new code is taken by another product', async () => {
      prismaMock.product.findFirst
        .mockResolvedValueOnce(makeProduct())
        .mockResolvedValueOnce(makeProduct({ id: 'prod-other' }));
      await expect(service.update('prod-1', { code: 'WGT-001' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes the product', async () => {
      prismaMock.product.findFirst.mockResolvedValue(makeProduct());
      prismaMock.product.update.mockResolvedValue({});

      await service.remove('prod-1');
      expect(prismaMock.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── importCsv ─────────────────────────────────────────────────────────────

  describe('importCsv', () => {
    it('imports valid CSV rows', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue({ id: 'prod-new' });

      const csv = `name,code,price\nWidget A,WGT-A,100\nWidget B,WGT-B,200`;
      const result = await service.importCsv(Buffer.from(csv, 'utf-8'));
      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('imports CSV without codes (no duplicate check)', async () => {
      prismaMock.product.create.mockResolvedValue({ id: 'prod-new' });

      const csv = `name,price\nWidget X,50\nWidget Y,75`;
      const result = await service.importCsv(Buffer.from(csv, 'utf-8'));
      expect(result.created).toBe(2);
      expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
    });

    it('reports error for rows missing required name', async () => {
      const csv = `name,code,price\n,WGT-X,50`;
      const result = await service.importCsv(Buffer.from(csv, 'utf-8'));
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.msg).toContain('name');
    });

    it('reports error for rows with missing price', async () => {
      const csv = `name,code,price\nWidget Missing,,`;
      const result = await service.importCsv(Buffer.from(csv, 'utf-8'));
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.msg).toContain('price');
    });

    it('reports error for rows with invalid price', async () => {
      const csv = `name,code,price\nWidget Bad,WGT-Y,notanumber`;
      const result = await service.importCsv(Buffer.from(csv, 'utf-8'));
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.msg).toContain('Ungültiger Preis');
    });

    it('reports error for duplicate code in CSV', async () => {
      prismaMock.product.findFirst.mockResolvedValue(makeProduct());
      const csv = `name,code,price\nWidget Dupe,WGT-001,99`;
      const result = await service.importCsv(Buffer.from(csv, 'utf-8'));
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.msg).toContain('WGT-001');
    });

    it('skips bad rows and continues importing valid ones', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue({ id: 'prod-ok' });

      const csv = `name,code,price\nGood Product,WGT-G,10\n,WGT-BAD,20\nAnother Good,,30`;
      const result = await service.importCsv(Buffer.from(csv, 'utf-8'));
      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(1);
    });

    it('aborts and records error when row count exceeds 5000', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue({ id: 'x' });

      const header = 'name,price\n';
      const rows = Array.from({ length: 5001 }, (_, i) => `Product ${i + 1},10`).join('\n');
      const result = await service.importCsv(Buffer.from(header + rows, 'utf-8'));
      expect(result.errors.some((e) => e.msg.includes('5000'))).toBe(true);
    });
  });
});
