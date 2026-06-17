---
title: "Runbook: Disaster-Recovery"
tags: [runbook, disaster-recovery, backup, postgres, kubernetes, dsgvo]
status: active
last_updated: 2026-06-17
summary: "Wiederherstellung nach Datenverlust/Ausfall: Postgres-Restore aus S3-EU-Backup, MinIO-Replikation, RTO/RPO, Restore-Test-Prozedur."
---
# Runbook: Disaster-Recovery

> Ergänzt [Rollback-Prozedur](rollback-procedure.md) (Deploy-Incident) und
> [Deploy-Production](deploy-production.md). Dieser Runbook deckt **Datenverlust /
> Infrastruktur-Ausfall** ab. Erstellt in Session 16b.

## Schutzziele (RTO / RPO)

| Komponente | Strategie | RPO | RTO |
|------------|-----------|-----|-----|
| Postgres | Tägliches `pg_dump` (custom format) → S3-EU, 30 Tage Retention (`k8s/backup-cronjob.yaml`) | ≤ 24 h | ≤ 1 h |
| Redis | **Kein Backup** — reiner Cache/Throttle-Store, zustandslos wiederherstellbar | n/a | sofort (Neustart) |
| MinIO (Objektspeicher) | Cross-Region-Replication **innerhalb der EU** | ~Minuten | ~Minuten |
| App (web/api) | Stateless Container-Images in GHCR; via `kubectl`/Deploy-Workflow neu ausrollbar | 0 | ≤ 10 min |

Alle Backups verbleiben in der EU (DSGVO Art. 44 ff. — kein Drittlandtransfer).

## 1. Postgres wiederherstellen

```sh
# 1. Verfügbare Backups auflisten
aws s3 ls s3://$BACKUP_BUCKET/postgres/ --endpoint-url $S3_ENDPOINT

# 2. Gewünschten Dump laden (jüngster vor dem Incident-Zeitpunkt)
aws s3 cp s3://$BACKUP_BUCKET/postgres/nextgen-<STAMP>.dump /tmp/restore.dump \
  --endpoint-url $S3_ENDPOINT

# 3. App pausieren, damit kein Schreibzugriff während des Restores erfolgt
kubectl -n nextgen-prod scale deployment/nextgen-api --replicas=0

# 4. In eine FRISCHE Datenbank restoren (niemals über laufende Daten drüber)
createdb -h $PGHOST nextgen_restore
pg_restore --no-owner --clean --if-exists --dbname=nextgen_restore /tmp/restore.dump

# 5. Verifizieren (Tabellen-Counts, jüngste Datensätze), dann Cutover
#    (DATABASE_URL auf nextgen_restore zeigen lassen ODER rename).

# 6. App hochfahren
kubectl -n nextgen-prod scale deployment/nextgen-api --replicas=3
kubectl -n nextgen-prod rollout status deployment/nextgen-api
```

Nach dem Restore die ausstehenden Migrationen prüfen:
`pnpm --filter @nextgen/db prisma:migrate:deploy` (idempotent — wendet nur Fehlendes an).

## 2. Restore-Test (vierteljährlich, Pflicht)

Ein Backup ohne getesteten Restore ist kein Backup.

1. Jüngsten Dump in eine isolierte `nextgen_restore_test`-DB einspielen (Schritte 1+4 oben).
2. Smoke: `SELECT count(*)` auf `User`, `Deal`, `Organization`; `prisma migrate status` = clean.
3. API mit der Test-DB starten, `/api/health/ready` → 200 prüfen.
4. Ergebnis (Datum, Dump-Stamp, Dauer, OK/Fehler) in dieses Runbook unter „Restore-Test-Log" eintragen.
5. Test-DB löschen.

## 3. MinIO / Objektspeicher

Cross-Region-Replication innerhalb der EU ist aktiv; bei Verlust der primären Region
auf das Replikat-Bucket umschwenken (`MINIO_ENDPOINT` in `nextgen-secrets` anpassen,
API neu ausrollen). Keine manuelle Kopie nötig.

## 4. Vollständiger Cluster-/Region-Ausfall

1. Cluster in EU-Sekundärregion bereitstellen (IaC).
2. `nextgen-secrets` + `nextgen-backup` aus dem Secret-Manager neu anlegen.
3. Manifeste anwenden (`k8s/README.md` Apply-Reihenfolge).
4. Postgres aus dem letzten S3-EU-Dump restoren (Abschnitt 1).
5. DNS auf den neuen Ingress umstellen; `/api/health/ready` + Lighthouse/PWA prüfen.

## Restore-Test-Log

| Datum | Dump-Stamp | Dauer | Ergebnis | Tester |
|-------|-----------|-------|----------|--------|
| _(erster Test nach Cluster-Provisioning eintragen)_ | | | | |
