---
title: "M2 Leads und Webformulare"
tags: [module, m2,leads,webforms,enrichment]
status: planned
session: 8
related: []
last_updated: 2026-05-07
summary: "Embeddbare Webformulare, BullMQ Enrichment-Trigger, Lead-zu-Deal-Konvertierung. Form-Builder-Inputs per DOMPurify sanitisieren. AC-011,AC-016."
---

# M2 Leads und Webformulare

## Was dieses Modul tut
Embeddbare Webformulare, BullMQ Enrichment-Trigger, Lead-zu-Deal-Konvertierung. Form-Builder-Inputs per DOMPurify sanitisieren. AC-011,AC-016.

## Kritische Business-Regeln
- Soft-Delete: deletedAt IMMER in WHERE-Clause
- Input-Validation via Zod an allen API-Grenzen
- (weiteres aus Pflichtenheft v4 entnehmen)

## Datenmodell
Prisma-Models werden in Session 8 definiert.
Referenz: packages/db/prisma/schema.prisma nach Session 1.

## API-Endpoints
Werden in Session 8 implementiert.
Konvention: /api/v1/{resource} | JWT Auth | Zod-Validation | Paginierung

## Session: 8 | Modell: sonnet-4-6 | Thinking: think-hard | Dauer: ~3.5h
