---
title: "Light Review Session 0 — Monorepo-Scaffolding + WebSocket-Echo"
session: 0
type: light
status: clean
date: 2026-05-08
blockers: 0
summary: "Light Review Session 0: CLEAN — 0 BLOCKER, 6 MINOR/INFO (alle non-blocking, geplante Tech-Debt)."
---

# Light Review Session 0 — Monorepo-Scaffolding + WebSocket-Echo

**Status:** ✅ CLEAN — PR-bereit

## Scope

- Commits: `ce394b1 feat(session-0): scaffold monorepo with websocket echo`, `a4a347a docs(session-0): update second brain`
- git diff `main..HEAD`: **77 Dateien** geändert (`+11833 / −18`); davon `pnpm-lock.yaml` (+10241).
- Effektiver Review-Surface (ohne Lock & Docs): ~30 Source-/Config-Files.
- Modul-Kontext: `docs/20-sessions/session-00-summary.md` (Selbstcheck 14/14).

## Findings

| # | Severity | Datei:Zeile | Problem | Vorschlag |
|---|----------|-------------|---------|-----------|
| 1 | MINOR | `apps/api/src/main.ts:7`, `apps/api/src/events/events.gateway.ts:4` | CORS-Origin liest `NEXT_PUBLIC_WEB_URL`, aber Variable fehlt in `.env.example` und CLAUDE.md-Env-Tabelle. Fallback auf `localhost:3000` versteckt das Problem in Dev; in Prod blockt CORS dann den echten Web-Origin. | `NEXT_PUBLIC_WEB_URL` zu `.env.example` und CLAUDE.md hinzufügen (oder konsequent `NEXT_PUBLIC_API_URL`-Logik invertieren). Kann mit Session 2 erledigt werden. |
| 2 | MINOR | `apps/api/src/main.ts:16` | `void bootstrap()` schluckt jede Promise-Rejection — Startup-Fehler (Port belegt, Module-Init-Fehler) werden ohne sichtbares Log terminiert. | `bootstrap().catch((err) => { console.error(err); process.exit(1); });` |
| 3 | MINOR | `.claude/.DS_Store`, `docs/.DS_Store` | Trotz `.gitignore`-Eintrag noch tracked (Erbe aus `08c27cc`). Root-`.DS_Store` ist in dieser Session korrekt entfernt; die zwei verbleibenden wurden übersehen. | `git rm --cached .claude/.DS_Store docs/.DS_Store` in einem Cleanup-Commit. |
| 4 | MINOR | `scripts/quality-gate.sh:53` | Secrets-Filter `grep -vE '(test\|spec\|mock)'` matcht **Zeileninhalt**, nicht Dateipfad. Eine echte Secret-Zeile, die zufällig das Wort „test" enthält (z. B. Kommentar), würde übersehen. | Auf Pfadfilter umstellen: `git diff --name-only main..HEAD \| grep -v -E '(test\|spec\|mock)' \| xargs -I{} git diff main..HEAD -- {}` o. ä. |
| 5 | INFO | `apps/api/src/events/events.gateway.ts:13` | `handlePing` validiert `PingPayload` nur per TS-Interface — kein Zod-Schema. CLAUDE.md fordert „Zod-Schema für ALLE User-Inputs an API-Grenzen". Bei malformed Payload (`data` undefined) wirft `data.msg` und Nest fängt's ab; kein DoS-Risiko, aber Konventionsverstoß. | Zod-Schema für `PingPayload` einführen, sobald der Gateway über Echo hinausgeht (spätestens Session 6/Pulse). |
| 6 | INFO | `apps/web/hooks/use-socket.ts:50–70` | `sendPing` korreliert Ping↔Pong nicht (kein Request-ID / kein `ts`-Match). Bei zwei parallelen Pings würden beide Promises mit dem ersten ankommenden Pong resolven. Für die Echo-Demo OK; bei Wiederverwendung in M-Modulen problematisch. | Optionale Korrelations-ID in `PingPayload`/`PongPayload` einführen, sobald Multi-Request-Szenarien entstehen. |

## Bewertung pro Review-Punkt

### 1. Offensichtliche Bugs
- Keine funktionalen Bugs gefunden. Echo-Pfad e2e verifiziert (Selbstcheck Session-Summary).
- Funde: #1 (CORS-Env), #3 (DS_Store), #6 (Race-Risiko) — alle non-blocking.

