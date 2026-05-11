import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@nextgen/db';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

const user: AuthenticatedUser = {
  id: 'u1',
  email: 'u@x.de',
  role: Role.SALES_REP,
  twoFactorEnabled: false,
};

const mockService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  changeStage: vi.fn(),
  markWon: vi.fn(),
  markLost: vi.fn(),
  snoozeGhosting: vi.fn(),
  getProducts: vi.fn(),
  addProduct: vi.fn(),
  removeProduct: vi.fn(),
};

describe('DealsController', () => {
  let controller: DealsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DealsController],
      providers: [{ provide: DealsService, useValue: mockService }],
    }).compile();
    controller = module.get(DealsController);
    vi.clearAllMocks();
  });

  it('delegates findAll', async () => {
    mockService.findAll.mockResolvedValue({ data: [], meta: {} });
    await controller.findAll({ page: 1, limit: 50 });
    expect(mockService.findAll).toHaveBeenCalledWith({ page: 1, limit: 50 });
  });

  it('forwards caller user on create', async () => {
    mockService.create.mockResolvedValue({ id: 'd1' });
    await controller.create({ title: 't', pipelineId: 'p', stageId: 's' }, user);
    expect(mockService.create).toHaveBeenCalledWith(
      { title: 't', pipelineId: 'p', stageId: 's' },
      user,
    );
  });

  it('forwards caller user on changeStage', async () => {
    mockService.changeStage.mockResolvedValue({ id: 'd1' });
    await controller.changeStage('d1', { stageId: 's2', order: 3 }, user);
    expect(mockService.changeStage).toHaveBeenCalledWith('d1', { stageId: 's2', order: 3 }, user);
  });

  it('won / lost / snooze are wired', async () => {
    mockService.markWon.mockResolvedValue({});
    mockService.markLost.mockResolvedValue({});
    mockService.snoozeGhosting.mockResolvedValue({});
    await controller.markWon('d1', user);
    await controller.markLost('d1', { lostReason: 'r' }, user);
    await controller.snoozeGhosting('d1', { days: 7 }, user);
    expect(mockService.markWon).toHaveBeenCalledWith('d1', user);
    expect(mockService.markLost).toHaveBeenCalledWith('d1', { lostReason: 'r' }, user);
    expect(mockService.snoozeGhosting).toHaveBeenCalledWith('d1', { days: 7 }, user);
  });

  it('products endpoints', async () => {
    mockService.getProducts.mockResolvedValue([]);
    mockService.addProduct.mockResolvedValue({});
    mockService.removeProduct.mockResolvedValue(undefined);
    await controller.getProducts('d1');
    await controller.addProduct('d1', { productId: 'p1', quantity: 1, unitPrice: 100 }, user);
    await controller.removeProduct('d1', 'dp1', user);
    expect(mockService.getProducts).toHaveBeenCalledWith('d1');
    expect(mockService.addProduct).toHaveBeenCalled();
    expect(mockService.removeProduct).toHaveBeenCalledWith('d1', 'dp1', user);
  });

  it('remove delegates with user', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('d1', user);
    expect(mockService.remove).toHaveBeenCalledWith('d1', user);
  });

  it('findOne delegates', async () => {
    mockService.findOne.mockResolvedValue({ id: 'd1' });
    expect(await controller.findOne('d1')).toEqual({ id: 'd1' });
  });

  it('update delegates with user', async () => {
    mockService.update.mockResolvedValue({ id: 'd1' });
    await controller.update('d1', { title: 'new' }, user);
    expect(mockService.update).toHaveBeenCalledWith('d1', { title: 'new' }, user);
  });
});
