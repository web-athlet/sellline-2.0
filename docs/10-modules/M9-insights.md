---
title: "M9 Insights und Analytics"
tags: [module, m9,insights,analytics,dashboard,charts,recharts]
status: planned
session: 13
related: []
last_updated: 2026-05-07
summary: "Dashboard-Builder (react-grid-layout, keine Kollision via verticalCompact), 8 Standard-Reports, KI-Verlust-Analyse woechentlich per Cron. AC-020."
---

# M9 Insights und Analytics

## Was dieses Modul tut
Dashboard-Builder (react-grid-layout, keine Kollision via verticalCompact), 8 Standard-Reports, KI-Verlust-Analyse woechentlich per Cron. AC-020.

## Kritische Business-Regeln
- Soft-Delete: deletedAt IMMER in WHERE-Clause
- Input-Validation via Zod an allen API-Grenzen
- (weiteres aus Pflichtenheft v4 entnehmen)

## Datenmodell
Prisma-Models werden in Session 13 definiert.
Referenz: packages/db/prisma/schema.prisma nach Session 1.

## API-Endpoints
Werden in Session 13 implementiert.
Konvention: /api/v1/{resource} | JWT Auth | Zod-Validation | Paginierung

## Session: 13 | Modell: sonnet-4-6 | Thinking: think-hard | Dauer: ~3h
