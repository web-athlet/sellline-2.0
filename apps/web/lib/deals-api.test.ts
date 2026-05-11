import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changeDealStage,
  createDeal,
  deleteDeal,
  getDeal,
  getPipelineSummary,
  listDeals,
  listPipelines,
  markDealLost,
  markDealWon,
  snoozeDealGhosting,
  updateDeal,
} from './deals-api';

const fetchMock = vi.fn();
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deals-api', () => {
  it('listDeals appends query string', async () => {
    fetchMock.mockResolvedValue(ok({ data: [], meta: {} }));
    await listDeals({ pipelineId: 'p1', limit: 100 });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('pipelineId=p1');
    expect(url).toContain('limit=100');
  });

  it('createDeal POSTs body', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1' }));
    await createDeal({ title: 't', pipelineId: 'p', stageId: 's' });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toContain('"title":"t"');
  });

  it('changeDealStage PATCHes /:id/stage', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1' }));
    await changeDealStage('d1', { stageId: 's2', order: 0 });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(url).toContain('/api/v1/deals/d1/stage');
    expect(init.method).toBe('PATCH');
  });

  it('markDealWon POSTs to /:id/won', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await markDealWon('d1');
    expect(fetchMock.mock.calls[0]?.[0] as string).toContain('/d1/won');
  });

  it('markDealLost sends lostReason', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await markDealLost('d1', 'budget');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toContain('"lostReason":"budget"');
  });

  it('snoozeDealGhosting sends days', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await snoozeDealGhosting('d1', 7);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toContain('"days":7');
  });

  it('deleteDeal DELETEs', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await deleteDeal('d1');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('DELETE');
  });

  it('updateDeal PATCHes', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await updateDeal('d1', { title: 'x' });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('PATCH');
  });

  it('getDeal GETs detail path', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'd1' }));
    await getDeal('d1');
    expect(fetchMock.mock.calls[0]?.[0] as string).toContain('/api/v1/deals/d1');
  });

  it('listPipelines + summary hit their paths', async () => {
    fetchMock.mockResolvedValue(ok([]));
    await listPipelines();
    expect(fetchMock.mock.calls[0]?.[0] as string).toContain('/api/v1/pipelines');

    fetchMock.mockResolvedValue(ok({ pipelineId: 'p', stages: [] }));
    await getPipelineSummary('p');
    expect(fetchMock.mock.calls[1]?.[0] as string).toContain('/api/v1/pipelines/p/summary');
  });
});
