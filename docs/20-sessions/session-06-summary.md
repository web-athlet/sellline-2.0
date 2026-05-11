---
title: "Session 06 — M1 Pulse-Feed"
tags: [session, m1, pulse-feed, websocket, redis, react-query]
status: completed
session: 6
last_updated: 2026-05-12
summary: "M1 Pulse-Feed vollstaendig: score-sortierter Daily-Feed (3 Tabs), Redis-Cache 30s TTL, WS User-Room per user:{userId}, virtualisierte FeedList, Bell-Button-Tech-Debt behoben. Kein Schema-Change. 222 API / 202 Web-Tests."
---

# Session 06 — M1 Pulse-Feed

## TLDR (5 Zeilen)

- `GET /api/v1/pulse-feed` liefert score-sortierte Items in 3 Tabs (followups/missed/opportunities); Redis-Cache 30s TTL, Cache-Key `pulse:{userId}:{date}:{tab}:{page}`
- Priority-Score-Formel: `min(dealValue/10000*30,30) + min(daysOverdue*20,30) + min(activitiesLast7d*10,30) + (stageIndex/totalStages)*10`; score > 75 → isUrgent
- `PATCH /pulse-feed/activity/:id/complete` markiert done, invalidiert Cache per Pattern, emittiert `pulse:feed_updated` im `user:{userId}` Room
- Frontend: Pulse-Seite mit DayNav, TabBar (Badge-Counts), InfoBanner (localStorage), virtualisierter FeedList (@tanstack/react-virtual), FeedItem (ScoreBar, Dringend-Badge, Slide-Out)
- Bell-Button-Tech-Debt Session 3 #11 behoben: NavRail Bell → `router.push('/pulse')`; 222 API / 202 Web-Tests, Quality-Gate 10/10

---

## Was wurde implementiert?

### Backend — PulseFeedModule

**Neues Modul:** `apps/api/src/modules/pulse-feed/`

- `pulse-feed.service.ts` — Tab-Queries:
  - `followups`: Activities `dueDate <= today`, `done = false`
  - `missed`: Deals ohne Aktivitaet 7+ Tage ODER `rotIndicator = true`
  - `opportunities`: Deals `probability > 60`, nicht gewonnen/verloren
  - `completeActivity` — markiert done, `delByPattern('pulse:{userId}:*')`, emittiert WS
  - `invalidateForUser(userId)` public — direkt aufrufbar aus ActivitiesService (Session 7)
- `pulse-feed.controller.ts`
  - `GET /api/v1/pulse-feed?tab=&date=&page=`
  - `GET /api/v1/pulse-feed/counts`
  - `PATCH /api/v1/pulse-feed/activity/:id/complete` (HTTP 204, ParseUUIDPipe)
- `dto/query-pulse-feed.dto.ts` — `PulseTab` enum (followups/missed/opportunities), `QueryPulseFeedDto`
- `pulse-feed.module.ts` — importiert PrismaModule, RedisModule, EventsModule

**Neues Modul:** `apps/api/src/redis/`

- `redis.service.ts` — `@Global()` ioredis-Wrapper; `get/set/delByPattern`; `lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1`; loggt Fehler, returned null/void als Fallback
- `redis.module.ts`

**Geaenderte Dateien:**

- `apps/api/src/events/events.gateway.ts` — `handleConnection` joined `user:{userId}` Room nach Auth; neue Methode `emitPulseFeedUpdated(userId, tab)`
- `apps/api/src/app.module.ts` — RedisModule + PulseFeedModule registriert

**Neue Dependency:** `ioredis` (in `apps/api/package.json`)

**Entscheidung:** `ioredis` statt `redis`-npm — besseres TypeScript-Support, eingebaute Reconnect-Logik.

### Types Package

- `packages/types/src/events.ts` — `PulseFeedUpdatedEvent { userId, tab, ts }` hinzugefuegt

### Frontend

**Neue Dateien:**

