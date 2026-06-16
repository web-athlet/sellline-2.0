// Structured output shape extracted by GPT-4o, plus the per-run cost record.

export interface SocialProfiles {
  linkedin?: string | null;
  xing?: string | null;
  twitter?: string | null;
}

export interface EnrichmentFields {
  branche: string | null;
  mitarbeiterzahl: number | null;
  jahresumsatz: number | null;
  headquarter: string | null;
  techStack: string[];
  socialProfiles: SocialProfiles;
}

export interface EnrichmentCost {
  serperCredits: number;
  openaiTokensIn: number;
  openaiTokensOut: number;
  estCostUsd: number;
}

// The 7 fields counted for AC-025 ("min. 4 von 7 Feldern").
export const ENRICHMENT_FIELD_KEYS: (keyof EnrichmentFields)[] = [
  'branche',
  'mitarbeiterzahl',
  'jahresumsatz',
  'headquarter',
  'techStack',
  'socialProfiles',
];

/** Count how many of the 7 schema fields were actually filled (non-null / non-empty). */
export function countFilledFields(fields: EnrichmentFields): number {
  let n = 0;
  if (fields.branche) n++;
  if (fields.mitarbeiterzahl != null) n++;
  if (fields.jahresumsatz != null) n++;
  if (fields.headquarter) n++;
  if (Array.isArray(fields.techStack) && fields.techStack.length > 0) n++;
  if (fields.socialProfiles && Object.values(fields.socialProfiles).some((v) => !!v)) n++;
  return n;
}

/** Normalise an untrusted GPT JSON object into a well-formed EnrichmentFields. */
export function normalizeFields(raw: unknown): EnrichmentFields {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
  const social = (obj.socialProfiles ?? {}) as Record<string, unknown>;

  return {
    branche: str(obj.branche),
    mitarbeiterzahl: num(obj.mitarbeiterzahl),
    jahresumsatz: num(obj.jahresumsatz),
    headquarter: str(obj.headquarter),
    techStack: Array.isArray(obj.techStack)
      ? obj.techStack.filter((t): t is string => typeof t === 'string')
      : [],
    socialProfiles: {
      linkedin: str(social.linkedin),
      xing: str(social.xing),
      twitter: str(social.twitter),
    },
  };
}
