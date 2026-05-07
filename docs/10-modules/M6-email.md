---
title: "M6 E-Mail-Sync"
tags: [module, m6,email,gmail,outlook,encryption,webhook]
status: planned
session: 11
related: []
last_updated: 2026-05-07
summary: "Gmail-historyId-Sync, Outlook-Graph, AES-256-GCM E-Mail-Verschluesselung, KI-Thread-Summary, Smart-Reply. AC-007,AC-018."
---

# M6 E-Mail-Sync

## Was dieses Modul tut
Gmail-historyId-Sync, Outlook-Graph, AES-256-GCM E-Mail-Verschluesselung, KI-Thread-Summary, Smart-Reply. AC-007,AC-018.

## Kritische Business-Regeln
- Soft-Delete: deletedAt IMMER in WHERE-Clause
- Input-Validation via Zod an allen API-Grenzen
- (weiteres aus Pflichtenheft v4 entnehmen)

## Datenmodell
Prisma-Models werden in Session 11 definiert.
Referenz: packages/db/prisma/schema.prisma nach Session 1.

## API-Endpoints
Werden in Session 11 implementiert.
Konvention: /api/v1/{resource} | JWT Auth | Zod-Validation | Paginierung

## Session: 11 | Modell: opus-4-7 | Thinking: ultrathink | Dauer: ~7h
