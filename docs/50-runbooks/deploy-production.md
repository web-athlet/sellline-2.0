---
title: "Runbook: Production Deployment"
tags: [runbook, deployment, kubernetes, production]
status: active
last_updated: 2026-05-07
summary: "Schritt-fuer-Schritt Production-Deployment: CI grueen, Manual-Approval, K8s-Rollout, Health-Check."
---
# Runbook: Production Deployment

## Voraussetzungen
- [ ] CI Pipeline gruen (alle Tests, Snyk, Lint)
- [ ] Deep-Review approved (fuer kritische Sessions)
- [ ] PR von 2 Reviewern approved
- [ ] Staging-Test bestanden

## Deployment-Schritte

### 1. Docker-Images bauen und pushen
```bash
docker build -f apps/web/Dockerfile -t $REGISTRY/nextgen-web:$SHA .
docker build -f apps/api/Dockerfile -t $REGISTRY/nextgen-api:$SHA .
docker push $REGISTRY/nextgen-web:$SHA
docker push $REGISTRY/nextgen-api:$SHA
```

### 2. DB-Migration (vor App-Rollout)
```bash
kubectl run prisma-migrate --image=$REGISTRY/nextgen-api:$SHA \
  --env="DATABASE_URL=$DATABASE_URL" \
  --command -- npx prisma migrate deploy
kubectl wait --for=condition=complete job/prisma-migrate --timeout=120s
```

### 3. K8s-Rollout
```bash
kubectl set image deployment/nextgen-web web=$REGISTRY/nextgen-web:$SHA
kubectl set image deployment/nextgen-api api=$REGISTRY/nextgen-api:$SHA
kubectl rollout status deployment/nextgen-web --timeout=5m
kubectl rollout status deployment/nextgen-api --timeout=5m
```

### 4. Health-Check
```bash
curl -f https://app.nextgencrm.app/api/health
# Erwartet: { "status": "ok", "db": "ok", "redis": "ok" }
```

### 5. Smoke-Test
```bash
# Manuell: Login, Deal erstellen, WebSocket pruefen
# Automatisch via Playwright Smoke-Test-Suite
pnpm playwright test --project=smoke
```

## Rollback
Sofort bei Health-Check-Fehler:
```bash
kubectl rollout undo deployment/nextgen-web
kubectl rollout undo deployment/nextgen-api
```
