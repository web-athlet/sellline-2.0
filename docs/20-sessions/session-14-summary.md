---
title: "Session 14 Summary — KI-Agenten (Enrichment, Scoring, Ghosting)"
tags: [session, summary, ai, agents, enrichment, scoring, ghosting, bullmq, openai, pgvector, cron]
status: completed
session: 14
last_updated: 2026-06-16
summary: "3 KI-Agenten als BullMQ-Worker + Cron in apps/api/src/ai: (1) Enrichment (Serper → Web-Scraper → GPT-4o → Organization-Upsert + pgvector-Embedding), (2) regelbasiertes Lead-Scoring (0–100, deterministisch, Auto-Convert ≥80 hinter Env-Flag), (3) Ghosting-Detection (täglicher Cron, >14 Tage stille Deals → ghostedAt + Follow-up-Activity). Budget-Wächter pausiert Enrichment-Queue bei 100 %. Eine konsolidierte Migration (Lead.score, Deal.ghostedAt, AIInsight.deletedAt + HNSW-Index). 52 neue AI-Tests. Vitest 1.6 → 3.2 Upgrade."
---

# Session 14 — KI-Agenten (Enrichment, Scoring, Ghosting-Detection)

## TLDR (5 Punkte)

1. **3 KI-Agenten gebaut** unter `apps/api/src/ai/` (neues `AiModule`):
   - **Agent 1 — Enrichment** (BullMQ `lead-enrichment`, Producer = `LeadsService` aus S8): Serper-Google-Search → robots.txt-konformer Web-Scraper → GPT-4o JSON-Extraktion → `Organization`-Upsert (per Domain) + `text-embedding-3-small`-Vektor in `enrichmentEmbedding`. **Resolves immer** — bei fehlendem Serper/OpenAI/Firmen-Signal `partial`-AIInsight statt Fehler, Lead läuft durch.
   - **Agent 2 — Scoring** (neue BullMQ-Queue `lead-scoring`, debounced 30 s, latest-wins): rein **regelbasiert/deterministisch** (kein LLM) → `Lead.score` (0–100). Optionale Auto-Konvertierung ≥80 (Person + Deal + Activity in einer Transaktion) hinter `AI_AUTO_CONVERT_ENABLED`.
   - **Agent 3 — Ghosting** (täglicher `@Cron('0 6 * * *')` UTC): offene Deals >14 Tage ohne Antwort → `ghostedAt` setzen + **eine** `Activity` (type `TASK`, Priority `HIGH`) als Follow-up, idempotent. Letzte Stage je Pipeline + won/lost/snoozed ausgeschlossen.
   - **Budget-Wächter** (`CostService`, `@Cron('0 7 * * *')` UTC): summiert Monats-Enrichment-Kosten aus AIInsights, **pausiert die Enrichment-Queue bei ≥100 %**, warnt bei ≥90 %, resumed automatisch bei Monatswechsel.

2. **Schema-Änderungen** (eine konsolidierte Migration `20260615120000_session14_ai_agents`):
   - `Lead.score Int @default(0)` + `Lead.scoreUpdatedAt DateTime?` + Index `Lead_score_idx`
   - `Deal.ghostedAt DateTime?` + Index `Deal_ghostedAt_idx`
   - `AIInsight.deletedAt DateTime?` + Index (Deep-Review-Tech-Debt **D1** erledigt)
   - Raw-SQL **HNSW**-Index auf `Organization.enrichmentEmbedding` (`vector_cosine_ops`) — Deep-Review-Tech-Debt **P6** erledigt; nicht im Prisma-Schema ausdrückbar (`Unsupported`-Typ).

3. **Neue Env-Variablen**: `SERPER_API_KEY` (optional — ohne → `partial`-Enrichment), `AI_MONTHLY_BUDGET_USD` (default 100), `AI_AUTO_CONVERT_ENABLED` (default `false`), `AI_DEFAULT_OWNER_EMAIL` (leer → erster ADMIN/MANAGER), `AI_ALERT_EMAIL` (leer → nur Log). `OPENAI_API_KEY` aus S11 wiederverwendet.

4. **Limitierungen**: (a) **Migration noch nicht angewendet** — lokale `.env`-`DATABASE_URL` hat ungültige Credentials (P1000); `prisma generate` lief, `prisma:migrate:deploy` muss mit gültigen Creds nachgezogen werden. (b) Kein Frontend — Session 14 ist reines Backend; Scoring-Badge/Ghosting-Anzeige im UI offen. (c) `MailService` für Budget-Alerts ist weiterhin Stub-Log (S12-Tech-Debt). (d) Vitest 1.6 → 3.2 Upgrade (Typ-Fixes `mock.calls[0]![0]` in 5 Specs).

