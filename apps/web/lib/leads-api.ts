import { apiFetch } from './api-client';

export type EnrichmentStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface FormRef {
  id: string;
  name: string;
}

export interface Lead {
  id: string;
  source: string;
  formId: string | null;
  dataJson: Record<string, unknown>;
  enrichedJson: Record<string, unknown> | null;
  enrichmentStatus: EnrichmentStatus;
  convertedDealId: string | null;
  companyName: string | null;
  emailDomain: string | null;
  createdAt: string;
  updatedAt: string;
  form: FormRef | null;
}

export interface LeadsResponse {
  data: Lead[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface FormField {
  id: string;
  type:
    | 'text'
    | 'email'
    | 'tel'
    | 'textarea'
    | 'number'
    | 'dropdown'
    | 'checkbox'
    | 'radio'
    | 'date'
    | 'file';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  defaultValue?: string;
  validation?: string;
}

export interface Form {
  id: string;
  name: string;
  schemaJson: FormField[];
  notifyEmails: string[];
  isActive: boolean;
  submissions: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormEmbed {
  formId: string;
  formName: string;
  embedUrl: string;
  snippet: string;
}

export interface ConvertLeadInput {
  dealTitle: string;
  dealValue?: number;
  pipelineId: string;
  stageId: string;
  ownerId: string;
}

export interface ConvertLeadResult {
  person: { id: string; firstName: string; lastName: string };
  deal: { id: string; title: string; value: string; currency: string };
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const leadsKeys = {
  all: () => ['leads'] as const,
  list: (filters?: Record<string, unknown>) => ['leads', 'list', filters] as const,
  detail: (id: string) => ['leads', 'detail', id] as const,
};

export const formsKeys = {
  all: () => ['forms'] as const,
  list: () => ['forms', 'list'] as const,
  detail: (id: string) => ['forms', 'detail', id] as const,
  embed: (id: string) => ['forms', 'embed', id] as const,
};

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function listLeads(
  params: { enrichmentStatus?: EnrichmentStatus; formId?: string; page?: number; limit?: number },
  token?: string,
): Promise<LeadsResponse> {
  const q = new URLSearchParams();
  if (params.enrichmentStatus) q.set('enrichmentStatus', params.enrichmentStatus);
  if (params.formId) q.set('formId', params.formId);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch<LeadsResponse>(`/api/v1/leads${qs ? `?${qs}` : ''}`, { accessToken: token });
}

export async function getLead(id: string, token?: string): Promise<Lead> {
  return apiFetch<Lead>(`/api/v1/leads/${id}`, { accessToken: token });
}

export async function convertLead(
  id: string,
  input: ConvertLeadInput,
  token?: string,
): Promise<ConvertLeadResult> {
  return apiFetch<ConvertLeadResult>(`/api/v1/leads/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken: token,
  });
}

export async function reEnqueueLead(id: string, token?: string): Promise<{ queued: boolean }> {
  return apiFetch<{ queued: boolean }>(`/api/v1/leads/${id}/enrich`, {
    method: 'POST',
    accessToken: token,
  });
}

export async function deleteLead(id: string, token?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/leads/${id}`, { method: 'DELETE', accessToken: token });
}

// ── Forms ─────────────────────────────────────────────────────────────────────

export async function listForms(token?: string): Promise<Form[]> {
  return apiFetch<Form[]>('/api/v1/forms', { accessToken: token });
}

export async function getForm(id: string, token?: string): Promise<Form> {
  return apiFetch<Form>(`/api/v1/forms/${id}`, { accessToken: token });
}

export async function createForm(
  input: { name: string; schemaJson: FormField[]; notifyEmails?: string[]; isActive?: boolean },
  token?: string,
): Promise<Form> {
  return apiFetch<Form>('/api/v1/forms', {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken: token,
  });
}

export async function updateForm(
  id: string,
  input: Partial<{
    name: string;
    schemaJson: FormField[];
    notifyEmails: string[];
    isActive: boolean;
  }>,
  token?: string,
): Promise<Form> {
  return apiFetch<Form>(`/api/v1/forms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
    accessToken: token,
  });
}

export async function deleteForm(id: string, token?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/forms/${id}`, { method: 'DELETE', accessToken: token });
}

export async function getFormEmbed(id: string, token?: string): Promise<FormEmbed> {
  return apiFetch<FormEmbed>(`/api/v1/forms/${id}/embed`, { accessToken: token });
}

// ── Public submit ─────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function submitPublicForm(
  formId: string,
  data: Record<string, unknown>,
): Promise<Lead> {
  const res = await fetch(`${API_URL}/api/v1/public/forms/${formId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
  return res.json() as Promise<Lead>;
}

// ── Label helpers ─────────────────────────────────────────────────────────────

export const ENRICHMENT_LABEL: Record<EnrichmentStatus, string> = {
  PENDING: 'Ausstehend',
  PROCESSING: 'Wird angereichert...',
  DONE: 'Angereichert',
  FAILED: 'Fehlgeschlagen',
};

export const FIELD_TYPE_LABEL: Record<FormField['type'], string> = {
  text: 'Text',
  email: 'E-Mail',
  tel: 'Telefon',
  textarea: 'Textbereich',
  number: 'Zahl',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
  radio: 'Radio',
  date: 'Datum',
  file: 'Datei-Upload',
};
