const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ApiError extends Error {
  status: number;
  body: unknown;
}

const buildError = (status: number, body: unknown, message: string): ApiError => {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.body = body;
  return err;
};

export const apiFetch = async <T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> => {
  const headers = new Headers(init.headers ?? {});
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (init.accessToken) headers.set('Authorization', `Bearer ${init.accessToken}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${res.status}`;
    throw buildError(res.status, body, message);
  }
  return body as T;
};
