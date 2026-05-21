import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProjectStatus } from '@nextgen/db';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from './projects.service';

const makeProject = (overrides = {}) => ({
  id: 'proj-1',
  name: 'Test Project',
  emoji: '🚀',
  dealId: null,
  templateId: null,
  status: ProjectStatus.KICKOFF,
  tagsJson: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  deal: null,
  _count: { tasks: 5 },
  tasks: [],
  ...overrides,
});

const makeTask = (overrides = {}) => ({
  id: 'task-1',
  projectId: 'proj-1',
  title: 'Do something',
  description: null,
  dueDate: null,
  done: false,
  doneAt: null,
  assigneeId: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignee: null,
  ...overrides,
});

const prismaMock = {
  $transaction: vi.fn(),
  project: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  task: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  projectTemplate: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
};

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    vi.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(ProjectsService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated projects', async () => {
      prismaMock.$transaction.mockResolvedValue([
        2,
        [makeProject(), makeProject({ id: 'proj-2' })],
      ]);
      const result = await service.findAll({ page: 1, limit: 50 });
      expect(result.meta.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('filters by dealId and status', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [makeProject()]]);
      const result = await service.findAll({ dealId: 'deal-1', status: ProjectStatus.KICKOFF });
      expect(result.data).toHaveLength(1);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns project with computed doneTasks and dueDate', async () => {
      const dueDate = new Date('2026-06-01');
      prismaMock.project.findFirst.mockResolvedValue({
        ...makeProject(),
        deal: null,
        template: null,
        tasks: [
          makeTask({ done: true, dueDate }),
          makeTask({ id: 'task-2', done: false, dueDate: null }),
        ],
      });
      const result = await service.findOne('proj-1');
      expect(result.doneTasks).toBe(1);
      expect(result.dueDate).toEqual(dueDate);
    });

    it('throws NotFoundException for unknown project', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getTemplates ──────────────────────────────────────────────────────────

  describe('getTemplates', () => {
    it('returns all templates', async () => {
      prismaMock.projectTemplate.findMany.mockResolvedValue([
        {
          id: 't1',
          name: 'Kundenprojekt Standard',
          emoji: '🚀',
          tasksJson: [],
          createdAt: new Date(),
        },
      ]);
      const result = await service.getTemplates();
      expect(result).toHaveLength(1);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates project without template', async () => {
      prismaMock.project.create.mockResolvedValue(makeProject());
      const result = await service.create({ name: 'Test Project' });
      expect(prismaMock.project.create).toHaveBeenCalledOnce();
      expect(result.name).toBe('Test Project');
    });

    it('instantiates template tasks when templateId provided', async () => {
      prismaMock.project.create.mockResolvedValue(makeProject({ templateId: 't1' }));
      prismaMock.projectTemplate.findUnique.mockResolvedValue({
        id: 't1',
        tasksJson: [
          { title: 'Kickoff', relativeDueDays: 1 },
          { title: 'Impl', relativeDueDays: 7 },
        ],
      });
      prismaMock.task.createMany.mockResolvedValue({ count: 2 });
      await service.create({ name: 'Proj', templateId: 't1' });
      expect(prismaMock.task.createMany).toHaveBeenCalledOnce();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates project fields', async () => {
      prismaMock.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prismaMock.project.update.mockResolvedValue(makeProject({ name: 'Renamed' }));
      const result = await service.update('proj-1', { name: 'Renamed' });
      expect(result.name).toBe('Renamed');
    });

    it('throws NotFoundException for unknown project', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);
      await expect(service.update('bad', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes project', async () => {
      prismaMock.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prismaMock.project.update.mockResolvedValue({});
      await service.remove('proj-1');
      expect(prismaMock.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });

  // ── changeStatus ──────────────────────────────────────────────────────────

  describe('changeStatus', () => {
    it('updates status', async () => {
      prismaMock.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prismaMock.project.update.mockResolvedValue(makeProject({ status: ProjectStatus.PLANNING }));
      const result = await service.changeStatus('proj-1', { status: ProjectStatus.PLANNING });
      expect(result.status).toBe(ProjectStatus.PLANNING);
    });
  });

  // ── createTask ────────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('creates task at next order', async () => {
      prismaMock.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prismaMock.task.aggregate.mockResolvedValue({ _max: { order: 3 } });
      prismaMock.task.create.mockResolvedValue(makeTask({ order: 4 }));
      const result = await service.createTask('proj-1', { title: 'New task' });
      expect(result.order).toBe(4);
    });

    it('sets doneAt when done=true on create', async () => {
      prismaMock.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prismaMock.task.aggregate.mockResolvedValue({ _max: { order: null } });
      prismaMock.task.create.mockResolvedValue(makeTask({ done: true, doneAt: new Date() }));
      await service.createTask('proj-1', { title: 'Done', done: true });
      expect(prismaMock.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ done: true, doneAt: expect.any(Date) }),
        }),
      );
    });
  });

  // ── updateTask ────────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('sets doneAt when toggling done true', async () => {
      prismaMock.task.findFirst.mockResolvedValue({ id: 'task-1', done: false });
      prismaMock.task.update.mockResolvedValue(makeTask({ done: true, doneAt: new Date() }));
      await service.updateTask('task-1', { done: true });
      expect(prismaMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ done: true, doneAt: expect.any(Date) }),
        }),
      );
    });

    it('clears doneAt when toggling done false', async () => {
      prismaMock.task.findFirst.mockResolvedValue({ id: 'task-1', done: true });
      prismaMock.task.update.mockResolvedValue(makeTask({ done: false, doneAt: null }));
      await service.updateTask('task-1', { done: false });
      expect(prismaMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ done: false, doneAt: null }),
        }),
      );
    });

    it('throws NotFoundException for unknown task', async () => {
      prismaMock.task.findFirst.mockResolvedValue(null);
      await expect(service.updateTask('bad', { title: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── removeTask ────────────────────────────────────────────────────────────

  describe('removeTask', () => {
    it('deletes task by id', async () => {
      prismaMock.task.findFirst.mockResolvedValue({ id: 'task-1' });
      prismaMock.task.delete.mockResolvedValue({});
      await service.removeTask('task-1');
      expect(prismaMock.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });

    it('throws NotFoundException for unknown task', async () => {
      prismaMock.task.findFirst.mockResolvedValue(null);
      await expect(service.removeTask('bad')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findTasks ─────────────────────────────────────────────────────────────

  describe('findTasks', () => {
    it('returns paginated tasks with project info', async () => {
      prismaMock.$transaction.mockResolvedValue([3, [makeTask(), makeTask({ id: 'task-2' })]]);
      const result = await service.findTasks({ page: 1, limit: 50 });
      expect(result.meta.total).toBe(3);
      expect(result.data).toHaveLength(2);
    });

    it('filters by assigneeId and done', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [makeTask()]]);
      await service.findTasks({ assigneeId: 'user-1', done: 'false' });
      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    });
  });
});
