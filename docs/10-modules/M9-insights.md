---
title: "M9 Insights und Analytics"
tags: [module, m9,insights,analytics,dashboard,charts,recharts]
status: implemented
session: 13
related: []
last_updated: 2026-05-29
summary: "Dashboard-Builder (react-grid-layout v2, verticalCompactor, localStorage-Persistenz), 8 Standard-Reports, KI-Verlust-Analyse (Cron Mo 09:00 + manueller Trigger). AC-020. 59 Tests."
---

# M9 Insights und Analytics

## Was dieses Modul tut

Dashboard-Builder mit 12 vordefinierten Widgets (react-grid-layout v2, 12 Spalten, rowHeight 150 px). 8 Standard-Reports über `/api/v1/insights/reports/:type` mit DateRange-Filter. Wöchentliche KI-Verlust-Analyse (Cron Mo 09:00 Berlin) + manueller Trigger. DSGVO-konform: nur Metadaten an OpenAI, keine E-Mail-Bodies.

## Kritische Business-Regeln

- Soft-Delete: `deletedAt: null` in allen WHERE-Clauses
- DSGVO: KI-Payload enthält KEIN `bodyEncrypted` — nur `value`, `lostReason`, `daysInPipeline`, `activityCount`, `emailCount`
- Loss-Insight: `validUntil = +7 Tage`; ältere Insights bleiben erhalten (History)
- Dashboard-Layout: pro Browser in `localStorage` (`insights-layout-v1`)

## Datenmodell

Kein neues Prisma-Model — nutzt `AIInsight` (seit Session 1):
- `type: 'loss_analysis'` für KI-Verlust-Insights
- `content: Json` → `{ reasons: [{ pattern, count, recommendation, priority }] }`
- `validUntil: DateTime?` → 7 Tage ab Erstellung

## API-Endpoints

| Method | Path | Auth | Beschreibung |
|--------|------|------|-------------|
| GET | `/api/v1/insights/reports/:type` | JWT | 8 Report-Typen |
| GET | `/api/v1/insights/loss-analysis` | JWT | Neuester Loss-Insight |
| POST | `/api/v1/insights/loss-analysis/trigger` | JWT MANAGER+ | Manueller Trigger |

### Report-Typen
`dealConversionRate` · `revenueForecast` · `activityPerformance` · `wonVsLostDeals` · `pipelineVelocity` · `leadSources` · `emailPerformance` · `revenueByUser`

## Session: 13 | Modell: sonnet-4-6 | Thinking: think-hard | Dauer: ~3h
