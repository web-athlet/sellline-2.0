import { apiFetch } from './api-client';

export type ProjectStatus = 'KICKOFF' | 'PLANNING' | 'IMPLEMENTATION' | 'REVIEW' | 'CLOSING';

export const PROJECT_STATUSES: ProjectStatus[] = [
  'KICKOFF',
  'PLANNING',
  'IMPLEMENTATION',
  'REVIEW',
  'CLOSING',
];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  KICKOFF: 'Kick-Off',
  PLANNING: 'Planung',
  IMPLEMENTATION: 'Implementierung',
  REVIEW: 'Überprüfen',
  CLOSING: 'Schließen',
};

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  KICKOFF: '#6366f1',
  PLANNING: '#3b82f6',
  IMPLEMENTATION: '#f59e0b',
  REVIEW: '#8b5cf6',
  CLOSING: '#10b981',
};

export interface TaskAssignee {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  done: boolean;
  doneAt: string | null;
  assigneeId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  assignee: TaskAssignee | null;
}

export interface TaskWithProject extends Task {
  project: { id: string; name: string; emoji: string | null };
}

export interface ProjectDeal {
  id: string;
  title: string;
}

export interface Project {
  id: string;
  name: string;
  emoji: string | null;
  dealId: string | null;
  templateId: string | null;
  status: ProjectStatus;
  tagsJson: string[];
  doneTasks: number;
  totalTasks: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  deal: ProjectDeal | null;
}

export interface ProjectDetail extends Project {
  template: { id: string; name: string } | null;
  tasks: Task[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  emoji: string | null;
  tasksJson: Array<{ title: string; relativeDueDays: number }>;
  createdAt: string;
}

export interface ProjectsResponse {
  data: Project[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface TasksResponse {
  data: TaskWithProject[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface CreateProjectInput {
  name: string;
  emoji?: string;
  dealId?: string;
  templateId?: string;
  tags?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  emoji?: string;
  dealId?: string;
  tags?: string[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  assigneeId?: string;
  order?: number;
  done?: boolean;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  order?: number;
  done?: boolean;
}

export interface ProjectsQuery {
  dealId?: string;
  status?: ProjectStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TasksQuery {
  projectId?: string;
  assigneeId?: string;
  done?: boolean;
  page?: number;
  limit?: number;
}

const buildQs = (params: ProjectsQuery | TasksQuery | Record<string, unknown>): string => {
  const qs = new URLSearchParams(
    Object.entries(params as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return qs ? `?${qs}` : '';
};

export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: (q: ProjectsQuery) => [...projectsKeys.lists(), q] as const,
  detail: (id: string) => [...projectsKeys.all, 'detail', id] as const,
  templates: () => [...projectsKeys.all, 'templates'] as const,
};

export const tasksKeys = {
  all: ['tasks'] as const,
  lists: () => [...tasksKeys.all, 'list'] as const,
  list: (q: TasksQuery) => [...tasksKeys.lists(), q] as const,
};

export async function listProjects(
  query: ProjectsQuery = {},
  token?: string,
): Promise<ProjectsResponse> {
  return apiFetch<ProjectsResponse>(`/api/v1/projects${buildQs(query)}`, { accessToken: token });
}

export async function getProject(id: string, token?: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/api/v1/projects/${id}`, { accessToken: token });
}

export async function getTemplates(token?: string): Promise<ProjectTemplate[]> {
  return apiFetch<ProjectTemplate[]>('/api/v1/projects/templates', { accessToken: token });
}

export async function createProject(input: CreateProjectInput, token?: string): Promise<Project> {
  return apiFetch<Project>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken: token,
  });
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  token?: string,
): Promise<Project> {
  return apiFetch<Project>(`/api/v1/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    accessToken: token,
  });
}

export async function deleteProject(id: string, token?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/projects/${id}`, { method: 'DELETE', accessToken: token });
}

export async function changeProjectStatus(
  id: string,
  status: ProjectStatus,
  token?: string,
): Promise<Project> {
  return apiFetch<Project>(`/api/v1/projects/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    accessToken: token,
  });
}

export async function createProjectFromTemplate(
  projectId: string,
  templateId: string,
  token?: string,
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/api/v1/projects/${projectId}/from-template`, {
    method: 'POST',
    body: JSON.stringify({ templateId }),
    accessToken: token,
  });
}

export async function listTasks(query: TasksQuery = {}, token?: string): Promise<TasksResponse> {
  return apiFetch<TasksResponse>(`/api/v1/tasks${buildQs(query)}`, { accessToken: token });
}

export async function createTask(
  projectId: string,
  input: CreateTaskInput,
  token?: string,
): Promise<Task> {
  return apiFetch<Task>(`/api/v1/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken: token,
  });
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
  token?: string,
): Promise<Task> {
  return apiFetch<Task>(`/api/v1/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    accessToken: token,
  });
}

export async function deleteTask(taskId: string, token?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/tasks/${taskId}`, { method: 'DELETE', accessToken: token });
}
