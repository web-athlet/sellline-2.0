---
title: "Runbook: KI-Budget ueberschritten"
tags: [runbook, ai, budget, enrichment, incident]
status: active
last_updated: 2026-05-07
summary: "Was tun wenn das monatliche AI-Budget (OpenAI/Serper) ueberschritten oder Queue automatisch pausiert wurde."
---
# Runbook: KI-Budget ueberschritten

## Symptom
- Slack-Warnung: "AI-Budget > 90% ausgeschoepft"
- Enrichment-Jobs laufen nicht mehr (Queue pausiert bei 100%)
- `AIInsight.content.cost.estCostUsd` Summe naehert sich Limit

## Sofortmassnahmen

### Queue-Status pruefen
```bash
# BullMQ-Queue-Status via Bull-Board oder CLI
npx bullmq stats enrichment
```

### Queue manuell pausieren (falls noch aktiv)
```bash
# Via API (Admin-Endpoint)
curl -X POST https://api.nextgencrm.app/api/admin/queues/enrichment/pause \
  -H "Authorization: Bearer $ADMIN_JWT"
```

### Kosten analysieren
```sql
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as runs,
  SUM((content->>'estCostUsd')::decimal) as cost_usd
FROM ai_insights
WHERE type = 'enrichment'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;
```

## Ursachenanalyse
- Retry-Loop? → Logs pruefen: `pino` logs in Grafana nach `enrichment failed`
- Verdoppelte Jobs? → Idempotenz-Keys pruefen: `lead:{id}:enrichment`
- Quota-Fehler Serper? → `status: 'partial'` Jobs pruefen

## Budget erhoehen (Entscheidung CTO)
```bash
# In .env.production
AI_MONTHLY_BUDGET_USD=150  # von 100 auf 150
# Dann: kubectl rollout restart deployment/nextgen-api
```

## Queue wieder aktivieren
```bash
curl -X POST https://api.nextgencrm.app/api/admin/queues/enrichment/resume \
  -H "Authorization: Bearer $ADMIN_JWT"
```
