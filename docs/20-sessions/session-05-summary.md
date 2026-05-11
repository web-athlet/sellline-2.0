---
title: "Session 5 — M3 Deals / Pipeline (Kritischer Pfad)"
tags: [session, deals, pipeline, kanban, dnd, websocket, m3]
status: implemented
last_updated: 2026-05-11
summary: "M3 vollständig: Deals-Kanban mit @dnd-kit DnD, 6 Stages, Pipeline-Value server-seitig, WS Pipeline-Room-Scoping, Closed-Deal-Guard. 200 API-Tests + 164 Web-Tests."
---

# Session 5 — M3 Deals / Pipeline (Kritischer Pfad)

## TLDR

1. `DealsModule` + `PipelinesModule` vollständig implementiert: Kanban-Board mit Drag-and-Drop (@dnd-kit), Optimistic-UI-Rollback, Pipeline-Value server-seitig, Deal-Lifecycle (create / changeStage / markWon / markLost / snoozeGhosting), DealProduct-Verwaltung, Rot-Indikator.
2. Frontend: `/deals` Kanban-/Listen-/Tabellen-/Timeline-View (ViewSwitcher), `/deals/[id]` Detail (Header, StageStepper, Tabs), `CreateDealModal`, `SnoozeGhostingModal`.
3. WebSocket: `EventsGateway` erweitert um Pipeline-Rooms (`pipeline:<id>`); `pipeline:subscribe` / `pipeline:unsubscribe`; Deal-Events scoped auf Pipeline-Room statt globalem `server.emit`.
4. DB-Migration `20260511120000_deals_order_score_closing` — neue Spalten `order`, `score`, `closingDate` auf `Deal`; Indexes auf `stageId`, `ownerId`, `status`, `closingDate`, `(stageId, order)`; `DealStatus`-Enum (OPEN / CLOSED_WON / CLOSED_LOST).
5. Security-Fix `fd2ae98` auf `fix/session-5-security`: B4 (WS-Broadcast → Pipeline-Room-Scoping) und H3 (Closed-Deal-Stage-Guard) geschlossen. Deep-Review hatte 4 BLOCKERs — 3 waren FALSE POSITIVES (halluzinierter Code); nur 2 echte Findings (B4, H3) wurden gefixt.
6. 200 API-Tests (~98% Coverage), 164 Web-Tests — alle Thresholds grün. Quality-Gate 10/10 grün.
7. Session 6 (M1 Pulse-Feed) kann starten: `GET /api/v1/deals/kanban`, Deal-WS-Events, `EventsGateway` Pipeline-Room-Infra alle bereit.

---

## Backend

**DealsModule** (`apps/api/src/modules/deals/`)

| Endpoint | Beschreibung |
|----------|-------------|
| `GET /api/v1/deals` | Liste, paginated (`page`, `limit` ≤ 500), filter[stage/owner/pipeline/status] |
| `GET /api/v1/deals/kanban` | Nach Stage gruppiert mit Aggregat-Values |
| `POST /api/v1/deals` | Erstellen (Zod-validiert) |
| `GET /api/v1/deals/:id` | Detail mit Stage, Owner, Person, Org, Products |
| `PATCH /api/v1/deals/:id` | Update (Partial) — `assertEditable` Owner/Manager/Admin |
| `DELETE /api/v1/deals/:id` | Soft-Delete |
| `POST /api/v1/deals/:id/change-stage` | Stage-Wechsel, server-seitige Value-Berechnung, WS-Event; lehnt geschlossene Deals ab |
| `POST /api/v1/deals/:id/won` | Deal als gewonnen schließen — setzt `status`, `wonAt`, `closedReason` atomar |
| `POST /api/v1/deals/:id/lost` | Deal als verloren schließen — setzt `lostReason` |
| `POST /api/v1/deals/:id/snooze-ghosting` | Ghosting snoozen (`days: 1–365`, Server berechnet `until = now + days`) |
| `POST /api/v1/deals/:id/products` | DealProduct hinzufügen |
| `DELETE /api/v1/deals/:id/products/:productId` | DealProduct entfernen |

