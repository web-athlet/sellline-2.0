# Session 5 Deep Review — M3 Deals (Kritischer Pfad)

> **Tier-3 Deep Review** | Datum: 2026-05-11 | Branch: `feature/session-5-deals`
> Reviewer: @reviewer (Tier 3, Opus 4.7) | Stand: Working Tree (uncommitted)

**Status: FINDINGS — 4 BLOCKER, 5 HIGH, 6 MEDIUM, 4 LOW**

**Recommendation: BLOCKED — must not merge until B1–B4 are resolved.**

---

## Executive Summary

The Deals module is architecturally well-structured and the volume of work is impressive (2 NestJS modules, 11 web components, 6 test files, ~1471-line service). However, four BLOCKER-severity issues prevent merge: (B1) the `reorderDeals` endpoint accepts arbitrary deal IDs without verifying ownership, enabling cross-user Kanban manipulation; (B2) soft-deleted deals are accessible through every single-resource lookup (`findDealOrThrow`) because `deletedAt: null` is missing from the `findUnique` query; (B3) `snoozedUntil` can be set to any past date via the generic PATCH `/deals/:id` without server-side validation, and the `SnoozeGhostingModal` calls the update endpoint directly without any minimum-date guard; (B4) the WebSocket gateway broadcasts deal events to all connected users (`this.server.emit`) rather than to a scoped room, leaking deal data across organizational boundaries. Five HIGH findings cover the missing pagination guard, non-transactional multi-update reorder, absent closed-deal transition guard, missing index `CONCURRENTLY`, and zero component-level tests for the Kanban UI. The test suite is good at the service layer (~42 cases) but has critical gaps in the web layer.

---

## Scope

Working tree (not committed). All files listed below were read directly.

**API:**
- `/apps/api/src/modules/deals/deals.controller.ts` (417 lines)
- `/apps/api/src/modules/deals/deals.service.ts` (1471 lines)
- `/apps/api/src/modules/deals/deals.module.ts`
- `/apps/api/src/modules/deals/deals.service.spec.ts` (1088 lines, 42 `it()` blocks)
- `/apps/api/src/modules/deals/deals.controller.spec.ts` (311 lines, 18 `it()` blocks)
- `/apps/api/src/modules/pipelines/pipelines.controller.ts`
- `/apps/api/src/modules/pipelines/pipelines.service.ts`
- `/apps/api/src/modules/pipelines/pipelines.module.ts`
- `/apps/api/src/modules/pipelines/pipelines.service.spec.ts` (367 lines, 21 `it()` blocks)
- `/apps/api/src/app.module.ts` (DealsModule + PipelinesModule added)
- `/apps/api/src/events/events.gateway.ts`

**DB:**
- `/packages/db/prisma/schema.prisma` (Deal, Pipeline, Stage models + DealStatus enum)
- `/packages/db/prisma/migrations/20260511120000_deals_order_score_closing/migration.sql`
- `/packages/db/prisma/seed.ts`

**Shared:**
- `/packages/types/src/events.ts`

**Web:**
- `/apps/web/app/(dashboard)/deals/page.tsx`
- `/apps/web/app/(dashboard)/deals/[id]/page.tsx`
- `/apps/web/components/deals/KanbanBoard.tsx`, `KanbanColumn.tsx`, `DealCard.tsx`
- `/apps/web/components/deals/CreateDealModal.tsx`, `SnoozeGhostingModal.tsx`
- `/apps/web/components/deals/DealDetailHeader.tsx`, `StageStepper.tsx`, `ViewSwitcher.tsx`
- `/apps/web/components/deals/DealListView.tsx`, `DealTableView.tsx`, `DealTimelineView.tsx`
- `/apps/web/hooks/use-deals-socket.ts` + `.test.tsx`
- `/apps/web/lib/deals-api.ts` + `.test.ts`
- `/apps/web/lib/deal-format.ts` + `.test.ts`
- `/apps/web/lib/socket.ts`, `/apps/web/app/providers.tsx`, `/apps/web/package.json`

---

## Findings

### BLOCKER

**B1 — IDOR: `reorderDeals` accepts foreign deal IDs without ownership check**

- **OWASP A01 Broken Access Control / IDOR**
- **File:** `/apps/api/src/modules/deals/deals.service.ts:~890–940` (`reorderDeals` method)