5. **Nächste Session (15 — Security & DSGVO-Härtung) braucht**: Migration mit echten Creds anwenden; fehlende `@Roles()` auf AI-relevanten Lead-Mutationen (Tech-Debt #31) prüfen; Serper/OpenAI-Kosten in Deployment-Checkliste; PII-Prüfung der an OpenAI gesendeten Scrape-Snippets (nur öffentliche Web-Daten, dennoch dokumentieren).

## Backend-Architektur (`apps/api/src/ai/`)

### AiModule (`ai.module.ts`)
Registriert beide Queues (`lead-enrichment` re-konsumiert, `lead-scoring` neu), injiziert `openAiProvider` (über `OPENAI_CLIENT`-Symbol-Token → testbar, `null` ohne Key), exportiert die 4 Services. In `app.module.ts` eingehängt.

### Agent 1 — Enrichment
| Datei | Rolle |
|-------|-------|
| `enrichment/enrichment.service.ts` | Pipeline-Orchestrierung; `enrich()`, `handleDeadLetter()`, `finalizePartial()`, `persistOrganization()` (Upsert per Domain), `storeEmbedding()` (best-effort pgvector). |
| `enrichment/enrichment.processor.ts` | BullMQ-Consumer; ruft `enrich()`, bei Retry-Erschöpfung `handleDeadLetter()`. |
| `enrichment/serper.client.ts` | Serper Google-Search-Wrapper; `SerperQuotaError` für graceful Fallback. |
| `enrichment/web-scraper.ts` | robots.txt-Check (`isAllowed`) + HTML→Text (`fetchAllowedText`); Top-3-URLs. |
| `enrichment/enrichment.types.ts` | `normalizeFields`, `countFilledFields`, `EnrichmentFields`/`EnrichmentCost`. |
| `prompts/enrichment.ts` | `ENRICHMENT_SYSTEM` + `ENRICHMENT_USER(snippets)`. |

- Generische E-Mail-Domains (`gmail.com`, `gmx.de`, …) → kein Serper/Scrape.
- `enrichedJson` + `AIInsight(type:'enrichment')` mit `confidence` (gefüllte Felder / 7) und `cost`.
- Nach Erfolg/Partial → `scoring.enqueue(leadId)` (Kette Enrichment → Scoring).
- Retry-Policy in `leads.module.ts`: 3 Attempts, exponential Backoff 2 s, `removeOnFail: 500` = de-facto DLQ.

### Agent 2 — Scoring (`scoring/`)
- `scoring.rules.ts`: pure `calculateLeadScore(input)` → `{ fit, engagement, recency, profile, total }`.
  - **Fit** (max 45): MA 50–500 (+20), Ziel-Branche saas/e-commerce/fintech (+15), Umsatz >1 Mio (+10).
  - **Engagement** (max 25): `min(opens×2,10) + min(clicks×5,15)` — aus `Person.campaignContacts` (Match: `Person.emails has lead-email`).
  - **Recency** (max 15): <7 Tage (+15), <30 Tage (+5).
  - **Profile** (max 10): E-Mail + Phone + Website alle vorhanden.
- `scoring.service.ts`: liest `lead.dataJson` + `enrichedJson.fields`, schreibt `Lead.score`/`scoreUpdatedAt` + `AIInsight(type:'scoring')`; Auto-Convert ≥80 nur wenn `AI_AUTO_CONVERT_ENABLED` und noch nicht konvertiert.
- Debounce über `jobId = score-<leadId>` (alter Job wird entfernt, neuer mit 30 s Delay).

### Agent 3 — Ghosting (`ghosting/ghosting.service.ts`)
- `detectGhosting()`: Kandidaten = offene Deals (nicht won/lost/deleted, nicht in letzter Stage, snooze abgelaufen). **Last-Touch** zur Cron-Zeit berechnet aus `createdAt` + jüngster Activity (`doneAt ?? createdAt`) + jüngster empfangener E-Mail (`isSent:false`) — es gibt **kein** `Deal.lastResponseAt`.
- `>14 Tage still` → `ghostedAt = now`, Follow-up-`Activity` (idempotent über `subject startsWith 'Ghosting-Follow-up'`), `AIInsight(type:'ghosting_detected')`, WS `emitDealUpdated`.
- `ghostedAt` gesetzt → in Folgeläufen übersprungen (idempotent).

### Budget-Wächter (`cost/`)
- `cost.util.ts`: `estimateRunCostUsd({ serperCredits, openaiTokensIn, openaiTokensOut })` (reine Preis-Funktion).
- `cost.service.ts`: `checkBudget()` summiert Monats-Enrichment-`estCostUsd`, pausiert/resumed `lead-enrichment`-Queue, schreibt `AIInsight(type:'budget_alert')`, optional Mail an `AI_ALERT_EMAIL`.

### AIInsight-Typen (in `ai.constants.ts`)
`enrichment` · `scoring` · `ghosting_detected` · `budget_alert`. Confidence/Status/Cost leben im `content`-JSON (keine eigenen Spalten).

## Cron-Schedule
| Cron | Zeit (UTC) | Service |
|------|-----------|---------|
| Ghosting-Scan | `0 6 * * *` (täglich 06:00) | `GhostingService.detectGhostingCron` |
| Budget-Check | `0 7 * * *` (täglich 07:00) | `CostService.dailyBudgetCheck` |

## Tests
| Spec | Fokus |
|------|-------|
| `enrichment.service.spec.ts` | Happy-Path, partial-Fallbacks (kein Signal/Quota/leer/OpenAI fehlt), Dead-Letter, Org-Upsert, Embedding best-effort |
| `enrichment.types.spec.ts` | `normalizeFields`/`countFilledFields` |
| `web-scraper.spec.ts` | robots.txt Disallow, Script-Strip, Text-Extraktion |
| `scoring.rules.spec.ts` | alle 4 Score-Komponenten + Caps + 100-Clamp |
| `scoring.service.spec.ts` | Engagement-Match, Score-Persist, Auto-Convert-Gate (Env an/aus, bereits konvertiert) |
| `ghosting.service.spec.ts` | Last-Touch, 14-Tage-Schwelle, Idempotenz, Stage/won/lost/snooze-Ausschluss, Follow-up-Dedupe |
| `cost.util.spec.ts` | Preis-Berechnung |
| `cost.service.spec.ts` | Pause ≥100 %, Warn ≥90 %, Resume, Alert-Insight |

- **52 neue AI-Unit-Tests** (8 Spec-Dateien). Quality-Gate grün (10/10), Coverage ≥ 80 %, Branches ~81 %.
- **Vitest 1.6.1 → 3.2.6** (api/web/utils): Typ-Anpassung `mock.calls[0]![0]` in 5 Specs (V3 typisiert Tuple-Zugriff als `possibly undefined`).
- `email-sync.service.ts`-Analogie: kein Endpoint-Controller in diesem Modul → reine Service/Worker-Coverage.

## Acceptance Criteria
| AC | Beschreibung | Status |
|----|-------------|--------|
| Enrichment | Lead-Enrichment-Worker: Serper → Scrape → GPT-4o → Organization + Embedding | ✅ |
| Enrichment-Resilienz | Ausfall von Serper/OpenAI → `partial`-Durchlauf statt Fehler | ✅ |
| Scoring | Deterministisches Lead-Score (0–100) aus Fit/Engagement/Recency/Profile | ✅ |
| Auto-Convert | Lead ≥80 → Person + Deal + Activity (hinter `AI_AUTO_CONVERT_ENABLED`) | ✅ |
| Ghosting | Täglicher Cron flaggt Deals >14 Tage still + Follow-up-Task (idempotent) | ✅ |
| Budget | Enrichment-Queue pausiert bei 100 % Monatsbudget, Warnung bei 90 % | ✅ |
| Tech-Debt P6 | HNSW-Index auf `Organization.enrichmentEmbedding` | ✅ |
| Tech-Debt D1 | `AIInsight.deletedAt` + Index | ✅ |

## Tech-Debts (neu)
- **[Tech-Debt Session 14] Migration nicht angewendet** — lokale `.env`-`DATABASE_URL` ungültig (P1000). `prisma generate` lief; `pnpm --filter @nextgen/db prisma:migrate:deploy` mit gültigen Creds nachziehen (Session 15 / lokales Setup).
- **[Tech-Debt Session 14] Kein Frontend für KI-Signale** — `Lead.score`-Badge, Ghosting-Indikator und Enrichment-Status-Anzeige im UI offen. Geplant Session 16a oder eigener PR.
- **[Tech-Debt Session 14] `serper.client.ts` + `web-scraper.ts` External-API-Wrapper** — Live-Netzwerk; nur gemockt unit-getestet, Integration-Tests Session 16a (analog `email-sync.service.ts`).
- **[Tech-Debt Session 14] Auto-Convert ohne Dedupe gegen bestehende Person** — `autoConvert` legt immer eine neue Person an (kein Match auf vorhandene `emails`). Bei aktivem Flag Duplikat-Risiko. Geplant Session 16a.
- **[Tech-Debt Session 14] Budget-Alert nutzt `MailService`-Stub** — keine echte Zustellung bis SMTP real ist (S12-Tech-Debt #41). Session 15.
- **[Tech-Debt Session 14] PII an OpenAI** — Scrape-Snippets (öffentliche Web-Daten) gehen an GPT-4o; DSGVO-Bewertung/Dokumentation in Session 15.

## Nächste Session
**Session 15 — Security & DSGVO-Härtung**: Migration anwenden; Rate-Limits auf Public-Endpoints; `@Roles()`-Lücken (Tech-Debt #31); CAMPAIGN/AI-Secrets-Checkliste; DSGVO-Bewertung der KI-Datenflüsse (Serper/Scrape/OpenAI). HNSW-Index (P6) und `AIInsight.deletedAt` (D1) sind mit Session 14 bereits erledigt.
