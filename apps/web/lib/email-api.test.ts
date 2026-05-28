import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as apiClient from './api-client';
import {
  listThreads,
  getThread,
  sendEmail,
  getUnreadCount,
  getProviders,
  getGmailConnectUrl,
  disconnectGmail,
  summarizeThread,
} from './email-api';

vi.mock('./api-client', () => ({ apiFetch: vi.fn() }));

const apiFetchMock = vi.mocked(apiClient.apiFetch);

beforeEach(() => {
  vi.resetAllMocks();
});

const makeThread = (overrides = {}) => ({
  id: 'email-1',
  threadId: 'thread-1',
  fromAddress: 'alice@acme.com',
  toAddresses: ['bob@nextgen.com'],
  cc: [],
  bcc: [],
  subject: 'Test',
  bodyPreview: 'Hello',
  isRead: false,
  isSent: false,
  sentAt: '2026-05-22T10:00:00Z',
  dealId: null,
  userId: 'user-1',
  createdAt: '2026-05-22T10:00:00Z',
  deal: null,
  ...overrides,
});

describe('listThreads', () => {
  it('fetches without query params', async () => {
    apiFetchMock.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 50, pages: 0 } });

    await listThreads();

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/email/threads');
  });

  it('builds query string from params', async () => {
    apiFetchMock.mockResolvedValue({ data: [], meta: {} });

    await listThreads({ search: 'invoice', dealId: 'deal-1', page: 2, limit: 25 });

    const url = apiFetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('search=invoice');
    expect(url).toContain('dealId=deal-1');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=25');
  });

  it('omits empty/undefined params', async () => {
    apiFetchMock.mockResolvedValue({ data: [], meta: {} });

    await listThreads({ search: '', dealId: undefined });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/email/threads');
  });
});

describe('getThread', () => {
  it('fetches thread by id', async () => {
    const detail = { threadId: 'thread-1', emails: [makeThread()] };
    apiFetchMock.mockResolvedValue(detail);

    const result = await getThread('thread-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/email/threads/thread-1');
    expect(result.threadId).toBe('thread-1');
  });

  it('URL-encodes special characters in threadId', async () => {
    apiFetchMock.mockResolvedValue({ threadId: 'thread/123', emails: [] });

    await getThread('thread/123');

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/email/threads/thread%2F123');
  });
});

describe('summarizeThread', () => {
  it('fetches AI summary for thread', async () => {
    apiFetchMock.mockResolvedValue({ bullets: ['Point 1'], suggestedReply: 'Hi', tone: 'neutral' });

    const result = await summarizeThread('thread-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/email/threads/thread-1/summary');
    expect(result.tone).toBe('neutral');
  });
});

describe('sendEmail', () => {
  it('posts to send endpoint', async () => {
    apiFetchMock.mockResolvedValue({ emailId: 'new-email' });

    const result = await sendEmail({
      to: ['alice@acme.com'],
      subject: 'Hello',
      bodyHtml: '<p>Hi</p>',
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v1/email/send',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.emailId).toBe('new-email');
  });
});

describe('getUnreadCount', () => {
  it('fetches unread count', async () => {
    apiFetchMock.mockResolvedValue({ unread: 7 });

    const result = await getUnreadCount();

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/email/count');
    expect(result.unread).toBe(7);
  });
});

describe('getProviders', () => {
  it('fetches provider status', async () => {
    apiFetchMock.mockResolvedValue({
      gmail: { connected: true, watchExpiresAt: null },
      outlook: { connected: false, subscriptionExpiresAt: null },
    });

    const result = await getProviders();

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/email/providers');
    expect(result.gmail.connected).toBe(true);
    expect(result.outlook.connected).toBe(false);
  });
});

describe('getGmailConnectUrl', () => {
  it('fetches OAuth connect URL', async () => {
    apiFetchMock.mockResolvedValue({ url: 'https://accounts.google.com/...' });

    const result = await getGmailConnectUrl();

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/email/gmail/connect-url');
    expect(result.url).toContain('accounts.google.com');
  });
});

describe('disconnectGmail', () => {
  it('calls DELETE endpoint', async () => {
    apiFetchMock.mockResolvedValue(undefined);

    await disconnectGmail();

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v1/email/gmail/disconnect',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