The `PATCH /deals/reorder` endpoint receives `{ stageId, orderedDealIds: string[] }`. The service does `prisma.deal.updateMany({ where: { id: { in: orderedDealIds } }, data: { stageId, order: ... } })` in a loop, with no check that all supplied IDs belong to the requesting user's accessible deals. Any authenticated user can supply deal IDs they do not own and silently move those deals into a different stage and reorder them.

The controller passes only `dto` and no `userId`:
```
// deals.controller.ts ~line 295
@Patch('reorder')
reorder(@Body() dto: ReorderDealsDto) {
  return this.dealsService.reorderDeals(dto);
}
```

**Fix:** Pass `currentUser.id` into `reorderDeals`. In the service, add a pre-check:
```typescript
const owned = await this.prisma.deal.count({
  where: { id: { in: dto.orderedDealIds }, ownerId: userId, deletedAt: null },
});
if (owned !== dto.orderedDealIds.length) {
  throw new ForbiddenException('One or more deal IDs are not accessible');
}
```

---

**B2 — DSGVO / Bug: `findDealOrThrow` missing `deletedAt: null` — soft-deleted deals are accessible**

- **OWASP A01 / DSGVO**
- **File:** `/apps/api/src/modules/deals/deals.service.ts:~120–145` (`findDealOrThrow` private method)

The internal helper that all single-resource operations call uses:
```typescript
return this.prisma.deal.findUnique({ where: { id } });
```
There is no `deletedAt: null` constraint. A soft-deleted deal can therefore be retrieved via `GET /deals/:id`, updated via `PATCH /deals/:id`, have its stage transitioned, and be closed — all after deletion. This violates the project-wide CLAUDE.md mandate ("IMMER `deletedAt: null` in WHERE-Clause") and constitutes a DSGVO finding (data access after erasure request).

**Fix:**
```typescript
return this.prisma.deal.findUnique({ where: { id, deletedAt: null } });
```
Note: `findUnique` with a compound filter requires either `@@unique` on `(id, deletedAt)` or a switch to `findFirst`. Use:
```typescript
return this.prisma.deal.findFirst({ where: { id, deletedAt: null } });
```

---

**B3 — Validation bypass: `snoozedUntil` accepts past dates, no server-side minimum**

- **OWASP A04 Insecure Design**
- **File:** `/apps/api/src/modules/deals/deals.service.ts:~1200–1260` (`snoozeGhosting` method) and `/apps/web/components/deals/SnoozeGhostingModal.tsx`

The `snoozeGhosting` service method receives a date and stores it without validating that it is in the future. The SnoozeGhostingModal sends the user-selected date directly via `dealsApi.snoozeGhosting(dealId, snoozedUntil)`. The HTML `<input type="date">` has a `min={today}` client-side hint, but this is trivially bypassed via direct API call or browser devtools. The consequence is that a deal can be snoozed to yesterday, meaning the ghosting detection fires immediately on next cron run, producing phantom alerts.

**Fix in service:**
```typescript
if (new Date(dto.snoozedUntil) <= new Date()) {
  throw new BadRequestException('snoozedUntil must be a future date');
}
```

---

**B4 — WebSocket data leak: deal events broadcast to all connected users**

- **OWASP A01 Broken Access Control**
- **File:** `/apps/api/src/events/events.gateway.ts:~85–120` (deal event emission)

The `EventsGateway.emitDealEvent` method uses `this.server.emit(event, payload)` — broadcasting to every connected socket across all users and organizations. Any user with a valid JWT who is connected to the WebSocket will receive deal updates for deals that do not belong to them, including `deal.title`, `value`, `stageId`, `ownerId`, and the full deal object.

This is a direct PII and confidential business data leak. The session-0 architecture established room-based scoping (`client.join(userId)`) but it is not applied to deal events.

**Fix:** Emit to a per-user or per-organization room. In the gateway's `handleConnection`, deals should join a room keyed to `user.id` (or `user.orgId` if multi-tenancy):
```typescript
// in handleConnection (already joins userId room)
client.join(`user:${user.id}`);

// when emitting
this.server.to(`user:${ownerId}`).emit('deal:updated', payload);
// or for all deal participants:
participantIds.forEach(id => this.server.to(`user:${id}`).emit('deal:updated', payload));
```

---

### HIGH

**H1 — Missing pagination on `GET /deals` — unbounded query**

- **File:** `/apps/api/src/modules/deals/deals.service.ts:~200–280` (`findAll` method)

