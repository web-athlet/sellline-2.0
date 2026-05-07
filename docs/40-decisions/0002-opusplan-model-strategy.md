---
title: "0002 — opusplan Modell-Strategie"
status: accepted
date: 2026-04-15
tags: [adr, claude-code, cost-optimization, model-selection]
summary: "opusplan als Default: Opus 4.7 beim Planen, Sonnet 4.6 bei Ausfuehrung. Kritische Sessions auf reines Opus."
---
# ADR 0002 — Claude Code Modell-Strategie

## Context
18 Sessions, verschiedene Komplexitaetsstufen. Reines Opus 4.7 waere ~5x teurer
als Sonnet 4.6 ohne proportionalen Qualitaetsgewinn bei einfachen Sessions.

## Entscheidung
opusplan-Alias als Default. Kritische Sessions (0,1,5,11,14) auf claude-opus-4-7.

## Modell-Matrix
| Sessions | Modell | Thinking |
|----------|--------|----------|
| 0,1,5,11,14 | opus-4-7 | ultrathink |
| 2,15 | opus-4-7 | think-harder |
| 4,6,7,8,12,13,16a,16b | sonnet-4-6 | think-hard |
| 3,9,10 | sonnet-4-6 | think |

## Konsequenzen
Gesamt-Budget: ~$50-66 fuer 18 Sessions.
Qualitaetsverlust bei Sonnet-Sessions: minimal (einfachere Module).

## Status: Akzeptiert
