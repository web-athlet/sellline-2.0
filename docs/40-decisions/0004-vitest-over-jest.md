---
title: "0004 — Vitest statt Jest"
status: accepted
date: 2026-04-20
tags: [adr, testing, vitest, jest]
summary: "Vitest statt Jest: native ESM-Support, 2-5x schneller, bessere Turborepo-Integration."
---
# ADR 0004 — Vitest statt Jest

## Context
Pflichtenheft v3.0 spezifizierte Jest. Projekt nutzt ESM (Next.js 14, NestJS 10).

## Entscheidung
Vitest statt Jest.

## Begruendung
- Nativer ESM-Support ohne Babel-Transform-Overhead
- 2-5x schneller bei grossen Test-Suites
- Identische API (describe/it/expect) — kein Lernaufwand
- Bessere Turborepo-Integration (shared vitest.config.ts)
- vitest-mock-extended fuer Prisma-Mocking (vs jest-mock-extended)

## Konsequenzen
- Session 0: vitest als devDependency, vitest.config.ts aufsetzen
- Session 16a: Coverage mit @vitest/coverage-v8
- Playwright bleibt fuer E2E (kein Vitest-Playwright-Plugin noetig)

## Status: Akzeptiert
