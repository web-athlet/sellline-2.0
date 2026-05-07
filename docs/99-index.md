---
title: "Gesamt-Index aller Docs"
tags: [index, navigation, all-docs]
status: active
last_updated: 2026-05-07
summary: "Vollstaendiger Index aller Second-Brain-Dokumente."
---

# Gesamt-Index — NextGen CRM Second Brain

> Zuletzt aktualisiert: 2026-05-07 von @doc-keeper / update-index.sh
> Agents: Scanne diesen Index ZUERST um zu entscheiden was zu laden ist.

## Module (10-modules/)

| Datei | Status | Summary |
|---|---|---|
| M1-pulse-feed.md | planned | Realtime Activity-Feed via Socket.io, KI-Sortierung (Score-Formel), Infinite Scroll, Redis-Cache 30s TTL. JWT im Handshake Pflicht. AC-010. |
| M10-products.md | planned | Produktkatalog mit Preisen, Steuern, Waehrungen, Deal-Zuweisung mit Menge und Rabatt, Rechnungs-Frequenz. AC-009. |
| M2-leads.md | planned | Embeddbare Webformulare, BullMQ Enrichment-Trigger, Lead-zu-Deal-Konvertierung. Form-Builder-Inputs per DOMPurify sanitisieren. AC-011,AC-016. |
| M3-deals.md | planned | Kanban-Board mit @dnd-kit DnD, 6 Stages, Pipeline-Value server-seitig, Rot-Indikator, Ghosting-Flag. |
| M4-projects.md | planned | Projekt-Kanban mit Task-Verwaltung, Deal-Verknuepfung, Vorlagen-System, Fortschritts-Tracking. |
| M5-campaigns.md | planned | DSGVO-konformer Campaign-Versand, HMAC-Tracking-Tokens (kein UUID), Bounce-Handling, KI-Betreffzeilen via GPT-4o, opt_in-Pflicht-Check. AC-025,AC-029. |
| M6-email.md | planned | Gmail-historyId-Sync, Outlook-Graph, AES-256-GCM E-Mail-Verschluesselung, KI-Thread-Summary, Smart-Reply. AC-007,AC-018. |
| M7-activities.md | planned | Activity-Kalender mit DnD, Konflikt-Erkennung (Doppelbuchung), polymorphe Verknuepfung Deal/Person/Org. AC-006. |
| M8-contacts.md | planned | Personen und Firmen mit Soft-Delete, Duplikat-Erkennung via fast-fuzzy, Unique-Constraint (email, deletedAt). |
| M9-insights.md | planned | Dashboard-Builder (react-grid-layout, keine Kollision via verticalCompact), 8 Standard-Reports, KI-Verlust-Analyse woechentlich per Cron. AC-020. |

## Entscheidungen (ADRs) (40-decisions/)

| Datei | Status | Summary |
|---|---|---|
| 0001-pgvector-vs-pinecone.md | accepted | pgvector statt Pinecone: kein extra Service, DSGVO-konform, ausreichend bis 1M Vektoren. |
| 0002-opusplan-model-strategy.md | accepted | opusplan als Default: Opus 4.7 beim Planen, Sonnet 4.6 bei Ausfuehrung. Kritische Sessions auf reines Opus. |
| 0003-csrf-double-submit-cookie.md | accepted | csrf-csrf Package mit Double-Submit-Cookie fuer CSRF-Schutz. Gilt nur Non-GET ausser Bearer-Auth. |
| 0004-vitest-over-jest.md | accepted | Vitest statt Jest: native ESM-Support, 2-5x schneller, bessere Turborepo-Integration. |

## Runbooks (50-runbooks/)

| Datei | Summary |
|---|---|
| ai-budget-exceeded.md | Was tun wenn das monatliche AI-Budget (OpenAI/Serper) ueberschritten oder Queue automatisch pausiert wurde. |
| deploy-production.md | Schritt-fuer-Schritt Production-Deployment: CI grueen, Manual-Approval, K8s-Rollout, Health-Check. |
| rollback-procedure.md | Vollstaendige Rollback-Prozedur bei Production-Incident: K8s-Rollback, DB-Migration-Revert, Kommunikation. |

## KI-Prompts (60-prompts/)

| Datei | Summary |
|---|---|
| enrichment-system.md | System- und User-Prompt fuer den Enrichment-Worker (GPT-4o, JSON-Schema-Output). |
| scoring-formula.md | Regelbasierte Score-Berechnung 0-100. Kein LLM-Aufruf noetig. Trigger: Aktivitaet, Stage-Wechsel, E-Mail-Event. |
| thread-summary.md | GPT-4o-Prompt fuer Thread-Summary bei >5 E-Mails. Keine E-Mail-Bodies an OpenAI (DSGVO). |
