---
title: "M1 Pulse-Feed"
tags: [module, m1,pulse-feed,websocket,realtime]
status: planned
session: 6
related: []
last_updated: 2026-05-07
summary: "Realtime Activity-Feed via Socket.io, KI-Sortierung (Score-Formel), Infinite Scroll, Redis-Cache 30s TTL. JWT im Handshake Pflicht. AC-010."
---

# M1 Pulse-Feed

## Was dieses Modul tut
Realtime Activity-Feed via Socket.io, KI-Sortierung (Score-Formel), Infinite Scroll, Redis-Cache 30s TTL. JWT im Handshake Pflicht. AC-010.

## Kritische Business-Regeln
- Soft-Delete: deletedAt IMMER in WHERE-Clause
- Input-Validation via Zod an allen API-Grenzen
- (weiteres aus Pflichtenheft v4 entnehmen)

## Datenmodell
Prisma-Models werden in Session 6 definiert.
Referenz: packages/db/prisma/schema.prisma nach Session 1.

## API-Endpoints
Werden in Session 6 implementiert.
Konvention: /api/v1/{resource} | JWT Auth | Zod-Validation | Paginierung

## Session: 6 | Modell: sonnet-4-6 | Thinking: think-hard | Dauer: ~3h
