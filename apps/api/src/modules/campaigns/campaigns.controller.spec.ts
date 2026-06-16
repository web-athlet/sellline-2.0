import { Test, TestingModule } from '@nestjs/testing';
import { UserThrottlerGuard } from '../../common/throttler/user-throttler.guard';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

const mockService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  addContacts: vi.fn(),
  removeContact: vi.fn(),
  sendCampaign: vi.fn(),
  testSend: vi.fn(),
  generateAiSubjects: vi.fn(),
  handleSendGridBounce: vi.fn(),
};

const mockUser = {
  id: 'user-1',
  email: 'alice@example.com',
  role: 'MANAGER' as const,
  twoFactorEnabled: false,
};

describe('CampaignsController', () => {
  let controller: CampaignsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [{ provide: CampaignsService, useValue: mockService }],
    })
      // The send route uses UserThrottlerGuard (ThrottlerGuard DI); stub it out.
      .overrideGuard(UserThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CampaignsController>(CampaignsController);
    vi.clearAllMocks();
  });

  it('create delegates to service with senderId', async () => {
    const dto = { name: 'N', subject: 'S', bodyHtml: '<p>Hi</p>' };
    mockService.create.mockResolvedValue({ id: 'c1' });
    const result = await controller.create(dto, mockUser);
    expect(result).toEqual({ id: 'c1' });
    expect(mockService.create).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('findAll delegates to service', async () => {
    mockService.findAll.mockResolvedValue({ data: [], meta: {} });
    const result = await controller.findAll({});
    expect(mockService.findAll).toHaveBeenCalledWith({});
    expect(result).toEqual({ data: [], meta: {} });
  });

  it('findOne delegates to service', async () => {
    mockService.findOne.mockResolvedValue({ id: 'c1' });
    const result = await controller.findOne('c1');
    expect(mockService.findOne).toHaveBeenCalledWith('c1');
    expect(result).toEqual({ id: 'c1' });
  });

  it('update delegates to service', async () => {
    mockService.update.mockResolvedValue({ id: 'c1', subject: 'Updated' });
    const result = await controller.update('c1', { subject: 'Updated' });
    expect(mockService.update).toHaveBeenCalledWith('c1', { subject: 'Updated' });
    expect(result).toEqual(expect.objectContaining({ subject: 'Updated' }));
  });

  it('remove delegates to service', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('c1');
    expect(mockService.remove).toHaveBeenCalledWith('c1');
  });

  it('addContacts delegates to service', async () => {
    mockService.addContacts.mockResolvedValue({ added: 2, total: 2 });
    const result = await controller.addContacts('c1', { personIds: ['p1', 'p2'] });
    expect(mockService.addContacts).toHaveBeenCalledWith('c1', { personIds: ['p1', 'p2'] });
    expect(result).toEqual({ added: 2, total: 2 });
  });

  it('removeContact delegates to service', async () => {
    mockService.removeContact.mockResolvedValue(undefined);
    await controller.removeContact('c1', 'p1');
    expect(mockService.removeContact).toHaveBeenCalledWith('c1', 'p1');
  });

  it('send delegates to service with senderId', async () => {
    mockService.sendCampaign.mockResolvedValue(undefined);
    await controller.send('c1', mockUser);
    expect(mockService.sendCampaign).toHaveBeenCalledWith('c1', 'user-1');
  });

  it('testSend delegates to service', async () => {
    mockService.testSend.mockResolvedValue({ to: 'alice@example.com', preview: 'Hi' });
    const result = await controller.testSend('c1', mockUser);
    expect(mockService.testSend).toHaveBeenCalledWith('c1', 'user-1');
    expect(result).toEqual({ to: 'alice@example.com', preview: 'Hi' });
  });

  it('generateAiSubjects delegates to service', async () => {
    const suggestions = [{ subject: 'S', reasoning: 'R', estimatedOpenRate: 25 }];
    mockService.generateAiSubjects.mockResolvedValue(suggestions);
    const result = await controller.generateAiSubjects('c1');
    expect(mockService.generateAiSubjects).toHaveBeenCalledWith('c1');
    expect(result).toEqual(suggestions);
  });

  it('handleSendGridBounce passes array of events', async () => {
    mockService.handleSendGridBounce.mockResolvedValue(undefined);
    await controller.handleSendGridBounce([{ email: 'x@y.com', event: 'bounce' }]);
    expect(mockService.handleSendGridBounce).toHaveBeenCalledWith([
      { email: 'x@y.com', event: 'bounce' },
    ]);
  });

  it('handleSendGridBounce normalizes non-array body to empty array', async () => {
    mockService.handleSendGridBounce.mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleSendGridBounce({} as any);
    expect(mockService.handleSendGridBounce).toHaveBeenCalledWith([]);
  });
});
