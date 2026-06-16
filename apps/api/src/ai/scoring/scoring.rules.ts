// Pure, rule-based lead scoring (0–100). No LLM — kept deterministic and unit-testable.
// Reconciled to the real schema: fit comes from Agent-1 enrichment, engagement from
// matched campaign interactions, recency from the lead's last update.

export interface ScoringInput {
  fit: {
    employeeCount: number | null;
    industry: string | null;
    revenue: number | null;
  };
  engagement: {
    opens: number;
    clicks: number;
  };
  /** Days since the lead's last interaction/update; null when unknown. */
  recencyDays: number | null;
  profile: {
    hasEmail: boolean;
    hasPhone: boolean;
    hasWebsite: boolean;
  };
}

export interface ScoreBreakdown {
  fit: number;
  engagement: number;
  recency: number;
  profile: number;
  total: number;
}

const TARGET_INDUSTRIES = new Set(['saas', 'e-commerce', 'fintech']);

export function calculateLeadScore(input: ScoringInput): ScoreBreakdown {
  // Fit
  let fit = 0;
  const emp = input.fit.employeeCount;
  if (emp != null && emp >= 50 && emp <= 500) fit += 20;
  if (input.fit.industry && TARGET_INDUSTRIES.has(input.fit.industry.trim().toLowerCase())) {
    fit += 15;
  }
  if (input.fit.revenue != null && input.fit.revenue > 1_000_000) fit += 10;

  // Engagement (capped)
  const engagement =
    Math.min(input.engagement.opens * 2, 10) + Math.min(input.engagement.clicks * 5, 15);

  // Recency
  let recency = 0;
  if (input.recencyDays != null) {
    if (input.recencyDays < 7) recency = 15;
    else if (input.recencyDays < 30) recency = 5;
  }

  // Profile completeness
  const profile =
    input.profile.hasEmail && input.profile.hasPhone && input.profile.hasWebsite ? 10 : 0;

  const total = Math.min(fit + engagement + recency + profile, 100);
  return { fit, engagement, recency, profile, total };
}
