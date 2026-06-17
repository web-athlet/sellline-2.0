# Kubernetes Manifests — nextgen-prod (Session 16b)

Production manifests for the NextGen CRM. All workloads are pinned to the EU region
(`topology.kubernetes.io/region: eu-central-1`) for DSGVO data residency.

> **Status:** authored & schema-validated, **not yet applied to a live cluster.**
> Image refs point at `ghcr.io/web-athlet/sellline-2.0/*` — adjust to your registry.

## Prerequisites (cluster add-ons)

- `ingress-nginx` (namespace labelled `kubernetes.io/metadata.name: ingress-nginx`)
- `cert-manager` with a `letsencrypt-prod` ClusterIssuer
- `kube-prometheus-stack` (Prometheus Operator) for the `observability/` resources
- `metrics-server` (HPA CPU metrics)

## Apply order

```sh
kubectl apply -f namespace.yaml

# Secrets — DO NOT apply secrets.example.yaml as-is. Populate out-of-band:
#   kubectl -n nextgen-prod create secret generic nextgen-secrets --from-env-file=prod.env
#   kubectl -n nextgen-prod create secret generic nextgen-backup  --from-env-file=backup.env

kubectl apply -f web-deployment.yaml
kubectl apply -f api-deployment.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
kubectl apply -f pdb.yaml
kubectl apply -f networkpolicy.yaml
kubectl apply -f backup-cronjob.yaml
kubectl apply -f observability/
```

## Files

| File                   | Purpose                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `namespace.yaml`       | `nextgen-prod` namespace (EU residency label)                                      |
| `secrets.example.yaml` | **Template only** — env keys; never commit real values                             |
| `web-deployment.yaml`  | Next.js web: 3 replicas, RollingUpdate (maxUnavailable 0), probes `/api/health`    |
| `api-deployment.yaml`  | NestJS API: liveness `/api/health`, readiness `/api/health/ready` (503 on DB loss) |
| `ingress.yaml`         | nginx Ingress, TLS via cert-manager, WS upgrade timeouts                           |
| `hpa.yaml`             | CPU 70% → 3–10 replicas (web + api)                                                |
| `pdb.yaml`             | `minAvailable: 2` during voluntary disruptions                                     |
| `networkpolicy.yaml`   | Default-deny + explicit allows (DNS, PG, Redis, 443 egress)                        |
| `backup-cronjob.yaml`  | Nightly `pg_dump` → S3-EU, 30-day retention                                        |
| `observability/`       | ServiceMonitor, PrometheusRule alerts, Grafana dashboard                           |

## Zero-downtime rollout

`maxUnavailable: 0` + `maxSurge: 1` + `readinessProbe` means a new pod must pass
readiness before an old one is removed. The deploy workflow waits on
`kubectl rollout status` and auto-runs `rollout undo` on timeout.