| Datei | Beschreibung |
|-------|-------------|
| `apps/web/lib/pulse-api.ts` | API-Client, Types, `pulseKeys`, Formatter-Utilities |
| `apps/web/hooks/use-pulse-socket.ts` | `pulse:feed_updated` Listener; invalidiert feed+counts (matching tab) oder nur counts |
| `apps/web/components/pulse/DayNav.tsx` | Datum-Navigation; ISO-String-Vergleich statt lokaler Date-Objekte |
| `apps/web/components/pulse/TabBar.tsx` | 3 Tabs mit aria-roles, Badge-Counts (ausgeblendet bei 0) |
| `apps/web/components/pulse/InfoBanner.tsx` | Dismissible Banner, `localStorage`-Persistenz |
| `apps/web/components/pulse/FeedItem.tsx` | ScoreBar (5 Segmente), Dringend-Badge, Slide-Out via CSS-Transitions, Action-Dropdown |
| `apps/web/components/pulse/FeedList.tsx` | Virtualisierte Liste, `estimateSize: 96`, `overscan: 5`, "Mehr laden"-Button |
| `apps/web/app/(dashboard)/pulse/page.tsx` | Vollstaendige Seite, React Query `staleTime: 30_000`, optimistic `completingIds` |

**Geaendert:** `apps/web/components/layout/NavRail.tsx` — Bell-Button onClick → `router.push('/pulse')` (Tech-Debt #11 behoben)

**Bugfix im Branch:** `fix(session-6): DayNav timezone` — ISO-String-Vergleich ersetzt lokale `Date`-Objekte; behebt Mitternacht-UTC-Flaky-Test.

---

## Schema-Aenderungen

Keine Prisma-Schema-Aenderungen. Keine Migration.

---

## Neue Env-Variablen

Keine. `REDIS_URL` war bereits seit Session 0 dokumentiert; wird ab Session 6 aktiv genutzt.

---

## AC-Status

| AC | Beschreibung | Status |
|----|-------------|--------|
| AC1 | `GET /api/v1/pulse-feed` liefert score-sortierte Items | ✅ |
| AC2 | Priority-Score korrekt berechnet (Unit-Tests) | ✅ |
| AC3 | Redis-Cache 30s TTL, Pattern-Invalidierung | ✅ |
| AC4 | `PATCH /activity/:id/complete` → done + Cache + WS | ✅ |
| AC5 | WS-Event `pulse:feed_updated` per `user:{userId}` Room | ✅ |
| AC6 | Pulse-Seite mit DayNav, TabBar, FeedList (virtualisiert) | ✅ |
| AC7 | FeedItem mit ScoreBar, Dringend-Badge, Slide-Out | ✅ |
| AC8 | InfoBanner dismissible mit localStorage | ✅ |
| AC9 | Bell-Button NavRail → `/pulse` | ✅ |
| AC10 | Tests: 222 API (21 Dateien), 202 Web (30 Dateien) | ✅ |

---

## Test-Coverage (kumulativ nach Session 6)

| Paket | Tests | Dateien | Coverage |
|-------|-------|---------|----------|
| API | 222 | 21 | ~98% Lines |
| Web | 202 | 30 | ~87% Lines |

Neue Test-Dateien: `pulse-feed.service.spec.ts` (17), `pulse-feed.controller.spec.ts` (5), `pulse-api.test.ts` (4 describe), `use-pulse-socket.test.ts` (7), `DayNav.test.tsx` (4), `TabBar.test.tsx` (5), `InfoBanner.test.tsx` (4), `FeedItem.test.tsx` (9).

---

## Tech-Debt nach Session 6

| ID | Beschreibung | Ziel-Session |
|----|-------------|--------------|
| TD-S6-01 | `providers.tsx` kein `staleTime`-Default (von S5 verschoben) | Session 7 / eigener PR |
| TD-S6-02 | NavRail Bell-Badge nicht an `/pulse-feed/counts` angebunden | Session 7 |
| TD-S6-03 | FeedList ohne IntersectionObserver — Infinite-Scroll nur ueber Button | Session 16a |
| TD-S6-04 | RedisService ohne Circuit-Breaker — faellt auf null/void zurueck | Session 15 |

---

## Voraussetzungen fuer Session 7 (M7 Aktivitaeten)

- `PulseFeedService.invalidateForUser(userId)` public — aufrufbar aus ActivitiesService
- `EventsGateway.emitPulseFeedUpdated(userId, tab)` bereit
- `GET /api/v1/pulse-feed/counts` bereit fuer NavRail-Badge-Anbindung
- `user:{userId}` Room-Pattern etabliert fuer weitere WS-Events
