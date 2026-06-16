// Shared constants for the Session-14 AI agents (Enrichment, Scoring, Ghosting, Cost).

// Canonical enrichment-queue name lives with its producer (LeadsService). Re-exported
// here so the AI module has a single import surface and there is one source of truth.
export { LEAD_ENRICHMENT_QUEUE } from '../modules/leads/leads.service';

// New queue for the rule-based Scoring-Worker (delayed + debounced per lead).
export const LEAD_SCORING_QUEUE = 'lead-scoring';

// `AIInsight.type` discriminators written by the agents.
export const AI_INSIGHT_TYPE = {
  ENRICHMENT: 'enrichment',
  SCORING: 'scoring',
  GHOSTING: 'ghosting_detected',
  BUDGET_ALERT: 'budget_alert',
} as const;

// Domains that never identify a company — skip Serper/scraping for these.
export const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'yahoo.de',
  'gmx.de',
  'gmx.net',
  'web.de',
  't-online.de',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
]);
