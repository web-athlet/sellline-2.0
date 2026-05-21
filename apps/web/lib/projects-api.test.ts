import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listProjects,
  getProject,
  getTemplates,
  createProject,
  updateProject,
  deleteProject,
  changeProjectStatus,
  createProjectFromTemplate,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  projectsKeys,
  tasksKeys,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_COLOR,
  PROJECT_STATUSES,
} from './projects-api';

vi.mock('./api-client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './api-client';
const mockFetch = vi.mocked(apiFetch);

const TOKEN = 'tok-123';
const PROJECT_ID = 'proj-abc';
const TASK_ID = 'task-xyz';
const TEMPLATE_ID = 'tmpl-1';

beforeEach(() => {
  vi.resetAllMocks();
});

const makeProject = () => ({
  id: PROJECT_ID,
  name: 'Test',
  emoji: '🚀',
  dealId: null,
  templateId: null,
  status: 'KICKOFF' as const,
  tagsJson: [],
  doneTasks: 0,
  totalTasks: 5,
  dueDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deal: null,
});

describe('PROJECT_STATUSES', () => {
  it('has 5 statuses', () => {
    expect(PROJECT_STATUSES).toHaveLength(5);
  });
});

describe('PROJECT_STATUS_LABEL', () => {
  it('maps KICKOFF to Kick-Off', () => {
    expect(PROJECT_STATUS_LABEL.KICKOFF).toBe('Kick-Off');
  });
});

describe('PROJECT_STATUS_COLOR', () => {
  it('has a color for each status', () => {
    for (const s of PROJECT_STATUSES) {
      expect(PROJECT_STATUS_COLOR[s]).toMatch(/^#/);
    }
  });
});

describe('projectsKeys', () => {
  it('builds stable cache keys', () => {
    expect(projectsKeys.all).toEqual(['projects']);
    expect(projectsKeys.lists()).toEqual(['projects', 'list']);
    expect(projectsKeys.list({ status: 'KICKOFF' })).toEqual([
      'projects',
      'list',
      { status: 'KICKOFF' },
    ]);
    expect(projectsKeys.detail('p1')).toEqual(['projects', 'detail', 'p1']);
    expect(projectsKeys.templates()).toEqual(['projects', 'templates']);
  });
});

describe('tasksKeys', () => {
  it('builds stable cache keys', () => {
    expect(tasksKeys.all).toEqual(['tasks']);
    expect(tasksKeys.list({ assigneeId: 'u1' })).toEqual(['tasks', 'list', { assigneeId: 'u1' }]);
  });
});

describe('listProjects', () => {
  it('calls correct URL with query params', async () => {
    mockFetch.mockResolvedValue({ data: [], meta: {} });
    await listProjects({ status: 'KICKOFF', page: 2 }, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('status=KICKOFF'),
      expect.objectContaining({ accessToken: TOKEN }),
    );
  });

  it('calls plain URL with empty query', async () => {
    mockFetch.mockResolvedValue({ data: [], meta: {} });
    await listProjects({}, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects', expect.any(Object));
  });
});

describe('getProject', () => {
  it('calls correct URL', async () => {
    mockFetch.mockResolvedValue(makeProject());
    await getProject(PROJECT_ID, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(`/api/v1/projects/${PROJECT_ID}`, expect.any(Object));
  });
});

describe('getTemplates', () => {
  it('calls templates endpoint', async () => {
    mockFetch.mockResolvedValue([]);
    await getTemplates(TOKEN);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/templates', expect.any(Object));
  });
});

describe('createProject', () => {
  it('POSTs to /api/v1/projects', async () => {
    mockFetch.mockResolvedValue(makeProject());
    await createProject({ name: 'New Project', emoji: '🚀' }, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/projects',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('updateProject', () => {
  it('PATCHes the project', async () => {
    mockFetch.mockResolvedValue(makeProject());
    await updateProject(PROJECT_ID, { name: 'Renamed' }, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/projects/${PROJECT_ID}`,
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

describe('deleteProject', () => {
  it('DELETEs the project', async () => {
    mockFetch.mockResolvedValue(undefined);
    await deleteProject(PROJECT_ID, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/projects/${PROJECT_ID}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('changeProjectStatus', () => {
  it('PATCHes the status endpoint', async () => {
    mockFetch.mockResolvedValue(makeProject());
    await changeProjectStatus(PROJECT_ID, 'PLANNING', TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/projects/${PROJECT_ID}/status`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'PLANNING' }) }),
    );
  });
});

describe('createProjectFromTemplate', () => {
  it('POSTs to from-template endpoint', async () => {
    mockFetch.mockResolvedValue({ ...makeProject(), tasks: [] });
    await createProjectFromTemplate(PROJECT_ID, TEMPLATE_ID, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/projects/${PROJECT_ID}/from-template`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ templateId: TEMPLATE_ID }),
      }),
    );
  });
});

describe('listTasks', () => {
  it('calls correct URL with filters', async () => {
    mockFetch.mockResolvedValue({ data: [], meta: {} });
    await listTasks({ assigneeId: 'u-1', done: false }, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('assigneeId=u-1'),
      expect.any(Object),
    );
  });
});

describe('createTask', () => {
  it('POSTs to project tasks endpoint', async () => {
    mockFetch.mockResolvedValue({ id: TASK_ID });
    await createTask(PROJECT_ID, { title: 'New Task' }, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/projects/${PROJECT_ID}/tasks`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('updateTask', () => {
  it('PATCHes the task', async () => {
    mockFetch.mockResolvedValue({ id: TASK_ID });
    await updateTask(TASK_ID, { done: true }, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/tasks/${TASK_ID}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ done: true }) }),
    );
  });
});

describe('deleteTask', () => {
  it('DELETEs the task', async () => {
    mockFetch.mockResolvedValue(undefined);
    await deleteTask(TASK_ID, TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/tasks/${TASK_ID}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
