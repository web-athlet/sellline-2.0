import { Test } from '@nestjs/testing';
import { Role } from '@nextgen/db';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

const makeUser = () => ({
  id: 'user-1',
  email: 'sales@test.de',
  role: Role.SALES_REP,
  twoFactorEnabled: false,
});

const serviceMock = {
  getConfig: vi.fn().mockResolvedValue({ slotDuration: 30, bookingSlug: null, bookingUrl: null }),
  updateConfig: vi.fn().mockResolvedValue({}),
  generateSlug: vi.fn().mockResolvedValue({ bookingSlug: 'alice-abc' }),
  getPublicProfile: vi.fn().mockResolvedValue({ userId: 'user-1', name: 'Alice', config: {} }),
  getAvailableSlots: vi.fn().mockResolvedValue({ slots: [] }),
  createBooking: vi
    .fn()
    .mockResolvedValue({ activityId: 'act-1', startTime: new Date(), endTime: new Date() }),
};

describe('BookingController', () => {
  let controller: BookingController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [{ provide: BookingService, useValue: serviceMock }],
    }).compile();

    controller = module.get(BookingController);
  });

  it('getConfig delegates to service', async () => {
    const result = await controller.getConfig(makeUser());
    expect(serviceMock.getConfig).toHaveBeenCalledWith(makeUser());
    expect(result.slotDuration).toBe(30);
  });

  it('updateConfig delegates to service with dto and user', async () => {
    const dto = { slotDuration: 60 };
    await controller.updateConfig(dto, makeUser());
    expect(serviceMock.updateConfig).toHaveBeenCalledWith(dto, makeUser());
  });

  it('generateSlug delegates to service', async () => {
    const result = await controller.generateSlug(makeUser());
    expect(serviceMock.generateSlug).toHaveBeenCalledWith(makeUser());
    expect(result.bookingSlug).toBe('alice-abc');
  });

  it('getPublicProfile delegates to service with slug', async () => {
    const result = await controller.getPublicProfile('alice-slug');
    expect(serviceMock.getPublicProfile).toHaveBeenCalledWith('alice-slug');
    expect(result.name).toBe('Alice');
  });

  it('getAvailableSlots delegates to service with slug and date', async () => {
    const result = await controller.getAvailableSlots('alice-slug', '2026-05-11');
    expect(serviceMock.getAvailableSlots).toHaveBeenCalledWith('alice-slug', '2026-05-11');
    expect(result.slots).toHaveLength(0);
  });

  it('createBooking delegates to service and returns activityId', async () => {
    const dto = {
      startTime: '2026-05-11T10:00:00.000Z',
      guestName: 'Bob Gast',
      guestEmail: 'bob@example.com',
      subject: 'Demo-Termin',
    };
    const result = await controller.createBooking('alice-slug', dto);
    expect(serviceMock.createBooking).toHaveBeenCalledWith('alice-slug', dto);
    expect(result.activityId).toBe('act-1');
  });
});
