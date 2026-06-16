/** Keys whose values must never be persisted to the audit log (PII/secrets). */
const SENSITIVE_KEY =
  /pass(word)?|token|secret|twofactor|2fa|otp|\bcode\b|credential|authorization/i;

const REDACTED = '[REDACTED]';
const MAX_SERIALIZED_BYTES = 64 * 1024;

/**
 * Deep-redacts sensitive keys and normalises Dates so the result is safe, finite
 * JSON for the AuditLog.changes column. Returns `undefined` for unserialisable or
 * oversized payloads (so the audit row stays small and never leaks secrets).
 */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (t !== 'object') return undefined; // functions, symbols, bigint
  const obj = value as object;
  if (seen.has(obj)) return undefined; // circular guard
  seen.add(obj);
  if (Array.isArray(value)) return value.map((v) => redact(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, seen);
  }
  return out;
}

/** Redacts then caps the payload size; oversized payloads collapse to a marker. */
export function redactCapped(value: unknown): unknown {
  const redacted = redact(value);
  if (redacted === undefined) return null;
  try {
    if (JSON.stringify(redacted).length > MAX_SERIALIZED_BYTES) {
      return { truncated: true };
    }
  } catch {
    return null;
  }
  return redacted;
}

/**
 * Derives a coarse entity name from a request path, e.g. `/api/v1/deals/:id` → `deals`.
 * Generic by design — manual auditLog.create calls keep their precise tableName.
 */
export function extractEntity(path: string): string {
  const segments = (path.split('?')[0] ?? '')
    .split('/')
    .filter((s) => s && s !== 'api' && !/^v\d+$/.test(s));
  const first = segments[0];
  if (!first || first.startsWith(':')) return 'unknown';
  return first;
}