### 2. Error-Handling
- Frontend (`page.tsx:14–25`, `use-socket.ts:51–69`): saubere Fehlerpfade (Disconnect, Pong-Timeout, Form-Submit-Fail) inkl. UI-Feedback im Log.
- Backend (`main.ts:9–14`): Fund #2 — Bootstrap swallowed errors via `void`.
- Gateway (`events.gateway.ts:13`): kein explizites Validation-Layer; akzeptabel für Scaffolding (Fund #5).

### 3. Security-Basics
- WebSocket ohne Auth: bewusst auf Session 2 verschoben, TODO-Kommentar im Gateway vorhanden, in CLAUDE.md/Architektur dokumentiert. ✅
- `pnpm audit --audit-level=critical`: Tech-Debt sauber dokumentiert (Next-15-Migration → Session 15). ✅
- CORS mit `withCredentials: true` + spezifischer Origin (kein Wildcard). ✅
- Keine Secrets im Diff. `.env.example` enthält nur Dev-Defaults mit klarem `*-dev-only`-Suffix. ✅
- `.gitignore` deckt `.env`, `.env.local`, `.env.*.local`. ✅
- Findings: #4 (Secrets-Filter zu lax), #1 (Env-Doku-Lücke).

### 4. Tests
- API: 6 Specs, 100/100/100/100 (HealthController, EventsGateway). ✅
- Web: 7 Specs für `useSocket()` mit FakeSocket-Pattern + fake-timers für Pong-Timeout, 100/100/100/100. ✅
- Utils: 4 Specs (cn/sleep mit Branches), 100/100/100/100. ✅
- Integration: `smoke.test.ts` ist `expect(1+1).toBe(2)` — explizit als Quality-Gate-Vertrag dokumentiert, Replacement geplant für Session 1. ✅ (Erwartung)
- Coverage-Threshold 80 % pro Vitest-Config — angemessen.
- Lücke: `lib/socket.ts` von Coverage ausgeschlossen (intentional, da Socket.io-IO); Env-Var-Fallback (#1) somit nicht getestet — INFO, kein Blocker.

### 5. DSGVO
- Keine PII fließt in dieser Session (nur ephemere Ping/Pong-Strings).
- Pino-Logger ohne `redact`-Config — geplante Härtung, sobald Auth (Session 2) und Kontakte (Session 4) PII einbringen.
- EU-only-Hinweis im `docker-compose.yml`-Kommentar dokumentiert. ✅
- Kein Tracking/Analytics/Third-Party-Cookies in dieser Session.

## Quality-Gate (per Session-Summary)

| Check | Ergebnis |
|-------|----------|
| Lint (ESLint) | PASS |
| Typecheck (`tsc --noEmit`) | PASS |
| Format (Prettier) | PASS |
| Unit-Tests | PASS — 100 % Coverage api/web/utils |
| Integration | PASS — Smoke-Placeholder |
| `pnpm audit` (critical) | PASS — 0 critical Advisories |
| Build (api/web) | PASS |
| **Gesamt** | **10/10 PASS** |

## Architektur-/Konventions-Sanity

- Monorepo-Struktur entspricht CLAUDE.md (`apps/`, `packages/`, `docs/`, `.claude/`, `scripts/`).
- Branch-Name `feature/session-0-scaffolding` ✅ Konventions-konform.
- Commits `feat(session-0): …`, `docs(session-0): …` ✅ Conventional Commits + Husky/Commitlint enforced.
- `tsconfig.base.json`: `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch` aktiv. ✅
- ESLint: `@typescript-eslint/no-explicit-any: 'warn'` (CLAUDE.md fordert „kein `any` ohne `// eslint-disable`"). Ggf. später auf `error` heben — INFO, kein Blocker.

## Empfehlung

**✅ MERGE-READY.**

Die 6 MINOR/INFO-Funde sind alle non-blocking; #1–#4 lassen sich in einem 5-Minuten-Cleanup-Commit auf demselben Branch beheben (empfohlen vor Merge), #5 und #6 sind ohnehin für spätere Sessions geplant.

### Vor-Merge-Cleanup (optional, empfohlen)

1. `NEXT_PUBLIC_WEB_URL` zu `.env.example` und CLAUDE.md ergänzen.
2. `apps/api/src/main.ts:16` → `bootstrap().catch((err) => { console.error(err); process.exit(1); });`
3. `git rm --cached .claude/.DS_Store docs/.DS_Store`
4. Quality-Gate Secrets-Filter auf Pfad-basiert umstellen.

### Tracked als Tech-Debt (CLAUDE.md „Bekannte Offene Punkte")

- JWT-WS-Handshake → Session 2 ✅ schon getrackt
- Audit-Threshold `critical` → Session 15 ✅ schon getrackt
- `vitest.workspace.ts` entfernt → ✅ schon getrackt
- **NEU:** `.claude/.DS_Store` + `docs/.DS_Store` Cleanup (falls nicht im Vor-Merge erledigt)
- **NEU:** Pino-`redact`-Config für PII (vor Session 2 Auth)
- **NEU:** Zod-Schema für WS-Payloads (vor Session 6 Pulse-Feed)

---

**0 BLOCKER → kein `/review-deep` nötig.**
