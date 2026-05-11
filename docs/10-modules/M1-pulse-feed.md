---
title: "M1 Pulse-Feed"
tags: [module, m1, pulse-feed, websocket, redis, react-query]
status: implemented
session: 6
related: [M3-deals, M7-activities]
last_updated: 2026-05-12
summary: "Score-sortierter Daily-Feed (3 Tabs: followups/missed/opportunities), Redis-Cache 30s TTL, WS User-Room per user:{userId}, virtualisierte FeedList. Kein Schema-Change. Session 6."
---

# M1 Pulse-Feed

## Was dieses Modul tut

Score-sortierter Daily-Feed — zeigt dem Vertriebsmitarbeiter, was heute am dringendsten bearbeitet werden muss. Drei Tabs decken den Arbeitstag ab: offene Aufgaben (followups), verpasste Aktivitaeten (missed), vielversprechende Deals (opportunities). Redis-Cache 30s TTL, WS Real-Time-Invalidierung per User-Room.

→ Session-Summary: [docs/20-sessions/session-06-summary.md](../20-sessions/session-06-summary.md)

## API-Endpoints

| Method | Path | Beschreibung |
|--------|------|-------------|
| GET | `/api/v1/pulse-feed` | Feed-Items (`tab`, `date`, `page`) |
| GET | `/api/v1/pulse-feed/counts` | Badge-Counts pro Tab |
| PATCH | `/api/v1/pulse-feed/activity/:id/complete` | Aktivitaet abschliessen (204) |

## Priority-Score-Formel

```
score = min(dealValue / 10000 * 30, 30)
      + min(daysOverdue * 20, 30)
      + min(activitiesLast7d * 10, 30)
      + (stageIndex / totalStages) * 10
```

`score > 75` → `isUrgent = true` (Dringend-Badge)

## Kritische Business-Regeln

- Soft-Delete: `deletedAt: null` IMMER in WHERE-Clause
- Input-Validation via Zod (`QueryPulseFeedDto`)
- Redis-Cache-Key: `pulse:{userId}:{date}:{tab}:{page}`, TTL 30s
- Cache-Invalidierung via `delByPattern('pulse:{userId}:*')` nach `completeActivity`
- WS-Room: `user:{userId}` — Pattern fuer alle user-spezifischen Events

## Datenmodell

Kein eigenes Prisma-Model. Nutzt bestehende `Activity`- und `Deal`-Entities.

## WebSocket-Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `pulse:feed_updated` | `{ userId, tab, ts }` | nach completeActivity |

## Session: 6 | Modell: sonnet-4-6 | Thinking: think-hard | Dauer: ~3h
