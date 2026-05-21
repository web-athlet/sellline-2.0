import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nextgen/db';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const TASK_SELECT = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  dueDate: true,
  done: true,
  doneAt: true,
  assigneeId: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskSelect;

const PROJECT_LIST_SELECT = {
  id: true,
  name: true,
  emoji: true,
  dealId: true,
  templateId: true,
  status: true,
  tagsJson: true,
  createdAt: true,
  updatedAt: true,
  deal: { select: { id: true, title: true } },
  _count: { select: { tasks: true } },
  tasks: {
    select: { done: true, dueDate: true },
    orderBy: { dueDate: 'desc' as const },
  },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Queries ────────────────────────────────────────────────────────────────

  async findAll(query: QueryProjectsDto) {
    const { page = 1, limit = 50, dealId, status, search } = query;

    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(dealId ? { dealId } : {}),
      ...(status ? { status } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const skip = (page - 1) * limit;
    const [total, projects] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: PROJECT_LIST_SELECT,
      }),
    ]);

    return {
      data: projects.map(this.mapProject),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        deal: { select: { id: true, title: true } },
        template: { select: { id: true, name: true } },
        tasks: {
          orderBy: { order: 'asc' },
          select: TASK_SELECT,
        },
      },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);

    const doneTasks = project.tasks.filter((t) => t.done).length;
    const dueDates = project.tasks.map((t) => t.dueDate).filter(Boolean) as Date[];
    const dueDate = dueDates.length
      ? new Date(Math.max(...dueDates.map((d) => d.getTime())))
      : null;

    return { ...project, doneTasks, dueDate };
  }

  async getTemplates() {
    return this.prisma.projectTemplate.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  async create(dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        emoji: dto.emoji,
        dealId: dto.dealId ?? null,
        templateId: dto.templateId ?? null,
        tagsJson: dto.tags ?? [],
      },
      select: PROJECT_LIST_SELECT,
    });

    if (dto.templateId) {
      await this.instantiateTemplateTasks(project.id, dto.templateId);
    }

    return this.mapProject(project);
  }

  async createFromTemplate(projectId: string, templateId: string) {
    await this.assertProjectExists(projectId);
    await this.instantiateTemplateTasks(projectId, templateId);
    return this.findOne(projectId);
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.assertProjectExists(id);
    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}),
        ...(dto.dealId !== undefined ? { dealId: dto.dealId } : {}),
        ...(dto.tags !== undefined ? { tagsJson: dto.tags } : {}),
      },
      select: PROJECT_LIST_SELECT,
    });
    return this.mapProject(project);
  }

  async remove(id: string) {
    await this.assertProjectExists(id);
    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async changeStatus(id: string, dto: ChangeStatusDto) {
    await this.assertProjectExists(id);
    const project = await this.prisma.project.update({
      where: { id },
      data: { status: dto.status },
      select: PROJECT_LIST_SELECT,
    });
    return this.mapProject(project);
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async findTasks(query: QueryTasksDto) {
    const { page = 1, limit = 50, projectId, assigneeId, done } = query;

    const where: Prisma.TaskWhereInput = {
      project: { deletedAt: null },
      ...(projectId ? { projectId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(done !== undefined ? { done: done === 'true' } : {}),
    };

    const skip = (page - 1) * limit;
    const [total, tasks] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { order: 'asc' }],
        select: {
          ...TASK_SELECT,
          project: { select: { id: true, name: true, emoji: true } },
        },
      }),
    ]);

    return {
      data: tasks,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async createTask(projectId: string, dto: CreateTaskDto) {
    await this.assertProjectExists(projectId);

    const maxOrder = await this.prisma.task.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    const nextOrder = dto.order ?? (maxOrder._max.order ?? -1) + 1;

    return this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId: dto.assigneeId ?? null,
        order: nextOrder,
        done: dto.done ?? false,
        doneAt: dto.done ? new Date() : null,
      },
      select: TASK_SELECT,
    });
  }

  async updateTask(taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { deletedAt: null } },
      select: { id: true, done: true },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    const toggledDone = dto.done !== undefined && dto.done !== task.done;

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.done !== undefined ? { done: dto.done } : {}),
        ...(toggledDone ? { doneAt: dto.done ? new Date() : null } : {}),
      },
      select: TASK_SELECT,
    });
  }

  async removeTask(taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { deletedAt: null } },
      select: { id: true },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    await this.prisma.task.delete({ where: { id: taskId } });
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async assertProjectExists(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  private async instantiateTemplateTasks(projectId: string, templateId: string) {
    const template = await this.prisma.projectTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    const templateTasks = template.tasksJson as Array<{
      title: string;
      relativeDueDays: number;
    }>;

    const now = new Date();
    await this.prisma.task.createMany({
      data: templateTasks.map((t, i) => ({
        projectId,
        title: t.title,
        dueDate: new Date(now.getTime() + t.relativeDueDays * 86_400_000),
        order: i,
      })),
    });
  }

  private mapProject(project: Prisma.ProjectGetPayload<{ select: typeof PROJECT_LIST_SELECT }>) {
    const tasks = project.tasks as Array<{ done: boolean; dueDate: Date | null }>;
    const doneTasks = tasks.filter((t) => t.done).length;
    const totalTasks = tasks.length;
    const dueDates = tasks.map((t) => t.dueDate).filter(Boolean) as Date[];
    const dueDate = dueDates.length
      ? new Date(Math.max(...dueDates.map((d) => d.getTime())))
      : null;
    const { tasks: _omit, ...rest } = project; // eslint-disable-line @typescript-eslint/no-unused-vars

    return { ...rest, doneTasks, totalTasks, dueDate };
  }
}
