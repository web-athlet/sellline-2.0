---
title: "Gesamt-Index aller Docs"
tags: [index, navigation, all-docs]
status: active
last_updated: 2026-05-28
summary: "Vollstaendiger Index aller Second-Brain-Dokumente."
---

# Gesamt-Index — NextGen CRM Second Brain

> Zuletzt aktualisiert: 2026-05-10 von @doc-keeper / update-index.sh
> Agents: Scanne diesen Index ZUERST um zu entscheiden was zu laden ist.

## Sessions (20-sessions/)

| Datei | Status | Summary |
|---|---|---|
| [session-00-summary.md](20-sessions/session-00-summary.md) | completed | Greenfield-Scaffolding: 6 Workspaces (NestJS 10 + Next.js 14), pgvector/Redis/MinIO Docker, WS-Echo end-to-end, CI + Husky + Quality-Gate 10/10 PASS. |
| [session-01-summary.md](20-sessions/session-01-summary.md) | completed | Vollstaendiges Prisma-5-Schema (19 Models + 7 Enums + pgvector(1536)) in @nextgen/db plus idempotenter Seed (3 User, 1 Pipeline + 6 Stages, 10 Orgs, 20 Persons, 30 Deals, 50 Activities, 5 Products, 3 Projects + 15 Tasks, 1 Template). Initial-Migration deployed, Quality-Gate 10/10 PASS. |
| [session-02-summary.md](20-sessions/session-02-summary.md) | completed | Vollstaendiges v3.0-Auth-System: JWT-15min + Refresh-Token-Family-Rotation mit Replay-Detection, TOTP-2FA (AES-256-GCM-encrypted), OAuth Google/Microsoft (feature-flagged), RBAC-Hierarchie, Rate-Limit 10/15min/IP, Password-Reset, NextAuth-Frontend. WS-JWT-Handshake schliesst Tech-Debt #1. 10/10 ACs, 97 API-Tests (97.1% Coverage), 14 Web-Tests (100%). |
| [session-03-summary.md](20-sessions/session-03-summary.md) | completed | NavRail (60/220px, Hover+Hamburger), DashboardLayout (3-Spalten), 10 Stub-Pages, Zustand-UIStore (persist), Mobile Bottom-Nav + Sheet. Pakete: lucide-react, zustand. 45 Web-Tests, 99.8% Coverage. 10/10 ACs. |
| [session-04-summary.md](20-sessions/session-04-summary.md) | completed | M8 vollständig: Contacts/Orgs CRUD, Duplikat-Erkennung (fast-fuzzy, 0.85), Merge, Org-Hierarchie. 159 API-Tests (~98%), 99 Web-Tests (89.44%). 5/5 ACs. |
| [session-05-summary.md](20-sessions/session-05-summary.md) | completed | M3 vollständig: Deals-Kanban (@dnd-kit), PipelinesModule, Pipeline-Value server-seitig, WS Pipeline-Room-Scoping, Closed-Deal-Guard. 200 API-Tests (~98%), 164 Web-Tests. 4/4 ACs. PRs #7+#8. |
| [session-06-summary.md](20-sessions/session-06-summary.md) | completed | M1 Pulse-Feed vollstaendig: score-sortierter Daily-Feed (3 Tabs), Redis-Cache 30s TTL, WS User-Room, virtualisierte FeedList, Bell-Button-Fix. 222 API-Tests (~98%), 202 Web-Tests. 10/10 ACs. PR #9. |
| [session-07-summary.md](20-sessions/session-07-summary.md) | completed | M7 Aktivitäten + BookingModule vollständig: Activities-CRUD, Kalender, BookingModule öffentliche Slots, BullMQ Deal-Scoring Debounce, activity:completed WS-Event. 14/14 ACs. PR #10. |
| [session-08-summary.md](20-sessions/session-08-summary.md) | completed | M2 Leads & Webformulare vollständig: FormsModule + LeadsModule + PublicModule, DnD FormBuilder, BullMQ lead-enrichment Stub, lead:enriched WS-Event, atomare convert-Transaktion. 6/6 ACs. PR #11. |
| [session-09-summary.md](20-sessions/session-09-summary.md) | completed | M10 Produktkatalog vollständig: ProductsModule CRUD + CSV-Streaming-Import, DealProductsTab, /products Seite. 4/4 ACs. 696 Tests. PR #12. |
| [session-10-summary.md](20-sessions/session-10-summary.md) | completed | M4 Projekte vollständig: ProjectsModule + TasksModule (12 Endpoints), Kanban-Board DnD, Template-Instantiierung, Task.assigneeId FK-Migration, globale Tasks-Seite. 4/4 ACs. ~783 Tests. PR #13. |
| [session-11-summary.md](20-sessions/session-11-summary.md) | completed | M6 E-Mail-Sync vollständig: Gmail + Outlook OAuth2, AES-256-GCM Body-Verschlüsselung, BullMQ Watch/Poll-Fallback, GPT-4o Thread-Summary, Inbox-UI 2-Panel, NavRail-Badge. 14 Endpoints. 4/4 ACs. ~855 Tests. |
| [session-12-summary.md](20-sessions/session-12-summary.md) | completed | M5 E-Mail-Campaigns vollständig: DSGVO-Validierung, HMAC-Tracking-Tokens, BullMQ-Batch-Versand, GPT-4o Betreffzeilen, 4-Schritt-Wizard, Drag-Drop-Editor. 13 Endpoints. 7/7 ACs. ~953 Tests. |

