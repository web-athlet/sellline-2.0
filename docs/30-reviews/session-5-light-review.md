---
title: "Light Review Session 5 — M3 Deals (Kritischer Pfad)"
session: 5
type: light
status: clean
date: 2026-05-11
blockers: 0
summary: "Light Review Session 5: CLEAN — Deep-Review-BLOCKER (B4 + H3) durch fix/session-5-security geschlossen, Diff selbst bringt keine neuen BLOCKER."
---

# Light Review Session 5 — M3 Deals

**Status:** CLEAN — merge-ready
**Branch:** `fix/session-5-security` (basiert auf `feature/session-5-deals`)
**Vergleich:** `git diff main..HEAD`
**Reviewer:** Tier-2 (light), invoked via `/review-light`

## Scope

- **2 Commits:**
  - `84b2660` feat(session-5): deals module M3 — kanban, dnd, pipeline-value, websocket
  - `fd2ae98` fix(session-5): security hardening — WS pipeline-room scoping + closed-deal stage guard
- **59 Dateien, +5392 LoC** (Deals-Modul: API + Web + Tests + WebSocket-Events + Pipelines-Modul)
- Tier-3 Deep-Review existiert bereits unter `docs/30-reviews/session-5-deep-review.md`.

## Deep-Review-BLOCKER-Status

Der Deep-Review hatte 4 BLOCKER und 3 prioritäre HIGH-Findings. Verifikation gegen den realen Code (siehe Deep-Review-Header):

| ID | Claim | Verifikation | Status |
|----|-------|--------------|--------|
| B1 | `reorderDeals` IDOR | Methode existiert nicht; Reorder läuft via `changeStage` → `assertEditable` (Owner/Manager/Admin) in `$transaction`. | FALSE POSITIVE |
| B2 | `findDealOrThrow` ohne `deletedAt: null` | Methode existiert nicht. `findOne` (`deals.service.ts:111`) und `assertExists` (`:475`) filtern korrekt. | FALSE POSITIVE |
| B3 | `snoozedUntil` past-date möglich | `SnoozeGhostingDto` hat `@IsInt @Min(1) @Max(365)` auf `days`; Server berechnet `until = now + days`. `UpdateDealDto` exponiert das Feld nicht. | FALSE POSITIVE |
| B4 | WS broadcastet `this.server.emit` an alle | Bestätigt im ursprünglichen Code. | ECHT — gefixt in `fd2ae98` |
| H1 | Keine Pagination in `findAll` | `page=1, limit=50` (`@Max(500)`) bereits da. | FALSE POSITIVE |
| H2 | Reorder ohne `$transaction` | `changeStage` ist in `prisma.$transaction(...)`. | FALSE POSITIVE |
| H3 | Closed deals → Stage-Change möglich | Bestätigt. | ECHT — gefixt in `fd2ae98` |

## Tier-2-Checkliste — neue Findings aus dem Diff

### 1. Offensichtliche Bugs
Keine. `assertEditable` zentralisiert Owner/Role-Checks für alle Schreibpfade (`update`, `remove`, `changeStage`, `markWon`, `markLost`, `snoozeGhosting`, `addProduct`, `removeProduct`). `assertStageInPipeline` verhindert Cross-Pipeline-Stage-Moves. `EventsGateway.handleConnection` schliesst unauthenticated Sockets zuverlässig.

### 2. Error-Handling
- DTOs durchgängig mit `class-validator` (`@IsString`, `@IsUUID`, `@IsInt @Min @Max`, `@IsEnum`).
- Service wirft `NotFoundException` / `ForbiddenException` / `BadRequestException` wo passend.
- Keine fehlenden `await`s in Service-Methoden gefunden.
- WS-Handler geben strukturierte `{ event: 'error', data: { reason } }`-Antworten zurück statt zu werfen — gut für Client-UX.

### 3. Security-Basics
- **Soft-Delete:** Alle `findMany`/`findFirst`/`groupBy`/`aggregate` filtern `deletedAt: null` (verifiziert per grep — 8 Treffer in `deals.service.ts`, alle korrekt).
- **RBAC:** Globaler `JwtAuthGuard` (`app.module.ts:41`) schützt alle Routen. Pro-Deal-Mutationen über `assertEditable`.
- **WS-Auth:** JWT wird in `handleConnection` verifiziert; ungültige Tokens disconnecten sofort. `pipeline:subscribe` lehnt unauthenticated Sockets explizit ab.
- **Event-Scoping:** `emitDeal*` ruft `server.to(PIPELINE_ROOM(pipelineId))` — kein globales `server.emit` mehr (B4-Fix).
- **Closed-Deal-Guard:** `changeStage` lehnt Stage-Wechsel ab, wenn Quell- oder Ziel-Stage `isClosed=true` ist (H3-Fix).
- **Audit-Trail:** Jeder Schreibpfad ruft `this.audit(userId, action, dealId, diff)`.

