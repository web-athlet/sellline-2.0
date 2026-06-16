---
title: "Deep Review Session 14 — KI-Agenten (Enrichment, Scoring, Ghosting)"
session: 14
type: deep
status: clean
date: 2026-06-16
blockers: 0
summary: "Deep Review Session 14: CLEAN (0 BLOCKER). 1 Medium Scoring-Korrektheit (Recency-Selbstreset), 1 Medium SSRF-Härtung Scraper, mehrere Low + DSGVO-Doku-Punkte → Session 15."
---

# Deep Review Session 14 — KI-Agenten

**Status:** ✅ CLEAN — **0 BLOCKER**

> Methodik: Review in frischer, isolierter Session (kein Builder-Kontext). **Jede Aussage
> gegen den realen Code verifiziert** (Datei:Zeile). Typecheck + AI-Unit-Tests lokal
> ausgeführt. Keine spekulativen Findings; nicht-verifizierbare Hypothesen wurden verworfen.

## Scope
- `git diff main..HEAD`: 45 Dateien, +2902 / −677 Zeilen.
- Kern: `apps/api/src/ai/**` (4 Services + 2 Processor + Helper), Migration
  `20260615120000_session14_ai_agents`, Schema (`Lead.score`, `Deal.ghostedAt`,
  `AIInsight.deletedAt`, HNSW-Index), `leads.module.ts` Retry-Policy, Vitest 1.6→3.2.

## Verifikations-Ergebnis (Quality-Gate)
- **Typecheck (`@nextgen/api`): PASS** (EXIT 0) — generierter Prisma-Client trägt die neuen Felder, Code kompiliert.
- **Unit-Tests AI (`vitest run src/ai`): PASS** — 8 Spec-Dateien, **52/52 grün**.
- DI verifiziert: `MailModule` ist `@Global()` → `CostService`-Injektion auflösbar; `ScheduleModule.forRoot()` in `app.module.ts:42` vorhanden → `@Cron` feuert.
- Soft-Delete-Disziplin verifiziert: **alle** Prisma-Queries der AI-Services filtern `deletedAt: null` (enrichment/scoring/ghosting/cost).
- Kein PII-in-Logs (email/name/phone) in den AI-Services verifiziert — geloggt werden nur `leadId`/`dealId`/Budget-Beträge.
- `$executeRawUnsafe` (`enrichment.service.ts:252`) ist **parametrisiert** (`$1::vector`, `$2`) → **keine SQL-Injection**.

---

## Security (OWASP)

| # | Kategorie | Severity | Datei | Problem | Vorschlag |
|---|-----------|----------|-------|---------|-----------|
| S1 | A10 SSRF | **Medium** | `enrichment/web-scraper.ts:50` + `:30` | Scraper holt `results[].link` (aus Serper) **und** `${origin}/robots.txt` ohne Allow-/Blocklist. Kein Schutz gegen private/loopback/link-local Ranges (z. B. `169.254.169.254` Metadaten). Praktische Ausnutzbarkeit gering (URLs stammen aus Google-Organic, nicht direkt aus User-Input), aber Defense-in-Depth fehlt. | In `fetchWithTimeout` Host auflösen und private/reserved IP-Ranges blocken; nur `http(s)` erlauben; keine Redirects auf interne Ziele. Session 15 (Security-Härtung). |
| S2 | A03 Injection | Info (kein Befund) | `enrichment.service.ts:252` | `$executeRawUnsafe` — **als sicher verifiziert**: Vektor + orgId als gebundene Parameter (`$1`/`$2`), Query-String statisch. | Keine Aktion. |
| S2b | A09 Logging | Info (kein Befund) | AI-Services | Kein PII in Logs verifiziert. | Beibehalten. |
| S3 | Cost-DoS | Low | `enrichment.service.ts:73-115` | Bei transientem OpenAI-Fehler wirft `enrich()` → BullMQ-Retry (3×). Jeder Retry wiederholt **Serper-Suche + Scrape** → unnötige Credits/Token. | Serper/Scrape-Ergebnis cachen oder OpenAI-Call separat retrien (idempotenter Teilschritt). Session 16a. |

## DSGVO

