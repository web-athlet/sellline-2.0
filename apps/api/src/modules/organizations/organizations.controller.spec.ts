import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

const mockService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  findTree: vi.fn(),
  findPersons: vi.fn(),
  findDeals: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationsService, useValue: mockService }],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
    vi.clearAllMocks();
  });

  it('findAll delegates to service', async () => {
    const result = { data: [], meta: { total: 0, page: 1, limit: 25, pages: 0 } };
    mockService.findAll.mockResolvedValue(result);
    expect(await controller.findAll({ page: 1, limit: 25 })).toBe(result);
  });

  it('create delegates to service', async () => {
    const dto = { name: 'Acme GmbH', domain: 'acme.de' };
    const created = { id: 'o1', ...dto };
    mockService.create.mockResolvedValue(created);
    expect(await controller.create(dto)).toBe(created);
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('findOne delegates to service', async () => {
    const org = { id: 'o1', name: 'Acme' };
    mockService.findOne.mockResolvedValue(org);
    expect(await controller.findOne('o1')).toBe(org);
    expect(mockService.findOne).toHaveBeenCalledWith('o1');
  });

  it('getTree delegates to service', async () => {
    const tree = { id: 'o1', children: [] };
    mockService.findTree.mockResolvedValue(tree);
    expect(await controller.getTree('o1')).toBe(tree);
    expect(mockService.findTree).toHaveBeenCalledWith('o1');
  });

  it('getPersons delegates to service with pagination', async () => {
    const result = { data: [], meta: { total: 0, page: 1, limit: 25, pages: 0 } };
    mockService.findPersons.mockResolvedValue(result);
    expect(await controller.getPersons('o1', 1, 25)).toBe(result);
    expect(mockService.findPersons).toHaveBeenCalledWith('o1', 1, 25);
  });

  it('getDeals delegates to service with pagination', async () => {
    const result = { data: [], meta: { total: 0, page: 1, limit: 25, pages: 0 } };
    mockService.findDeals.mockResolvedValue(result);
    expect(await controller.getDeals('o1', 2, 50)).toBe(result);
    expect(mockService.findDeals).toHaveBeenCalledWith('o1', 2, 50);
  });

  it('update delegates to service', async () => {
    const dto = { name: 'Acme AG' };
    const updated = { id: 'o1', name: 'Acme AG' };
    mockService.update.mockResolvedValue(updated);
    expect(await controller.update('o1', dto)).toBe(updated);
    expect(mockService.update).toHaveBeenCalledWith('o1', dto);
  });

  it('remove delegates to service', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('o1');
    expect(mockService.remove).toHaveBeenCalledWith('o1');
  });
});