**PipelinesModule** (`apps/api/src/modules/pipelines/`)

| Endpoint | Beschreibung |
|----------|-------------|
| `GET /api/v1/pipelines` | Liste aller Pipelines mit Stages |
| `POST /api/v1/pipelines` | Pipeline anlegen |
| `GET /api/v1/pipelines/:id` | Detail mit Stages + Deal-Count |
| `PATCH /api/v1/pipelines/:id` | Update (name, rotThresholdDays) |
| `DELETE /api/v1/pipelines/:id` | Soft-Delete |

**Sicherheitsmechanismen:**
- `assertEditable(userId, deal)` — prüft Owner/Manager/Admin für alle Schreibpfade
- `assertStageInPipeline(stageId, pipelineId)` — verhindert Cross-Pipeline-Stage-Moves
- Closed-Deal-Guard: `changeStage` lehnt ab wenn `isClosed=true` (source oder target stage)
- Audit-Trail via `prisma.auditLog.create` für alle Mutationen
- Pipeline-Room-Scoping: `server.to(PIPELINE_ROOM(pipelineId)).emit(...)` — kein globales `server.emit`

**WebSocket-Events** (neu in `packages/types/src/events.ts`):
- `pipeline:subscribe` / `pipeline:unsubscribe` — Client-seitig, Room-Join/Leave
- `deal:created`, `deal:updated`, `deal:stage-changed`, `deal:closed` — scoped auf `pipeline:<id>`

---

## Frontend

**Seiten:**
- `/deals` — `KanbanBoard` (DnD, Optimistic-UI), `DealListView`, `DealTableView`, `DealTimelineView`, `ViewSwitcher`
- `/deals/[id]` — `DealDetailHeader` (Actions), `StageStepper` (aktive Stage, Closed-State), Tabs Übersicht/Aktivitäten/Dateien

**Neue Komponenten** (`apps/web/components/deals/`):
`KanbanBoard`, `KanbanColumn`, `DealCard` (Rot-Indikator, Won/Lost-Badge, Ghosting-Badge), `CreateDealModal`, `SnoozeGhostingModal`, `DealDetailHeader`, `StageStepper`, `ViewSwitcher`, `DealListView`, `DealTableView`, `DealTimelineView`

**Hooks:**
- `apps/web/hooks/use-deals-socket.ts` — Socket-Hook, typed Event-Callbacks, Pipeline-Subscribe/Unsubscribe-Lifecycle, Reconnect-Handling

**API-Client:**
- `apps/web/lib/deals-api.ts` — Funktionen für alle Deal-/Pipeline-Endpoints
- `apps/web/lib/deal-format.ts` — Formatierung (Value, Closing-Date, Status-Labels)

---

## Schema-Änderungen

Bestehende Models `Deal`, `Pipeline`, `Stage` aus Session 1 erweitert.

**Neue Migration:**
- `20260511120000_deals_order_score_closing`
- Neue Spalten auf `Deal`: `order INT DEFAULT 0`, `score DECIMAL(5,2) DEFAULT 0`, `closingDate DATETIME?`, `status DealStatus DEFAULT OPEN`
- Neuer Enum: `DealStatus { OPEN, CLOSED_WON, CLOSED_LOST }`
- Indexes: `stageId`, `ownerId`, `status`, `closingDate`, Composite `(stageId, order)`

---

## Neue Env-Variablen

Keine.

---

## Test-Coverage

| Scope | Tests | Coverage | Notiz |
|-------|-------|----------|-------|
| API (gesamt) | 200 in ~20 Files | ~98% | +41 vs. Session 4 |
| Web (gesamt) | 164 in ~20 Files | ~85% | +65 vs. Session 4; 9 neue Komponenten-Test-Files |

