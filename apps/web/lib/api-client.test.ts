import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api-client';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('returns parsed JSON on 2xx', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ hello: 'world' }), { status: 200 }));
    const out = await apiFetch<{ hello: string }>('/test');
    expect(out).toEqual({ hello: 'world' });
  });

  it('returns undefined on 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const out = await apiFetch<void>('/test', { method: 'POST' });
    expect(out).toBeUndefined();
  });

  it('throws ApiError with status + body on non-2xx', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Bad email' }), { status: 400 }),
    );
    await expect(apiFetch('/test', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      status: 400,
      message: 'Bad email',
    });
  });

  it('falls back to HTTP <status> when body has no message', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    await expect(apiFetch('/test')).rejects.toMatchObject({ status: 500, message: 'HTTP 500' });
  });

  it('attaches Authorization header when accessToken is provided', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await apiFetch('/test', { accessToken: 'abc' });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer abc');
  });

  it('sets Content-Type when body is present and not already set', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await apiFetch('/test', { method: 'POST', body: '{"a":1}' });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('always uses credentials: include', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await apiFetch('/test');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.credentials).toBe('include');
  });
});
