import { Test, TestingModule } from '@nestjs/testing';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

const mockService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  getTimeline: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  findDuplicates: vi.fn(),
  merge: vi.fn(),
};

describe('ContactsController', () => {
  let controller: ContactsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: mockService }],
    }).compile();

    controller = module.get<ContactsController>(ContactsController);
    vi.clearAllMocks();
  });

  it('findAll delegates to service', async () => {
    const result = { data: [], meta: { total: 0, page: 1, limit: 25, pages: 0 } };
    mockService.findAll.mockResolvedValue(result);
    expect(await controller.findAll({ page: 1, limit: 25 })).toBe(result);
    expect(mockService.findAll).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  it('getDuplicates delegates to service', async () => {
    const result = { data: [], total: 0 };
    mockService.findDuplicates.mockResolvedValue(result);
    expect(await controller.getDuplicates()).toBe(result);
  });

  it('merge delegates to service', async () => {
    const dto = { masterId: 'm1', duplicateId: 'd1' };
    const result = { success: true, masterId: 'm1' };
    mockService.merge.mockResolvedValue(result);
    expect(await controller.merge(dto)).toBe(result);
    expect(mockService.merge).toHaveBeenCalledWith(dto);
  });

  it('create delegates to service with caller userId', async () => {
    const dto = { firstName: 'Max', lastName: 'Müller', emails: ['max@test.de'] };
    const user = {
      id: 'u1',
      email: 'max@test.de',
      role: 'SALES_REP' as const,
      twoFactorEnabled: false,
    };
    const created = { id: 'p1', ...dto };
    mockService.create.mockResolvedValue(created);
    expect(await controller.create(dto, user)).toBe(created);
    expect(mockService.create).toHaveBeenCalledWith(dto, 'u1');
  });

  it('findOne delegates to service', async () => {
    const person = { id: 'p1', firstName: 'Max' };
    mockService.findOne.mockResolvedValue(person);
    expect(await controller.findOne('p1')).toBe(person);
    expect(mockService.findOne).toHaveBeenCalledWith('p1');
  });

  it('getTimeline delegates to service', async () => {
    const timeline = { data: [] };
    mockService.getTimeline.mockResolvedValue(timeline);
    expect(await controller.getTimeline('p1')).toBe(timeline);
    expect(mockService.getTimeline).toHaveBeenCalledWith('p1');
  });

  it('update delegates to service', async () => {
    const dto = { firstName: 'Updated' };
    const updated = { id: 'p1', firstName: 'Updated' };
    mockService.update.mockResolvedValue(updated);
    expect(await controller.update('p1', dto)).toBe(updated);
    expect(mockService.update).toHaveBeenCalledWith('p1', dto);
  });

  it('remove delegates to service', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('p1');
    expect(mockService.remove).toHaveBeenCalledWith('p1');
  });
});