**Neue Test-Files (API):**
`deals.service.spec.ts` (~42 Cases), `deals.controller.spec.ts` (~18 Cases), `pipelines.service.spec.ts` (~21 Cases), `pipelines.controller.spec.ts`, `events.gateway.spec.ts` (+7 Cases für Subscribe/Unsubscribe/Scoped-Emit)

**Neue Test-Files (Web):**
`use-deals-socket.test.tsx` (224 Zeilen, Reconnect-Coverage), `deals-api.test.ts`, `deal-format.test.ts`, Tests für alle 11 Komponenten (KanbanBoard, KanbanColumn, DealCard, CreateDealModal, DealDetailHeader, ViewSwitcher, StageStepper, SnoozeGhostingModal, DealList/Table/Timeline-Views)

---

## AC-Status (4/4)

- [x] AC-002: Kanban zeigt alle Deals korrekt nach Stage — `GET /deals/kanban` + `KanbanBoard`
- [x] AC-003: DnD < 16ms, Optimistic-UI mit Rollback bei API-Fehler — @dnd-kit + React-Query `onError`
- [x] AC-004: Pipeline-Value aktualisiert nach Stage-Wechsel — server-seitig in `changeStage`
- [x] AC-005: Rot-Indikator nach konfigurierten Tagen — `rotIndicator`-Flag via Pipeline.rotThresholdDays

---

## Review-Ergebnis

**Deep-Review (Tier 3, Opus 4.7):** Initialer Report: 4 BLOCKER, 5 HIGH, 6 MEDIUM, 4 LOW.
Nach Verifikation gegen realen Code: 3 von 4 BLOCKERn waren **FALSE POSITIVES** (Reviewer halluzinierte nicht-existierende Methoden `reorderDeals`, `findDealOrThrow` sowie nicht-existierende DTO-Felder). Nur B4 (WS-Broadcast) und H3 (Closed-Deal-Guard) waren echt.

**Security-Fix `fd2ae98`:** Nur die 2 echten Findings gefixt — keine "prophylaktischen" Fixes für halluzinierten Code.

**Light-Review (Tier 2):** CLEAN — keine weiteren BLOCKER. Quality-Gate 10/10 grün (200 API-Tests, 164 Web-Tests, Lint PASS, Typecheck PASS).

Review-Dokumente: `docs/30-reviews/session-5-deep-review.md`, `docs/30-reviews/session-5-light-review.md`

---

## Tech-Debt (neu aus Session 5)

| ID | Beschreibung | Geplant |
|----|-------------|---------|
| TD-S5-01 | `deal-format.test.ts` nutzt echten System-Clock (`new Date()`) — fragile Tests | Session 16a |
| TD-S5-02 | Index-Migration ohne `CONCURRENTLY` — bei Prod-Migration manuell als separate Migration ausführen | Session 15 |
| TD-S5-03 | `providers.tsx` kein `staleTime`-Default — WS-getriggerte Refetches entstehen | Session 6 oder eigener PR |
| TD-S5-04 | `pipeline:subscribe` prüft Org-Zugehörigkeit von `pipelineId` nicht via Prisma (akzeptabel bei Single-Tenant) | Session 15 (Multi-Tenancy) |

---

## Nächste Session (Session 6 — M1 Pulse-Feed)

**Voraussetzungen erfüllt:**
- `EventsGateway` mit Pipeline-Room-Infra auf `main`
- `GET /api/v1/deals/kanban` für Feed-Daten bereit
- Bell-Button (Tech-Debt Session 3) wird in Session 6 adressiert

---

## Branch & PRs

- **Feature-Branch:** `feature/session-5-deals`
- **Security-Fix-Branch:** `fix/session-5-security`
- **PR #7:** Security-Fix (WS Pipeline-Room-Scoping + Closed-Deal-Guard) — gemergt
- **PR #8:** Feature Session 5 Deals — gemergt
- **Commits:** `84b2660` feat(session-5) · `fd2ae98` fix(session-5)
- **Migration:** `20260511120000_deals_order_score_closing`
- **Diff:** 98 Dateien, +9.372 / -30 LoC
