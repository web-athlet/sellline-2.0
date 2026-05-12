import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@nextgen/db';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingService } from './booking.service';

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'sales@test.de',
  role: Role.SALES_REP,
  twoFactorEnabled: false,
  ...overrides,
});

const makeConfig = (overrides = {}) => ({
  id: 'cfg-1',
  userId: 'user-1',
  slotDuration: 30,
  workdayStart: 9,
  workdayEnd: 17,
  timezone: 'Europe/Berlin',
  activeDays: [1, 2, 3, 4, 5],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const prismaMock = {
  $transaction: vi.fn(),
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  bookingConfig: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  activity: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

describe('BookingService', () => {
  let service: BookingService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [BookingService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(BookingService);
  });

  // ── getConfig ─────────────────────────────────────────────────────────────

  describe('getConfig', () => {
    it('returns config merged with user booking slug', async () => {
      prismaMock.bookingConfig.findFirst.mockResolvedValue(makeConfig());
      prismaMock.user.findFirst.mockResolvedValue({ bookingSlug: 'alice-abc', name: 'Alice' });

      const result = await service.getConfig(makeUser());

      expect(result.slotDuration).toBe(30);
      expect(result.bookingSlug).toBe('alice-abc');
      expect(result.bookingUrl).toBe('/book/alice-abc');
    });

    it('falls back to DEFAULT_CONFIG when no config exists', async () => {
      prismaMock.bookingConfig.findFirst.mockResolvedValue(null);
      prismaMock.user.findFirst.mockResolvedValue({ bookingSlug: null, name: 'Alice' });

      const result = await service.getConfig(makeUser());

      expect(result.slotDuration).toBe(30);
      expect(result.bookingUrl).toBeNull();
    });
  });

  // ── generateSlug ──────────────────────────────────────────────────────────

  describe('generateSlug', () => {
    it('returns existing slug if already set', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ bookingSlug: 'alice-abc', name: 'Alice' });

      const result = await service.generateSlug(makeUser());

      expect(result.bookingSlug).toBe('alice-abc');
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('generates and persists new slug when none exists', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ bookingSlug: null, name: 'Max Mustermann' });
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.generateSlug(makeUser());

      expect(result.bookingSlug).toMatch(/^max-mustermann-/);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bookingSlug: result.bookingSlug }),
        }),
      );
    });
  });

  // ── getPublicProfile ──────────────────────────────────────────────────────

  describe('getPublicProfile', () => {
    it('returns profile for known slug', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1', name: 'Alice', avatarUrl: null });
      prismaMock.bookingConfig.findFirst.mockResolvedValue(makeConfig());

      const result = await service.getPublicProfile('alice-slug');

      expect(result).toMatchObject({ userId: 'user-1', name: 'Alice' });
      expect(result.config).toBeDefined();
    });

    it('throws NotFoundException for unknown slug', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.getPublicProfile('unknown')).rejects.toThrow(NotFoundException);
    });

    it('falls back to DEFAULT_CONFIG when no BookingConfig row exists', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1', name: 'Alice', avatarUrl: null });
      prismaMock.bookingConfig.findFirst.mockResolvedValue(null);

      const result = await service.getPublicProfile('slug');

      expect(result.config).toMatchObject({ slotDuration: 30 });
    });
  });

  // ── getAvailableSlots ─────────────────────────────────────────────────────

  describe('getAvailableSlots', () => {
    it('throws BadRequestException for invalid date string', async () => {
      await expect(service.getAvailableSlots('slug', 'not-a-date')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for unknown slug', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.getAvailableSlots('unknown', '2026-05-11')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns empty slots for inactive weekday (Sunday = 0)', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' });
      // activeDays [1-5] excludes Sunday (0)
      prismaMock.bookingConfig.findFirst.mockResolvedValue(
        makeConfig({ activeDays: [1, 2, 3, 4, 5] }),
      );

      // 2026-05-10 is a Sunday
      const result = await service.getAvailableSlots('slug', '2026-05-10');

      expect(result.slots).toHaveLength(0);
    });

    it('returns slots for active weekday with no existing meetings', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prismaMock.bookingConfig.findFirst.mockResolvedValue(
        makeConfig({
          workdayStart: 9,
          workdayEnd: 10,
          slotDuration: 30,
          activeDays: [1, 2, 3, 4, 5],
        }),
      );
      prismaMock.activity.findMany.mockResolvedValue([]);

      // 2026-05-11 is a Monday
      const result = await service.getAvailableSlots('slug', '2026-05-11');

      expect(result.slots).toHaveLength(2); // 09:00–09:30 and 09:30–10:00
    });

    it('excludes slots overlapping with existing meetings', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prismaMock.bookingConfig.findFirst.mockResolvedValue(
        makeConfig({
          workdayStart: 9,
          workdayEnd: 10,
          slotDuration: 30,
          activeDays: [1, 2, 3, 4, 5],
        }),
      );
      // Mirror how the service builds slot boundaries (local-time setHours)
      const base = new Date('2026-05-11');
      const meetingStart = new Date(base);
      meetingStart.setHours(9, 0, 0, 0);
      const meetingEnd = new Date(base);
      meetingEnd.setHours(9, 30, 0, 0);
      prismaMock.activity.findMany.mockResolvedValue([
        { startTime: meetingStart, endTime: meetingEnd },
      ]);

      const result = await service.getAvailableSlots('slug', '2026-05-11');

      // Only the second slot (09:30–10:00) should be free
      expect(result.slots).toHaveLength(1);
    });
  });

  // ── createBooking ─────────────────────────────────────────────────────────

  describe('createBooking', () => {
    const dto = {
      startTime: '2026-05-11T10:00:00.000Z',
      guestName: 'Bob Gast',
      guestEmail: 'bob@example.com',
      subject: 'Demo-Termin',
    };

    it('throws NotFoundException for unknown slug', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.createBooking('unknown', dto)).rejects.toThrow(NotFoundException);
    });

    it('creates booking in atomic transaction — happy path', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prismaMock.bookingConfig.findFirst.mockResolvedValue(makeConfig());

      const createdActivity = {
        id: 'act-1',
        subject: 'Demo-Termin',
        startTime: new Date('2026-05-11T10:00:00.000Z'),
        endTime: new Date('2026-05-11T10:30:00.000Z'),
      };

      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          activity: {
            findFirst: vi.fn().mockResolvedValue(null), // no conflict
            create: vi.fn().mockResolvedValue(createdActivity),
          },
        }),
      );

      const result = await service.createBooking('slug', dto);

      expect(result.activityId).toBe('act-1');
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when slot is already taken (TOCTOU guard)', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prismaMock.bookingConfig.findFirst.mockResolvedValue(makeConfig());

      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          activity: {
            findFirst: vi.fn().mockResolvedValue({ id: 'conflict-1' }), // conflict
            create: vi.fn(),
          },
        }),
      );

      await expect(service.createBooking('slug', dto)).rejects.toThrow(BadRequestException);
    });

    it('stores guestName + guestEmail in activity notes (not in logs)', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prismaMock.bookingConfig.findFirst.mockResolvedValue(makeConfig());

      const createFn = vi.fn().mockResolvedValue({
        id: 'act-1',
        subject: 'Demo-Termin',
        startTime: new Date(),
        endTime: new Date(),
      });

      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          activity: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: createFn,
          },
        }),
      );

      await service.createBooking('slug', dto);

      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining('Bob Gast'),
          }),
        }),
      );
    });

    it('appends guestNotes to booking notes when provided', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prismaMock.bookingConfig.findFirst.mockResolvedValue(makeConfig());

      const createFn = vi.fn().mockResolvedValue({
        id: 'act-2',
        subject: 'Demo-Termin',
        startTime: new Date(),
        endTime: new Date(),
      });

      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          activity: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: createFn,
          },
        }),
      );

      await service.createBooking('slug', { ...dto, guestNotes: 'Bitte Zoom-Link senden' });

      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining('Bitte Zoom-Link senden'),
          }),
        }),
      );
    });
  });
});
