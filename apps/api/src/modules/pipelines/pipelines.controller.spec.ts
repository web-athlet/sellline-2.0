import { Test, TestingModule } from '@nestjs/testing';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';

const mockService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  summary: vi.fn(),
};

describe('PipelinesController', () => {
  let controller: PipelinesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PipelinesController],
      providers: [{ provide: PipelinesService, useValue: mockService }],
    }).compile();
    controller = module.get(PipelinesController);
    vi.clearAllMocks();
  });

  it('findAll', async () => {
    mockService.findAll.mockResolvedValue([]);
    await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('findOne', async () => {
    mockService.findOne.mockResolvedValue({ id: 'p1' });
    expect(await controller.findOne('p1')).toEqual({ id: 'p1' });
  });

  it('summary', async () => {
    mockService.summary.mockResolvedValue({ pipelineId: 'p1', stages: [] });
    expect(await controller.summary('p1')).toEqual({ pipelineId: 'p1', stages: [] });
    expect(mockService.summary).toHaveBeenCalledWith('p1');
  });
});
