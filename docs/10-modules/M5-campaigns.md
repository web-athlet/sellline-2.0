---
title: "M5 E-Mail-Campaigns"
tags: [module, m5,campaigns,email-marketing,dsgvo,hmac]
status: planned
session: 12
related: []
last_updated: 2026-05-07
summary: "DSGVO-konformer Campaign-Versand, HMAC-Tracking-Tokens (kein UUID), Bounce-Handling, KI-Betreffzeilen via GPT-4o, opt_in-Pflicht-Check. AC-025,AC-029."
---

# M5 E-Mail-Campaigns

## Was dieses Modul tut
DSGVO-konformer Campaign-Versand, HMAC-Tracking-Tokens (kein UUID), Bounce-Handling, KI-Betreffzeilen via GPT-4o, opt_in-Pflicht-Check. AC-025,AC-029.

## Kritische Business-Regeln
- Soft-Delete: deletedAt IMMER in WHERE-Clause
- Input-Validation via Zod an allen API-Grenzen
- (weiteres aus Pflichtenheft v4 entnehmen)

## Datenmodell
Prisma-Models werden in Session 12 definiert.
Referenz: packages/db/prisma/schema.prisma nach Session 1.

## API-Endpoints
Werden in Session 12 implementiert.
Konvention: /api/v1/{resource} | JWT Auth | Zod-Validation | Paginierung

## Session: 12 | Modell: sonnet-4-6 | Thinking: think-hard | Dauer: ~4h
