import { apiFetch } from './api-client';

export interface EmailSummary {
  id: string;
  threadId: string;
  fromAddress: string;
  toAddresses: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyPreview: string;
  isRead: boolean;
  isSent: boolean;
  sentAt: string;
  dealId: string | null;
  userId: string;
  createdAt: string;
  deal: { id: string; title: string } | null;
}

export interface ThreadDetail {
  threadId: string;
  emails: EmailSummary[];
}

export interface ThreadsResponse {
  data: EmailSummary[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface AISummary {
  bullets: string[];
  suggestedReply: string | null;
  tone: 'friendly' | 'neutral' | 'urgent';
  skipped?: boolean;
}

export interface ProviderStatus {
  gmail: { connected: boolean; watchExpiresAt: string | null };
  outlook: { connected: boolean; subscriptionExpiresAt: string | null };
}

export interface SendEmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  dealId?: string;
  threadId?: string;
  inReplyToMessageId?: string;
}

export interface EmailQuery {
  page?: number;
  limit?: number;
  dealId?: string;
  search?: string;
}

function buildQs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (!entries.length) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  );
}

export async function listThreads(query: EmailQuery = {}): Promise<ThreadsResponse> {
  return apiFetch<ThreadsResponse>(
    `/api/v1/email/threads${buildQs(query as Record<string, unknown>)}`,
  );
}

export async function getThread(threadId: string): Promise<ThreadDetail> {
  return apiFetch<ThreadDetail>(`/api/v1/email/threads/${encodeURIComponent(threadId)}`);
}

export async function summarizeThread(threadId: string): Promise<AISummary> {
  return apiFetch<AISummary>(`/api/v1/email/threads/${encodeURIComponent(threadId)}/summary`);
}

export async function sendEmail(payload: SendEmailPayload): Promise<{ emailId: string }> {
  return apiFetch<{ emailId: string }>('/api/v1/email/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getUnreadCount(): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>('/api/v1/email/count');
}

export async function getProviders(): Promise<ProviderStatus> {
  return apiFetch<ProviderStatus>('/api/v1/email/providers');
}

export async function getGmailConnectUrl(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/api/v1/email/gmail/connect-url');
}

export async function disconnectGmail(): Promise<void> {
  await apiFetch<void>('/api/v1/email/gmail/disconnect', { method: 'DELETE' });
}

export async function getOutlookConnectUrl(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/api/v1/email/outlook/connect-url');
}

export async function disconnectOutlook(): Promise<void> {
  await apiFetch<void>('/api/v1/email/outlook/disconnect', { method: 'DELETE' });
}
