import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from './api-client';
import {
  addCampaignContacts,
  campaignsKeys,
  createCampaign,
  deleteCampaign,
  getAiSubjects,
  getCampaign,
  listCampaigns,
  removeCampaignContact,
  sendCampaign,
  testSendCampaign,
  updateCampaign,
} from './campaigns-api';

vi.mock('./api-client', () => ({ apiFetch: vi.fn() }));

const mockFetch = vi.mocked(client.apiFetch);

describe('campaigns-api', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockResolvedValue({} as never);
  });

  // ─── Keys ────────────────────────────────────────────────────────────────

  it('campaignsKeys.all returns stable key', () => {
    expect(campaignsKeys.all()).toEqual(['campaigns']);
  });

  it('campaignsKeys.list includes query params', () => {
    expect(campaignsKeys.list({ status: 'DRAFT' })).toEqual([
      'campaigns',
      'list',
      { status: 'DRAFT' },
    ]);
  });

  it('campaignsKeys.detail includes id', () => {
    expect(campaignsKeys.detail('abc')).toEqual(['campaigns', 'detail', 'abc']);
  });

  // ─── listCampaigns ────────────────────────────────────────────────────────

  it('listCampaigns calls correct path without params', async () => {
    await listCampaigns({}, 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/campaigns',
      expect.objectContaining({ accessToken: 'tok' }),
    );
  });

  it('listCampaigns appends query string with status', async () => {
    await listCampaigns({ status: 'SENT', page: 2 }, 'tok');
    const path = (mockFetch.mock.calls[0] as [string])[0];
    expect(path).toContain('status=SENT');
    expect(path).toContain('page=2');
  });

  // ─── getCampaign ──────────────────────────────────────────────────────────

  it('getCampaign calls /api/v1/campaigns/:id', async () => {
    await getCampaign('camp-1', 'tok');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/campaigns/camp-1', expect.anything());
  });

  // ─── createCampaign ───────────────────────────────────────────────────────

  it('createCampaign posts to /api/v1/campaigns', async () => {
    await createCampaign({ name: 'N', subject: 'S', bodyHtml: '<p>Hi</p>' }, 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/campaigns',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('bodyHtml') }),
    );
  });

  // ─── updateCampaign ───────────────────────────────────────────────────────

  it('updateCampaign sends PATCH', async () => {
    await updateCampaign('camp-1', { subject: 'New' }, 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/campaigns/camp-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  // ─── deleteCampaign ───────────────────────────────────────────────────────

  it('deleteCampaign sends DELETE', async () => {
    await deleteCampaign('camp-1', 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/campaigns/camp-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  // ─── addCampaignContacts ─────────────────────────────────────────────────

  it('addCampaignContacts posts personIds', async () => {
    await addCampaignContacts('camp-1', ['p1', 'p2'], 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/campaigns/camp-1/contacts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ personIds: ['p1', 'p2'] }),
      }),
    );
  });

  // ─── removeCampaignContact ────────────────────────────────────────────────

  it('removeCampaignContact sends DELETE to correct path', async () => {
    await removeCampaignContact('camp-1', 'person-1', 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/campaigns/camp-1/contacts/person-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  // ─── sendCampaign ─────────────────────────────────────────────────────────

  it('sendCampaign posts to /send', async () => {
    await sendCampaign('camp-1', 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/campaigns/camp-1/send',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  // ─── testSendCampaign ────────────────────────────────────────────────────

  it('testSendCampaign posts to /test-send', async () => {
    await testSendCampaign('camp-1', 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/campaigns/camp-1/test-send',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  // ─── getAiSubjects ────────────────────────────────────────────────────────

  it('getAiSubjects posts to /ai-subjects', async () => {
    await getAiSubjects('camp-1', 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/campaigns/camp-1/ai-subjects',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
