---
title: "M4 Projekte"
tags: [module, m4,projects,tasks]
status: planned
session: 10
related: []
last_updated: 2026-05-07
summary: "Projekt-Kanban mit Task-Verwaltung, Deal-Verknuepfung, Vorlagen-System, Fortschritts-Tracking."
---

# M4 Projekte

## Was dieses Modul tut
Projekt-Kanban mit Task-Verwaltung, Deal-Verknuepfung, Vorlagen-System, Fortschritts-Tracking.

## Kritische Business-Regeln
- Soft-Delete: deletedAt IMMER in WHERE-Clause
- Input-Validation via Zod an allen API-Grenzen
- (weiteres aus Pflichtenheft v4 entnehmen)

## Datenmodell
Prisma-Models werden in Session 10 definiert.
Referenz: packages/db/prisma/schema.prisma nach Session 1.

## API-Endpoints
Werden in Session 10 implementiert.
Konvention: /api/v1/{resource} | JWT Auth | Zod-Validation | Paginierung

## Session: 10 | Modell: sonnet-4-6 | Thinking: think | Dauer: ~2.5h
