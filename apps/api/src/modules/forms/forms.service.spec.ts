import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { FormsService } from './forms.service';

const makeForm = (overrides = {}) => ({
  id: 'form-1',
  name: 'Kontaktformular',
  schemaJson: [{ id: 'f1', type: 'text', label: 'Name', required: true }],
  notifyEmails: ['admin@acme.de'],
  isActive: true,
  submissions: 12,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const prismaMock = {
  form: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

describe('FormsService', () => {
  let service: FormsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [FormsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(FormsService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all non-deleted forms', async () => {
      prismaMock.form.findMany.mockResolvedValue([makeForm()]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(prismaMock.form.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns form when found', async () => {
      prismaMock.form.findFirst.mockResolvedValue(makeForm());
      const result = await service.findOne('form-1');
      expect(result.id).toBe('form-1');
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.form.findFirst.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates form with sanitized schema', async () => {
      prismaMock.form.create.mockResolvedValue(makeForm());
      const result = await service.create({
        name: 'Test',
        schemaJson: [{ id: 'f1', type: 'text', label: 'Name', required: true }],
      });
      expect(result.id).toBe('form-1');
      expect(prismaMock.form.create).toHaveBeenCalled();
    });

    it('sanitizes XSS in form labels', async () => {
      prismaMock.form.create.mockResolvedValue(makeForm());
      await service.create({
        name: 'Test',
        schemaJson: [
          { id: 'f1', type: 'text', label: '<script>alert(1)</script>', required: false },
        ],
      });
      const callData = prismaMock.form.create.mock.calls[0]?.[0] as {
        data: { schemaJson: Array<{ label: string }> };
      };
      expect(callData?.data?.schemaJson?.[0]?.label).not.toContain('<script>');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates existing form', async () => {
      prismaMock.form.findFirst.mockResolvedValue(makeForm());
      prismaMock.form.update.mockResolvedValue(makeForm({ name: 'Neuer Name' }));
      const result = await service.update('form-1', { name: 'Neuer Name' });
      expect(result.name).toBe('Neuer Name');
    });

    it('throws NotFoundException when form not found', async () => {
      prismaMock.form.findFirst.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes form', async () => {
      prismaMock.form.findFirst.mockResolvedValue(makeForm());
      prismaMock.form.update.mockResolvedValue({});
      await service.remove('form-1');
      expect(prismaMock.form.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });

  // ── getEmbed ──────────────────────────────────────────────────────────────

  describe('getEmbed', () => {
    it('returns embed snippet containing form id', async () => {
      prismaMock.form.findFirst.mockResolvedValue(makeForm());
      const result = await service.getEmbed('form-1');
      expect(result.snippet).toContain('form-1');
      expect(result.embedUrl).toContain('form-1');
    });
  });
});
