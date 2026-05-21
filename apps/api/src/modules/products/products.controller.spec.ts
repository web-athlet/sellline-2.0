import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

const mockService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  importCsv: vi.fn(),
};

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockService }],
    }).compile();
    controller = module.get(ProductsController);
    vi.clearAllMocks();
  });

  it('delegates findAll', async () => {
    mockService.findAll.mockResolvedValue({ data: [], meta: {} });
    await controller.findAll({ page: 1, limit: 10 });
    expect(mockService.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('delegates findOne', async () => {
    mockService.findOne.mockResolvedValue({ id: 'p1' });
    await controller.findOne('p1');
    expect(mockService.findOne).toHaveBeenCalledWith('p1');
  });

  it('delegates create', async () => {
    mockService.create.mockResolvedValue({ id: 'p1' });
    await controller.create({ name: 'Widget', price: 99 });
    expect(mockService.create).toHaveBeenCalledWith({ name: 'Widget', price: 99 });
  });

  it('delegates update', async () => {
    mockService.update.mockResolvedValue({ id: 'p1' });
    await controller.update('p1', { name: 'Widget v2' });
    expect(mockService.update).toHaveBeenCalledWith('p1', { name: 'Widget v2' });
  });

  it('delegates remove', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('p1');
    expect(mockService.remove).toHaveBeenCalledWith('p1');
  });

  it('throws BadRequestException when no file uploaded', () => {
    expect(() => controller.importCsv(undefined)).toThrow(BadRequestException);
  });

  it('delegates importCsv when file is provided', async () => {
    mockService.importCsv.mockResolvedValue({ created: 3, errors: [] });
    const file = {
      buffer: Buffer.from('name,price\nWidget,10'),
      originalname: 'test.csv',
      mimetype: 'text/csv',
      size: 20,
    } as { buffer: Buffer; originalname: string; mimetype: string; size: number };
    const result = await controller.importCsv(file);
    expect(mockService.importCsv).toHaveBeenCalledWith(file.buffer);
    expect(result).toEqual({ created: 3, errors: [] });
  });
});
