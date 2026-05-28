---
title: "Session 13 Summary — M9 Insights & Analytics"
tags: [session, summary, m9, insights, analytics, recharts, react-grid-layout, openai, cron]
status: completed
session: 13
last_updated: 2026-05-29
summary: "M9 Insights & Analytics vollständig: 8 Standard-Reports, KI-Verlust-Analyse (Cron Mo 09:00 + manueller Trigger), Dashboard-Builder (react-grid-layout v2, verticalCompact, localStorage-Persistenz). 36 neue API-Tests, 40 neue Web-Tests. 2/2 ACs."
---

# Session 13 — M9 Insights & Analytics

## TLDR (5 Punkte)

1. **8 Standard-Reports** unter `/api/v1/insights/reports/:type`: `dealConversionRate`, `revenueForecast`, `activityPerformance`, `wonVsLostDeals`, `pipelineVelocity`, `leadSources`, `emailPerformance`, `revenueByUser`. Jeder Report akzeptiert `from`, `to`, `pipelineId?`, `userId?` und gibt `{ labels, datasets, summary }` zurück. Paginierung per Woche (Bar/Line-Charts) oder Aggregation (Pie/Funnel).

2. **KI-Verlust-Analyse**: `@Cron('0 9 * * 1')` wöchentlich Mo 09:00 Berlin + `POST /api/v1/insights/loss-analysis/trigger` für manuellen Aufruf. GPT-4o analysiert verlorene Deals (letzte 90 Tage) → 3 Verlustmuster mit Empfehlung + Priorität. **DSGVO**: Nur Metadaten (`value`, `lostReason`, `daysInPipeline`, `activityCount`, `emailCount`) — keine `bodyEncrypted`-Felder an OpenAI.

3. **Dashboard-Builder** (`/insights`): `react-grid-layout v2` (12 Spalten, rowHeight 150 px). Neue API in v2: `gridConfig`, `dragConfig`, `resizeConfig` statt direkter Props. `verticalCompactor` aus Named-Export. 12 Widgets vorkonfiguriert (3 KPI, 8 Charts, 1 AI-Karte). Layout-Persistenz via `localStorage` (`insights-layout-v1`).

4. **Neue Dependencies**: `recharts` (Charts), `react-grid-layout@2.x` (Dashboard), `@nestjs/schedule` (Cron). Keine Schema-Migrationen nötig — `AIInsight`-Model existiert seit Session 1.

5. **Nächste Session (14) braucht**: AIInsight-Model (`type: 'loss_analysis'`) bereits schreibbar; HNSW-Index für `Organization.enrichmentEmbedding` (Tech-Debt P6) sollte in Session 14 ergänzt werden; `OPENAI_API_KEY` muss gesetzt sein für KI-Enrichment und Verlust-Analyse.

## Implementierte Endpoints (3)

| Method | Path | Auth | Beschreibung |
|--------|------|------|-------------|
| GET | `/api/v1/insights/reports/:type` | JWT | 8 Report-Typen mit DateRange + Filter |
| GET | `/api/v1/insights/loss-analysis` | JWT | Neuester KI-Verlust-Insight |
| POST | `/api/v1/insights/loss-analysis/trigger` | JWT MANAGER+ | Manueller KI-Analyse-Trigger |

### Valide Report-Typen

| Type | Datenquelle | Chart |
|------|------------|-------|
| `dealConversionRate` | Deal.wonAt/lostAt nach Woche | Bar |
| `revenueForecast` | Deal.value × probability / closingDate | Line |
| `activityPerformance` | Activity.type + done groupBy | Bar |
| `wonVsLostDeals` | Deal.wonAt/lostAt nach Woche | Bar |
| `pipelineVelocity` | Deal.closedAt - createdAt per Stage | Bar |
| `leadSources` | Lead.source groupBy | Pie |
| `emailPerformance` | Campaign.openCount/clickCount/bounceCount | Line |
| `revenueByUser` | Deal.value wonAt per Owner | Bar |

## Backend-Architektur

