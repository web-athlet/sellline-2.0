---
title: "Scoring-Formel (regelbasiert, kein LLM)"
tags: [scoring, algorithm, ai-agent, deals]
status: active
last_updated: 2026-05-07
summary: "Regelbasierte Score-Berechnung 0-100. Kein LLM-Aufruf noetig. Trigger: Aktivitaet, Stage-Wechsel, E-Mail-Event."
---
# Scoring-Formel (Scoring Agent)

## Kein LLM — bewusste Entscheidung
Regelbasiert statt GPT-4o: schneller, guenstiger, deterministisch, testbar.
Referenz: ADR 0002.

## Formel

```typescript
function calculateScore(lead: Lead, interactions: Interaction[]): number {
  let score = 0;

  // Fit-Score (Firmen-Profil) — max 45 Punkte
  if (lead.company.mitarbeiterzahl >= 50 && lead.company.mitarbeiterzahl <= 500)
    score += 20;
  if (['SaaS', 'E-Commerce', 'FinTech'].includes(lead.company.branche ?? ''))
    score += 15;
  if ((lead.company.jahresumsatz ?? 0) > 1_000_000)
    score += 10;

  // Engagement-Score — max 25 Punkte
  const opens = interactions.filter(i => i.type === 'email_open').length;
  const clicks = interactions.filter(i => i.type === 'email_click').length;
  score += Math.min(opens * 2, 10);
  score += Math.min(clicks * 5, 15);

  // Recency-Score — max 15 Punkte
  const daysSince = differenceInDays(new Date(), lead.lastInteractionAt);
  if (daysSince < 7) score += 15;
  else if (daysSince < 30) score += 5;

  // Vollstaendigkeit — max 10 Punkte
  if (lead.person.email && lead.person.phone && lead.company.website) score += 10;

  return Math.min(score, 100);
}
```

## Trigger
- `lead.created` → initiales Scoring
- `lead.interaction` → Debounce 30s, dann neu berechnen
- `stage.changed` → neu berechnen

## Auto-Convert-Regel
Score >= 80 UND `autoConvertEnabled = true` → Lead zu Deal (Stage: Qualifiziert)