| # | Severity | Bereich | Problem | Vorschlag |
|---|----------|---------|---------|-----------|
| G1 | **Medium** | Drittland-Transfer (OpenAI, US) | Mission ist „EU-only", aber Enrichment sendet Scrape-Snippets **und** Embedding-Input an OpenAI (US-Sub-Prozessor). Scrape liest `$('body').text()` von „About/Team"-Seiten (`web-scraper.ts:43-48`) → kann **personenbezogene Daten Dritter** (Mitarbeiter-Namen/-Kontakte) enthalten, die an OpenAI gehen und in `Organization.enrichedJson`/Embedding persistiert werden. Pre-existing seit S11, in S14 **ausgeweitet**. Bereits als Tech-Debt #57 erfasst. | DPA + EU-Datenverarbeitungs-Addendum/Zero-Retention mit OpenAI; ROPA-Eintrag + Rechtsgrundlage (Art. 6 Abs. 1 f) dokumentieren; Prompt extrahiert bewusst nur Firmen-Felder (mitigierend). **Session 15** (DSGVO-Bewertung der KI-Datenflüsse). Kein BLOCKER (öffentliche Daten, keine besonderen Kategorien). |
| G2 | Low | Aufbewahrung / Löschkonzept | `AIInsight` hat jetzt `deletedAt` + `validUntil` (30 Tage) ✅. Aber `Organization.enrichmentEmbedding` und `Organization.enrichedJson` haben **keine TTL/Erasure-Verknüpfung**; bei Löschung des auslösenden Lead/Person werden enrichte Daten + Embedding nicht mitgeräumt (referenziert via JSON-`leadId`, kein FK). | Retention-Feld/Cleanup-Job für `enrichmentEmbedding`/`enrichedJson`; Erasure-Kaskade beim Person-/Lead-Delete. Session 15 (D2 Retention). |
| G3 | Low | Transparenz | Auto-Convert (`scoring.service.ts:138`) legt automatisiert `Person`+`Deal` an. Bei aktivem Flag entsteht automatisierte Verarbeitung personenbezogener Daten. | Hinweis/Logik dokumentieren; Flag default `false` (✅ bereits so). |

## Performance

