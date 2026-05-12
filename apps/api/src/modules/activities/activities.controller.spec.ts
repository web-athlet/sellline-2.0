import { Test } from '@nestjs/testing';
import { ActivityType, Role } from '@nextgen/db';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

const makeUser = () => ({
  id: 'user-1',
  email: 'sales@test.de',
  role: Role.SALES_REP,
  twoFactorEnabled: false,
});

const serviceMock = {
  findAll: vi
    .fn()
    .mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 50, pages: 0 } }),
  findOne: vi.fn().mockResolvedValue({}),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
  remove: vi.fn().mockResolvedValue(undefined),
  markDone: vi.fn().mockResolvedValue({}),
  checkConflicts: vi.fn().mockResolvedValue({ conflicts: [] }),
};

describe('ActivitiesController', () => {
  let controller: ActivitiesController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [{ provide: ActivitiesService, useValue: serviceMock }],
    }).compile();

    controller = module.get(ActivitiesController);
  });

  it('findAll delegates to service', async () => {
    const result = await controller.findAll({});
    expect(serviceMock.findAll).toHaveBeenCalled();
    expect(result.data).toHaveLength(0);
  });

  it('create delegates to service with user', async () => {
    const dto = {
      type: ActivityType.TASK,
      subject: 'Demo',
      dealId: 'deal-1',
      _linkedEntity: undefined as undefined,
    };
    await controller.create(dto, makeUser());
    expect(serviceMock.create).toHaveBeenCalledWith(dto, makeUser());
  });

  it('findOne delegates to service', async () => {
    await controller.findOne('act-1');
    expect(serviceMock.findOne).toHaveBeenCalledWith('act-1');
  });

  it('markDone delegates to service', async () => {
    await controller.markDone('act-1', makeUser());
    expect(serviceMock.markDone).toHaveBeenCalledWith('act-1', makeUser());
  });

  it('checkConflicts returns empty conflicts list', async () => {
    const dto = { startTime: '2026-05-12T10:00:00Z', endTime: '2026-05-12T11:00:00Z' };
    const result = await controller.checkConflicts(dto, makeUser());
    expect(result.conflicts).toHaveLength(0);
  });
});