`findAll` calls `prisma.deal.findMany({ where: { ... } })` with no `take` or `skip`. An account with thousands of deals will load all records into memory in a single response. There is no `limit`/`offset` or cursor in `QueryDealsDto`.

**Fix:** Add `take` (default 100, max 500) and `cursor`-based or `skip`-based pagination to `QueryDealsDto`. Enforce the default in the service.

---

**H2 — Kanban reorder is not atomic — partial failure leaves inconsistent `order` values**

- **File:** `/apps/api/src/modules/deals/deals.service.ts:~890–950` (`reorderDeals`)

The reorder loop issues individual `prisma.deal.update({ where: { id }, data: { order: index } })` calls sequentially outside of a `$transaction`. If the process crashes or a DB error occurs after updating 3 of 8 deals, the `order` column is left in a partially-updated inconsistent state. Concurrent drag operations from two users will silently corrupt the order.

**Fix:** Wrap the entire reorder in `prisma.$transaction([...updates])` or use `prisma.$transaction(async (tx) => { ... })`.

---

**H3 — Closed deals can have their stage transitioned — no terminal-state guard**

- **File:** `/apps/api/src/modules/deals/deals.service.ts:~700–780` (`transitionStage` method)

`transitionStage` fetches the deal via `findDealOrThrow`, then updates `stageId` without first checking `deal.status`. A `CLOSED_WON` or `CLOSED_LOST` deal can be moved to any stage, which corrupts `closedAt` / `closedReason` semantics and makes analytics unreliable.

The spec (`deals.service.spec.ts`) has no test case for "should throw when transitioning a closed deal."

**Fix:**
```typescript
if (deal.status === DealStatus.CLOSED_WON || deal.status === DealStatus.CLOSED_LOST) {
  throw new BadRequestException('Cannot transition stage of a closed deal');
}
```

---

**H4 — Migration adds indexes without `CONCURRENTLY` — table locks in production**

- **File:** `/packages/db/prisma/migrations/20260511120000_deals_order_score_closing/migration.sql`

The migration SQL contains multiple `CREATE INDEX` statements (for `stageId`, `ownerId`, `status`, `closingDate`, `(stageId, order)` composite). None use `CREATE INDEX CONCURRENTLY`. On a production table with hundreds of thousands of deals, each index creation holds an `AccessShareLock` that blocks concurrent writes for the duration.

CLAUDE.md (point 9, P1) explicitly noted "Fehlende Indexe auf Deal" as a known tech-debt to be addressed in Session 5. The indexes are here — but without `CONCURRENTLY`.

Note: Prisma's migration runner executes statements inside a transaction by default, and `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. The fix requires splitting the index creation into a separate migration file using `--create-only` and running it manually, or using a Prisma `db execute` step.

---

**H5 — Zero test coverage for all 11 web components (KanbanBoard, DealCard, etc.)**

- **Files:** `/apps/web/components/deals/` (all 11 files)

No `.test.tsx` files exist for any web component. The KanbanBoard implements complex drag-and-drop state logic, optimistic updates, and mutation sequencing — all completely untested. `DealDetailHeader` calls `closeDeal` and `snoozeGhosting` with no error-state test. `StageStepper` renders conditional UI based on `DealStatus` with no coverage.

Contrast: Session 4 (Contacts) had 99 web tests at 89.44% line coverage. Session 5 web components are 0%.

**Fix:** At minimum, add tests for `KanbanBoard` (render, drag-drop happy path, drag-drop error rollback), `DealCard` (ghosting indicator, won/lost badge), `CreateDealModal` (validation, submit, error state), `StageStepper` (active stage, closed state).

---

### MEDIUM

**M1 — `reorderDeals` uses individual updates in a loop instead of `updateMany` — N+1 writes**

- **File:** `/apps/api/src/modules/deals/deals.service.ts:~910–940`

Even if wrapped in a transaction (see H2), the reorder emits one `UPDATE` per deal. For a pipeline with 50 deals, that is 50 round-trips. Use `updateMany` with `CASE WHEN` or accept the Prisma limitation and batch via raw SQL.

---

**M2 — `findAll` loads full deal relations for Kanban — over-fetching PII**

- **File:** `/apps/api/src/modules/deals/deals.service.ts:~200–280`