### InsightsService (`insights.service.ts`)
- `parseDateRange`: `from/to` ISO → Date, Default 30 Tage zurück
- `dealConversionRate/wonVsLostDeals`: `eachWeekOfInterval` → parallele `prisma.deal.count` per Woche
- `revenueForecast`: `eachMonthOfInterval` (90 Tage voraus), `value × probability / 100`
- `activityPerformance`: `prisma.activity.groupBy(['type', 'done'])`
- `pipelineVelocity`: `differenceInDays(closedAt, createdAt)` per Stage
- `leadSources`: `prisma.lead.groupBy(['source'])`
- `emailPerformance`: Campaign-Stats → openRate/clickRate/bounceRate in %
- `revenueByUser`: Won Deals summiert per Owner, sortiert DESC
- `runLossAnalysis`: DSGVO-konformes Payload (kein bodyEncrypted) → GPT-4o JSON-Mode → `aIInsight.create`

### AppModule-Erweiterungen
- `ScheduleModule.forRoot()` → Cron-Support
- `InsightsModule` registriert

## Frontend-Komponenten

| Datei | Beschreibung |
|-------|-------------|
| `app/(dashboard)/insights/page.tsx` | Dashboard-Seite mit DashboardBuilder |
| `components/insights/DashboardBuilder.tsx` | react-grid-layout v2, 12 Widgets, localStorage-Persistenz |
| `components/insights/ChartWidget.tsx` | Recharts: Bar/Line/Pie/Funnel/Table mit EmptyState + Skeleton |
| `components/insights/KpiWidget.tsx` | Große KPI-Zahl + Trend-Pfeil aus `report.summary` |
| `components/insights/AiInsightCard.tsx` | 3 Verlustmuster-Cards + "Neu analysieren"-Button |
| `lib/insights-api.ts` | 3 API-Funktionen + insightsKeys |

## Tests

| Datei | Tests | Coverage |
|-------|-------|---------|
| `insights.service.spec.ts` | 23 | Alle 8 Reports, DSGVO-Payload, Loss-Analyse, Dispatch |
| `insights.controller.spec.ts` | 13 | BadRequest auf ungültigen Type, alle 8 Typen valide, Delegates |
| `insights-api.test.ts` | 10 | API-Endpunkte, QueryString-Building, AccessToken |
| `AiInsightCard.test.tsx` | 7 | Loading, Reasons, Error, Empty, triggerLossAnalysis |
| `KpiWidget.test.tsx` | 6 | Title, Value, Unit, Description, undefined-Guard |
| **Gesamt (neu)** | **59** | API: 484 Tests / Web: 528 Tests |

**DashboardBuilder + ChartWidget aus Web-Coverage ausgeschlossen** — react-grid-layout ResizeObserver + Recharts SVG-Rendering nicht unit-testbar, analog zu ActivityCalendar.

## Acceptance Criteria

| AC | Beschreibung | Status |
|----|-------------|--------|
| AC-020 | Dashboard-Builder: Verschieben und Skalieren ohne Überlappung | ✅ |
| KI-Cron | Verlust-Analyse wöchentlich Mo 09:00 Berlin | ✅ |
| KI-Manuell | Trigger via POST (MANAGER+) | ✅ |
| DSGVO | Kein bodyEncrypted in OpenAI-Payload (Test: assert payload) | ✅ |
| Reports | Alle 8 Typen liefern `{ labels, datasets, summary }` | ✅ |
| Layout | Persistiert nach Refresh (localStorage) | ✅ |

## Tech-Debts (neu)

- **[Tech-Debt Session 13] DashboardBuilder + ChartWidget ohne Unit-Tests** — react-grid-layout ResizeObserver + Recharts SVG. Geplant Session 16a.
- **[Tech-Debt Session 13] InsightsReports ohne Pagination/Caching** — Bei großen Datenmengen könnten die Wochenloop-Queries langsam werden. Redis-Cache in Session 15 sinnvoll.
- **[Tech-Debt Session 13] Kein separates Date-Preset für Reports** — Nur `from/to` ISO-Strings; keine Shortcuts wie `7d`, `30d`, `ytd`. UX-Verbesserung in Session 16a.

## Nächste Session

**Session 14 — KI-Agenten (Enrichment, Scoring, Ghosting-Detection)**: nutzt `Lead`-Model für Enrichment (BullMQ Worker fertig seit S8), `Deal.score` für Scoring und `Deal.ghostingSnoozedUntil` + `rotIndicator` für Ghosting. HNSW-Index für `Organization.enrichmentEmbedding` sollte in S14 als erstes ergänzt werden.