### 4. Tests
- **API:** 200 Tests grün (vitest), davon ~28 für Deals/Pipelines.
- **Web:** 164 Tests grün, 9 neue Test-Dateien für Deal-Komponenten (KanbanBoard, KanbanColumn, DealCard, CreateDealModal, DealDetailHeader, ViewSwitcher, StageStepper, SnoozeGhostingModal, DealList/Table/Timeline-Views).
- `events.gateway.spec.ts` (94 Zeilen, neu) deckt JWT-Auth + Pipeline-Subscribe/Unsubscribe ab.
- `use-deals-socket.test.tsx` (224 Zeilen, neu) testet Socket-Hook inkl. Reconnect.

### 5. DSGVO
- Keine PII (E-Mail, Name, Telefon) in `console.log`/`Logger`-Aufrufen im Diff.
- `Logger.warn`-Calls in `EventsGateway` loggen nur Socket-IDs, keine User-Daten.
- Audit-Log via `prisma.auditLog.create` für alle Mutationen.

## Findings

| # | Severity | Datei:Zeile | Problem | Vorschlag |
|---|----------|-------------|---------|-----------|
| 1 | INFO | `apps/api/src/events/events.gateway.ts:80–95` | `pipeline:subscribe` verifiziert die Existenz der `pipelineId` und die Org-Zugehörigkeit des Users nicht per Prisma. Aktuell akzeptabel, weil die App single-tenant ist und alle authentifizierten User ohnehin alle Pipelines sehen (`PipelinesService.findAll` ohne Org-Scoping). Sobald Multi-Tenancy eingeführt wird (Session 15?), muss vor `client.join(room)` ein `prisma.pipeline.findFirst({ where: { id, orgId: user.orgId } })` ergänzt werden. | Tech-Debt für Session 15 oder bei Einführung der Org-Entity vermerken. |
| 2 | INFO | `apps/web/components/deals/DealCard.tsx` o.ä. | Kein `dangerouslySetInnerHTML` und kein raw `innerHTML` im Diff — XSS-Surface unverändert. Positiv-Befund. | — |

Keine BLOCKER, keine WARN, keine MAJOR-Findings über das hinaus, was Deep-Review + Fix-Commit bereits adressiert haben.

## Quality-Gate

| Check | Status | Notiz |
|-------|--------|-------|
| Lint | PASS | `pnpm lint` — `✔ No ESLint warnings or errors` (alle 6 Tasks cached) |
| Typecheck (API) | PASS | `tsc --noEmit -p tsconfig.json` clean |
| Typecheck (Web) | PASS | `tsc --noEmit` clean |
| Unit (API) | PASS | 200/200 Tests in 27.1s |
| Unit (Web) | PASS | 164/164 Tests in 16.0s |
| npm audit | n/a | Threshold steht weiterhin auf `critical` (Next.js 14.2 CVE, geplant Session 15 — keine neuen Vulns durch diesen Diff) |

## Verdict

**CLEAN — Merge-ready.**

- Beide echten Deep-Review-BLOCKER (B4 WS-Broadcast, H3 Closed-Deal-Guard) sind durch `fd2ae98` korrekt geschlossen — verifiziert in `events.gateway.ts:108–129` (Pipeline-Room-Scoping) und `deals.service.ts` (`changeStage` mit `isClosed`-Check).
- Der ursprüngliche Feature-Commit `84b2660` führte schon die meisten als BLOCKER gemeldeten Schutzmechanismen (Pagination, Owner-Check via `assertEditable`, `$transaction`-Reorder, snooze-DTO-Validation, `deletedAt`-Filter) korrekt aus — der Deep-Review hat hier teilweise halluzinierten Code geprüft.
- Keine zusätzlichen BLOCKER aus dem Light-Review-Scan.
- Quality-Gate komplett grün.

PR kann gemergt werden, sobald `.claude/agents/reviewer.md` (uncommitted local change) entweder committed oder revertiert ist.