## Reviews (30-reviews/)

| Datei | Typ | Summary |
|---|---|---|
| [session-0-light-review.md](30-reviews/session-0-light-review.md) | Light | Session 0 Light-Review: Scaffolding und WebSocket-Basis — Befunde behoben. |
| [session-1-deep-review.md](30-reviews/session-1-deep-review.md) | Deep (Tier 3) | Session 1 Deep-Review: 4 BLOCKER initial (2 echt, 2 FP) + 13 weitere Findings. Echte Fixes in `fix/session-1-security`. |
| [session-5-deep-review.md](30-reviews/session-5-deep-review.md) | Deep (Tier 3) | Session 5 Deep-Review: 4 BLOCKER initial — 3 FALSE POSITIVES (halluzinierter Code), 1 echt (B4 WS-Broadcast). H3 (Closed-Deal-Guard) ebenfalls echt. Beide gefixt in `fix/session-5-security`. |
| [session-5-light-review.md](30-reviews/session-5-light-review.md) | Light | Session 5 Light-Review: CLEAN — Quality-Gate 10/10 grün (200 API, 164 Web). Merge-ready. |

## Module (10-modules/)

| Datei | Status | Summary |
|---|---|---|
| M1-pulse-feed.md | implemented | Score-sortierter Daily-Feed (3 Tabs), Redis-Cache 30s TTL, WS User-Room per user:{userId}, virtualisierte FeedList. Session 6. |
| M10-products.md | implemented | M10 vollständig: CRUD /api/v1/products, CSV-Streaming-Import, DealProductsTab + Deal-Wert-Auto-Update (AC-009). Session 9. |
| M2-leads.md | implemented | FormsModule + LeadsModule + PublicModule vollständig: embeddable Webformulare, DnD FormBuilder, BullMQ Enrichment Stub, convert-Transaktion (Person+Deal). Session 8. AC-011 ✅. |
| M3-deals.md | planned | Kanban-Board mit @dnd-kit DnD, 6 Stages, Pipeline-Value server-seitig, Rot-Indikator, Ghosting-Flag. |
| M4-projects.md | implemented | Projekt-Kanban mit Task-Verwaltung, Deal-Verknüpfung, Vorlagen-System, Fortschritts-Tracking. 12 Endpoints. Session 10. |
| M5-campaigns.md | implemented | DSGVO-konformer Campaign-Versand, HMAC-Tracking-Tokens, BullMQ-Batch-Versand (50/Batch), GPT-4o Betreffzeilen, Bounce-Handling. 13 Endpoints. Session 12. |
| M6-email.md | implemented | Gmail + Outlook OAuth2, AES-256-GCM Body-Verschlüsselung, BullMQ Watch/Poll, GPT-4o Thread-Summary, Inbox-UI. 14 Endpoints. Session 11. |
| M7-activities.md | planned | Activity-Kalender mit DnD, Konflikt-Erkennung (Doppelbuchung), polymorphe Verknuepfung Deal/Person/Org. AC-006. |
| M8-contacts.md | implemented | Personen und Firmen: CRUD, Timeline, Duplikat-Erkennung (fast-fuzzy, Threshold 0.85), Merge, Org-Hierarchie-Tree. Partial Unique Index. Session 4. |
| M9-insights.md | planned | Dashboard-Builder (react-grid-layout, keine Kollision via verticalCompact), 8 Standard-Reports, KI-Verlust-Analyse woechentlich per Cron. AC-020. |

## Entscheidungen (ADRs) (40-decisions/)

| Datei | Status | Summary |
|---|---|---|
| 0001-pgvector-vs-pinecone.md | accepted | pgvector statt Pinecone: kein extra Service, DSGVO-konform, ausreichend bis 1M Vektoren. |
| 0002-opusplan-model-strategy.md | accepted | opusplan als Default: Opus 4.7 beim Planen, Sonnet 4.6 bei Ausfuehrung. Kritische Sessions auf reines Opus. |
| 0003-csrf-double-submit-cookie.md | accepted | csrf-csrf Package mit Double-Submit-Cookie fuer CSRF-Schutz. Gilt nur Non-GET ausser Bearer-Auth. |
| 0004-vitest-over-jest.md | accepted | Vitest statt Jest: native ESM-Support, 2-5x schneller, bessere Turborepo-Integration. |

## Runbooks (50-runbooks/)

| Datei | Summary |
|---|---|
| ai-budget-exceeded.md | Was tun wenn das monatliche AI-Budget (OpenAI/Serper) ueberschritten oder Queue automatisch pausiert wurde. |
| deploy-production.md | Schritt-fuer-Schritt Production-Deployment: CI grueen, Manual-Approval, K8s-Rollout, Health-Check. |
| rollback-procedure.md | Vollstaendige Rollback-Prozedur bei Production-Incident: K8s-Rollback, DB-Migration-Revert, Kommunikation. |

## KI-Prompts (60-prompts/)

| Datei | Summary |
|---|---|
| enrichment-system.md | System- und User-Prompt fuer den Enrichment-Worker (GPT-4o, JSON-Schema-Output). |
| scoring-formula.md | Regelbasierte Score-Berechnung 0-100. Kein LLM-Aufruf noetig. Trigger: Aktivitaet, Stage-Wechsel, E-Mail-Event. |
| thread-summary.md | GPT-4o-Prompt fuer Thread-Summary bei >5 E-Mails. Keine E-Mail-Bodies an OpenAI (DSGVO). |