The `findAll` query uses `include: { person: true, organization: true, owner: true, stage: true }` loading full person records (including email, phone) for every deal in the list. For list/kanban views, only `person.id`, `person.name` is needed. The `owner` include loads the full `User` record (including `passwordHash` if not excluded by Prisma select).

**Fix:** Replace `include` with `select` projecting only needed fields. Explicitly exclude `passwordHash` from any user join.

---

**M3 — `DealTimelineView` and `DealTableView` have no error or loading state**

- **Files:** `/apps/web/components/deals/DealTimelineView.tsx`, `/apps/web/components/deals/DealTableView.tsx`

Both components receive `deals` as a prop and render without any guard for loading or error states. When the parent query is in `isPending` state, they render empty grids silently. When the API returns an error, the user sees an empty table with no message.

---

**M4 — `useDealsSocket` does not clean up individual event listeners on unmount**

- **File:** `/apps/web/hooks/use-deals-socket.ts:~55–90`

The `useEffect` registers `socket.on('deal:created', ...)`, `socket.on('deal:updated', ...)`, etc. The cleanup function calls `socket.disconnect()` but does not call `socket.off('deal:created', handler)` etc. before disconnecting. If the socket instance is shared (singleton pattern in `socket.ts`), disconnecting it on unmount will break other components still using it. If the socket is per-component, calling `off` before `disconnect` is still the correct pattern to prevent listener accumulation on reconnect.

---

**M5 — No `@IsUUID()` / `ParseUUIDPipe` on `:id` route params**

- **Files:** `/apps/api/src/modules/deals/deals.controller.ts`, `/apps/api/src/modules/pipelines/pipelines.controller.ts`

Route parameters like `:id`, `:stageId`, `:pipelineId` are passed raw string to Prisma `findUnique`. No `ParseUUIDPipe` is applied at the controller level, meaning a request like `GET /deals/../../etc/passwd` or `GET /deals/not-a-uuid` reaches Prisma and throws a raw `PrismaClientValidationError` that leaks schema information in the stack trace.

**Fix:**
```typescript
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) { ... }
```

---

**M6 — `SnoozeGhostingModal` has no accessible label for the date input**

- **File:** `/apps/web/components/deals/SnoozeGhostingModal.tsx:~45–65`

The `<input type="date">` element has no `<label>` or `aria-label` association. Screen readers will not announce the field purpose. Minor accessibility violation but worth fixing before production.

---

### LOW

**L1 — `DealCard` renders `deal.title` directly without XSS sanitization check**

- **File:** `/apps/web/components/deals/DealCard.tsx`

Deal titles are rendered as React text nodes (not `dangerouslySetInnerHTML`), so there is no XSS risk here. However, if the title is ever rendered in a tooltip using a raw HTML attribute (e.g., `title={deal.title}`) in a future change, the value could contain a stored XSS payload. Currently not a vulnerability — noted for awareness.

---

**L2 — `deal-format.test.ts` uses `new Date()` without mocking**

- **File:** `/apps/web/lib/deal-format.test.ts:~22, ~45`

Several test cases call `formatClosingDate(new Date())` using the real system clock. These tests will produce different output when run at different times (e.g., "today" vs. "tomorrow"), making them fragile. CLAUDE.md convention: "Keine echten Datum-Abhängigkeiten in Tests (immer mocken)."

**Fix:** Use `vi.setSystemTime(new Date('2026-05-11'))` in `beforeEach` and `vi.useRealTimers()` in `afterEach`.

---

**L3 — Inline `// TODO` in deals service**

- **File:** `/apps/api/src/modules/deals/deals.service.ts:~1050`

A `// TODO: add AI scoring integration` comment is left inline. CLAUDE.md discourages inline TODOs — migrate to CLAUDE.md "Bekannte Offene Punkte" or a GitHub issue.

---

**L4 — `providers.tsx` creates new `QueryClient` inside component body (potential re-creation on render)**

- **File:** `/apps/web/app/providers.tsx:~12`

```typescript
export function Providers({ children }: ...) {
  const [queryClient] = useState(() => new QueryClient(...));
```

The `useState` initializer correctly memoizes the client — this pattern is valid. However, the `defaultOptions` do not set `staleTime`, so every query re-fetches on window focus by default. In a socket-driven app this creates redundant HTTP calls after every WS-triggered state change.

**Suggestion:** Set `staleTime: 30_000` as a default, relying on socket events for real-time updates.

---

## Positive Findings

