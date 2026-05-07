---
title: "0003 — CSRF Double-Submit-Cookie Pattern"
status: accepted
date: 2026-04-20
tags: [adr, security, csrf, cookies]
summary: "csrf-csrf Package mit Double-Submit-Cookie fuer CSRF-Schutz. Gilt nur Non-GET ausser Bearer-Auth."
---
# ADR 0003 — CSRF-Schutz

## Context
Next.js + NestJS SPA braucht CSRF-Schutz fuer Session-basierte Requests.
Bearer-Token-basierte API-Calls sind inherent CSRF-sicher.

## Entscheidung
csrf-csrf Package (Double-Submit-Cookie-Pattern).
Cookie: `__Host-csrf`, Secure+SameSite=Strict+HttpOnly.

## Ausnahmen
- Bearer-Token-Requests (API-Clients): kein CSRF-Token noetig
- GET/HEAD/OPTIONS: nie CSRF-geschuetzt (per RFC)

## Konsequenzen
- Session 15: csrf-csrf in main.ts konfigurieren
- Frontend: CSRF-Token aus Cookie auslesen, in X-CSRF-Token Header setzen
- Tests: CSRF-Token in Integration-Tests mitmocken

## Status: Akzeptiert
