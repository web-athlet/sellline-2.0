import 'reflect-metadata';
import { Role } from '@nextgen/db';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

const mockService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  convert: vi.fn(),
  reEnqueue: vi.fn(),
  remove: vi.fn(),
};

const make = () => new LeadsController(mockService as unknown as LeadsService);

const rolesOf = (method: keyof LeadsController) =>
  Reflect.getMetadata(ROLES_KEY, LeadsController.prototype[method] as object) as Role[] | undefined;

describe('LeadsController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates read endpoints to the service', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    await make().findAll({});
    expect(mockService.findAll).toHaveBeenCalledWith({});
    mockService.findOne.mockResolvedValue({ id: 'l1' });
    await make().findOne('l1');
    expect(mockService.findOne).toHaveBeenCalledWith('l1');
  });

  it('delegates mutating endpoints to the service', async () => {
    await make().convert('l1', { ownerId: 'u1' } as never);
    expect(mockService.convert).toHaveBeenCalledWith('l1', { ownerId: 'u1' });
    await make().reEnqueue('l1');
    expect(mockService.reEnqueue).toHaveBeenCalledWith('l1');
    await make().remove('l1');
    expect(mockService.remove).toHaveBeenCalledWith('l1');
  });

  it('guards convert/enrich/delete with MANAGER+ADMIN roles (TD#31)', () => {
    for (const m of ['convert', 'reEnqueue', 'remove'] as const) {
      expect(rolesOf(m)).toEqual([Role.ADMIN, Role.MANAGER]);
    }
  });

  it('leaves read endpoints unrestricted', () => {
    expect(rolesOf('findAll')).toBeUndefined();
    expect(rolesOf('findOne')).toBeUndefined();
  });
});
