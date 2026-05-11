import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getContacts,
  getContact,
  getContactTimeline,
  createContact,
  updateContact,
  deleteContact,
  getDuplicates,
  mergeContacts,
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from './contacts-api';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('contacts-api', () => {
  describe('getContacts', () => {
    it('calls /api/v1/contacts without query string when no params', async () => {
      fetchMock.mockResolvedValue(ok({ data: [], meta: {} }));
      await getContacts();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/contacts'),
        expect.any(Object),
      );
    });

    it('appends query string when params provided', async () => {
      fetchMock.mockResolvedValue(ok({ data: [], meta: {} }));
      await getContacts({ page: 2, limit: 50, search: 'Max' });
      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('limit=50');
      expect(url).toContain('search=Max');
    });
  });

  describe('getContact', () => {
    it('calls /api/v1/contacts/:id', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'p1' }));
      await getContact('p1');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/contacts/p1'),
        expect.any(Object),
      );
    });
  });

  describe('getContactTimeline', () => {
    it('calls /api/v1/contacts/:id/timeline', async () => {
      fetchMock.mockResolvedValue(ok({ data: [] }));
      await getContactTimeline('p1');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/contacts/p1/timeline'),
        expect.any(Object),
      );
    });
  });

  describe('createContact', () => {
    it('calls POST /api/v1/contacts', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'p2' }));
      await createContact({ firstName: 'Max' });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/contacts'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('updateContact', () => {
    it('calls PATCH /api/v1/contacts/:id', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'p1' }));
      await updateContact('p1', { firstName: 'Updated' });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/contacts/p1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteContact', () => {
    it('calls DELETE /api/v1/contacts/:id', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      await deleteContact('p1');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/contacts/p1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('getDuplicates', () => {
    it('calls /api/v1/contacts/duplicates', async () => {
      fetchMock.mockResolvedValue(ok({ data: [], total: 0 }));
      await getDuplicates();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/contacts/duplicates'),
        expect.any(Object),
      );
    });
  });

  describe('mergeContacts', () => {
    it('calls POST /api/v1/contacts/merge with body', async () => {
      fetchMock.mockResolvedValue(ok({ success: true, masterId: 'm1' }));
      await mergeContacts('m1', 'd1');
      const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body as string)).toEqual({ masterId: 'm1', duplicateId: 'd1' });
    });
  });

  describe('getOrganizations', () => {
    it('calls /api/v1/organizations', async () => {
      fetchMock.mockResolvedValue(ok({ data: [], meta: {} }));
      await getOrganizations();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/organizations'),
        expect.any(Object),
      );
    });

    it('appends query string params', async () => {
      fetchMock.mockResolvedValue(ok({ data: [], meta: {} }));
      await getOrganizations({ page: 1, search: 'Acme' });
      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('search=Acme');
    });
  });

  describe('getOrganization', () => {
    it('calls /api/v1/organizations/:id', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'o1' }));
      await getOrganization('o1');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/organizations/o1'),
        expect.any(Object),
      );
    });
  });

  describe('createOrganization', () => {
    it('calls POST /api/v1/organizations', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'o2' }));
      await createOrganization({ name: 'New Org' });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/organizations'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('updateOrganization', () => {
    it('calls PATCH /api/v1/organizations/:id', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'o1' }));
      await updateOrganization('o1', { name: 'Updated' });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/organizations/o1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteOrganization', () => {
    it('calls DELETE /api/v1/organizations/:id', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      await deleteOrganization('o1');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/organizations/o1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
