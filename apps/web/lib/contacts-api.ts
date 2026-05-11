import { apiFetch } from './api-client';

export interface ContactOrg {
  id: string;
  name: string;
}

export interface ContactActivity {
  id: string;
  type: string;
  subject: string;
  dueDate: string | null;
}

export interface ContactListItem {
  id: string;
  firstName: string;
  lastName: string;
  emails: string[];
  phones: string[];
  org: ContactOrg | null;
  openDeals: number;
  closedDeals: number;
  nextActivity: ContactActivity | null;
  ownerId: string | null;
  optIn: boolean;
  createdAt: string;
}

export interface ContactDetail extends Omit<
  ContactListItem,
  'openDeals' | 'closedDeals' | 'nextActivity'
> {
  notes: string | null;
  optInSource: string | null;
  optInAt: string | null;
  updatedAt: string;
  dealParticipations: DealSummary[];
  activities: ActivityDetail[];
}

export interface DealSummary {
  id: string;
  title: string;
  value: string;
  currency: string;
  closedAt: string | null;
  wonAt: string | null;
  stage: { id: string; name: string };
}

export interface ActivityDetail {
  id: string;
  type: string;
  subject: string;
  notes: string | null;
  dueDate: string | null;
  done: boolean;
  priority: string;
  createdAt: string;
}

export interface TimelineItem {
  id: string;
  _type: 'activity' | 'email';
  subject: string;
  createdAt?: string;
  sentAt?: string;
  dueDate?: string | null;
  type?: string;
  done?: boolean;
  fromAddress?: string;
  bodyPreview?: string;
  isRead?: boolean;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ContactsResponse {
  data: ContactListItem[];
  meta: PaginatedMeta;
}

export interface DuplicatePair {
  personA: { id: string; firstName: string; lastName: string; emails: string[] };
  personB: { id: string; firstName: string; lastName: string; emails: string[] };
  score: number;
}

export interface DuplicatesResponse {
  data: DuplicatePair[];
  total: number;
}

export interface OrgListItem {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  revenue: string | null;
  website: string | null;
  parent: ContactOrg | null;
  _count: { persons: number; deals: number; children: number };
  createdAt: string;
}

export interface OrgDetail extends OrgListItem {
  description: string | null;
  linkedinUrl: string | null;
  enrichedAt: string | null;
  children: OrgListItem[];
}

export interface OrgsResponse {
  data: OrgListItem[];
  meta: PaginatedMeta;
}

export type ContactSortField =
  | 'name'
  | '-name'
  | 'firstName'
  | '-firstName'
  | 'org'
  | '-org'
  | 'deals'
  | '-deals'
  | 'createdAt'
  | '-createdAt';

export interface ContactsQuery {
  page?: number;
  limit?: number;
  search?: string;
  orgId?: string;
  ownerId?: string;
  sort?: ContactSortField;
  accessToken?: string;
}

export async function getContacts(query: ContactsQuery = {}): Promise<ContactsResponse> {
  const { accessToken, ...params } = query;
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return apiFetch<ContactsResponse>(`/api/v1/contacts${qs ? `?${qs}` : ''}`, { accessToken });
}

export async function getContact(id: string, accessToken?: string): Promise<ContactDetail> {
  return apiFetch<ContactDetail>(`/api/v1/contacts/${id}`, { accessToken });
}

export async function getContactTimeline(
  id: string,
  accessToken?: string,
): Promise<{ data: TimelineItem[] }> {
  return apiFetch<{ data: TimelineItem[] }>(`/api/v1/contacts/${id}/timeline`, { accessToken });
}

export async function createContact(
  data: Partial<ContactDetail>,
  accessToken?: string,
): Promise<ContactDetail> {
  return apiFetch<ContactDetail>('/api/v1/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
    accessToken,
  });
}

export async function updateContact(
  id: string,
  data: Partial<ContactDetail>,
  accessToken?: string,
): Promise<ContactDetail> {
  return apiFetch<ContactDetail>(`/api/v1/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    accessToken,
  });
}

export async function deleteContact(id: string, accessToken?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/contacts/${id}`, { method: 'DELETE', accessToken });
}

export async function getDuplicates(accessToken?: string): Promise<DuplicatesResponse> {
  return apiFetch<DuplicatesResponse>('/api/v1/contacts/duplicates', { accessToken });
}

export async function mergeContacts(
  masterId: string,
  duplicateId: string,
  accessToken?: string,
): Promise<{ success: boolean; masterId: string }> {
  return apiFetch<{ success: boolean; masterId: string }>('/api/v1/contacts/merge', {
    method: 'POST',
    body: JSON.stringify({ masterId, duplicateId }),
    accessToken,
  });
}

export async function getOrganizations(
  query: {
    page?: number;
    limit?: number;
    search?: string;
    parentId?: string;
    sort?: string;
    accessToken?: string;
  } = {},
): Promise<OrgsResponse> {
  const { accessToken, ...params } = query;
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return apiFetch<OrgsResponse>(`/api/v1/organizations${qs ? `?${qs}` : ''}`, { accessToken });
}

export async function getOrganization(id: string, accessToken?: string): Promise<OrgDetail> {
  return apiFetch<OrgDetail>(`/api/v1/organizations/${id}`, { accessToken });
}

export async function createOrganization(
  data: Partial<OrgDetail>,
  accessToken?: string,
): Promise<OrgDetail> {
  return apiFetch<OrgDetail>('/api/v1/organizations', {
    method: 'POST',
    body: JSON.stringify(data),
    accessToken,
  });
}

export async function updateOrganization(
  id: string,
  data: Partial<OrgDetail>,
  accessToken?: string,
): Promise<OrgDetail> {
  return apiFetch<OrgDetail>(`/api/v1/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    accessToken,
  });
}

export async function deleteOrganization(id: string, accessToken?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/organizations/${id}`, { method: 'DELETE', accessToken });
}
