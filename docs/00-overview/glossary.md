---
title: "Glossar — NextGen CRM"
tags: [glossary, definitions, reference]
status: active
last_updated: 2026-05-07
summary: "Alle Projektbegriffe definiert: CRM-Domain, Tech-Stack, Claude-Code-spezifische Begriffe."
---
# Glossar

| Begriff | Definition |
|---------|------------|
| CRM | Customer Relationship Management |
| Deal | Verkaufschance mit Wert, Kontakt, Wahrscheinlichkeit |
| Stage | Phase innerhalb einer Pipeline |
| Pipeline | Sequenz von Stages fuer den Verkaufsprozess |
| Rot-Indikator | Deal ohne Activity seit N Tagen — `rot_indicator: true` |
| Ghosting | Deal-Partner antwortet seit 14+ Tagen nicht mehr |
| Enrichment | Automatische Datenanreicherung via Serper + GPT-4o |
| Scoring | Regelbasierte 0-100-Bewertung eines Leads/Deals |
| opt_in | DSGVO-Einwilligung — Pflicht vor Campaign-Versand |
| Soft-Delete | `deletedAt` Timestamp — Daten nicht physisch geloescht |
| Hard-Delete | Physisches Loeschen nach 30 Tagen Soft-Delete |
| Audit-Log | Protokoll aller schreibenden API-Calls — 7 Jahre Retention |
| AuditLog-Interceptor | NestJS-Interceptor der automatisch loggt |
| Trust Boundary | Pipeline-Value-Berechnung MUSS server-seitig bleiben |
| Optimistic UI | UI-Update sofort, API-Call danach, Rollback bei Fehler |
| historyId | Gmail-Mechanismus fuer inkrementelle E-Mail-Sync |
| HMAC-Token | Kryptografisch signiertes Token (kein UUID) fuer Tracking |
| Double-Submit-Cookie | CSRF-Schutz-Pattern via csrf-csrf Package |
| DOMPurify | XSS-Schutz durch HTML-Sanitisierung |
| Second Brain | Das docs/-Verzeichnis — lebende Projektdokumentation |
| opusplan | Claude Code Alias: Opus 4.7 beim Planen, Sonnet 4.6 bei Ausfuehrung |
| ultrathink | Claude Code Keyword: maximales Thinking-Budget (~32k Tokens) |
| think hard | Claude Code Keyword: mittleres Thinking-Budget (~10k Tokens) |
| think harder | Claude Code Keyword: hohes Thinking-Budget (~20k Tokens) |
| ADR | Architectural Decision Record — dokumentierte Tech-Entscheidung |
| Quality-Gate | Automatisierte Checks vor jedem Merge (Lint, Tests, Audit) |
| DSGVO | Datenschutz-Grundverordnung (EU) |
| P0/P1/P2 | Prioritaeten: Pflicht / Soll / Kann |
| Fishery | Test-Data-Factory-Library fuer typsichere Testdaten |
| testcontainers | Library fuer echte Postgres-Instanz in Tests |
| pgvector | PostgreSQL-Extension fuer Vektor-Embeddings |
| BullMQ | Redis-basierte Job-Queue fuer KI-Worker |
| PodDisruptionBudget | K8s-Ressource: min. 2 Pods immer aktiv bei Updates |
