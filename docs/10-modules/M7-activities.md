---
title: "M7 Aktivitaeten"
tags: [module, m7,activities,calendar,dnd,conflict-detection]
status: planned
session: 7
related: []
last_updated: 2026-05-07
summary: "Activity-Kalender mit DnD, Konflikt-Erkennung (Doppelbuchung), polymorphe Verknuepfung Deal/Person/Org. AC-006."
---

# M7 Aktivitaeten

## Was dieses Modul tut
Activity-Kalender mit DnD, Konflikt-Erkennung (Doppelbuchung), polymorphe Verknuepfung Deal/Person/Org. AC-006.

## Kritische Business-Regeln
- Soft-Delete: deletedAt IMMER in WHERE-Clause
- Input-Validation via Zod an allen API-Grenzen
- (weiteres aus Pflichtenheft v4 entnehmen)

## Datenmodell
Prisma-Models werden in Session 7 definiert.
Referenz: packages/db/prisma/schema.prisma nach Session 1.

## API-Endpoints
Werden in Session 7 implementiert.
Konvention: /api/v1/{resource} | JWT Auth | Zod-Validation | Paginierung

## Session: 7 | Modell: sonnet-4-6 | Thinking: think-hard | Dauer: ~3h
