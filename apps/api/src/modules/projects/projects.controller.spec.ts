import { Test } from '@nestjs/testing';
import { ProjectStatus } from '@nextgen/db';
import { ProjectsController } from './projects.controller';
import { TasksController } from './tasks.controller';
import { ProjectsService } from './projects.service';

const serviceMock = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  getTemplates: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  changeStatus: vi.fn(),
  createFromTemplate: vi.fn(),
  createTask: vi.fn(),
  findTasks: vi.fn(),
  updateTask: vi.fn(),
  removeTask: vi.fn(),
};

describe('ProjectsController', () => {
  let ctrl: ProjectsController;
  let tasksCtrl: TasksController;

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [ProjectsController, TasksController],
      providers: [{ provide: ProjectsService, useValue: serviceMock }],
    }).compile();

    ctrl = module.get(ProjectsController);
    tasksCtrl = module.get(TasksController);
  });

  it('findAll delegates to service', async () => {
    serviceMock.findAll.mockResolvedValue({ data: [], meta: {} });
    await ctrl.findAll({});
    expect(serviceMock.findAll).toHaveBeenCalledWith({});
  });

  it('create delegates to service', async () => {
    serviceMock.create.mockResolvedValue({ id: 'p1' });
    await ctrl.create({ name: 'My Project' });
    expect(serviceMock.create).toHaveBeenCalledWith({ name: 'My Project' });
  });

  it('getTemplates delegates to service', async () => {
    serviceMock.getTemplates.mockResolvedValue([]);
    await ctrl.getTemplates();
    expect(serviceMock.getTemplates).toHaveBeenCalled();
  });

  it('findOne delegates to service', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'p1' });
    await ctrl.findOne('p1');
    expect(serviceMock.findOne).toHaveBeenCalledWith('p1');
  });

  it('update delegates to service', async () => {
    serviceMock.update.mockResolvedValue({ id: 'p1' });
    await ctrl.update('p1', { name: 'Renamed' });
    expect(serviceMock.update).toHaveBeenCalledWith('p1', { name: 'Renamed' });
  });

  it('remove delegates to service', async () => {
    serviceMock.remove.mockResolvedValue(undefined);
    await ctrl.remove('p1');
    expect(serviceMock.remove).toHaveBeenCalledWith('p1');
  });

  it('changeStatus delegates to service', async () => {
    serviceMock.changeStatus.mockResolvedValue({ id: 'p1', status: ProjectStatus.PLANNING });
    await ctrl.changeStatus('p1', { status: ProjectStatus.PLANNING });
    expect(serviceMock.changeStatus).toHaveBeenCalledWith('p1', { status: ProjectStatus.PLANNING });
  });

  it('createFromTemplate delegates to service', async () => {
    serviceMock.createFromTemplate.mockResolvedValue({ id: 'p1' });
    await ctrl.createFromTemplate('p1', 't1');
    expect(serviceMock.createFromTemplate).toHaveBeenCalledWith('p1', 't1');
  });

  it('createTask delegates to service', async () => {
    serviceMock.createTask.mockResolvedValue({ id: 'task-1' });
    await ctrl.createTask('p1', { title: 'Task' });
    expect(serviceMock.createTask).toHaveBeenCalledWith('p1', { title: 'Task' });
  });

  it('tasks findAll delegates to service', async () => {
    serviceMock.findTasks.mockResolvedValue({ data: [], meta: {} });
    await tasksCtrl.findAll({});
    expect(serviceMock.findTasks).toHaveBeenCalledWith({});
  });

  it('tasks update delegates to service', async () => {
    serviceMock.updateTask.mockResolvedValue({ id: 'task-1' });
    await tasksCtrl.update('task-1', { done: true });
    expect(serviceMock.updateTask).toHaveBeenCalledWith('task-1', { done: true });
  });

  it('tasks remove delegates to service', async () => {
    serviceMock.removeTask.mockResolvedValue(undefined);
    await tasksCtrl.remove('task-1');
    expect(serviceMock.removeTask).toHaveBeenCalledWith('task-1');
  });
});