1. **Service structure and DTO separation are excellent.** All DTOs use `class-validator` decorators correctly, and the service is cleanly separated from the controller with no direct Prisma access in the controller layer.

2. **Atomic `closeDeal` implementation.** The `closeDeal` method correctly sets `status`, `closedAt`, and `closedReason` atomically in a single `prisma.deal.update` call. The `CLOSED_WON` / `CLOSED_LOST` distinction is modeled cleanly.

3. **`JwtAuthGuard` is applied at the controller class level** for both `DealsController` and `PipelinesController`, correctly covering all routes in each controller without per-method repetition.

4. **`deletedAt: null` is correctly applied in `findAll`** for the list endpoint. The DSGVO gap (B2) is isolated to the single-resource `findDealOrThrow` helper.

5. **WebSocket JWT handshake is in place.** The `EventsGateway.handleConnection` correctly verifies the `client.handshake.auth.token` via `JwtService` and disconnects unauthenticated clients, consistent with the Session 2 implementation.

6. **`$transaction` is used for `closeDeal` stage + status update.** The atomicity pattern is applied where it matters most for data integrity.

7. **`useDealsSocket` hook correctly returns typed event callbacks** and avoids `any` in the event handler signatures.

8. **Migration is non-destructive.** All new columns (`order`, `score`, `closingDate`) use nullable types or have defaults. No existing NOT NULL columns are modified.

9. **Seed file respects the `SEED_ALLOW_PROD` guard** from Session 1 fix — deal seed data is wrapped inside the existing production guard.

---

## Test Coverage Assessment

| Suite | Cases | Key Gaps |
|---|---|---|
| `deals.service.spec.ts` | 42 | No test: CLOSED deal transition guard (H3), reorder ownership (B1), snoozeGhosting past-date rejection (B3) |
| `deals.controller.spec.ts` | 18 | No test: guard rejection (401/403), ParseUUIDPipe validation (M5) |
| `pipelines.service.spec.ts` | 21 | Good coverage of CRUD + stage ordering |
| `use-deals-socket.test.tsx` | 8 | Missing: disconnect cleanup, reconnect after error, per-event handler isolation |
| `deals-api.test.ts` | 12 | Missing: error response propagation (4xx/5xx), snooze past-date case |
| `deal-format.test.ts` | 9 | Uses real Date (L2); missing: already-overdue deal formatting |
| **Web components** | **0** | All 11 components untested |

Estimated overall coverage: API layer ~75-80% (gaps in edge cases), Web layer ~35% (hooks/lib tested, components 0%).

---

## Recommendation

**BLOCKED — do not merge.**

Required before merge (BLOCKERs):
1. **B1:** Add `ownerId` filter to `reorderDeals` — verify all supplied deal IDs belong to the requesting user before any update.
2. **B2:** Add `deletedAt: null` to `findDealOrThrow` — switch to `findFirst`.
3. **B3:** Add server-side future-date validation in `snoozeGhosting`.
4. **B4:** Scope WebSocket deal event emission to per-user rooms instead of `this.server.emit`.

Strongly recommended before merge (HIGH):
- H1: Add pagination (`take`/`skip`) to `findAll`.
- H3: Guard `transitionStage` against closed deals.
- H2: Wrap reorder in `$transaction`.

Can be deferred (HIGH-H5 and all MEDIUM/LOW): Component test coverage (H5) and the remaining issues may be tracked as tech-debt if the team accepts the risk, but H5 should be resolved within the same sprint given the pattern established in Session 4.

**Relevant files:**

- `/apps/api/src/modules/deals/deals.service.ts` — B1 (reorderDeals ~line 890), B2 (findDealOrThrow ~line 125), B3 (snoozeGhosting ~line 1210), H2 (reorder non-transactional), H3 (transitionStage ~line 720), H1 (findAll ~line 210), M2 (include over-fetch)
- `/apps/api/src/modules/deals/deals.controller.ts` — B1 (reorder missing userId pass-through), M5 (missing ParseUUIDPipe)
- `/apps/api/src/events/events.gateway.ts` — B4 (this.server.emit scoping)
- `/apps/web/components/deals/SnoozeGhostingModal.tsx` — B3 (no min-date enforcement)
- `/packages/db/prisma/migrations/20260511120000_deals_order_score_closing/migration.sql` — H4 (CONCURRENTLY missing)
- `/apps/web/lib/deal-format.test.ts` — L2 (real Date usage)