---
title: "Runbook: Rollback-Prozedur"
tags: [runbook, rollback, incident, kubernetes]
status: active
last_updated: 2026-05-07
summary: "Vollstaendige Rollback-Prozedur bei Production-Incident: K8s-Rollback, DB-Migration-Revert, Kommunikation."
---
# Runbook: Rollback-Prozedur

## Entscheidungs-Kriterien fuer Rollback
- Error-Rate > 5% (Grafana-Alert)
- p95 Latenz > 2s (Grafana-Alert)
- Health-Check schlaegt fehl
- Datenverlust oder Datenkorrektheit-Problem

## Rollback-Schritte

### Schritt 1: Traffic sichern (Sofort < 1min)
```bash
kubectl rollout undo deployment/nextgen-web
kubectl rollout undo deployment/nextgen-api
kubectl rollout status deployment/nextgen-web
```

### Schritt 2: DB-Migration revert (falls noetig)
```bash
# Nur wenn Migration in diesem Deployment war
npx prisma migrate resolve --rolled-back MIGRATION_NAME
# ACHTUNG: nur rueckwaerts-kompatible Migrations koennen reverted werden
```

### Schritt 3: Verifizieren
```bash
curl -f https://app.nextgencrm.app/api/health
# Login testen, Deal erstellen
```

### Schritt 4: Post-Mortem
1. Timeline dokumentieren
2. Root-Cause identifizieren
3. Fix entwickeln (in Feature-Branch, mit Tests)
4. Neuer Review-Zyklus vor erneutem Deployment

## Kommunikation
Bei Ausfall > 5 Minuten: Status-Page aktualisieren, Team informieren.