| # | Severity | Problem | Vorschlag |
|---|----------|---------|-----------|
| P1 | Info (kein Befund) | Ghosting-Kandidaten-Query (`ghosting.service.ts:34`) nutzt nested `select` (activities/emails `take:1`) → **kein N+1** (Prisma batcht konstant viele Queries je Relation). | Keine Aktion. |
| P2 | Low | `cost.service.ts:65 monthlySpend()` lädt alle Enrichment-Insights des Monats und summiert `estCostUsd` in JS (JSON-Feld nicht SQL-aggregierbar). Bei hohem Volumen wachsende Payload. | Akzeptabel; ggf. dedizierte `cost`-Spalte für SQL-`SUM`. Session 16a. |
| P3 | Low | HNSW-Index in Migration als `CREATE INDEX` (nicht `CONCURRENTLY`) — sperrt `Organization` beim Prod-Build (analog Tech-Debt #17). | In Prod als separate `CONCURRENTLY`-Migration. Session 15. |
| P4 | Low | Embedding-Kosten nicht erfasst: `storeEmbedding` (`enrichment.service.ts:243`) ruft `text-embedding-3-small`, dessen Tokens fließen **nicht** in den `cost`-Record → Budget-Wächter **unterschätzt** Ausgaben (Embeddings günstig, aber Lücke). | Embedding-Tokens in `EnrichmentCost` aufnehmen. Session 16a. |

## Architektur / Korrektheit

| # | Severity | Problem | Vorschlag |
|---|----------|---------|-----------|
| A1 | **Medium** | **Recency-Signal entwertet.** `scoring.service.ts:68` berechnet `recencyDays` aus `lead.updatedAt`. Enrichment aktualisiert den Lead unmittelbar **vor** dem Scoring (`enrich()`→`lead.update(enrichedJson)`→`scoring.enqueue` mit 30 s Delay). Dadurch ist `updatedAt` zur Scoring-Zeit ≈ jetzt → `recencyDays ≈ 0` → **konstant +15** für jeden frisch enrichten Lead. Zusätzlich bumpt das Scoring selbst `updatedAt` (`@updatedAt`) → bei Re-Scoring self-reset. Recency diskriminiert faktisch nicht. | Eigenes Feld für „letzte echte Interaktion" (z. B. Lead-Submission-Zeit / letzte Activity / letzte empfangene Mail) statt `updatedAt`. Session 16a (Scoring-Tuning). |
| A2 | Low | `enrichment.types.ts`: `EnrichmentFields` hat **6** Felder, `ENRICHMENT_FIELD_KEYS` listet 6, `countFilledFields` zählt 6 — aber `confidence = count/7` (`enrichment.service.ts:120`). → Confidence ist auf **0.86 gedeckelt**, erreicht nie 1.0. Kommentar/AC sagen „7 von 7". Off-by-one. | Divisor auf 6 korrigieren **oder** 7. (informatives Feld) fehlendes Feld ergänzen. Cosmetic. |
| A3 | Low | `scoring.service.ts:136` Title-Fallback: `lead.companyName ?? \`${firstName} ${lastName}\`.trim() ?? 'Auto-Lead'` — der zweite `??` ist toter Code (`''.trim()` ist nicht nullish). Bei fehlendem Firmen-/Namensdaten entsteht **leerer** Deal-Titel statt `'Auto-Lead'`. | `|| 'Auto-Lead'` statt `?? 'Auto-Lead'`. |
| A4 | Low | `enqueue`-Debounce (`scoring.service.ts:33`): `queue.remove(jobId)` entfernt **keinen aktiven** Job; ein Re-Add mit gleicher `jobId` während aktiver Verarbeitung kann verworfen werden → seltenes verpasstes Re-Scoring. | Akzeptabler Edge-Case; ggf. `updatedAt`-Marker + erneutes Enqueue nach `completed`. |
| A5 | Low | Multi-Instance: `@Cron` (Ghosting 06:00, Budget 07:00) feuert auf **jeder** Instanz. Ghosting ist weitgehend idempotent (`ghostedAt`-Guard), aber Race zwischen `ensureFollowupTask`-`findFirst` und `create` könnte Duplikat-Follow-ups erzeugen; Budget-Pause/Resume könnte flattern. Single-Instance-Annahme aktuell ok. | Beim Scale-out Cron-Leader-Lock (z. B. Redis-Lock). Session 15/Scaling. |
| A6 | Low | `persistOrganization` (`:227`) upsert per `where:{domain}` ohne `deletedAt`-Bedingung — könnte eine **soft-deleted** Organization „wiederbeleben" (Update ohne `deletedAt`-Reset). Unique-Constraint auf `domain` erzwingt Treffer. | Upsert-Pfad explizit auf `deletedAt: null` prüfen / bei Treffer reaktivieren. Niedrig. |
| A7 | Info | Doppelte `BullModule.registerQueue('lead-enrichment')` in `leads.module.ts` (mit JobOptions) und `ai.module.ts` (ohne). Funktional ok (gleiche Redis-Queue; Producer-Seite trägt JobOptions). | Optional: JobOptions als Single-Source-of-Truth zentralisieren. |

## Test-Coverage
- 52 neue Unit-Tests (8 Specs), grün; Branches ~81 % laut Summary.
- **Lücke:** `enrichment.processor.ts:23 onFailed` (Dead-Letter-Verzweigung `attemptsMade >= attempts`) und `scoring.processor.ts` sind ungetestet (dünne Wrapper). → Low, Session 16a.
- `serper.client.ts` + `web-scraper.ts` aus Unit-Coverage ausgeschlossen (External-I/O), dokumentiert (#55); `web-scraper.spec.ts` deckt robots/Extraktion via Mock ab.

---

## Fazit

**0 BLOCKER — Merge nach Approval zulässig.**

Session 14 ist sauber implementiert: graceful degradation (partial-Enrichment), idempotentes
Ghosting, deterministisches Scoring, konsequente Soft-Delete-Filterung, parametrisiertes
Raw-SQL, kein PII-Logging. Typecheck + 52 Tests grün.

Die gewichtigsten Punkte sind **A1 (Recency-Signal faktisch konstant)** und **S1 (SSRF-Härtung
des Scrapers)** — beide **Medium, kein BLOCKER**. Die DSGVO-Punkte (G1/G2) sind Dokumentations-/
Härtungsaufgaben, die thematisch exakt in **Session 15 (Security & DSGVO-Härtung)** gehören und
dort bereits über Tech-Debt #57 / D2 vorgemerkt sind.

### Empfohlene Einplanung
- **Session 15:** S1 (SSRF), G1 (OpenAI-DPA/ROPA), G2 (Embedding-Retention/Erasure), P3 (CONCURRENTLY), A5 (Cron-Lock bei Scale-out), Migration anwenden (#53).
- **Session 16a:** A1 (Recency-Feld), P4 (Embedding-Kosten), A2/A3 (Korrekturen), Processor-Tests.

## Quality-Gate
- Lint: n/v (nicht erneut ausgeführt) | **Typecheck: PASS** | **Unit (AI): PASS (52/52)** | Integration: n/v
- npm audit / Snyk: nicht im Scope dieses Reviews (Audit-Threshold-Tech-Debt #2 offen bis Next-15-Migration).
