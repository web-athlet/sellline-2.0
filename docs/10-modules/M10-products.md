---
title: "M10 Produktkatalog"
tags: [module, m10,products,catalog,pricing]
status: planned
session: 9
related: []
last_updated: 2026-05-07
summary: "Produktkatalog mit Preisen, Steuern, Waehrungen, Deal-Zuweisung mit Menge und Rabatt, Rechnungs-Frequenz. AC-009."
---

# M10 Produktkatalog

## Was dieses Modul tut
Produktkatalog mit Preisen, Steuern, Waehrungen, Deal-Zuweisung mit Menge und Rabatt, Rechnungs-Frequenz. AC-009.

## Kritische Business-Regeln
- Soft-Delete: deletedAt IMMER in WHERE-Clause
- Input-Validation via Zod an allen API-Grenzen
- (weiteres aus Pflichtenheft v4 entnehmen)

## Datenmodell
Prisma-Models werden in Session 9 definiert.
Referenz: packages/db/prisma/schema.prisma nach Session 1.

## API-Endpoints
Werden in Session 9 implementiert.
Konvention: /api/v1/{resource} | JWT Auth | Zod-Validation | Paginierung

## Session: 9 | Modell: sonnet-4-6 | Thinking: think | Dauer: ~2.5h
