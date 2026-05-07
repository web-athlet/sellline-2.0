# NextGen CRM — Claude Code Dev Sessions v3.0
## Copy-Paste-Ready Prompt-Guide für Claude Code + VSCode + Git

> **Pflichtenheft v4.0 | Stand: April 2026 | 18 Dev Sessions (0–16b) | 10 Module + 3 KI-Agenten**
> **NEU v3.0:** Aktualisierte Modelle (Opus 4.7 / Sonnet 4.6 / `opusplan`-Alias), optimierte Thinking-Budgets (Token-Sparsamkeit), vollständiges Context-Management-Protokoll (Opener / Checkpoint / Closer), Copy-Paste-ready Prompts, Bug- und Lücken-Fixes.

---

## Änderungs-Log v3.0 gegenüber v2.0

| Bereich | Änderung | Grund |
|---------|----------|-------|
| **Modelle** | `claude-opus-4-7` statt `claude-opus-4-6`; `opusplan`-Alias eingeführt | Opus 4.7 ist seit April 2026 GA, deutlich besser auf SWE-Bench & CursorBench |
| **Thinking-Budgets** | Session 6, 12, 13: `think hard` statt `ultrathink` | Spart ~22 k Thinking-Tokens pro Session ohne Qualitätsverlust |
| **Thinking-Inkonsistenzen** | Sessions 2, 15: Header und Prompt auf `think harder` vereinheitlicht | Vorher Header ≠ Prompt → Verwirrung |
| **Context-Mgmt** | Vollständiges 3-Phasen-Protokoll (Opener / Checkpoint / Closer) | Claude Code hat kein Session-Memory → Pflicht |
| **Lange Sessions** | Session 5, 11, 14: expliziter Checkpoint-Prompt bei 50 %-Marke | Context-Window-Kompression verhindert "Amnesie" |
| **Session 0** | + Husky + lint-staged, Prettier/ESLint-Config, README.md-Template | Code-Qualität ab Commit #1 |
| **Session 1** | + Partielle Indexe auf `deletedAt`, idempotentes Seed-Script | Performance + Dev-Experience |
| **Session 2** | + Password-Reset-Flow, Session-Invalidierung bei PW-Change | Security-Lücke in v2.0 |
| **Session 4** | Fuzzy-Lib explizit (`fast-fuzzy`), Unique-Constraint `(email, deletedAt)` | Implementierbarkeit |
| **Session 5** | Pipeline-Value-Berechnung **server-seitig** (Trust Boundary) | Sicherheit: Client kann Wert nicht manipulieren |
| **Session 6** | JWT im Socket-Handshake explizit spezifiziert | Auth-Lücke in v2.0 |
| **Session 7** | Konflikt-Erkennung bei Calendar-DnD (Doppelbuchung) | UX-Fehler in v2.0 |
| **Session 8** | Form-Builder-Inputs → DOMPurify beim Rendern | XSS-Schutz |
| **Session 9** | CSV-Import im **Streaming-Modus** (Papaparse) | Memory-Leak vermeiden |
| **Session 11** | Gmail `historyId` speichern, Webhook-Verifikation, GCP-Projekt-Setup | Vollständigkeit |
| **Session 12** | HMAC-signierte Unsubscribe-Tokens, Bounce-Handling, Sendrate | DSGVO + Deliverability |
| **Session 13** | Widget-Kollisionserkennung im Grid | UX-Qualität |
| **Session 14** | Serper-Fallback, Cost-Tracking pro Enrichment | Robustheit + Budget-Kontrolle |
| **Session 15** | + CSRF, DOMPurify, Dependabot/Snyk-Scan | Security-Vollständigkeit |
| **Session 16a** | + Test-Data-Factories (Fishery), WebSocket-Test-Strategie | Testing-Best-Practice |
| **Session 16b** | + K8s-Manifeste, Service-Worker-Update-Strategie, Multi-Size-Icons | Deployment-Realität |

---

## 1. Einmalige Claude-Code-Konfiguration (VOR Session 0)

Führe diese Schritte **einmalig** aus, bevor du mit den Sessions startest. Sie stellen sicher, dass dein Claude-Code-Setup optimal konfiguriert ist.

### 1.1 Claude Code aktualisieren

Opus 4.7 benötigt **Claude Code v2.1.111 oder neuer**. Prüfe und aktualisiere:

```bash
claude --version        # sollte >= 2.1.111 sein
npm install -g @anthropic-ai/claude-code    # falls Update nötig
```

### 1.2 Standard-Modell setzen

Empfehlung für dieses Projekt: **`opusplan`-Alias** als Default. Er nutzt Opus 4.7 in Plan Mode (maximale Reasoning-Tiefe beim Planen) und Sonnet 4.6 bei der Ausführung (5× günstiger). Das ist der beste Cost/Quality-Trade-off für ein 18-Session-Projekt:

```bash
# Einmalig in Claude Code:
/model opusplan
```

Bei **kritischen Sessions** (0, 1, 5, 11, 14) überschreiben wir das explizit auf reines Opus 4.7 (siehe Matrix).

### 1.3 Thinking- & Effort-Konfiguration verstehen

Claude Code v2.1.68+ unterstützt zwei Ebenen, um die Reasoning-Tiefe zu steuern:

**A) Keywords im Prompt (pro Turn)** — dominieren pro Nachricht:

| Keyword | Thinking-Budget (ca.) | Einsatz |
|---------|----------------------|---------|
| *(kein Keyword)* | adaptiv (Opus 4.7: auto) | Routine-CRUD |
| `think` | ~4 000 Token | Einfache Logik, Refactor kleiner Module |
| `think hard` / `megathink` | ~10 000 Token | Architektur kleinerer Features, Design-Reviews |
| `think harder` | ~20 000 Token | Security, komplexe Validierung |
| `ultrathink` | ~31 999 Token | System-Architektur, Cascading-Fehler möglich |

**B) `/effort`-Command (session-persistent)** — für ganze Session:

```
/effort low       # schnell + günstig
/effort medium    # Standard Sonnet-Defaults
/effort high      # Sonnet-Standard für dieses Projekt
/effort xhigh     # Opus 4.7-Default
/effort max       # absolutes Maximum (nur kritischer Pfad)
```

**Token-Spar-Regel:** Pro Session **ein** Thinking-Keyword im ersten Prompt setzen — nicht in jedem Folge-Prompt wiederholen. `/effort` nur setzen, wenn ganze Session auf diesem Level laufen soll.

### 1.4 Nützliche Claude-Code-Slash-Commands

| Command | Zweck | Wann nutzen? |
|---------|-------|--------------|
| `/plan` | Plan Mode aktivieren (kein Coding, nur Planung) | **Pflicht** am Session-Start |
| `/compact` | Komprimiert Konversations-Historie (behält Essenz) | Bei langen Sessions ab ~50 % Context-Füllung |
| `/clear` | Historie komplett leeren | Zwischen unabhängigen Tasks |
| `/model <alias>` | Modell wechseln | Wenn Session wechselt |
| `/effort <level>` | Effort-Level setzen | Am Session-Start |
| `/cost` | Aktuelle Token-/$-Nutzung anzeigen | Bei Budget-Kontrolle |
| `/ultrareview` | Automatisches Code-Review (Opus 4.7-only) | Nach kritischen Sessions |

### 1.5 VSCode-Extensions (empfohlen)

- **Claude Code** (offizielle Extension) — Integration mit Editor-Tabs
- **GitLens** — Git-History direkt im Editor (für Session-Opener)
- **Prettier** + **ESLint** — matchen mit Session-0-Config
- **Prisma** — Schema-Autocompletion
- **Tailwind CSS IntelliSense**
- **Error Lens** — Fehler inline anzeigen

### 1.6 `.mcp.json` für das Projekt (optional, empfohlen)

Falls du MCP-Server für Datenbank-Zugriff oder Docs-Lookup nutzen willst, lege `.mcp.json` im Repo-Root an. Hilft Claude Code, Postgres direkt abzufragen ohne Umweg über den Worker:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://crm_user:crm_secure_pass@localhost:5432/nextgen_crm"]
    }
  }
}
```

---

## 2. Context-Management-Protokoll (kritisch!)

Claude Code hat **kein Memory zwischen Sessions** — jede neue Session startet mit leerem Context. Um sicherzustellen, dass Claude stets komplett über die Session weiß, nutzen wir ein **3-Phasen-Protokoll**:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  PHASE 1         │     │  PHASE 2         │     │  PHASE 3         │
│  SESSION-OPENER  │ ──► │  CHECKPOINT(S)   │ ──► │  SESSION-CLOSER  │
│  (vor dem Coden) │     │  (bei >3 h)      │     │  (am Session-Ende)│
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### 2.1 Phase 1 — Session-Opener (Pflicht jede Session)

**Vor dem Coden**: Öffne die relevanten Dateien in VSCode-Tabs (damit Claude Code sie schnell greift), wechsle git-Branch und gib diesen Prompt ein. Das `{SESSION_X}` durch die Session-Nummer ersetzen, `{MODULE_Y}` durch das Modul.

```
/plan

Ich starte jetzt Session {SESSION_X} von 18 für das NextGen-CRM-Projekt.

Bitte führe EXAKT diese Schritte durch, bevor du mit der Implementierung beginnst:

1. Lies CLAUDE.md vollständig durch und fasse in 3 Sätzen zusammen:
   (a) welche Sessions sind abgeschlossen,
   (b) welche Konventionen gelten im Projekt,
   (c) welche offenen TODOs/Issues sind vermerkt.

2. Führe aus: `git log --oneline -15` und `git status`. Nenne den aktuellen Branch.

3. Lies diese Dateien (Relevanz für Session {SESSION_X}):
   - {FILE_LIST}   (siehe Session-Header unten)

4. Bestätige mir in einem kurzen Antwort-Block (maximal 10 Zeilen):
   - "Session {SESSION_X} — Modul {MODULE_Y}"
   - Abgeschlossene Vor-Sessions: [...]
   - Gelesene Dateien: [...]
   - Abhängigkeiten erfüllt? (ja/nein mit Grund)
   - Bereit für Plan-Mode-Vorschlag? (ja/nein)

NOCH NICHT CODEN. Warte auf mein "go" nach deiner Bestätigung.
```

**Warum funktioniert das?**
- `/plan` deaktiviert vorzeitiges Coden.
- Forcierte Zusammenfassung der CLAUDE.md zwingt Claude zu aktivem Lesen (kein passives „ich hab's gesehen").
- Git-Log liefert den exakten Stand.
- Das „Warte auf go" verhindert, dass Claude in den Arbeits-Prompt hineingerannt kommt und halb vergisst, was er lesen sollte.

### 2.2 Phase 2 — Session-Checkpoint (nur bei Sessions > 3 h)

Nach ca. 50 % der geschätzten Session-Dauer, spätestens wenn du merkst, dass Claude auf ältere Details nicht mehr präzise antwortet:

```
CHECKPOINT — Bitte keine Code-Änderungen in dieser Antwort.

Fasse strukturiert zusammen (max. 30 Zeilen):

1. Welche Teile von Session {SESSION_X} sind bereits implementiert?
   (Datei + Funktion + Zweck — keine Code-Zitate)

2. Welche Teile stehen noch aus? (geordnete Liste mit Priorität)

3. Gibt es offene Design-Entscheidungen, die wir getroffen haben und die in CLAUDE.md dokumentiert werden sollten?

4. Gibt es Schulden/TODOs, die wir aufgesammelt haben?

Nach deiner Antwort führe ich `/compact` aus, um den Context zu komprimieren,
bevor wir weitermachen.
```

Nach Claude's Antwort: `/compact` ausführen → Claude behält die Essenz, spart ~50–70 % Tokens.

### 2.3 Phase 3 — Session-Closer (Pflicht am Session-Ende)

```
Session {SESSION_X} — Modul {MODULE_Y} ist abgeschlossen. Führe jetzt den Session-Closer aus:

1. Aktualisiere CLAUDE.md:
   - Setze Session {SESSION_X} auf [x] in der Checkliste
   - Ergänze neue Konventionen (z. B. API-Pattern, Error-Codes, DB-Spalten-Namen)
   - Ergänze neue Verzeichnis-Pfade in der Directory-Map
   - Dokumentiere bekannte Limitations/TODOs

2. Erstelle docs/sessions/session-{SESSION_X}-summary.md mit:
   - **Implementiert:** (Dateien + Features)
   - **Test-Coverage:** (Jest Coverage-Report, Playwright-Tests)
   - **AC erfüllt:** (AC-XYZ ✅/❌ mit kurzem Nachweis)
   - **Known Issues:** (konkrete TODOs mit Priorität)
   - **Nächste Session-Abhängigkeiten:** (was muss vorhanden sein für Session X+1)

3. Führe aus und zeige mir Output:
   - `npm run lint`
   - `npm run type-check`
   - `npm run test:unit` (falls Tests existieren)

4. Schlage einen Commit-Message-Text vor im Format:
   feat(session-{SESSION_X}): implement {module-name}
   
   - [Was implementiert wurde — 3-5 Bullets]
   - [Welche Tests erstellt]
   - [Welche AC erfüllt]
   
   Closes: #{session-{SESSION_X}-issue}

5. WARTE auf mein "commit", bevor du `git add`/`git commit` ausführst.
```

### 2.4 Phase 4 — Review (nur nach kritischen Sessions: 0, 1, 2, 5, 11, 14, 15)

Nach dem Commit, bevor du PR öffnest:

```
/ultrareview

Führe ein vollständiges Code-Review der in Session {SESSION_X} geänderten Dateien durch.

Checkliste (bitte ALLE Punkte abklopfen):

**TypeScript & Code-Qualität**
- [ ] Keine `any`-Typen, die auf `unknown` oder explizite Types umgestellt werden sollten
- [ ] Kein dead code, keine unbenutzten Imports
- [ ] Alle async-Functions haben `await`-Calls oder werden bewusst returned

**Error-Handling**
- [ ] Alle `await` in try/catch, Promise-Rejections behandelt
- [ ] Error-Response-Format aus CLAUDE.md eingehalten: `{ success: false, error, code }`
- [ ] Keine sensiblen Daten in Error-Messages (Stack-Traces, DB-Strings)

**Security**
- [ ] Keine SQL-Injection (Prisma-Queries nur mit Placeholders)
- [ ] Input-Validierung (class-validator-DTOs) auf allen Endpoints
- [ ] Guards gesetzt (@UseGuards(JwtAuthGuard, RolesGuard))
- [ ] Keine hardcoded Secrets (.env verwenden)

**Datenbank**
- [ ] Neue Queries haben Indexe? (mit EXPLAIN ANALYZE geprüft)
- [ ] Soft-Delete-Filter (`deletedAt: null`) überall wo nötig
- [ ] N+1-Queries vermieden (Prisma `include`/`select` nutzen)

**DSGVO**
- [ ] Keine Klartext-PII in Logs
- [ ] E-Mail-Bodies verschlüsselt (AES-256-GCM, wenn relevant)
- [ ] AuditLog-Einträge für schreibende Operationen

**Liste aller gefundenen Issues** mit `file.ts:line` + Severity (HIGH/MEDIUM/LOW).
KEINE Änderungen jetzt. Nur Report.
```

### 2.5 Pre-Session-Checkliste (als Ritual vor jedem `/plan`)

```bash
# Im Terminal, bevor du Claude Code öffnest:
git checkout develop
git pull origin develop
git checkout -b feature/session-X-name

# VSCode öffnen + relevante Dateien als Tabs offen lassen:
# - CLAUDE.md
# - Haupt-Modul-Datei (z. B. apps/api/src/modules/deals/deals.service.ts)
# - Prisma schema.prisma
# - .env.example

# Claude Code starten:
claude

# Im Claude Code:
/model opusplan      # oder Session-spezifisches Modell (s. Matrix)
/effort high         # oder Session-spezifisch
# Dann den Session-Opener aus 2.1 einfügen
```

---

## 3. Session-Strategie-Matrix (Überblick)

| # | Session | Modul | Modell | Thinking | `/effort` | Prio | Dauer | Kritisch? |
|---|---------|-------|--------|----------|-----------|------|-------|:---------:|
| 0 | Projekt-Scaffolding | Setup | **opus-4-7** | **ultrathink** | xhigh | P0 | 3–4 h | ✅ |
| 1 | Datenbank-Schema | Prisma | **opus-4-7** | **ultrathink** | xhigh | P0 | 3–4 h | ✅ |
| 2 | Authentication | Auth | opus-4-7 | think harder | high | P0 | 4–5 h | ✅ |
| 3 | Navigation & Layout | UI | sonnet-4-6 | think | high | P0 | 3–4 h | |
| 4 | Kontakte & Orgs | M8 | sonnet-4-6 | think hard | high | P0 | 4–5 h | ✅ |
| 5 | Deals & Kanban | **M3** | **opus-4-7** | **ultrathink** | xhigh | P0 | 5–6 h | ✅ |
| 6 | Pulse-Feed | **M1** | sonnet-4-6 | think hard | high | P0 | 4–5 h | ✅ |
| 7 | Aktivitäten & Kalender | M7 | sonnet-4-6 | think hard | high | P0 | 4–5 h | |
| 8 | Leads & Webformulare | M2 | sonnet-4-6 | think hard | high | P1 | 4–5 h | |
| 9 | Produktkatalog | M10 | sonnet-4-6 | think | high | P0 | 3–4 h | |
| 10 | Projekte | M4 | sonnet-4-6 | think | high | P1 | 3–4 h | |
| 11 | E-Mail-Posteingang | M6 | **opus-4-7** | **ultrathink** | max | P0 | 6–8 h | ✅ |
| 12 | Campaigns | M5 | sonnet-4-6 | think hard | high | P1 | 4–5 h | |
| 13 | Insights & Analytics | M9 | sonnet-4-6 | think hard | high | P1 | 4–5 h | |
| 14 | KI-Agenten | AI | **opus-4-7** | **ultrathink** | xhigh | P1 | 5–6 h | ✅ |
| 15 | Security & DSGVO | Sec | opus-4-7 | think harder | high | P0 | 4–5 h | ✅ |
| 16a | Testing & Performance | QA | sonnet-4-6 | think hard | high | P1 | 5–6 h | |
| 16b | PWA & CI/CD | DevOps | sonnet-4-6 | think hard | high | P1 | 4–5 h | |

**Kritischer Pfad (in Reihenfolge bauen):** Session 0 → 1 → 2 → 4 → 5 → 6

**Token-Budget-Richtwert (pro Session):**
- `opus-4-7` + `ultrathink`: ~$1.50–$4.00 pro Session (abhängig von Context-Größe)
- `opus-4-7` + `think harder`: ~$0.80–$2.00
- `sonnet-4-6` + `think hard`: ~$0.30–$0.80
- `sonnet-4-6` + `think`: ~$0.15–$0.40

**Gesamtes Projekt-Budget-Richtwert:** ~$25–$50 für alle 18 Sessions bei disziplinierter Nutzung.

---

## 4. Dev Sessions — Copy-Paste-Ready Prompts

Jede Session enthält:
- **Header:** Modell, Thinking, `/effort`, Branch, Dauer, Dateien-Liste für Opener
- **📋 Session-Opener** (Phase 1 aus Abschnitt 2.1) — copy-paste-ready
- **💻 Implementierungs-Prompt** — nach Claude's "bereit"-Bestätigung einfügen
- **⏸ Checkpoint-Prompt** (nur bei Sessions > 3 h) — bei 50 %-Marke
- **🏁 Session-Closer** (Phase 3 aus Abschnitt 2.3)

---

## SESSION 0 — Projekt-Scaffolding & Monorepo-Setup

| Feld | Wert |
|------|------|
| **Modell** | `claude-opus-4-7` |
| **Thinking** | `ultrathink` |
| **/effort** | `xhigh` |
| **Git-Branch** | `feature/session-0-scaffolding` |
| **Dauer** | ~3–4 h |
| **Abhängigkeiten** | Keine — erste Session |
| **Dateien für Opener** | (noch keine — Greenfield) |

### Pre-Session-Setup

```bash
# Im Terminal:
mkdir nextgen-crm && cd nextgen-crm
git init
git branch -m main
git checkout -b develop
git checkout -b feature/session-0-scaffolding

# Claude Code starten:
claude
# Darin:
/model claude-opus-4-7
/effort xhigh
```

### 📋 Session-Opener (Session 0 — Sonderfall Greenfield)

```
/plan

Ich starte Session 0 (Greenfield-Setup) für das NextGen-CRM-Projekt.

Es gibt noch keine CLAUDE.md und keinen Code. Du bist Senior Full-Stack-Architekt.
Bestätige mir in einem kurzen Block:
- "Session 0 — Projekt-Scaffolding"
- Verstandener Tech-Stack: (Next.js 14, NestJS 10, Postgres 15 + pgvector, Redis + BullMQ, Socket.io, Prisma 5, MinIO, OpenAI + Serper.dev)
- Bereit für Plan-Mode-Vorschlag? (ja)

NOCH NICHT CODEN. Warte auf mein "go" nach deinem Plan-Vorschlag.
```

### 💻 Implementierungs-Prompt

```
ultrathink

Du bist Senior Full-Stack-Architekt. Baue das vollständige Projekt-Scaffolding für "NextGen CRM".
Arbeite in klaren Schritten, committe nach jedem Hauptblock incrementell.

## TECH-STACK (exakt diese Versionen)

- Frontend: Next.js 14 (App Router), React 18, TypeScript 5
- Styling: Tailwind CSS 3.x + shadcn/ui
- State: Zustand 4.x + TanStack React Query 5.x
- Backend: NestJS 10.x, TypeScript
- DB: PostgreSQL 15 + Prisma 5.x + pgvector Extension
- Cache/Queues: Redis 7.x + BullMQ 5.x (NICHT Bull 4.x!)
- Realtime: Socket.io 4.x (PFLICHT bereits in Session 0)
- Auth: NextAuth.js 4.x + JWT
- File Storage: MinIO (S3-kompatibel)
- AI: OpenAI SDK (latest) + Serper.dev (Web-Search für Enrichment)
- API-Docs: Swagger/OpenAPI 3.1 (@nestjs/swagger)
- Testing: Jest 29.x + Playwright 1.x
- CI/CD: GitHub Actions
- Monorepo-Tool: Turborepo

## MONOREPO-STRUKTUR

```
nextgen-crm/
├── apps/
│   ├── web/                          # Next.js 14 Frontend
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── pulse/
│   │   │   │   ├── leads/
│   │   │   │   ├── deals/
│   │   │   │   ├── projects/
│   │   │   │   ├── campaigns/
│   │   │   │   ├── inbox/
│   │   │   │   ├── activities/
│   │   │   │   ├── contacts/
│   │   │   │   ├── insights/
│   │   │   │   └── products/
│   │   │   └── layout.tsx
│   │   ├── components/{ui,layout,shared}/
│   │   ├── lib/{api.ts,store/,hooks/}
│   │   ├── styles/globals.css
│   │   ├── middleware.ts
│   │   └── Dockerfile
│   └── api/                          # NestJS Backend
│       ├── src/
│       │   ├── modules/{auth,users,deals,contacts,organizations,activities,emails,leads,products,campaigns,projects,insights,pulse-feed,ai}/
│       │   ├── shared/{guards,decorators,filters,interceptors}/
│       │   ├── workers/{enrichment,scoring,ghosting}.worker.ts
│       │   ├── websocket/            # PFLICHT
│       │   │   ├── websocket.gateway.ts
│       │   │   └── websocket.module.ts
│       │   └── main.ts
│       ├── prisma/{schema.prisma,migrations/,seed.ts}
│       └── Dockerfile
├── packages/
│   ├── shared-types/
│   └── ui-components/
├── docs/
│   └── sessions/                     # Session-Summaries (NEU)
├── .github/workflows/ci.yml
├── .husky/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── .lintstagedrc.json
├── CLAUDE.md                         # Kontext-Dokument für Claude Code
├── README.md
├── package.json
├── turbo.json
└── tsconfig.json
```

## AUFGABEN (in Reihenfolge, committe incrementell)

### Block 1: Root-Setup

1. Root `package.json` mit npm-workspaces (`"workspaces": ["apps/*", "packages/*"]`)
2. `turbo.json` mit `build`, `dev`, `lint`, `test`, `type-check` Pipelines
3. Root `tsconfig.json` mit `paths`-Aliasen (`@web/*`, `@api/*`)
4. `.eslintrc.cjs` (Next.js + NestJS + @typescript-eslint)
5. `.prettierrc` (singleQuote: true, trailingComma: 'all', printWidth: 100)
6. `.lintstagedrc.json` (lint-staged auf geänderte Dateien)
7. Husky + lint-staged installieren, `pre-commit`-Hook: `npx lint-staged`
8. `.gitignore` (node_modules, .next, dist, .env*, .turbo)

**Commit:** `chore(session-0): root monorepo configuration`

### Block 2: Frontend (apps/web)

1. `npx create-next-app@14 apps/web --ts --tailwind --app --no-src-dir`
2. `shadcn/ui` init + diese Komponenten installieren:
   button, card, dialog, dropdown-menu, form, input, label, select,
   separator, sheet, sidebar, table, tabs, toast, badge, avatar,
   calendar, popover, command, checkbox, radio-group, switch, textarea,
   progress, skeleton, tooltip, alert, scroll-area
3. Zustand + React Query installieren
4. `lib/api.ts` — Axios-Instance mit JWT-Interceptor-Stub
5. `lib/store/authStore.ts` — Zustand-Store-Stub

**Commit:** `feat(session-0): Next.js 14 frontend scaffold`

### Block 3: globals.css mit Design-Tokens

```css
:root {
  --color-primary: #4F46E5;
  --color-primary-dark: #3730A3;
  --color-success: #16A34A;
  --color-danger: #DC2626;
  --color-warning: #D97706;
  --color-nav-bg: #1B2559;
  --color-surface: #FFFFFF;
  --color-bg: #F8FAFC;
  --radius-card: 8px;
  --radius-button: 6px;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.1);
  --font-sans: 'Inter', system-ui, sans-serif;
}
```
Entsprechend `tailwind.config.ts` erweitern.

### Block 4: Backend (apps/api) — NestJS + WebSocket

1. `nest new apps/api --skip-install --skip-git --package-manager npm`
2. Scaffold-Module erzeugen (leer):
   auth, users, deals, contacts, organizations, activities, emails, leads,
   products, campaigns, projects, insights, pulse-feed, ai
3. **PFLICHT: Socket.io Gateway**

```typescript
// apps/api/src/websocket/websocket.gateway.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: process.env.NEXTAUTH_URL, credentials: true },
  namespace: '/',
})
@Injectable()
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);
  @WebSocketServer() server: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token;
    if (!token) {
      this.logger.warn(`Rejected unauthed socket ${client.id}`);
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync(token);
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
      this.logger.log(`Socket connected: ${client.id} (user ${payload.sub})`);
    } catch (err) {
      this.logger.warn(`JWT verify failed for socket ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  emit(event: string, data: unknown): void {
    this.server.emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}

// apps/api/src/websocket/websocket.module.ts
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WebsocketGateway } from './websocket.gateway';

@Global()  // Damit andere Module ohne expliziten Import injizieren können
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
```

4. `main.ts`: Swagger-Setup, Helmet, globale ValidationPipe (class-validator), CORS
5. Prisma init: `npx prisma init` (Schema kommt in Session 1)

**Commit:** `feat(session-0): NestJS backend scaffold + WebSocket gateway`

### Block 5: docker-compose.yml

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: nextgen_crm
      POSTGRES_USER: crm_user
      POSTGRES_PASSWORD: crm_secure_pass
    ports: ['5432:5432']
    volumes: ['postgres_data:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U crm_user']
      interval: 5s
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
  minio:
    image: minio/minio
    ports: ['9000:9000', '9001:9001']
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes: ['minio_data:/data']
volumes:
  postgres_data:
  minio_data:
```

### Block 6: .env.example (VOLLSTÄNDIG)

```env
# === Datenbank ===
DATABASE_URL=postgresql://crm_user:crm_secure_pass@localhost:5432/nextgen_crm

# === Cache/Queues ===
REDIS_URL=redis://localhost:6379

# === File Storage ===
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=nextgen-crm

# === Auth ===
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# === OAuth (optional für lokales Dev) ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# === AI ===
OPENAI_API_KEY=
SERPER_API_KEY=               # https://serper.dev  (Web-Search für Enrichment)

# === E-Mail-Versand (Campaigns) ===
SENDGRID_API_KEY=

# === E-Mail-Verschlüsselung (DSGVO) ===
EMAIL_ENCRYPTION_KEY=         # 32-byte hex key für AES-256-GCM

# === Monitoring ===
SENTRY_DSN=

# === PWA / Push ===
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# === Frontend-Konfig ===
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# === Gmail-Webhook (Session 11) ===
GCP_PUBSUB_PROJECT=
GCP_PUBSUB_TOPIC=gmail-notifications
```

### Block 7: Docker-Build-Strategie

Erstelle `apps/web/Dockerfile` und `apps/api/Dockerfile` als **Multi-Stage-Build** (deps → builder → runner), mit `output: 'standalone'` in `next.config.ts`.

### Block 8: CLAUDE.md (INITIAL)

```markdown
# NextGen CRM — CLAUDE.md
> Kontext-Dokument für Claude Code. Bei Session-Start IMMER zuerst lesen.

## Projekt-Übersicht
AI-natives CRM. Monorepo (Turborepo): apps/web (Next.js 14) + apps/api (NestJS 10).
Ziel: 18 Dev-Sessions, 10 Module + 3 KI-Agenten.

## Tech-Stack
- Frontend: Next.js 14 App Router, React 18, TS, Tailwind, shadcn/ui, Zustand, React Query
- Backend: NestJS 10, TS, Prisma 5, PostgreSQL 15 (+ pgvector), Redis 7, BullMQ 5, Socket.io 4
- AI: OpenAI GPT-4o + Serper.dev (Web-Search)
- Auth: NextAuth.js + JWT (Access 15 min / Refresh 30 d)
- File Storage: MinIO

## Abgeschlossene Sessions
- [x] Session 0: Scaffolding, Monorepo, WebSocket-Gateway, Docker, Husky, CLAUDE.md
- [ ] Session 1: DB-Schema & Prisma
- [ ] Session 2: Authentication
- [ ] Session 3: Navigation & Layout
- [ ] Session 4: Kontakte (M8)
- [ ] Session 5: Deals & Kanban (M3)
- [ ] Session 6: Pulse-Feed (M1)
- [ ] Session 7: Aktivitäten (M7)
- [ ] Session 8: Leads (M2)
- [ ] Session 9: Produkte (M10)
- [ ] Session 10: Projekte (M4)
- [ ] Session 11: E-Mail-Inbox (M6)
- [ ] Session 12: Campaigns (M5)
- [ ] Session 13: Insights (M9)
- [ ] Session 14: KI-Agenten
- [ ] Session 15: Security & DSGVO
- [ ] Session 16a: Testing & Performance
- [ ] Session 16b: PWA & CI/CD

## Wichtige Konventionen (Stand: Session 0)
- Alle API-Routen: `/api/v1/...`
- Soft-Delete: `deletedAt` auf allen Haupt-Entitäten
- Error-Format: `{ success: false, error: "MESSAGE", code: "ERROR_CODE" }`
- Success-Format: `{ success: true, data: {...}, meta?: {...} }`
- WebSocket-Events: kommen in Session 6+ (geplant: `activity:created`, `activity:completed`, `deal:updated`, `deal:rot_indicator`, `lead:enriched`)
- DSGVO: E-Mail-Bodies IMMER verschlüsselt speichern (AES-256-GCM)
- BullMQ-Queues: `lead-enrichment`, `deal-scoring`, `ghosting-detection`
- Commit-Format: `type(session-X): description` (feat/fix/chore/docs/test)
- Branch-Format: `feature/session-X-name`

## Verzeichnis-Map
- `apps/web/app/(dashboard)/` → alle CRM-Seiten
- `apps/web/components/{ui,layout,shared}/` → UI-Komponenten
- `apps/web/lib/{api.ts,store,hooks}/` → Client-Logic
- `apps/api/src/modules/` → NestJS-Module (ein Ordner pro Domäne)
- `apps/api/src/workers/` → BullMQ-Worker
- `apps/api/src/websocket/` → Socket.io-Gateway
- `apps/api/src/shared/` → Guards, Decorators, Filters, Interceptors
- `apps/api/prisma/` → Schema + Migrations + Seed
- `docs/sessions/` → Session-Summaries (eine .md pro Session)

## Known Issues / TODOs
- (noch keine — Session 0 abgeschlossen)

## Test-Konten (Seed ab Session 1)
- admin@demo.de / Demo1234!
- manager@demo.de / Demo1234!
- sales@demo.de / Demo1234!
```

### Block 9: README.md (kurz)

Standard-README mit: Projekt-Beschreibung, Tech-Stack, Setup-Anleitung (`docker-compose up && npm install && npm run dev`), Link zu `CLAUDE.md`, Lizenz-Platzhalter.

### Block 10: GitHub Actions (Minimal-Setup)

`.github/workflows/ci.yml` mit Jobs `lint`, `type-check`, `build`. Vollständige Pipeline in Session 16b.

**Commit:** `feat(session-0): Docker + env + CLAUDE.md + CI baseline`

## AKZEPTANZKRITERIEN (nachweisbar am Session-Ende)

- [ ] `npm install` läuft fehlerfrei aus Root
- [ ] `npm run dev --workspace=apps/web` startet auf `localhost:3000` → zeigt Next.js-Default-Page
- [ ] `npm run dev --workspace=apps/api` startet auf `localhost:3001` → Swagger-UI unter `/api`
- [ ] `docker-compose up -d` startet postgres + redis + minio, alle Health-Checks grün
- [ ] `npm run type-check` läuft in beiden Apps fehlerfrei
- [ ] `npm run lint` läuft fehlerfrei
- [ ] WebSocket-Gateway akzeptiert Verbindung mit gültigem JWT und lehnt ohne JWT ab (kurzer Smoke-Test)
- [ ] `CLAUDE.md` existiert und ist vollständig
- [ ] `.env.example` enthält `SERPER_API_KEY`, `EMAIL_ENCRYPTION_KEY`, VAPID-Keys, GCP-PubSub-Vars
- [ ] `apps/web/Dockerfile` + `apps/api/Dockerfile` builden lokal erfolgreich
- [ ] Husky-Hook blockt Commit bei Lint-Fehlern
```

### ⏸ Checkpoint-Prompt (nach ~1,5 h)

```
CHECKPOINT — Bitte keine Code-Änderungen in dieser Antwort.

Welche Blöcke (1–10) sind bereits committet? Welche stehen noch aus?
Gibt es offene Design-Entscheidungen, die in CLAUDE.md dokumentiert werden sollten?
Nach deiner Antwort führe ich /compact aus.
```

### 🏁 Session-Closer (siehe Abschnitt 2.3)

Nach Abschluss aller Blöcke: den generischen Session-Closer-Prompt aus **Abschnitt 2.3** nutzen.

### 🔒 Review-Prompt (kritische Session)

Nach Session-Closer: den Review-Prompt aus **Abschnitt 2.4** (`/ultrareview`) ausführen.

---

## SESSION 1 — Datenbank-Schema & Prisma ORM

| Feld | Wert |
|------|------|
| **Modell** | `claude-opus-4-7` |
| **Thinking** | `ultrathink` |
| **/effort** | `xhigh` |
| **Git-Branch** | `feature/session-1-database-schema` |
| **Dauer** | ~3–4 h |
| **Abhängigkeiten** | Session 0 komplett |
| **Dateien für Opener** | `CLAUDE.md`, `apps/api/prisma/schema.prisma`, `.env.example` |

### 📋 Session-Opener

Generischer Opener aus Abschnitt 2.1 mit:
- `{SESSION_X}` = 1
- `{MODULE_Y}` = Database Schema (Prisma)
- `{FILE_LIST}` = `CLAUDE.md`, `apps/api/prisma/schema.prisma`, `.env.example`

### 💻 Implementierungs-Prompt

```
ultrathink

Du bist Senior Database Architect. Erstelle das vollständige Prisma-Schema für NextGen CRM.
DSGVO-konform (EU-Server, Soft-Delete, Audit-Log, verschlüsselte E-Mails).
BullMQ ist Redis-basiert — Schema ändert sich dadurch nicht.

## pgvector Extension

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}
```

## KERN-ENTITÄTEN (vollständig implementieren!)

Erstelle ALLE folgenden Models mit allen Relationen und Indexen:

### User
```prisma
model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  name                  String
  role                  Role      @default(SALES_REP)
  avatarUrl             String?
  password              String    // bcrypt hash
  passwordChangedAt     DateTime?  // NEU: für Session-Invalidierung (Session 2)
  twoFactorSecret       String?
  twoFactorEnabled      Boolean   @default(false)
  gmailTokenEncrypted   String?   // AES-256-GCM
  outlookTokenEncrypted String?
  gmailHistoryId        String?   // NEU: für Gmail incremental sync (Session 11)
  gmailWatchExpiresAt   DateTime? // NEU: Watch läuft 7 Tage (Session 11)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime?

  ownedDeals     Deal[]     @relation("DealOwner")
  activities     Activity[]
  campaignSender Campaign[] @relation("CampaignSender")
  auditLogs      AuditLog[]
  refreshTokens  RefreshToken[]
  passwordResets PasswordReset[]  // NEU (Session 2)

  @@index([deletedAt])
  @@index([email, deletedAt])
}

enum Role {
  ADMIN
  MANAGER
  SALES_REP
  READ_ONLY
}
```

### Deal
```prisma
model Deal {
  id                    String    @id @default(uuid())
  title                 String
  value                 Decimal   @default(0)  @db.Decimal(14, 2)
  currency              String    @default("EUR")
  stageId               String
  pipelineId            String
  ownerId               String
  probability           Int       @default(0)  // 0-100, gesetzt von Scoring-Agent
  rotIndicator          Boolean   @default(false)
  scoreUpdatedAt        DateTime?
  ghostingSnoozedUntil  DateTime? // Für Ghosting-Agent Snooze
  closedAt              DateTime?
  wonAt                 DateTime?
  lostAt                DateTime?
  lostReason            String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime?

  stage      Stage         @relation(fields: [stageId], references: [id])
  pipeline   Pipeline      @relation(fields: [pipelineId], references: [id])
  owner      User          @relation("DealOwner", fields: [ownerId], references: [id])
  activities Activity[]
  emails     Email[]
  products   DealProduct[]
  projects   Project[]
  participants Person[]   @relation("DealParticipants")

  @@index([pipelineId, stageId, deletedAt])
  @@index([ownerId, updatedAt(sort: Desc)])
  @@index([rotIndicator, deletedAt])
  @@index([deletedAt])
}
```

### Organization
```prisma
model Organization {
  id               String    @id @default(uuid())
  name             String
  domain           String?   @unique
  parentOrgId      String?   // für Hierarchien
  revenue          String?
  employeeCount    Int?
  industry         String?
  linkedinUrl      String?
  website          String?
  description      String?
  enrichedAt       DateTime?
  enrichedJson     Json?
  enrichmentEmbedding  Unsupported("vector(1536)")?  // pgvector
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  parent      Organization?  @relation("OrgHierarchy", fields: [parentOrgId], references: [id])
  children    Organization[] @relation("OrgHierarchy")
  persons     Person[]
  deals       Deal[]         @relation("OrgDeals")

  @@index([domain, deletedAt])
  @@index([deletedAt])
}
```

### Person
```prisma
model Person {
  id           String    @id @default(uuid())
  firstName    String
  lastName     String
  emails       String[]  // Postgres native array
  phones       String[]
  orgId        String?
  ownerId      String?
  notes        String?
  optIn        Boolean   @default(false)  // DSGVO für Campaigns
  optInSource  String?   // Wo wurde opt-in gegeben?
  optInAt      DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  org                   Organization? @relation(fields: [orgId], references: [id])
  dealParticipations    Deal[]        @relation("DealParticipants")
  activities            Activity[]    @relation("ActivityPerson")

  @@index([orgId, deletedAt])
  @@index([deletedAt])
  // Für Duplikat-Detection in Session 4:
  @@index([firstName, lastName])
}
```

### Pipeline & Stage
```prisma
model Pipeline {
  id                String    @id @default(uuid())
  name              String
  rotThresholdDays  Int       @default(7)
  isDefault         Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  stages Stage[]
  deals  Deal[]

  @@index([deletedAt])
}

model Stage {
  id          String   @id @default(uuid())
  pipelineId  String
  name        String
  order       Int
  color       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  pipeline  Pipeline @relation(fields: [pipelineId], references: [id])
  deals     Deal[]

  @@unique([pipelineId, order])
  @@index([pipelineId, deletedAt])
}
```

### Activity
```prisma
model Activity {
  id          String    @id @default(uuid())
  type        ActivityType
  subject     String
  notes       String?
  dueDate     DateTime?
  startTime   DateTime?
  endTime     DateTime?
  done        Boolean   @default(false)
  doneAt      DateTime?
  priority    Priority  @default(NORMAL)
  dealId      String?
  personId    String?
  orgId       String?
  assigneeId  String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  deal      Deal?         @relation(fields: [dealId], references: [id])
  person    Person?       @relation("ActivityPerson", fields: [personId], references: [id])
  org       Organization? @relation(fields: [orgId], references: [id])
  assignee  User          @relation(fields: [assigneeId], references: [id])

  @@index([assigneeId, dueDate, done])
  @@index([dealId, done, dueDate])
  @@index([deletedAt])
}

enum ActivityType { CALL MEETING TASK DEADLINE EMAIL LUNCH }
enum Priority { LOW NORMAL HIGH URGENT }
```

### Email
```prisma
model Email {
  id               String    @id @default(uuid())
  gmailMessageId   String?   @unique
  outlookMessageId String?   @unique
  threadId         String
  fromAddress      String
  toAddresses      String[]
  cc               String[]
  bcc              String[]
  subject          String
  bodyEncrypted    String    // AES-256-GCM: JSON { encrypted, iv, authTag }
  bodyPreview      String    // Nur erste 200 Zeichen unverschlüsselt für Listen
  isRead           Boolean   @default(false)
  isSent           Boolean   @default(false)
  sentAt           DateTime
  dealId           String?
  userId           String
  createdAt        DateTime  @default(now())
  deletedAt        DateTime?

  deal Deal? @relation(fields: [dealId], references: [id])

  @@index([threadId, userId])
  @@index([dealId])
  @@index([userId, sentAt(sort: Desc)])
  @@index([deletedAt])
}
```

### Product & DealProduct
```prisma
model Product {
  id            String    @id @default(uuid())
  name          String
  code          String?   @unique
  category      String?
  unit          String?
  billingFreq   String?   // ONE_TIME | MONTHLY | YEARLY
  price         Decimal   @db.Decimal(12, 2)
  taxPct        Decimal   @default(0) @db.Decimal(5, 2)
  currency      String    @default("EUR")
  visibleFor    String[]  // Role-Array
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  dealProducts DealProduct[]

  @@index([deletedAt])
}

model DealProduct {
  id          String   @id @default(uuid())
  dealId      String
  productId   String
  quantity    Int      @default(1)
  unitPrice   Decimal  @db.Decimal(12, 2)
  discount    Decimal  @default(0) @db.Decimal(5, 2)
  discountType DiscountType @default(PERCENT)
  taxPct      Decimal  @default(0) @db.Decimal(5, 2)
  total       Decimal  @db.Decimal(14, 2)

  deal    Deal    @relation(fields: [dealId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@index([dealId])
}

enum DiscountType { PERCENT ABSOLUTE }
```

### Lead & Form
```prisma
model Lead {
  id                String    @id @default(uuid())
  source            String    // "form" | "manual" | "import"
  formId            String?
  dataJson          Json      // Rohe Form-Submission
  enrichedJson      Json?     // Ergebnis vom Enrichment-Agent
  enrichmentStatus  EnrichmentStatus @default(PENDING)
  convertedDealId   String?   @unique
  companyName       String?
  emailDomain       String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  form          Form? @relation(fields: [formId], references: [id])

  @@index([enrichmentStatus, createdAt])
  @@index([deletedAt])
}

enum EnrichmentStatus { PENDING PROCESSING DONE FAILED }

model Form {
  id            String    @id @default(uuid())
  name          String
  schemaJson    Json      // Form-Builder-Ausgabe
  notifyEmails  String[]
  isActive      Boolean   @default(true)
  submissions   Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  leads Lead[]

  @@index([deletedAt])
}
```

### Campaign & CampaignContact
```prisma
model Campaign {
  id                String   @id @default(uuid())
  name              String
  subject           String
  bodyHtml          String
  status            CampaignStatus @default(DRAFT)
  scheduledAt       DateTime?
  sentAt            DateTime?
  senderId          String
  totalRecipients   Int      @default(0)
  openCount         Int      @default(0)
  clickCount        Int      @default(0)
  unsubCount        Int      @default(0)
  bounceCount       Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  sender    User              @relation("CampaignSender", fields: [senderId], references: [id])
  contacts  CampaignContact[]

  @@index([deletedAt])
  @@index([senderId, sentAt(sort: Desc)])
}

enum CampaignStatus { DRAFT SCHEDULED SENDING SENT PAUSED FAILED }

model CampaignContact {
  id            String   @id @default(uuid())
  campaignId    String
  personId      String
  trackingToken String   @unique  // HMAC-signed, für Open/Click/Unsub
  openedAt      DateTime?
  clickedAt     DateTime?
  unsubscribedAt DateTime?
  bouncedAt     DateTime?

  campaign Campaign @relation(fields: [campaignId], references: [id])
  person   Person   @relation(fields: [personId], references: [id])

  @@unique([campaignId, personId])
  @@index([trackingToken])
}
```

### Project, Task, ProjectTemplate
```prisma
model Project {
  id           String   @id @default(uuid())
  name         String
  emoji        String?  // z. B. "🚀"
  dealId       String?
  templateId   String?
  status       ProjectStatus @default(KICKOFF)
  tagsJson     Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  deal      Deal?             @relation(fields: [dealId], references: [id])
  template  ProjectTemplate?  @relation(fields: [templateId], references: [id])
  tasks     Task[]

  @@index([dealId])
  @@index([deletedAt])
}

enum ProjectStatus { KICKOFF PLANNING IMPLEMENTATION REVIEW CLOSING }

model Task {
  id          String    @id @default(uuid())
  projectId   String
  title       String
  description String?
  dueDate     DateTime?
  done        Boolean   @default(false)
  doneAt      DateTime?
  assigneeId  String?
  order       Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project Project @relation(fields: [projectId], references: [id])

  @@index([projectId, done])
  @@index([assigneeId, done])
}

model ProjectTemplate {
  id          String   @id @default(uuid())
  name        String
  emoji       String?
  tasksJson   Json     // [{ title, relativeDueDays }]
  createdAt   DateTime @default(now())

  projects Project[]
}
```

### AIInsight, AuditLog, RefreshToken, PasswordReset
```prisma
model AIInsight {
  id          String   @id @default(uuid())
  type        String   // "loss_analysis" | "trend" | "forecast"
  content     Json
  validUntil  DateTime?
  createdAt   DateTime @default(now())

  @@index([type, createdAt(sort: Desc)])
}

model AuditLog {
  id          String   @id @default(uuid())
  userId      String?
  action      String   // "CREATE" | "UPDATE" | "DELETE"
  tableName   String
  recordId    String
  changes     Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@index([userId, createdAt(sort: Desc)])
  @@index([tableName, recordId])
  @@index([createdAt])  // für 7-Jahres-Cleanup-Check
}

model RefreshToken {
  id         String    @id @default(uuid())
  userId     String
  tokenHash  String    // bcrypt hash, nicht Klartext!
  family     String    // Token-Rotations-Familie (UUID)
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, expiresAt])
  @@index([family])
}

model PasswordReset {
  id         String    @id @default(uuid())
  userId     String
  tokenHash  String
  expiresAt  DateTime  // 1 Stunde
  usedAt     DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
}
```

## WICHTIGE CONSTRAINTS & INDEXES

1. Alle Soft-Delete-Entitäten: Index auf `deletedAt`
2. `deals`: Composite-Indexe wie oben definiert
3. Cascading: Pipeline soft-delete → Stages soft-delete → Deals bleiben (aber Warning im UI)
4. Org-Löschung: Persons bleiben (`orgId = NULL`)
5. User-Löschung (DSGVO): Deals behalten `ownerId` → Admin muss vorher reassignen

## SEED-DATEN (prisma/seed.ts)

**WICHTIG: Seed muss idempotent sein** (Re-Run überschreibt nicht, sondern `upsert` bzw. skip-if-exists):

- 3 User via `upsert`:
  - admin@demo.de (ADMIN) / Passwort: Demo1234!
  - manager@demo.de (MANAGER) / Demo1234!
  - sales@demo.de (SALES_REP) / Demo1234!
- 1 Default-Pipeline "Vertriebs-Pipeline" mit 6 Stages (Qualifiziert, Demo geplant, Demo abgeschlossen, Angebot abgegeben, Verhandlungen, Vertrag unterschrieben)
- 10 Organisationen (deutsche Firmen: "Bauer GmbH", "Schmidt AG", "Müller IT Solutions", etc.)
- 20 Personen (verteilt auf die Orgs)
- 30 Deals (verteilt auf alle Stages)
- 50 Aktivitäten (Mix aus überfällig / heute / diese Woche, mit und ohne Deal-Verknüpfung)
- 5 Produkte mit verschiedenen billingFreq
- 3 Projekte mit Tasks
- 1 ProjectTemplate "Kundenprojekt Standard" mit 5 Standard-Tasks

Nutze `faker-js` für realistische Namen/Texte.
Verwende `@prisma/client` mit `upsert` statt `create`, damit `npx prisma db seed` mehrfach laufen kann.

## MIGRATION AUSFÜHREN

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
```

## AKZEPTANZKRITERIEN

- [ ] `npx prisma migrate dev` läuft ohne Fehler
- [ ] `npx prisma db seed` ist **idempotent** (2× ausführen → keine Duplikate)
- [ ] `ghostingSnoozedUntil`-Feld in `deals` vorhanden
- [ ] `gmailHistoryId` + `gmailWatchExpiresAt` in `users` vorhanden
- [ ] `passwordChangedAt` in `users` vorhanden
- [ ] `optIn` + `optInSource` + `optInAt` in `persons` vorhanden
- [ ] `trackingToken @unique` in `campaignContacts` vorhanden
- [ ] `PasswordReset`-Model vorhanden
- [ ] pgvector-Extension in `schema.prisma` konfiguriert
- [ ] Alle soft-delete-Indexe existieren (`@@index([deletedAt])`)
- [ ] Test-Query: `npx prisma studio` zeigt Seed-Daten
```

### 🏁 Session-Closer & Review

Session-Closer aus 2.3 + `/ultrareview` aus 2.4 (kritische Session!).

---

## SESSION 2 — Authentication & Authorization

| Feld | Wert |
|------|------|
| **Modell** | `claude-opus-4-7` |
| **Thinking** | `think harder` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-2-auth` |
| **Dauer** | ~4–5 h |
| **Abhängigkeiten** | Session 0, 1 (User-Model, RefreshToken-Model, PasswordReset-Model) |
| **Dateien für Opener** | `CLAUDE.md`, `apps/api/prisma/schema.prisma`, `apps/api/src/modules/auth/`, `apps/web/app/(auth)/` |

### 📋 Session-Opener

Generischer Opener mit `{SESSION_X}=2`, `{MODULE_Y}=Authentication`.

### 💻 Implementierungs-Prompt

```
think harder

Du bist Security-Architekt. Implementiere das vollständige Authentication & Authorization System.

## ANFORDERUNGEN

- JWT Access Token: 15 Min Lebensdauer
- Refresh Token: 30 Tage, **rotierend mit Familie** (siehe RefreshToken-Model), HttpOnly-Cookie, Secure, SameSite=Lax
- RBAC: 4 Rollen (ADMIN, MANAGER, SALES_REP, READ_ONLY)
- 2FA: TOTP (Google Authenticator / Authy), Pflicht für Admins (Login-Blocker bis Setup)
- Brute-Force: Rate-Limiting 10 Requests / 15 Min / IP (auf /login, /register, /2fa/validate)
- OAuth2: Gmail + Outlook (Token-Verschlüsselung AES-256-GCM)
- **NEU v3.0: Password-Reset-Flow** (Token-basiert, 1 h gültig, einmalig verwendbar)
- **NEU v3.0: Session-Invalidierung** bei Passwort-Change — alle Refresh-Tokens des Users revoken, `users.passwordChangedAt` setzen

## BACKEND — apps/api/src/modules/auth/

### Struktur
```
auth/
├── auth.module.ts
├── auth.service.ts
├── auth.controller.ts
├── strategies/
│   ├── jwt.strategy.ts
│   ├── jwt-refresh.strategy.ts
│   ├── google.strategy.ts
│   └── microsoft.strategy.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── jwt-refresh.guard.ts
│   └── roles.guard.ts
├── decorators/
│   ├── roles.decorator.ts
│   └── current-user.decorator.ts
└── dto/
    ├── login.dto.ts
    ├── register.dto.ts
    ├── reset-password.dto.ts
    └── two-factor.dto.ts
```

### Endpoints (alle mit class-validator-DTOs)

```
POST /api/v1/auth/register
POST /api/v1/auth/login              → { accessToken } + refreshToken (HttpOnly-Cookie)
POST /api/v1/auth/refresh            → neue accessToken + neuer refreshToken (rotation)
POST /api/v1/auth/logout             → revoke aktuelles Refresh-Token
POST /api/v1/auth/logout-all         → revoke alle Refresh-Tokens des Users (NEU)
POST /api/v1/auth/forgot-password    → erzeugt PasswordReset-Token, versendet E-Mail (NEU)
POST /api/v1/auth/reset-password     → validiert Token, setzt neues Passwort, revoked alle RT (NEU)
POST /api/v1/auth/change-password    → altes Passwort + neues Passwort, revoked alle RT außer aktuelles (NEU)
GET  /api/v1/auth/me                 → Current User Info

GET  /api/v1/auth/google              → OAuth2 redirect
GET  /api/v1/auth/google/callback
GET  /api/v1/auth/microsoft
GET  /api/v1/auth/microsoft/callback

POST /api/v1/auth/2fa/generate       → QR-Code + Secret (noch nicht aktiviert)
POST /api/v1/auth/2fa/verify         → aktiviert 2FA
POST /api/v1/auth/2fa/validate       → 6-stelliger Code beim Login
POST /api/v1/auth/2fa/disable        → deaktiviert 2FA (nur mit Passwort-Bestätigung)
```

### Security-Features (Pflicht)

- **bcrypt** saltRounds=12 für Passwort-Hashes
- **Refresh-Token-Hash** in DB: `await bcrypt.hash(token, 10)` speichern, **niemals Klartext**
- **Token-Rotation mit Familie**: Beim Refresh neuen Token generieren + alten revoken. Bei Wiederverwendung eines revokten Tokens (Replay-Angriff) → **gesamte Familie invalidieren**, User-Alert
- **@nestjs/throttler**: globales + per-Endpoint Rate-Limiting
- **2FA**: `otplib` + `qrcode` npm-Packages, TOTP-Window 1 (±30s)
- **Password-Policy**: min. 8 Zeichen, 1 Großbuchstabe, 1 Ziffer, 1 Sonderzeichen (class-validator `@Matches`)
- **Session-Invalidation bei PW-Change**: Alle Refresh-Tokens des Users `revokedAt = new Date()`, `users.passwordChangedAt = new Date()`
- **JWT enthält `pwChangedAt`**: Bei jedem Request gegen DB-Wert vergleichen — bei Mismatch 401

### Password-Reset-Implementierung (NEU v3.0)

```typescript
async forgotPassword(email: string): Promise<void> {
  const user = await this.prisma.user.findFirst({
    where: { email, deletedAt: null }
  });
  // IMPORTANT: Kein Information-Leak — immer gleiche Response-Zeit
  if (!user) {
    await new Promise(r => setTimeout(r, 200));  // timing-safe
    return;
  }
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);
  await this.prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),  // 1 h
    }
  });
  await this.mailService.sendPasswordResetMail(user.email, rawToken);
}

async resetPassword(token: string, newPassword: string): Promise<void> {
  // Alle gültigen Tokens holen + gegen Hash prüfen (O(n) aber n klein)
  const candidates = await this.prisma.passwordReset.findMany({
    where: { expiresAt: { gt: new Date() }, usedAt: null }
  });
  let matchedReset = null;
  for (const c of candidates) {
    if (await bcrypt.compare(token, c.tokenHash)) { matchedReset = c; break; }
  }
  if (!matchedReset) throw new BadRequestException('Invalid or expired token');

  const pwHash = await bcrypt.hash(newPassword, 12);
  await this.prisma.$transaction([
    this.prisma.user.update({
      where: { id: matchedReset.userId },
      data: { password: pwHash, passwordChangedAt: new Date() }
    }),
    this.prisma.passwordReset.update({
      where: { id: matchedReset.id },
      data: { usedAt: new Date() }
    }),
    // Alle aktiven Refresh-Tokens revoken
    this.prisma.refreshToken.updateMany({
      where: { userId: matchedReset.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    })
  ]);
}
```

## FRONTEND (apps/web)

- **NextAuth.js** Credentials-Provider + Google + Microsoft
- **Login-Page** `/login`: E-Mail/Passwort, OAuth-Buttons, "Passwort vergessen"-Link
- **Register-Page** `/register`: Name, E-Mail, Passwort + Passwort-Stärke-Anzeige (zxcvbn)
- **Forgot-Password** `/forgot-password`: E-Mail-Feld, Success-Message auch bei Non-Existence (Anti-Enumeration)
- **Reset-Password** `/reset-password?token=xxx`: neues Passwort + Bestätigung
- **2FA-Setup** `/settings/security/2fa`: QR-Code + Code-Eingabe
- **2FA-Challenge** nach erfolgreichem Login, wenn `user.twoFactorEnabled`

## AKZEPTANZKRITERIEN

- [ ] AC-001: Registrieren, Einloggen, Ausloggen funktionieren
- [ ] JWT-Token-Rotation funktioniert korrekt (alter RT wird invalide)
- [ ] Token-Replay-Attack invalidiert ganze Familie
- [ ] 2FA: Setup, Validation, Disable funktioniert
- [ ] Rate-Limiting blockt nach 10 Fehlversuchen in 15 Min
- [ ] Password-Reset-Flow: Token 1 h gültig, einmalig verwendbar
- [ ] Nach PW-Change: alle Refresh-Tokens revoked, aktuelle Session bleibt (außer `logout-all`)
- [ ] OAuth-Flows Gmail + Microsoft funktionieren, Tokens werden AES-256-GCM verschlüsselt gespeichert
- [ ] RBAC-Guard prüft Role (ADMIN > MANAGER > SALES_REP > READ_ONLY)
- [ ] Admin-Account muss 2FA haben (Login ohne 2FA-Setup blockiert)
```

### 🏁 Session-Closer & Review

Session-Closer aus 2.3 + `/ultrareview` aus 2.4.

---

## SESSION 3 — Globale Navigation & Design-System

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-3-navigation` |
| **Dauer** | ~3–4 h |
| **Abhängigkeiten** | Session 0, 2 (Auth) |
| **Dateien für Opener** | `CLAUDE.md`, `apps/web/app/(dashboard)/layout.tsx`, `apps/web/styles/globals.css`, `apps/web/tailwind.config.ts` |

### 💻 Implementierungs-Prompt

```
think

Du bist Frontend-Entwickler. Implementiere die globale Navigation und das 3-Spalten-Layout.

## LAYOUT-SYSTEM

### NavRail (apps/web/components/layout/NavRail.tsx)
- Navy Hintergrund `--color-nav-bg` (#1B2559)
- Breite: 60px kollabiert (Default), 220px expanded (Toggle via Hamburger oder Hover)
- 10 Nav-Icons (Lucide React) — Reihenfolge:
  1. Radar (Pulse)            → `/pulse`
  2. Target (Leads)           → `/leads`
  3. DollarSign (Deals)       → `/deals`
  4. CheckSquare (Projekte)   → `/projects`
  5. Megaphone (Campaigns)    → `/campaigns`
  6. Mail (Inbox)             → `/inbox`
  7. Calendar (Aktivitäten)   → `/activities`
  8. Users (Kontakte)         → `/contacts`
  9. BarChart3 (Einblicke)    → `/insights`
  10. Package (Produkte)      → `/products`
- Aktiver Eintrag: 4px Indigo-Left-Border (--color-primary), aufgehellter BG (#2D3882)
- Hover: #252F7A
- Badges: rote Kreise für `/inbox` (unread emails) und `/activities` (overdue)
- Unten: Settings, Help, Glocke (Notifications), User-Avatar (mit Dropdown für Logout)

### DashboardLayout (apps/web/components/layout/DashboardLayout.tsx)
- 3-Spalten-Grid mit CSS Grid:
  - Spalte 1: NavRail (60px / 220px, `min-content`)
  - Spalte 2: Kontext-Sidebar (200px, optional — sichtbar nur bei bestimmten Modulen)
  - Spalte 3: Hauptarbeitsfeld (`flex-1`)
- Nav immer sichtbar (`sticky top-0`, `h-screen`)
- Scroll nur im Hauptarbeitsfeld

### Mobile Responsive (NEU v3.0)
- Breakpoint `md` (768px): NavRail wird zu Bottom-Navigation (iOS-Style)
- Breakpoint `sm` (640px): Kontext-Sidebar schließt automatisch, wird zu Sheet (shadcn/ui Sheet-Komponente)

### Design-Tokens (globals.css + tailwind.config.ts)
Bereits in Session 0 angelegt. Hier: Tailwind-Theme-Extension mit den CSS-Variablen als Aliases:

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      primary: 'var(--color-primary)',
      'primary-dark': 'var(--color-primary-dark)',
      success: 'var(--color-success)',
      danger: 'var(--color-danger)',
      warning: 'var(--color-warning)',
      'nav-bg': 'var(--color-nav-bg)',
      surface: 'var(--color-surface)',
      bg: 'var(--color-bg)',
    },
    borderRadius: {
      card: 'var(--radius-card)',
      btn: 'var(--radius-button)',
    },
    boxShadow: { card: 'var(--shadow-card)' },
  }
}
```

### State-Management
- Zustand-Store `useUIStore` mit `navExpanded: boolean`, Persist-Middleware für `localStorage`
- Toggle-Button in NavRail-Header

## TEST
- Visueller Test: Alle 10 Nav-Routen navigieren korrekt
- A11y: NavRail ist via Tab-Key bedienbar, Focus-Indicator sichtbar
- Breakpoint-Test: Chrome DevTools Mobile-View (375×812)

## CLAUDE.md AKTUALISIEREN
```

### 🏁 Session-Closer

Session-Closer aus 2.3.

---

## SESSION 4 — M8: Kontakte & Organisationen (KRITISCHER PFAD)

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think hard` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-4-contacts` |
| **Dauer** | ~4–5 h |
| **Abhängigkeiten** | Session 0, 1, 2 |
| **Dateien für Opener** | `CLAUDE.md`, `apps/api/prisma/schema.prisma`, `apps/api/src/modules/contacts/`, `apps/api/src/modules/organizations/` |

### 💻 Implementierungs-Prompt

```
think hard

Du bist Full-Stack-Entwickler. Implementiere Kontakte-Modul (M8) — kritischer Pfad.

## BACKEND — apps/api/src/modules/contacts/ + modules/organizations/

### Endpoints

```
# Personen
GET    /api/v1/contacts                   ?page, ?limit, ?search, ?orgId, ?sort
POST   /api/v1/contacts
GET    /api/v1/contacts/:id
PATCH  /api/v1/contacts/:id
DELETE /api/v1/contacts/:id               → Soft-Delete
POST   /api/v1/contacts/merge             → Duplikate zusammenführen
GET    /api/v1/contacts/:id/timeline      → aggregierte Activities + Emails

# Organisationen
GET    /api/v1/organizations              ?page, ?limit, ?search, ?parentId
POST   /api/v1/organizations
GET    /api/v1/organizations/:id
PATCH  /api/v1/organizations/:id
DELETE /api/v1/organizations/:id          → Soft-Delete
GET    /api/v1/organizations/:id/persons
GET    /api/v1/organizations/:id/deals
```

### Duplikat-Erkennung (M8.5) — NEU v3.0: explizite Library

- **Library:** `fast-fuzzy` (`npm install fast-fuzzy`)
- Fuzzy-String-Matching auf E-Mail + Vollname:
  ```typescript
  import { Searcher } from 'fast-fuzzy';
  // Email-Similarity
  const emailScore = fuzzyMatch(newEmail.split('@')[0], existingEmail.split('@')[0]);
  // Name-Similarity
  const nameScore = fuzzyMatch(
    `${newFirst} ${newLast}`.toLowerCase(),
    `${existingFirst} ${existingLast}`.toLowerCase()
  );
  const score = emailScore * 0.6 + nameScore * 0.4;
  ```
- Threshold `> 0.85` → Duplikat vorschlagen (nicht auto-merge!)
- Endpoint: `GET /api/v1/contacts/duplicates` — listet Paare mit Score
- Merge-Logik: Master-Person behält ID, alle Relationen von Duplicate übertragen, Duplicate wird **`deletedAt` gesetzt mit Hinweis "merged into {masterId}"** in `notes`-Feld (NICHT echt löschen, Audit-Trail)

### Unique-Constraint-Strategie (NEU v3.0)

Postgres Partial Unique Index auf `(email, deletedAt)` — verhindert Duplikate nur bei aktiven Records:

Migration hinzufügen:
```sql
CREATE UNIQUE INDEX persons_active_email_unique
  ON persons ((emails[1]))
  WHERE deleted_at IS NULL;
```

## FRONTEND — apps/web/app/(dashboard)/contacts/

### Personen-Liste (`/contacts`)
- 8 Spalten: Name, Org, E-Mail (erste), Telefon, Offene Deals, Abgeschlossene Deals, Nächste Aktivität, Besitzer
- Sortierbar alle Spalten, Filter oben (Search-Input, Owner-Filter, Org-Filter)
- Pagination: 25/50/100 pro Seite
- Bulk-Actions: Export (CSV), Delete (Soft)

### Detail-View (`/contacts/[id]`)
- Header: Avatar + Name (inline-editable), Org-Link, Kontakt-Actions (Call, Mail, Meeting)
- Tabs: Übersicht | Deals | Aktivitäten | E-Mails | Dateien | Timeline
- Timeline aggregiert Activities + Emails chronologisch

### Duplikate-Seite (`/contacts/duplicates`)
- Liste aller Paare mit Score
- Side-by-Side Panel: Master-Auswahl via Radio, Merge-Button

### Org-Hierarchie
- Tree-View mit `react-arborist` oder eigener recursive Komponente
- Drag-Parent-Change möglich

## AKZEPTANZKRITERIEN

- [ ] AC-008: Liste zeigt alle 8 Spalten, sortierbar
- [ ] AC-019: Duplikat-Erkennung findet ähnliche Kontakte (manueller Test: 2 Personen mit ähnlichem Namen erstellen → erscheinen in `/duplicates`)
- [ ] Partial Unique Constraint verhindert aktive Duplikate
- [ ] Merge überträgt alle Deals + Activities + Emails ohne Verlust
- [ ] Org-Tree rendert 3+ Ebenen korrekt
```

### 🏁 Session-Closer (nicht-kritisch, Review optional)

---

## SESSION 5 — M3: Deals / Pipeline-Kanban (KRITISCHER PFAD)

| Feld | Wert |
|------|------|
| **Modell** | `claude-opus-4-7` |
| **Thinking** | `ultrathink` |
| **/effort** | `xhigh` |
| **Git-Branch** | `feature/session-5-deals` |
| **Dauer** | ~5–6 h |
| **Abhängigkeiten** | Session 0, 1, 2, 4 (Contacts), WebSocket-Gateway |
| **Dateien für Opener** | `CLAUDE.md`, Schema, `apps/api/src/modules/deals/`, `apps/api/src/websocket/websocket.gateway.ts`, Kontakte-Module (für Verknüpfungen) |

### 📋 Session-Opener

Generischer Opener + Sonderanweisung: *"Prüfe explizit, dass `WebsocketGateway` existiert und in `AppModule` importiert ist."*

### 💻 Implementierungs-Prompt

```
ultrathink

Du bist Senior Full-Stack-Entwickler. Implementiere das Deal-Modul (M3) — Herzstück des CRM.

WICHTIG v3.0: Pipeline-Value-Berechnung MUSS server-seitig erfolgen (Trust Boundary).
Client kann Deal-Werte nicht manipulieren — Server liefert Summe pro Stage.

## BACKEND — apps/api/src/modules/deals/

### Endpoints

```
GET    /api/v1/deals                       ?pipelineId, ?ownerId, ?stageId, ?view=kanban|list
POST   /api/v1/deals
GET    /api/v1/deals/:id
PATCH  /api/v1/deals/:id
DELETE /api/v1/deals/:id                   → Soft-Delete
PATCH  /api/v1/deals/:id/stage             → body: { stageId, order } (DnD)
POST   /api/v1/deals/:id/won
POST   /api/v1/deals/:id/lost              → body: { lostReason }
POST   /api/v1/deals/:id/snooze-ghosting   → body: { days: number }
GET    /api/v1/deals/:id/products
POST   /api/v1/deals/:id/products
DELETE /api/v1/deals/:id/products/:productId

# Pipeline-Aggregates (server-side, client kann nicht manipulieren)
GET    /api/v1/pipelines/:id/summary       → { stages: [{ id, name, count, totalValue, avgProb }] }
```

### Stage-Change-Logik (PATCH /deals/:id/stage)

1. Validiere `stageId` gehört zu `deal.pipelineId`
2. Check: User hat Rechte (Owner oder Manager/Admin)
3. Transaction:
   - `deal.stageId`, `deal.updatedAt` setzen
   - `deal.order` = neuer Wert (für In-Stage-Sortierung)
   - Audit-Log-Entry
4. Trigger: BullMQ `deal-scoring` job (debounced 60 s)
5. WebSocket emit:
   - `deal:stage_changed` → `{ dealId, oldStageId, newStageId, userId }`
   - `deal:updated` → volles Deal-Objekt

### Rot-Indikator-Logik (Server-Side Job)

Täglicher Cron-Job (in `ghosting.worker.ts`, Session 14) setzt `rotIndicator = true` wenn:
```sql
-- Letzte Aktivität älter als pipeline.rotThresholdDays
-- UND Deal offen (not won/lost/deleted)
-- UND nicht gesnoozed
```

### WebSocket-Events (via WebsocketGateway)

- `deal:created` → Neue Card in Kanban einfügen
- `deal:updated` → Card neu rendern (jeder Patch)
- `deal:stage_changed` → Card animiert in neue Spalte
- `deal:rot_indicator` → rotes Badge auf Card togglen
- `deal:deleted` → Card entfernen

## FRONTEND — apps/web/app/(dashboard)/deals/

### Kanban-Board (Default-View)

- **Library:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Optimistic UI-Pattern bei DnD:**
  ```typescript
  // 1. on:dragEnd — sofort State updaten (< 16ms)
  setLocalDeals(reorder(localDeals, from, to));
  
  // 2. Mutation via React Query
  mutation.mutate({ id, stageId, order }, {
    onError: () => setLocalDeals(previousDeals),  // Rollback
    onSettled: () => queryClient.invalidateQueries(['deals'])
  });
  ```
- 4 Views: Kanban | Liste | Tabelle | Zeitachse (Tabs oben)
- **Server-Aggregates im Header:** Pro Spalte `{count} • €{totalValue}` aus `/pipelines/:id/summary`
- **Virtualisierung ab 500 Deals:** `@tanstack/react-virtual` für Spalten-Inhalte

### Deal-Karte

```
┌──────────────────────────────┐
│ 🔴  Deal-Titel (bold, link)  │
│    Firma / Person (grau)     │
│    ▰▰▰▱▱ Progress (Score)    │
│    €12.500 • Prob 35%        │
└──────────────────────────────┘
```

- Rot-Indikator = roter Kreis links oben
- Progress-Bar farbig nach Score (0-33: grau, 34-66: gelb, 67-100: grün)

### Deal-Detail (`/deals/[id]`)

- Header: Titel (inline-edit), Stage-Stepper (alle Stages klickbar), Buttons "Gewonnen" / "Verloren"
- Sidebar (rechts, 320px): Wert, Wahrscheinlichkeit, Closing-Datum (DatePicker), Owner (Select), Pipeline-Name
- Tabs: Übersicht | Aktivitäten (Timeline) | E-Mails | Produkte | Teilnehmer (Persons) | Dateien
- "Ghosting-Alert snoozen" Button: Modal mit Tage-Input (1/3/7/14/30 Preset)

### Performance

- React Query `staleTime: 60 * 1000`
- WebSocket-Updates via React-Query `setQueryData` (keine Invalidation bei jedem Event)
- Lighthouse-Ziel: Performance > 90 auf `/deals`

## AKZEPTANZKRITERIEN

- [ ] AC-002: Kanban zeigt alle Deals korrekt sortiert
- [ ] AC-003: DnD < 16 ms (Optimistic UI, gemessen via Performance-API)
- [ ] AC-004: Pipeline-Value summiert korrekt nach Stage-Wechsel (vom Server, nicht vom Client!)
- [ ] AC-005: Rot-Indikator erscheint nach `rotThresholdDays` (testbar mit Manual-Cron-Run)
- [ ] Rollback funktioniert bei API-Fehler (simuliert mit Dev-Tools offline)
- [ ] WebSocket-Events erreichen andere offene Tabs < 500 ms
- [ ] Virtualisierung ab 500 Deals (Scrollen bleibt 60 fps)
- [ ] Snooze-Ghosting-Action speichert `ghostingSnoozedUntil` korrekt
```

### ⏸ Checkpoint-Prompt (nach ~2,5 h)

Generischer Checkpoint aus 2.2.

### 🏁 Session-Closer & Review

Session-Closer aus 2.3 + `/ultrareview` aus 2.4 (KRITISCHE Session!).

---

## SESSION 6 — M1: Pulse-Feed (KRITISCHER PFAD)

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think hard` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-6-pulse-feed` |
| **Dauer** | ~4–5 h |
| **Abhängigkeiten** | Session 0 (WebSocket), 1, 2, 4, 5 |
| **Dateien für Opener** | `CLAUDE.md`, `apps/api/src/websocket/`, `apps/api/src/modules/deals/`, `apps/api/src/modules/activities/` |

### 📋 Session-Opener

Generischer Opener + Sonderanweisung: *"Verifiziere: WebsocketGateway ist funktional, Deal-Modul existiert, Activity-Modul existiert (noch leer)."*

### 💻 Implementierungs-Prompt

```
think hard

Du bist Full-Stack-Entwickler. Implementiere Pulse-Feed (M1) — zentraler AI-Workspace.

VORAUSSETZUNG: WebSocket-Gateway aus Session 0 MUSS laufen. Prüfe:
- `apps/api/src/websocket/websocket.gateway.ts` existiert
- `WebsocketModule` in `AppModule` importiert (global)
- JWT-Auth im Handshake funktioniert

## BACKEND — apps/api/src/modules/pulse-feed/

### Priority-Score-Berechnung

```typescript
function calculatePriorityScore(item: FeedItem): number {
  const dealValueScore = Math.min((item.dealValue / 10000) * 30, 30);
  const daysOverdue = Math.max(0, daysBetween(item.dueDate, new Date()));
  const overdueScore = Math.min(daysOverdue * 20, 30);
  const activityDensityScore = Math.min(item.activitiesLast7d * 10, 30);
  const stageProgressScore = (item.stageIndex / item.totalStages) * 10;
  return Math.round(dealValueScore + overdueScore + activityDensityScore + stageProgressScore);
}
// Score > 75 → "Dringend"-Badge (rot)
```

### Endpoint

```
GET /api/v1/pulse-feed?date=YYYY-MM-DD&tab=followups|missed|opportunities&page=1&limit=20
```

- **Redis-Cache:** TTL 30 s mit Key `pulse:{userId}:{date}:{tab}:{page}`
- **Cache-Invalidation:** Bei `activity:created/completed`, `deal:updated` → `DEL pulse:{userId}:*`
- Response: `{ items: FeedItem[], total, hasMore }`

### Tabs-Logik
- `followups`: offene Activities mit `dueDate <= today` + zugehörige Deals
- `missed`: Deals mit `rotIndicator = true` ODER keine Activity in 7+ Tagen
- `opportunities`: Deals mit `probability > 60` AND Stage nicht `Vertrag unterschrieben`

### WebSocket-Events (konsumieren)
```typescript
@SubscribeMessage('activity:created')  // Emit vom Activities-Service
// → Cache invalidieren, emit 'pulse:feed_updated'

// Im Gateway:
this.gateway.emitToUser(userId, 'pulse:feed_updated', { tab: 'followups' });
```

## FRONTEND — apps/web/app/(dashboard)/pulse/

### Layout
- Header: Tagesnavigation (◀ DatePicker ▶)
- 3 Tabs: "Follow-Ups" (mit Badge-Zähler) | "Übersehene Deals" | "Verkaufschancen"
- Feed: Infinite Scroll mit `@tanstack/react-virtual`

### Feed-Item-Komponente
```
┌──────────────────────────────────────────┐
│ ☐  "Anruf mit Herr Müller"               │
│    🔗 Deal: EDV-Angebot Müller GmbH      │
│    ▰▰▰▰▱ Score 82  🔴 Dringend           │
│    €45.000  •  📞 Mario (owner)          │
│                             [Aktion ▼]   │
└──────────────────────────────────────────┘
```

- Click auf Checkbox → PATCH `/activities/:id { done: true }` → Slide-out-Animation (framer-motion)
- Click auf Deal-Link → navigate `/deals/[id]`
- Action-Dropdown: "Anzeigen" / "Verschieben" / "Neue Aktivität"

### WebSocket-Hook (`lib/hooks/usePulseFeed.ts`)
```typescript
useEffect(() => {
  const socket = getSocket();  // Singleton
  socket.on('pulse:feed_updated', () => {
    queryClient.invalidateQueries(['pulse', date, tab]);
  });
  return () => socket.off('pulse:feed_updated');
}, [date, tab]);
```

### Info-Banner
- Blauer Banner oben: "Die KI hat X Tasks priorisiert. [Mehr]"
- Dismissible, State in `localStorage` (`pulse.banner_dismissed`)

## AKZEPTANZKRITERIEN

- [ ] AC-010: WebSocket-Update < 500 ms (Playwright-Test: API-Call + Erwartung der UI-Update)
- [ ] Feed lädt < 800 ms P95 (Lighthouse)
- [ ] Slide-out-Animation bei Activity-Erledigung
- [ ] Dismiss-State persistiert in `localStorage`
- [ ] Tagesnavigation zeigt korrekten Zähler pro Tag
- [ ] Priority-Score-Sortierung unterscheidet sich von reiner Datumssortierung (Unit-Test)
```

### 🏁 Session-Closer

Session-Closer aus 2.3.

---

## SESSION 7 — M7: Aktivitäten & Kalender

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think hard` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-7-activities` |
| **Dauer** | ~4–5 h |
| **Abhängigkeiten** | Session 0, 1, 2, 4, 5 |

### 💻 Implementierungs-Prompt

```
think hard

Du bist Full-Stack-Entwickler. Implementiere das Aktivitäten-Modul (M7).

## BACKEND — apps/api/src/modules/activities/

### Validierung (PFLICHT, class-validator-Custom-Decorator)

```typescript
@ValidatorConstraint({ name: 'hasLinkedEntity', async: false })
class HasLinkedEntityConstraint implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as any;
    return !!(obj.dealId || obj.personId || obj.orgId);
  }
  defaultMessage() {
    return 'Bitte verknüpfen Sie diese Aktivität mit einem Deal, einer Person oder einer Organisation.';
  }
}
```

### Zeitfilter-Logik (Query-Param `?filter=...`)

- `todo`: `dueDate >= today` AND `done = false`
- `overdue`: `dueDate < today` AND `done = false`
- `today`: `dueDate = today`
- `tomorrow`: `dueDate = tomorrow`
- `this_week`: innerhalb Mo-So der aktuellen Woche
- `next_week`: innerhalb Mo-So der nächsten Woche
- `range`: Custom `?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Endpoints

```
GET    /api/v1/activities              ?filter, ?type, ?dealId, ?personId, ?assigneeId
POST   /api/v1/activities
GET    /api/v1/activities/:id
PATCH  /api/v1/activities/:id
DELETE /api/v1/activities/:id          → Soft-Delete
PATCH  /api/v1/activities/:id/done     → Mark as done, triggers deal-scoring job
```

### Nach `markDone`
1. `done = true`, `doneAt = now()`
2. BullMQ: `deal-scoring` Queue (debounced 60 s mit `jobId: scoring-{dealId}`)
3. WebSocket emit `activity:completed` → Pulse-Feed-Update

### Konflikt-Erkennung für Meetings (NEU v3.0)

Beim Erstellen oder Verschieben eines Meetings (type=MEETING mit startTime + endTime):

```typescript
async checkConflicts(userId: string, start: Date, end: Date, excludeId?: string) {
  const conflicts = await this.prisma.activity.findMany({
    where: {
      assigneeId: userId,
      type: 'MEETING',
      deletedAt: null,
      id: excludeId ? { not: excludeId } : undefined,
      // Overlap-Check: (a.start < b.end) AND (a.end > b.start)
      AND: [
        { startTime: { lt: end } },
        { endTime: { gt: start } },
      ],
    },
  });
  return conflicts;
}
```

- Endpoint `POST /api/v1/activities/check-conflicts` → gibt Conflicts zurück (kein Create)
- Frontend zeigt Warnung vor Submit (`confirm()` mit Liste der Konflikte)

## FRONTEND — apps/web/app/(dashboard)/activities/

### Listen-Ansicht (`/activities`)
- 11 Spalten: Typ-Icon, Betreff, Deal (Link), Person (Link), Org, Fälligkeit, Dauer, Zugewiesen, Priorität, Status, Actions
- Typ-Tabs oben: Alle | Anruf | Meeting | Aufgabe | Frist | E-Mail | Mittagessen
- Zeitfilter rechts von Typ-Tabs: Dropdown mit o. g. Werten + Custom-Range
- Bulk-Actions: Done / Delete / Reassign

### Kalender-Ansicht (`/activities?view=calendar`)
- **Library:** `react-big-calendar`
- Views: Month / Week / Day / Agenda
- DnD zum Verschieben (→ checkt vorher Konflikte!)
- Farbkodierung nach Typ (siehe Design-Tokens)
- Click auf leeren Slot → Quick-Create Modal

### Meeting-Planer (`/activities/planner`)
- Calendly-Klon: Sales Rep veröffentlicht Buchungslink
- Externe Person wählt Slot → erstellt Activity (type=MEETING) + sendet Invite
- Link-Format: `/book/[publicSlug]`
- Verfügbare Slots aus User-Kalender (keine Konflikte mit bestehenden MEETINGs)

## AKZEPTANZKRITERIEN

- [ ] AC-006: Verknüpfungs-Validierung (Deal OR Person OR Org) funktioniert mit deutscher Fehlermeldung
- [ ] Kalender-Ansicht mit Farbkodierung nach Typ
- [ ] Meeting-Planer generiert buchbaren Link, externe Buchung legt Activity an
- [ ] Konflikt-Erkennung verhindert Doppelbuchung (Test: zwei Meetings zur gleichen Zeit)
- [ ] DnD im Kalender zeigt Warnung bei Konflikt
- [ ] markDone → deal-scoring Job in Redis Queue sichtbar
```

### 🏁 Session-Closer

---

## SESSION 8 — M2: Leads & Webformulare

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think hard` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-8-leads-forms` |
| **Dauer** | ~4–5 h |

### 💻 Implementierungs-Prompt

```
think hard

Du bist Full-Stack-Entwickler. Implementiere Leads & Webformulare (M2).

## WICHTIG: Enrichment-Stack-Klarstellung (aus v2.0 übernommen)

Der ursprüngliche "GPT-4o Browsing-Tool"-Ansatz ist NICHT implementierbar.
Korrigierter Stack (Details in Session 14):
1. Serper.dev API: Firmenwebsite suchen
2. HTTP-Fetch + Cheerio: Website-Content extrahieren
3. GPT-4o: Text analysieren und Daten strukturieren

In Session 8 NUR:
- Lead-CRUD
- Form-Builder
- BullMQ-Job `lead-enrichment` einreihen bei Lead-Submission
- Status-Tracking im UI (PENDING/PROCESSING/DONE/FAILED)

Der Worker-Code kommt in Session 14.

## BACKEND — apps/api/src/modules/leads/ + modules/forms/

### Endpoints

```
# Forms (Admin)
POST   /api/v1/forms
GET    /api/v1/forms
GET    /api/v1/forms/:id
PUT    /api/v1/forms/:id
DELETE /api/v1/forms/:id
GET    /api/v1/forms/:id/embed           → Embed-Snippet HTML/JS

# Public Submit (ohne Auth, mit Rate-Limit!)
POST   /api/v1/public/forms/:id/submit   → erstellt Lead, triggered enrichment
                                           Rate-Limit: 5/min/IP
                                           CORS: *

# Leads (intern)
GET    /api/v1/leads                     ?enrichmentStatus, ?formId
GET    /api/v1/leads/:id
POST   /api/v1/leads/:id/convert         → erstellt Person + Deal, verknüpft
POST   /api/v1/leads/:id/enrich          → erneut in Queue einreihen
DELETE /api/v1/leads/:id                 → Soft-Delete
```

### XSS-Schutz (NEU v3.0)

Form-Builder erlaubt Labels + Platzhalter. Diese werden im Embed-Formular gerendert.

**Auf Submit:** Validate mit class-validator + sanitize mit `DOMPurify` (server-side via `isomorphic-dompurify`).

Das verhindert, dass jemand ein Formular mit Label `<script>alert(1)</script>` anlegt und später im Lead-Detail Admin-Session gekapert wird.

## FRONTEND

### Lead-Posteingang (`/leads`)
- Tabelle mit Enrichment-Status-Badges:
  - PENDING: grau "Ausstehend"
  - PROCESSING: blauer Spinner "Wird angereichert..."
  - DONE: grüner Badge + Preview der Enriched-Daten
  - FAILED: roter Badge + Retry-Button
- Convert-Button pro Lead → Modal mit Deal-Daten vorbefüllt

### Drag-and-Drop Form-Builder (`/forms/builder/[id]?` — neu oder Edit)

Layout 3-Panel:
- Links (240px): Feld-Bibliothek (Draggable Cards)
- Mitte (flex-1): Canvas (Drop-Zone, sortierbar)
- Rechts (280px): Einstellungen des selektierten Felds

**Feldtypen:**
- Text, E-Mail, Telefon, Textarea, Zahl, Dropdown, Checkbox, Radio, Datum, Datei-Upload
- Jedes Feld: Label, Placeholder, required?, Validierung, Default-Wert

**Lib:** `@dnd-kit/core` + `@dnd-kit/sortable`

### Einbettbares Formular (`/f/[id]` — öffentliche Route, kein Layout!)

- Standalone HTML mit Tailwind
- Submit via `POST /api/v1/public/forms/:id/submit`
- Success-Message nach Submit
- Embed-Snippet als iframe (`<iframe src="https://.../f/abc">`)

## AKZEPTANZKRITERIEN

- [ ] AC-011: Webformular ist einbettbar und speichert Lead
- [ ] Form-Builder DnD funktioniert
- [ ] Enrichment-Status wird korrekt angezeigt und via WebSocket aktualisiert (`lead:enriched` Event)
- [ ] XSS-Payload in Form-Label wird sanitized
- [ ] Public-Submit ist rate-limited (6. Submit in 1 min → 429)
- [ ] Convert-Flow erstellt Person + Deal mit korrekten Verknüpfungen
```

### 🏁 Session-Closer

---

## SESSION 9 — M10: Produktkatalog

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-9-products` |
| **Dauer** | ~3–4 h |

### 💻 Implementierungs-Prompt

```
think

Du bist Full-Stack-Entwickler. Implementiere den Produktkatalog (M10).

## BACKEND

### Endpoints
```
GET    /api/v1/products                      ?category, ?search
POST   /api/v1/products
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id                  → Soft-Delete
POST   /api/v1/products/import               → CSV-Import (multipart, streaming!)

POST   /api/v1/deals/:id/products            → body: { productId, quantity, discount, discountType }
GET    /api/v1/deals/:id/products
DELETE /api/v1/deals/:id/products/:dealProductId
```

### CSV-Import — NEU v3.0: STREAMING

**Problem:** 5000 Zeilen * viele Spalten = potenziell > 10 MB. Synchrones Parsing lädt alles ins RAM.

**Lösung:** Papaparse im Stream-Mode:
```typescript
import Papa from 'papaparse';
import { Readable } from 'node:stream';

async importCsv(fileBuffer: Buffer, userId: string): Promise<ImportResult> {
  const errors: ImportError[] = [];
  const created: Product[] = [];
  let rowNumber = 0;

  return new Promise((resolve, reject) => {
    Papa.parse(Readable.from(fileBuffer), {
      header: true,
      worker: false,  // Wir sind schon im Worker-Context
      step: async (row, parser) => {
        rowNumber++;
        if (rowNumber > 5000) {
          parser.abort();
          errors.push({ row: rowNumber, msg: 'Limit 5000 Zeilen überschritten' });
          return;
        }
        parser.pause();
        try {
          const product = await this.createFromCsvRow(row.data);
          created.push(product);
        } catch (e) {
          errors.push({ row: rowNumber, msg: (e as Error).message });
        }
        parser.resume();
      },
      complete: () => resolve({ created: created.length, errors }),
      error: reject,
    });
  });
}
```

### Deal-Gesamtwert automatisch aktualisieren

Nach `POST/DELETE /deals/:id/products`:
```typescript
const sum = await prisma.dealProduct.aggregate({
  where: { dealId },
  _sum: { total: true }
});
await prisma.deal.update({
  where: { id: dealId },
  data: { value: sum._sum.total ?? 0 }
});
```

## FRONTEND

### Produktliste (`/products`)
- Tabelle: Name, Code, Kategorie, Preis, Steuer, Einheit, Abrechnung, Sichtbar für
- Filter: Kategorie-Dropdown, Search
- "Import CSV"-Button: Modal mit Spalten-Mapping + Preview erste 10 Zeilen

### "Produkt hinzufügen" Modal
Felder: Name, Code, Kategorie, Einheit, Abrechnungsfrequenz, Stückpreis, Steuer %, Sichtbar für (Rollen-Multi-Select)

### Produkte-Tab im Deal-Detail
- Autocomplete: `combobox` mit Product-Search
- Inline-Edit: Menge, Preis (prefill), Rabatt (% oder €-Toggle), Steuer, Gesamt (readonly, berechnet)
- Zeile hinzufügen / entfernen
- Gesamtsumme unten

## AKZEPTANZKRITERIEN

- [ ] AC-009: Produkt hinzufügen → Deal-Wert aktualisiert sich
- [ ] CSV-Import akzeptiert 5000 Zeilen, rejectet 5001+
- [ ] Streaming-Parse verbraucht < 100 MB RAM bei 5 MB CSV
- [ ] Ungültige Zeilen werden geskippt + im Error-Report gelistet
```

### 🏁 Session-Closer

---

## SESSION 10 — M4: Projekte

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-10-projects` |
| **Dauer** | ~3–4 h |

### 💻 Implementierungs-Prompt

```
think

Du bist Full-Stack-Entwickler. Implementiere das Projekte-Modul (M4).
Das Kanban-Muster aus Session 5 (Deals) wiederverwenden!

## BACKEND

```
GET    /api/v1/projects                    ?dealId, ?status
POST   /api/v1/projects                    { name, emoji, dealId?, templateId? }
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id                → Soft-Delete
PATCH  /api/v1/projects/:id/status         → Kanban-DnD

GET    /api/v1/projects/templates
POST   /api/v1/projects/:id/from-template  → Instanziert Tasks aus Template

# Tasks
POST   /api/v1/projects/:id/tasks
PATCH  /api/v1/tasks/:id                   → done, order, etc.
DELETE /api/v1/tasks/:id
GET    /api/v1/tasks                       → Globale Aufgabenliste ?assigneeId, ?done
```

### Templates

Beim Erstellen Projekt aus Template:
```typescript
const template = await prisma.projectTemplate.findUnique({ where: { id }});
const tasks = (template.tasksJson as Array<{ title: string; relativeDueDays: number }>).map((t, i) => ({
  projectId: newProject.id,
  title: t.title,
  dueDate: addDays(new Date(), t.relativeDueDays),
  order: i,
}));
await prisma.task.createMany({ data: tasks });
```

### Seed-Templates (in seed.ts ergänzen, falls noch nicht):
1. "Kundenprojekt Standard" — 5 Tasks (Kick-Off / Anforderungen / Design / Impl / Review)
2. "SaaS-Onboarding" — 4 Tasks (Vertrag / Setup / Training / Go-Live)
3. "Custom Integration" — 6 Tasks

## FRONTEND

### Kanban (`/projects`) — 5 Phasen-Spalten
Kick-Off | Planung | Implementierung | Überprüfen | Schließen

**Wiederverwendung:** Extrahiere `KanbanBoard<T>` aus Session 5 in `components/shared/Kanban.tsx` falls noch nicht geschehen. Typ-Parameter über Card-Renderer-Props.

### Projekt-Karte
```
┌──────────────────────────────┐
│ 🚀 Projektname               │
│    📅 Due: 15.05.2026        │
│    🏷️ urgent, crm             │
│    ▓▓▓▓░░ 4/6 Tasks          │
└──────────────────────────────┘
```

### Detail (`/projects/[id]`)
- Tabs: Übersicht | Tasks | Dateien | Notizen
- Tasks: Liste mit Checkbox, Drag-reorder, Due-Date, Assignee, Kommentare-Placeholder

### Globale Aufgabenliste (`/tasks`)
- Alle Tasks aller Projekte, gefiltert nach `assigneeId = currentUser`
- Filter: "Meine" | "Alle" | "Heute fällig" | "Diese Woche"

## AKZEPTANZKRITERIEN

- [ ] Projekt aus Template erstellt 5 Tasks mit relativen Daten
- [ ] DnD-Status-Change funktioniert
- [ ] Task-Progress-Balken korrekt (done-count / total)
- [ ] Globale Tasks-Liste filtert korrekt
```

### 🏁 Session-Closer

---

## SESSION 11 — M6: Sales-Posteingang (E-Mail-Sync)

| Feld | Wert |
|------|------|
| **Modell** | `claude-opus-4-7` |
| **Thinking** | `ultrathink` |
| **/effort** | `max` |
| **Git-Branch** | `feature/session-11-email-inbox` |
| **Dauer** | ~6–8 h (komplexeste Session!) |
| **Abhängigkeiten** | Session 0, 1, 2, 5; GCP-Pub/Sub-Topic eingerichtet |

> **⚠ Pre-Session-Pflicht (GCP-Setup):** Google Cloud Project erstellen, Pub/Sub-Topic `gmail-notifications` anlegen, Service-Account mit Gmail-API + PubSub-Rechten, Credentials in `.env` (`GCP_PUBSUB_PROJECT`, Service-Account-JSON als Base64 in `GCP_SA_KEY`). Siehe [Gmail Push Notifications Docs](https://developers.google.com/gmail/api/guides/push).

### 📋 Session-Opener

Generischer Opener + Sonderanweisung: *"Bestätige: GCP-Pub/Sub-Topic existiert, Service-Account-Credentials in .env, Gmail-API aktiviert im GCP-Projekt. Wenn nicht → STOP, User muss GCP-Setup nachholen."*

### 💻 Implementierungs-Prompt

```
ultrathink

Du bist Full-Stack-Entwickler mit Gmail/Outlook-API-Erfahrung. Implementiere E-Mail-Sync (M6).
Plane 6-8 Stunden ein — das ist die komplexeste Session.

## KRITISCHE IMPLEMENTIERUNGSREIHENFOLGE (genau so!)

1. AES-256-GCM Verschlüsselungs-Service (ZUERST — alles andere hängt davon ab)
2. Gmail OAuth2 + Token-Storage (verschlüsselt)
3. Gmail Watch API + Webhook-Handler
4. Poll-Fallback (BullMQ, alle 5 Min)
5. Outlook OAuth2 (Microsoft Graph) — gleiches Pattern
6. Email-Sync-Service (Verschlüsseln + Deal-Matching)
7. Smart Summary (GPT-4o)
8. Frontend (Inbox-UI + Compose)

Committe nach jedem Block! Bei Problemen können wir auf letzten funktionierenden Stand zurück.

## BLOCK 1: AES-256-GCM Encryption-Service

```typescript
// apps/api/src/shared/crypto/encryption.service.ts
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor() {
    const hexKey = process.env.EMAIL_ENCRYPTION_KEY;
    if (!hexKey || hexKey.length !== 64) {
      throw new Error('EMAIL_ENCRYPTION_KEY must be 64-char hex (32 bytes)');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return JSON.stringify({
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    });
  }

  decrypt(payload: string): string {
    const { encrypted, iv, authTag } = JSON.parse(payload);
    const decipher = crypto.createDecipheriv(
      this.algorithm, this.key, Buffer.from(iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
```

## BLOCK 2: Gmail Token-Management

```typescript
async refreshGmailToken(userId: string): Promise<string> {
  const user = await this.prisma.user.findUnique({ where: { id: userId }});
  if (!user?.gmailTokenEncrypted) throw new Error('Gmail not connected');
  
  const tokens = JSON.parse(this.encryption.decrypt(user.gmailTokenEncrypted));
  
  // Refresh wenn Token in < 60 s abläuft
  if (tokens.expiry_date < Date.now() + 60000) {
    this.oAuth2Client.setCredentials(tokens);
    const { credentials } = await this.oAuth2Client.refreshAccessToken();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        gmailTokenEncrypted: this.encryption.encrypt(JSON.stringify(credentials)),
      },
    });
    return credentials.access_token!;
  }
  return tokens.access_token;
}
```

## BLOCK 3: Gmail Watch API (Push-Notifications)

```typescript
// Einmalig pro User-Verbindung + Renewal alle 6 Tage via Cron
async setupGmailWatch(userId: string): Promise<void> {
  const gmail = await this.getGmailClient(userId);
  const resp = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      labelIds: ['INBOX'],
      topicName: `projects/${process.env.GCP_PUBSUB_PROJECT}/topics/${process.env.GCP_PUBSUB_TOPIC}`,
    },
  });
  await this.prisma.user.update({
    where: { id: userId },
    data: {
      gmailHistoryId: resp.data.historyId,
      gmailWatchExpiresAt: new Date(Number(resp.data.expiration)),
    },
  });
}

// Cron: alle 6 Tage renewen
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async renewWatches(): Promise<void> {
  const soonToExpire = await this.prisma.user.findMany({
    where: {
      gmailWatchExpiresAt: { lte: addDays(new Date(), 1) },
      gmailTokenEncrypted: { not: null },
    }
  });
  for (const u of soonToExpire) await this.setupGmailWatch(u.id);
}
```

## BLOCK 4: Webhook-Handler + Incremental Sync

```typescript
@Post('webhooks/gmail')
@Public()  // kein Auth — kommt von Google PubSub
async handleGmailWebhook(@Body() body: any, @Headers() headers: any) {
  // MUSS < 10 s antworten, sonst Retry von Google
  
  // 1. Verify: Cloud PubSub signed JWT (Authorization: Bearer ...)
  const token = headers.authorization?.replace('Bearer ', '');
  if (!await this.verifyPubSubToken(token)) {
    throw new UnauthorizedException();
  }
  
  // 2. Decode
  const data = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
  const { emailAddress, historyId } = data;
  
  // 3. ACK sofort, Verarbeitung asynchron
  this.emailSyncQueue.add('sync', { emailAddress, historyId });
  return { ok: true };
}

// Worker:
async syncFromHistory(emailAddress: string, newHistoryId: string) {
  const user = await this.prisma.user.findFirst({ where: { email: emailAddress }});
  if (!user?.gmailHistoryId) return;
  
  const gmail = await this.getGmailClient(user.id);
  const history = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: user.gmailHistoryId,
    historyTypes: ['messageAdded'],
  });
  
  for (const h of history.data.history ?? []) {
    for (const added of h.messagesAdded ?? []) {
      await this.fetchAndStoreMessage(user, added.message.id);
    }
  }
  
  await this.prisma.user.update({
    where: { id: user.id },
    data: { gmailHistoryId: newHistoryId },
  });
}
```

## BLOCK 5: Poll-Fallback

BullMQ Cron alle 5 Min: für User ohne aktives Watch (oder wenn Watch failed): `messages.list` mit `q: 'newer_than:10m'`.

## BLOCK 6: Outlook (Microsoft Graph)

Analog zu Gmail:
- OAuth2 via Azure AD
- `subscriptions.create` für Change-Notifications (äquivalent zu Gmail Watch)
- Webhook auf `POST /api/v1/webhooks/outlook`
- 3-Tage-Expiry, Renewal-Cron alle 2 Tage

## BLOCK 7: Email-Sync-Service

```typescript
async fetchAndStoreMessage(user: User, messageId: string) {
  const gmail = await this.getGmailClient(user.id);
  const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  
  const parsed = this.parseGmailMessage(msg.data);
  const bodyPreview = parsed.bodyText.slice(0, 200);  // Unverschlüsselt
  const bodyEncrypted = this.encryption.encrypt(parsed.bodyHtml);
  
  // Deal-Matching: Via domain lookup
  const dealId = await this.matchDealByAddress(parsed.from, user.id);
  
  await this.prisma.email.create({
    data: {
      gmailMessageId: messageId,
      threadId: parsed.threadId,
      fromAddress: parsed.from,
      toAddresses: parsed.to,
      cc: parsed.cc,
      bcc: parsed.bcc,
      subject: parsed.subject,
      bodyEncrypted,
      bodyPreview,
      sentAt: new Date(parsed.date),
      userId: user.id,
      dealId,
    },
  });
  
  this.gateway.emitToUser(user.id, 'email:received', { threadId: parsed.threadId });
}
```

## BLOCK 8: Smart Summary

Wenn Thread > 5 Nachrichten:
```typescript
async summarizeThread(threadId: string, userId: string) {
  const emails = await this.prisma.email.findMany({
    where: { threadId, userId },
    orderBy: { sentAt: 'asc' }
  });
  
  const decrypted = emails.map(e => ({
    from: e.fromAddress,
    date: e.sentAt,
    body: this.encryption.decrypt(e.bodyEncrypted),
  }));
  
  const completion = await this.openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'system',
      content: 'Du fasst E-Mail-Threads für Sales-Reps zusammen. Antworte ausschließlich JSON.',
    }, {
      role: 'user',
      content: `Thread mit ${decrypted.length} Mails. Gib zurück:
      { "bullets": ["Punkt 1", "Punkt 2", "Punkt 3"],
        "suggestedReply": "Draft-Text für Rep...",
        "tone": "friendly|neutral|urgent" }
      
      Mails: ${JSON.stringify(decrypted)}`,
    }],
  });
  
  return JSON.parse(completion.choices[0].message.content!);
}
```

## BLOCK 9: Frontend — Inbox-UI

2-Panel-Layout:
- Links (380px): Thread-Liste (sortiert nach sentAt DESC), gruppiert (heute/gestern/älter)
- Rechts: Thread-Detail mit allen Mails

**KI-Summary-Banner** (nur wenn > 5 Mails im Thread):
- "🤖 KI-Zusammenfassung anzeigen" → Button klicken → Banner mit 3 Bullets + Draft-Button
- "Als Entwurf laden" → öffnet Compose-Dialog prefilled

**Compose-Dialog:**
- Rich-Text mit TipTap (oder Quill)
- Attachments (MinIO-Upload, Session 9 vorausgesetzt)
- Send via Gmail/Outlook-API (`messages.send`)

## AKZEPTANZKRITERIEN

- [ ] AC-007: E-Mail in Gmail erscheint im CRM < 30 s (testbar mit gmail-send → watch → CRM)
- [ ] E-Mail-Body AES-256-GCM verschlüsselt — KEIN Klartext in DB (Test: `psql` query, body ist JSON-Blob)
- [ ] KEIN Klartext in Logs (`grep -r "bodyEncrypted" apps/api/src | grep -v encrypt` → leer)
- [ ] Im CRM gesendete Mail erscheint in Gmail "Gesendet"
- [ ] Token-Refresh funktioniert automatisch (Test: expiry_date manuell in DB auf < jetzt setzen)
- [ ] Gmail-Watch-Renewal Cron läuft (Test: Mock `gmailWatchExpiresAt` auf morgen → nach Cron-Run updated)
- [ ] AC-018: KI-Summary bei Threads > 5 Nachrichten erscheint
- [ ] Deal-Matching funktioniert für bekannte Sender (Test: Mail von Person mit bestehendem Deal → Email hat `dealId`)
- [ ] Poll-Fallback funktioniert für User ohne Watch
```

### ⏸ Checkpoint 1 (nach Block 4 / ca. 2,5 h)

```
CHECKPOINT 1 — Gmail Integration

Bitte keine Änderungen. Antworte kurz:
1. Sind Blöcke 1-4 (Encryption, OAuth, Watch, Webhook) implementiert und committet?
2. Lokaler Test möglich? (Webhook kann mit ngrok getestet werden — hast du daran gedacht?)
3. Nächstes: Block 5 (Poll-Fallback) oder direkt Block 6 (Outlook)?

Danach: /compact
```

### ⏸ Checkpoint 2 (nach Block 7 / ca. 5 h)

```
CHECKPOINT 2 — Sync-Service

Bitte keine Änderungen. Antworte kurz:
1. Blocks 5-7 fertig? Gmail UND Outlook?
2. Wird der bodyEncrypted-Wert nirgends entschlüsselt und geloggt?
3. Deal-Matching-Logik getestet?
4. Nächstes: Block 8 (Summary) + Block 9 (UI).

Danach: /compact
```

### 🏁 Session-Closer & Review

Session-Closer aus 2.3 + `/ultrareview` aus 2.4 (KRITISCHE Session — bitte gründlich!).

---

## SESSION 12 — M5: E-Mail-Campaigns

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think hard` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-12-campaigns` |
| **Dauer** | ~4–5 h |

### 💻 Implementierungs-Prompt

```
think hard

Du bist Full-Stack-Entwickler. Implementiere das Campaigns-Modul (M5).

## BACKEND — DSGVO KRITISCH

**Pflicht-Validierung vor jedem Versand:**
```typescript
async validateRecipients(campaignId: string): Promise<void> {
  const recipients = await this.prisma.campaignContact.findMany({
    where: { campaignId },
    include: { person: { select: { optIn: true, deletedAt: true }}},
  });
  const nonOptIn = recipients.filter(r => !r.person.optIn || r.person.deletedAt);
  if (nonOptIn.length > 0) {
    throw new BadRequestException({
      message: `${nonOptIn.length} Empfänger ohne DSGVO-Opt-in`,
      code: 'DSGVO_VIOLATION',
      details: nonOptIn.map(r => ({ personId: r.personId }))
    });
  }
}
```

## HMAC-signed Tracking-Tokens (NEU v3.0)

Nicht Random-UUID, sondern **HMAC** — verhindert Token-Forging und erlaubt Offline-Validierung:

```typescript
generateTrackingToken(campaignId: string, personId: string, action: 'open'|'click'|'unsub'): string {
  const payload = `${campaignId}:${personId}:${action}`;
  const hmac = crypto.createHmac('sha256', process.env.JWT_SECRET);  // Separaten Secret empfohlen!
  const sig = hmac.update(payload).digest('hex').slice(0, 16);
  return `${payload}:${sig}`;
}

validateTrackingToken(token: string): { campaignId, personId, action } | null {
  const [campaignId, personId, action, sig] = token.split(':');
  const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`${campaignId}:${personId}:${action}`)
    .digest('hex').slice(0, 16);
  if (sig !== expectedSig) return null;
  return { campaignId, personId, action };
}
```

## KI-Betreffzeilen (GPT-4o)

```typescript
async generateSubjects(campaignDraft: Campaign): Promise<Suggestion[]> {
  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Du bist E-Mail-Marketing-Experte. Antworte nur JSON.' },
      { role: 'user', content: `Generiere 3 Betreffzeilen (max 60 Zeichen) für max. Öffnungsrate.
       Ursprung: "${campaignDraft.subject}"
       Body-Preview: "${campaignDraft.bodyHtml.slice(0, 500)}"
       
       JSON: { "suggestions": [{ "subject": "...", "reasoning": "warum", "estimatedOpenRate": 25 }] }` }
    ]
  });
  return JSON.parse(response.choices[0].message.content!).suggestions;
}
```

## Endpoints

```
GET/POST/PUT/DELETE /api/v1/campaigns
POST /api/v1/campaigns/:id/send              → DSGVO-Validierung!
POST /api/v1/campaigns/:id/ai-subjects       → GPT-4o
POST /api/v1/campaigns/:id/test-send         → Send to Current User only

# Public Tracking (kein Auth, HMAC-Verifiziert)
GET  /api/v1/public/track/open/:token        → 1x1 transparent PNG
GET  /api/v1/public/track/click/:token?url=  → Redirect
GET  /api/v1/public/unsubscribe/:token       → Landing-Page mit Bestätigung
POST /api/v1/public/unsubscribe/:token       → setzt person.optIn=false

# Bounce Webhook (von SendGrid/Provider)
POST /api/v1/webhooks/sendgrid              → setzt bounceCount
```

## Sending & Throttling (NEU v3.0)

Nicht direkt loop-sending — via Queue:

```typescript
async sendCampaign(id: string): Promise<void> {
  await this.validateRecipients(id);
  const campaign = await this.prisma.campaign.update({
    where: { id }, data: { status: 'SENDING', sentAt: new Date() }
  });
  const contacts = await this.prisma.campaignContact.findMany({ where: { campaignId: id }});
  
  // In Batches von 50, delay 1s zwischen Batches → 3000/min = typisches SendGrid-Limit
  for (let i = 0; i < contacts.length; i += 50) {
    const batch = contacts.slice(i, i + 50);
    await this.campaignQueue.add('send-batch', {
      campaignId: id, contactIds: batch.map(c => c.id)
    }, { delay: (i / 50) * 1000 });
  }
}
```

## Bounce-Handling

SendGrid-Webhook liefert bounce-events. Event-Handler:
- Hard-Bounce → person.optIn = false, CampaignContact.bouncedAt = now
- Soft-Bounce → nur Counter, kein Opt-out

## FRONTEND

### 4-Schritt-Wizard (`/campaigns/new`)
1. **Vorlage** (Template-Auswahl oder Blank)
2. **Empfänger** (Segment-Filter: Tags, letzter Kontakt, Owner, etc.)
3. **Vorschau** (DSGVO-Banner rot, wenn non-opt-in enthalten)
4. **Senden** (Bestätigungs-Checkbox)

### E-Mail-Editor
- Drag-Drop-Blöcke: Text, Bild, Button, Divider, Spacer
- Live-Preview (Desktop / Mobile Toggle)
- Merge-Tags: `{{firstName}}`, `{{orgName}}`

### KI-Panel
- 3 Betreffzeilen-Vorschläge mit Reasoning + geschätzte Open-Rate
- Click auf Suggestion → übernimmt Subject

### DSGVO-Warnung vor Versand
- Rotes Alert-Banner: "X von Y Empfängern haben kein Opt-in. Versand ist DSGVO-rechtlich nicht zulässig."
- Versand-Button disabled bei non-opt-in
- Admin kann mit "Force-Send" überschreiben (nur ADMIN-Rolle) → Audit-Log

## AKZEPTANZKRITERIEN

- [ ] AC-025: KI schlägt 3 Betreffzeilen vor
- [ ] DSGVO-Validierung blockt Versand ohne Opt-in (testbar: Person mit `optIn=false` in Segment → 400)
- [ ] HMAC-Token kann nicht geforged werden (Test: manipuliertes Token → 400)
- [ ] Unsubscribe setzt optIn=false (Test: Klick auf Unsub-Link, dann DB-Check)
- [ ] Open-Tracking-Pixel liefert 1×1 PNG
- [ ] Bounce-Webhook updated bounceCount
- [ ] Sending in Batches mit Delay — keine Rate-Limit-Fehler bei SendGrid
```

### 🏁 Session-Closer

---

## SESSION 13 — M9: Einblicke & Analytics-Dashboard

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think hard` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-13-insights` |
| **Dauer** | ~4–5 h |

### 💻 Implementierungs-Prompt

```
think hard

Du bist Full-Stack-Entwickler mit Datenvisualisierungs-Expertise. Implementiere Reporting (M9).

## BACKEND — 8 Standard-Reports

Implementiere als Service-Methoden + Endpoints unter `/api/v1/insights/reports/:type`:
- `dealConversionRate`
- `revenueForecast`
- `activityPerformance`
- `wonVsLostDeals`
- `pipelineVelocity`
- `leadSources`
- `emailPerformance`
- `revenueByUser`

Jede Methode akzeptiert `dateRange`, `pipelineId?`, `userId?` — gibt `{ labels, datasets, summary }` zurück.

## KI-Verlust-Analyse (Cron Mo 09:00)

```typescript
@Cron('0 9 * * 1', { timeZone: 'Europe/Berlin' })
async weeklyLossAnalysis() {
  const lost = await this.prisma.deal.findMany({
    where: {
      lostAt: { gte: subDays(new Date(), 90) },
      deletedAt: null,
    },
    include: { activities: true, emails: { select: { bodyPreview: true }}}
  });
  
  // WICHTIG: KEINE E-Mail-Bodies schicken (DSGVO), nur Metadaten + lostReason
  const payload = lost.map(d => ({
    value: d.value,
    lostReason: d.lostReason,
    daysInPipeline: daysBetween(d.createdAt, d.lostAt),
    activityCount: d.activities.length,
    emailCount: d.emails.length,
  }));
  
  const completion = await this.openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Analysiere verlorene Deals und identifiziere 3 häufigste Verlustgründe mit konkreten Empfehlungen.
       Daten: ${JSON.stringify(payload)}
       JSON: { "reasons": [{ "pattern": "...", "count": N, "recommendation": "..." }]}`
    }]
  });
  
  await this.prisma.aIInsight.create({
    data: {
      type: 'loss_analysis',
      content: JSON.parse(completion.choices[0].message.content!),
      validUntil: addDays(new Date(), 7),
    }
  });
}
```

## FRONTEND

### Dashboard-Builder (`/insights`)
- **Library:** `react-grid-layout` (12 Spalten, row-height 150 px)
- Widgets drag-resize-bar
- Layouts per User gespeichert (`localStorage` oder separate Table)

### Widget-Kollision (NEU v3.0)
Nutze `react-grid-layout`'s `verticalCompact: true` + `preventCollision: false` — verhindert überlappende Widgets automatisch beim Drop.

### Chart-Library: `Recharts`

### Widget-Typen
1. **KPI-Zahl** — große Zahl + Trend-Pfeil
2. **Balken-Chart** (BarChart)
3. **Linie** (LineChart)
4. **Funnel** (Recharts FunnelChart)
5. **Pie/Donut** (PieChart)
6. **Tabelle** (Plain)
7. **Heatmap** (Custom oder `@nivo/heatmap`)
8. **KI-Insight-Karte** — rendert `AIInsight.content.reasons[]`

### KI-Insight-Karte
- Zeigt "Wöchentliche Verlust-Analyse" (neuester `type: 'loss_analysis'` Eintrag)
- 3 Gründe als Cards, jede mit Recommendation + Prio
- "Neu analysieren"-Button (manueller Trigger)

## AKZEPTANZKRITERIEN

- [ ] AC-020: Dashboard-Builder — Verschieben und Skalieren funktioniert, keine Überlappung
- [ ] KI-Verlust-Analyse läuft wöchentlich UND manuell
- [ ] Keine E-Mail-Bodies werden an OpenAI geschickt (Test: Mock OpenAI-Call → assert payload nicht `bodyEncrypted`)
- [ ] Alle 8 Standard-Reports liefern valide Daten
- [ ] Layout persistiert nach Refresh
```

### 🏁 Session-Closer

---

## SESSION 14 — KI-Agenten (Enrichment, Scoring, Ghosting)

| Feld | Wert |
|------|------|
| **Modell** | `claude-opus-4-7` |
| **Thinking** | `ultrathink` |
| **/effort** | `xhigh` |
| **Git-Branch** | `feature/session-14-ai-agents` |
| **Dauer** | ~5–6 h (Checkpoint bei 50 %) |
| **Abhängigkeiten** | Session 1 (Job-Queue-Tables), 8 (Leads), 11 (E-Mail-Events) |

### 📋 Pre-Session-Setup

```bash
git checkout main && git pull && git checkout -b feature/session-14-ai-agents
code CLAUDE.md prisma/schema.prisma apps/api/src/queues/
```

**VSCode-Tabs öffnen:** `CLAUDE.md`, `prisma/schema.prisma` (Tables: Lead, Person, Company, AIInsight, Task, Activity), `apps/api/src/queues/`, ggf. `docs/sessions/session-01-summary.md`, `session-08-summary.md`, `session-11-summary.md`.

### 🎬 Session-Opener-Prompt

```
Ich starte jetzt Session 14 von 18: KI-Agenten.

1. Lies CLAUDE.md vollständig.
2. Lies die Session-Summaries: docs/sessions/session-01-summary.md, session-08-summary.md, session-11-summary.md.
3. Lies diese Dateien für Session 14:
   - prisma/schema.prisma (besonders: AIInsight, Lead, Person, Company, Task, Activity, Email-Events)
   - apps/api/src/queues/ (BullMQ-Setup aus Session 1)
   - apps/api/src/leads/ (Session 8)
   - apps/api/src/email/ (Session 11)
4. Antworte mit Kurz-Zusammenfassung:
   - "Session 14 — KI-Agenten (Enrichment, Scoring, Ghosting)"
   - Abgeschlossene Vor-Sessions
   - Token-Budget jetzt
   - Datenmodell für AIInsight (content Jsonb-Struktur)
5. Stelle mir 2 Klärungsfragen zu Edge-Cases (z. B. OpenAI-Rate-Limits, Serper-Quota, Idempotenz bei Retries).

Nicht coden, nur lesen und zusammenfassen.
```

### 💻 Implementierungs-Prompt

```
ultrathink

Du bist Senior AI-Engineer mit Fokus auf Prompt-Engineering und Kosten-Optimierung. Implementiere die 3 KI-Agenten als BullMQ-Worker.

## AGENT 1: Enrichment-Worker

**Trigger:** `lead.created` Event → fügt Job in Queue `enrichment`
**Idempotenz-Key:** `lead:{id}:enrichment` (verhindert Doppel-Runs bei Retries)
**Timeout pro Job:** 60 s

### Pipeline
1. **Serper-Suche** (Google-Scraper-API, DSGVO-konform — kein eigener Crawler) — Suche nach `"{company} {website}"`, hole Top-5 Ergebnisse
2. **Fallback (NEU v3.0):** Falls Serper-Quota erschöpft (HTTP 429) oder Ergebnis leer → loggen in AIInsight mit `status: 'partial'` und Lead trotzdem durchreichen (kein kompletter Fail)
3. **Cheerio-Scraping** der Top-3 URLs (erstes relevantes Impressum/About) — **Robots.txt respektieren** via `robots-parser`
4. **GPT-4o-Extraktion** (structured output mit JSON-Schema):
   ```typescript
   const schema = {
     branche: "string",
     mitarbeiterzahl: "number | null",
     jahresumsatz: "number | null",
     headquarter: "string | null",
     techStack: "string[]",
     socialProfiles: { linkedin?: string, xing?: string, twitter?: string }
   };
   ```
5. **Speichern:** Company-Felder patchen, `AIInsight { type: 'enrichment', content: {...}, confidence: 0-1 }`
6. **Cost-Tracking (NEU v3.0):** Pro Run Tokens + Serper-Credits protokollieren in `AIInsight.content.cost`:
   ```json
   { "serperCredits": 1, "openaiTokensIn": 2300, "openaiTokensOut": 450, "estCostUsd": 0.021 }
   ```

### Prompt-Template (in `apps/api/src/ai/prompts/enrichment.ts`)
```typescript
export const ENRICHMENT_SYSTEM = `Du bist ein B2B-Daten-Extraktor. Extrahiere aus den folgenden Website-Snippets strukturierte Firmen-Daten. Antworte NUR mit validem JSON nach Schema.`;

export const ENRICHMENT_USER = (snippets: string[]) => `
Snippets:
${snippets.map((s, i) => `[${i+1}] ${s}`).join('\n\n')}

JSON-Schema: { branche, mitarbeiterzahl, jahresumsatz, headquarter, techStack[], socialProfiles{} }
Wenn ein Feld nicht ableitbar ist: null. Keine Halluzinationen.
`;
```

### OpenAI-Call
```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: ENRICHMENT_SYSTEM },
    { role: 'user', content: ENRICHMENT_USER(snippets) }
  ],
  response_format: { type: 'json_object' },
  temperature: 0.2,  // niedrig für Fakten-Extraktion
});
```

## AGENT 2: Scoring-Worker

**Trigger:** `lead.created`, `lead.interaction` (Delayed 30 s, Debounce per Lead-ID)
**Regel-basiert** — kein LLM nötig (Kosten/Latenz-Optimierung)

### Scoring-Regeln (Score 0–100)
```typescript
function calculateScore(lead: Lead, interactions: Interaction[]): number {
  let score = 0;

  // Fit-Score (Firma passt?)
  if (lead.company.mitarbeiterzahl >= 50 && lead.company.mitarbeiterzahl <= 500) score += 20;
  if (['SaaS', 'E-Commerce', 'FinTech'].includes(lead.company.branche)) score += 15;
  if (lead.company.jahresumsatz > 1_000_000) score += 10;

  // Engagement-Score
  const opens = interactions.filter(i => i.type === 'email_open').length;
  const clicks = interactions.filter(i => i.type === 'email_click').length;
  score += Math.min(opens * 2, 10);
  score += Math.min(clicks * 5, 15);

  // Recency-Score (letzter Kontakt)
  const daysSinceLastInteraction = differenceInDays(new Date(), lead.lastInteractionAt);
  if (daysSinceLastInteraction < 7) score += 15;
  else if (daysSinceLastInteraction < 30) score += 5;

  // Profile-Vollständigkeit
  if (lead.person.email && lead.person.phone && lead.company.website) score += 10;

  return Math.min(score, 100);
}
```

**Auto-Convert-Regel:** Score ≥ 80 UND `autoConvertEnabled = true` → Lead → Deal (Stage: Erstkontakt) + Activity-Eintrag "Auto-konvertiert durch KI-Scoring (Score: {score})"

## AGENT 3: Ghosting-Detector

**Trigger:** Cron, täglich 06:00 UTC
**Zweck:** Deals, die ≥ 14 Tage ohne Response sind, markieren + Follow-up-Task erstellen

### Logik
```typescript
async detectGhosting(): Promise<void> {
  const staleDeals = await this.prisma.deal.findMany({
    where: {
      status: 'OPEN',
      lastResponseAt: { lt: subDays(new Date(), 14) },
      stage: { in: ['ErstKontakt', 'Qualifiziert', 'Angebot'] },  // nicht in "Abschluss"
      deletedAt: null,
    },
    include: { person: true, owner: true },
  });

  for (const deal of staleDeals) {
    // 1. Flag setzen
    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { isGhosted: true, ghostedAt: new Date() },
    });

    // 2. Follow-up-Task erstellen (nur 1x pro Deal)
    const existingTask = await this.prisma.task.findFirst({
      where: { dealId: deal.id, type: 'ghosting_followup', status: 'OPEN' },
    });
    if (!existingTask) {
      await this.prisma.task.create({
        data: {
          title: `Follow-up: ${deal.title} (seit ${formatDistanceToNow(deal.lastResponseAt, { locale: de })} stumm)`,
          type: 'ghosting_followup',
          dueDate: addDays(new Date(), 1),
          assigneeId: deal.ownerId,
          dealId: deal.id,
          priority: 'HIGH',
        },
      });
    }

    // 3. AIInsight loggen
    await this.prisma.aIInsight.create({
      data: {
        type: 'ghosting_detected',
        content: { dealId: deal.id, daysSilent: differenceInDays(new Date(), deal.lastResponseAt) },
        validUntil: addDays(new Date(), 30),
      }
    });
  }
}
```

## WORKER-KONFIGURATION (BullMQ)

```typescript
// apps/api/src/queues/enrichment.worker.ts
const worker = new Worker('enrichment', processJob, {
  connection: redisConnection,
  concurrency: 3,              // gleichzeitige OpenAI-Calls limitiert
  limiter: { max: 10, duration: 60_000 },  // Rate-Limit: 10/min
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Enrichment failed');
});
```

**Retry-Strategie:** 3 Retries mit exponentiellem Backoff (2s, 8s, 32s). Nach 3 Fehlschlägen → Dead-Letter-Queue + Admin-Notification.

## KOSTEN-LIMIT (NEU v3.0)

Monatliches Budget-Limit via Env-Var (`AI_MONTHLY_BUDGET_USD=100`). Täglicher Cron prüft Summe von `AIInsight.content.cost.estCostUsd` für den Monat. Bei >90 % → Slack/Email-Warnung. Bei 100 % → alle Enrichment-Jobs automatisch pausiert (`queue.pause()`).

## AKZEPTANZKRITERIEN

- [ ] AC-025: Enrichment läuft automatisch bei Lead-Anlage, fülllt min. 4 von 7 Feldern bei 80 % der Tests
- [ ] AC-026: Scoring wird bei jedem Interaktions-Event neu berechnet (Debounce 30 s)
- [ ] AC-027: Ghosting-Cron markiert korrekt und erstellt Tasks ohne Duplikate
- [ ] Serper-Fallback getestet (Mock-429-Response → Job completed mit `status: 'partial'`)
- [ ] Cost-Tracking pro Enrichment-Run vorhanden
- [ ] Idempotency-Keys verhindern Doppel-Runs
- [ ] Robots.txt wird respektiert (Mock-Test mit `Disallow: /`)
- [ ] Monats-Budget-Warnung bei >90 % ausgelöst
```

### ⏸ Checkpoint (nach Agent 1 / ca. 2,5–3 h)

```
Checkpoint Session 14:

1. Ist der Enrichment-Worker komplett (inkl. Serper-Fallback und Cost-Tracking)?
2. Welche Tests existieren bereits (Unit/Integration)?
3. Zeige mir den aktuellen Token-Verbrauch.
4. Aktualisiere docs/sessions/session-14-progress.md mit Status.

Danach fahren wir mit Agent 2 (Scoring) und Agent 3 (Ghosting) fort — bitte bestätige, dass du den Plan noch im Kontext hast.
```

### 🏁 Session-Closer & Review

Nach Abschluss zuerst den **Session-Closer** (siehe Section 2.3), dann **Review** (Section 2.4) — Session 14 ist kritisch wegen Kosten-Implikationen von OpenAI/Serper-Integration.

---

## SESSION 15 — Security & DSGVO-Härtung

| Feld | Wert |
|------|------|
| **Modell** | `claude-opus-4-7` |
| **Thinking** | `think harder` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-15-security` |
| **Dauer** | ~4–5 h |
| **Abhängigkeiten** | ALLE Vor-Sessions (0–14) |

### 📋 Pre-Session-Setup

```bash
git checkout main && git pull && git checkout -b feature/session-15-security
code CLAUDE.md apps/api/src/common/ apps/api/src/audit/ prisma/schema.prisma
```

**VSCode-Tabs öffnen:** `CLAUDE.md`, `prisma/schema.prisma` (AuditLog-Table), `apps/api/src/common/guards/`, `apps/api/src/audit/`, `apps/web/next.config.js` (Security Headers).

### 🎬 Session-Opener-Prompt

```
Ich starte jetzt Session 15 von 18: Security & DSGVO-Härtung.

Diese Session ist ein Querschnitts-Refactor über ALLE bisher implementierten Module. Sie fügt keine neuen Features hinzu, sondern härtet bestehende.

1. Lies CLAUDE.md vollständig.
2. Lies ALLE docs/sessions/session-*-summary.md (0–14) — für den vollen Kontext.
3. Lies diese Dateien:
   - prisma/schema.prisma (AuditLog-Table, AuditTrail-Felder)
   - apps/api/src/common/ (Guards, Interceptors, Filters)
   - apps/api/src/audit/
   - apps/web/next.config.js (Security Headers)
   - apps/web/middleware.ts (CSP, CSRF)
4. Antworte mit:
   - "Session 15 — Security & DSGVO"
   - Liste der bereits vorhandenen Security-Features (aus den Summaries extrahiert)
   - Liste der aus dem Pflichtenheft geforderten, aber noch FEHLENDEN Features
5. Stelle 3 Klärungsfragen (z. B. bzgl. Pen-Test-Scope, DSGVO-Export-Format, Passwort-Policy).

Nicht coden.
```

### 💻 Implementierungs-Prompt

```
think harder

Du bist Security-Engineer mit DSGVO-Expertise. Implementiere folgende Security-Hardenings über ALLE Module.

## BLOCK 1: Audit-Log (Pflicht-DSGVO)

Entity: `AuditLog { id, userId, action, entityType, entityId, ipAddress, userAgent, before Jsonb, after Jsonb, createdAt }`

**NestJS-Interceptor** (`AuditLogInterceptor`), automatisch bei allen Mutating-Requests (POST/PUT/PATCH/DELETE):

```typescript
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next.handle();

    const before = req.method !== 'POST' ? this.captureBefore(req) : null;

    return next.handle().pipe(
      tap(async (response) => {
        await this.prisma.auditLog.create({
          data: {
            userId: req.user?.id,
            action: `${req.method} ${req.route.path}`,
            entityType: this.extractEntityType(req.route.path),
            entityId: req.params.id ?? response?.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            before, after: response,
          }
        });
      })
    );
  }
}
```

**Retention:** AuditLogs **7 Jahre** (DSGVO Art. 5 Abs. 1 lit. e + handelsrechtliche Aufbewahrungspflicht). Täglicher Cron löscht Einträge älter als 7 Jahre.

## BLOCK 2: DSGVO-Export (Art. 20 Datenportabilität)

Endpoint: `GET /api/gdpr/export/:userId` (nur Admin oder User selbst)

Generiert vollständigen ZIP mit:
- `user.json` — User-Profil
- `contacts.json` — alle Contacts (Persons + Companies)
- `deals.json`, `activities.json`, `emails.json`, `tasks.json`, `projects.json`
- `audit-log.json` — alle AuditLog-Einträge zu diesem User
- `README.md` — Erklärung des Exports (DSGVO-Hinweis, Ablauf)

Streaming-ZIP via `archiver` (nicht alles in Memory laden). Datei signiert mit HMAC, Link 24 h gültig.

## BLOCK 3: Hard-Delete (Art. 17 Recht auf Löschung)

**Soft-Delete ist nicht genug** — nach 30 Tagen muss Hard-Delete erfolgen.

```typescript
// Cron täglich 03:00 UTC
@Cron('0 3 * * *')
async hardDelete(): Promise<void> {
  const thirtyDaysAgo = subDays(new Date(), 30);

  // 1. AuditLog-Eintrag VOR Löschung
  const toDelete = await this.prisma.person.findMany({
    where: { deletedAt: { lte: thirtyDaysAgo }, hardDeleteConfirmed: true },
  });
  for (const p of toDelete) {
    await this.prisma.auditLog.create({
      data: { action: 'HARD_DELETE', entityType: 'Person', entityId: p.id, before: p, after: null }
    });
  }

  // 2. Hard-Delete in Reihenfolge der FK-Abhängigkeit
  await this.prisma.$transaction([
    this.prisma.activity.deleteMany({ where: { personId: { in: toDelete.map(p => p.id) }}}),
    this.prisma.deal.deleteMany({ where: { personId: { in: toDelete.map(p => p.id) }}}),
    this.prisma.person.deleteMany({ where: { id: { in: toDelete.map(p => p.id) }}}),
  ]);
}
```

## BLOCK 4: Rate-Limiting

`@nestjs/throttler` + Redis-Store:
- Global: 100 req/min pro IP
- `/auth/login`: 5 req/15 min pro IP (Brute-Force-Schutz)
- `/auth/password-reset`: 3 req/h pro IP
- `/api/gdpr/export`: 1 req/24 h pro User
- `/api/campaigns/*/send`: 2 req/h pro User

## BLOCK 5: Security Headers (Next.js Middleware)

```typescript
// apps/web/middleware.ts
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'nonce-{NONCE}' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' wss://api.nextgen-crm.com https://api.openai.com",
    "frame-ancestors 'none'",
  ].join('; '));
  return res;
}
```

## BLOCK 6: CSRF-Schutz (NEU v3.0)

`csrf-csrf` Package (Double-Submit-Cookie-Pattern). Gilt für alle non-GET-Requests außer API-Token-basierte Calls (Bearer-Auth).

```typescript
// apps/api/src/main.ts
import { doubleCsrf } from 'csrf-csrf';

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  cookieName: '__Host-csrf',
  cookieOptions: { secure: true, sameSite: 'strict', httpOnly: true },
  size: 64,
});

app.use(doubleCsrfProtection);
```

## BLOCK 7: DOMPurify für User-HTML (NEU v3.0)

Überall, wo User-HTML gerendert wird (Campaigns, Form-Builder-Outputs, Rich-Text-Notizen):

```typescript
// apps/web/lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

export const sanitizeHtml = (dirty: string): string => DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: ['p','br','strong','em','u','a','ul','ol','li','h1','h2','h3','img','blockquote'],
  ALLOWED_ATTR: ['href','src','alt','title','target','rel'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
});
```

Verwendung im React: `<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userHtml) }} />`.

## BLOCK 8: RBAC (Rollen-basierte Zugriffskontrolle)

Rollen: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`

```typescript
@Roles('MANAGER', 'ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete(':id')
async deleteDeal(@Param('id') id: string) { /* ... */ }
```

**Row-Level-Security** (Postgres RLS) für Multi-Tenant-Readiness: aktiviert auf `Deal`, `Lead`, `Project`. Policy: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.

## BLOCK 9: Dependency-Scanning (NEU v3.0)

**Dependabot** (`.github/dependabot.yml`):
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: daily }
    open-pull-requests-limit: 10
    groups:
      minor-and-patch: { update-types: [minor, patch] }
```

**Snyk** (`.github/workflows/snyk.yml`) — Scan bei jedem PR, failt Build bei HIGH/CRITICAL Vulns.

## BLOCK 10: Passwort-Policy & Account-Security

- Mindest-12 Zeichen, 1 Upper / 1 Lower / 1 Digit / 1 Special (enforced via Zod-Schema)
- HIBP-Pwned-Passwords-API-Check (k-anonymity) beim Registrieren/Passwort-Ändern
- 2FA-Option (TOTP, `speakeasy`-Lib, QR-Code via `qrcode`)
- Account-Lockout: 5 Fehlversuche → 15 min Sperre
- Passwort-Reset-Link: 1 h gültig, One-Time-Use

## AKZEPTANZKRITERIEN

- [ ] AC-030: Alle Mutating-Requests erzeugen AuditLog-Einträge (getestet mit Mock-Request)
- [ ] AC-031: DSGVO-Export liefert vollständiges ZIP mit allen User-Daten
- [ ] AC-032: Hard-Delete-Cron läuft idempotent und respektiert FK-Order
- [ ] Rate-Limiting greift (Test: 6× Login-Versuche → 429)
- [ ] Security-Headers im Response vorhanden (Test: `curl -I` prüft)
- [ ] CSRF-Schutz blockiert Requests ohne gültiges Token
- [ ] DOMPurify entfernt `<script>` und `onerror=` in Test-Inputs
- [ ] Snyk-Scan ohne HIGH/CRITICAL-Findings
- [ ] HIBP-Check verhindert `password123` bei Registrierung
- [ ] 2FA-Flow funktioniert (TOTP-Validierung mit 30-s-Fenster)
```

### 🏁 Session-Closer & Review

Nach Abschluss **Session-Closer** + **Review** (Section 2.3/2.4). Session 15 ist kritisch — Review ist **Pflicht**. Erwäge zusätzlich einen externen Pen-Test nach Session 16b vor Production-Launch.

---

## SESSION 16a — Testing & Performance

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think hard` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-16a-testing` |
| **Dauer** | ~5–6 h |
| **Abhängigkeiten** | ALLE Vor-Sessions (0–15) |

### 📋 Pre-Session-Setup

```bash
git checkout main && git pull && git checkout -b feature/session-16a-testing
code CLAUDE.md vitest.config.ts playwright.config.ts
```

### 🎬 Session-Opener-Prompt

```
Ich starte jetzt Session 16a von 18: Testing & Performance.

1. Lies CLAUDE.md vollständig.
2. Lies ALLE docs/sessions/session-*-summary.md (0–15).
3. Liste mir auf:
   (a) welche Module bereits Tests haben (prüfe Ordner __tests__/ in jedem Modul),
   (b) Ziel-Coverage laut Pflichtenheft: Unit ≥ 80 %, Integration ≥ 60 %, E2E Happy-Paths.
4. Lies: vitest.config.ts, playwright.config.ts, package.json.
5. Antworte mit:
   - "Session 16a — Testing & Performance"
   - Test-Setup-Status (Tools installiert? CI-Integration?)
   - Lücken-Liste pro Modul

Nicht coden.
```

### 💻 Implementierungs-Prompt

```
think hard

Du bist Test-Engineer. Vervollständige die Test-Suite auf Pflichtenheft-Ziel-Coverage.

## BLOCK 1: Test-Infrastruktur

**Vitest-Config** (`apps/api/vitest.config.ts`):
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/*.module.ts', '**/main.ts', '**/*.dto.ts', '**/prisma/**'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
    setupFiles: ['./test/setup.ts'],
    globalSetup: './test/global-setup.ts',  // Test-DB hochfahren
  }
});
```

**Test-DB:** Postgres via `testcontainers` — jeder Test-Run startet saubere DB.

## BLOCK 2: Test-Data-Factories (NEU v3.0, Fishery)

```typescript
// test/factories/person.factory.ts
import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';

export const personFactory = Factory.define<Person>(({ sequence }) => ({
  id: faker.string.uuid(),
  email: `person-${sequence}@test.local`,
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  optIn: true,
  createdAt: new Date(),
  deletedAt: null,
}));

// Verwendung im Test:
const person = personFactory.build({ email: 'specific@test.local' });
const persons = personFactory.buildList(10);
```

Factories für alle Haupt-Entities: `Person`, `Company`, `Deal`, `Lead`, `Activity`, `Task`, `Project`, `Campaign`, `User`.

## BLOCK 3: Unit-Tests (Ziel 80 %)

**Fokus:** Business-Logik isoliert testen — Prisma mocken via `vitest-mock-extended`.

```typescript
// apps/api/src/leads/leads.service.spec.ts
describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new LeadsService(prisma, /* ... */);
  });

  it('should calculate score correctly for SaaS-Lead', () => {
    const lead = leadFactory.build({ company: { branche: 'SaaS', mitarbeiterzahl: 100 }});
    const score = service.calculateScore(lead, []);
    expect(score).toBeGreaterThanOrEqual(35);
  });
});
```

## BLOCK 4: Integration-Tests (Ziel 60 %)

**Fokus:** API-Endpoints gegen echte Test-DB.

```typescript
describe('POST /api/deals (integration)', () => {
  it('creates deal and emits pulse-event', async () => {
    const owner = await userFactory.create();
    const res = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Authorization', `Bearer ${jwt(owner)}`)
      .send({ title: 'Test-Deal', value: 10000, personId: '...' });

    expect(res.status).toBe(201);
    const deal = await prisma.deal.findUnique({ where: { id: res.body.id }});
    expect(deal.ownerId).toBe(owner.id);

    // WebSocket-Event-Check
    expect(pulseGateway.emit).toHaveBeenCalledWith('deal.created', expect.any(Object));
  });
});
```

## BLOCK 5: WebSocket-Test-Strategie (NEU v3.0)

```typescript
// test/helpers/ws-client.ts
import { io } from 'socket.io-client';

export async function connectTestSocket(jwtToken: string): Promise<Socket> {
  const socket = io(`http://localhost:${TEST_PORT}`, {
    auth: { token: jwtToken },
    transports: ['websocket'],
    reconnection: false,
  });
  await new Promise(res => socket.once('connect', res));
  return socket;
}

// Test
it('receives pulse-event on deal-creation', async () => {
  const socket = await connectTestSocket(jwt(owner));
  const eventPromise = new Promise(res => socket.once('deal.created', res));

  await dealsService.create({ ... });

  const event = await Promise.race([eventPromise, timeout(2000)]);
  expect(event).toMatchObject({ title: '...' });
  socket.close();
});
```

## BLOCK 6: E2E-Tests (Playwright)

**Happy-Paths:**
1. User-Registrierung → E-Mail-Verifikation → Login
2. Contact anlegen → Deal erstellen → Stage verschieben (Drag-Drop) → Close Won
3. Lead-Import (CSV) → Enrichment-Run → Auto-Convert zu Deal
4. Campaign erstellen → Empfänger auswählen → Test-Versand → Öffnungs-Rate tracken
5. Dashboard-Widget hinzufügen → Verschieben → Speichern → Refresh → persistiert

**Playwright-Setup:**
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  workers: 4,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }},
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }},
    { name: 'mobile', use: { ...devices['iPhone 14'] }},
  ],
});
```

## BLOCK 7: Performance-Tests (k6)

**Szenarien:**
- `/api/contacts` Listen-Endpoint: 100 VUs, 5 min, p95 < 300 ms
- `/api/deals/kanban` (komplexer Query): 50 VUs, 3 min, p95 < 500 ms
- WebSocket-Pulse-Feed: 500 gleichzeitige Verbindungen, 10 min

```javascript
// k6/contacts-load.js
import http from 'k6/http';
export const options = {
  vus: 100,
  duration: '5m',
  thresholds: { http_req_duration: ['p(95)<300'] },
};
export default function () {
  http.get('http://localhost:3000/api/contacts?limit=50', {
    headers: { Authorization: `Bearer ${__ENV.TEST_JWT}` },
  });
}
```

## BLOCK 8: CI-Integration

Tests laufen bei jedem PR in dieser Reihenfolge:
1. Lint + Typecheck (parallel)
2. Unit-Tests (mit Coverage-Report)
3. Integration-Tests (mit Test-DB)
4. E2E-Tests (nur auf `main`-Branch, wegen Dauer)
5. Snyk-Scan (aus Session 15)
6. Coverage < Threshold → Build fail

## AKZEPTANZKRITERIEN

- [ ] Unit-Coverage ≥ 80 % (`pnpm test:coverage` bestätigt)
- [ ] Integration-Coverage ≥ 60 %
- [ ] 5 E2E-Happy-Paths laufen in allen 3 Playwright-Projects
- [ ] k6-Load-Tests bleiben unter p95-Threshold
- [ ] Test-Data-Factories für alle Haupt-Entities existieren
- [ ] WebSocket-Tests laufen deterministisch (keine Flakes)
- [ ] CI-Pipeline blockiert Merge bei Coverage-Drop
```

### 🏁 Session-Closer

Standard Session-Closer (Section 2.3). Review optional — aber empfohlen, falls Coverage-Thresholds knapp erreicht.

---

## SESSION 16b — PWA & CI/CD-Deployment

| Feld | Wert |
|------|------|
| **Modell** | `claude-sonnet-4-6` |
| **Thinking** | `think hard` |
| **/effort** | `high` |
| **Git-Branch** | `feature/session-16b-pwa-cicd` |
| **Dauer** | ~4–5 h |
| **Abhängigkeiten** | Session 16a (grüne Tests sind Deployment-Voraussetzung) |

### 📋 Pre-Session-Setup

```bash
git checkout main && git pull && git checkout -b feature/session-16b-pwa-cicd
code CLAUDE.md apps/web/next.config.js .github/workflows/
```

### 🎬 Session-Opener-Prompt

```
Ich starte jetzt Session 16b von 18: PWA & CI/CD-Deployment (finale Session).

1. Lies CLAUDE.md vollständig.
2. Lies alle session-*-summary.md, besonders session-16a-summary.md (Test-Status).
3. Lies: apps/web/next.config.js, apps/web/public/, .github/workflows/ (falls vorhanden).
4. Antworte mit:
   - "Session 16b — PWA & CI/CD (finale Session)"
   - PWA-Setup-Status (next-pwa installiert? manifest.json vorhanden?)
   - CI-Setup-Status (welche Workflows existieren?)
   - Deployment-Target laut Pflichtenheft (EU-Region, spezifischer Provider?)
5. Frage mich nach Deployment-Credentials/Secrets-Struktur, bevor wir loslegen.

Nicht coden.
```

### 💻 Implementierungs-Prompt

```
think hard

Du bist DevOps-Engineer. Finalisiere PWA und CI/CD für Production-Launch.

## BLOCK 1: PWA-Setup (next-pwa)

```javascript
// apps/web/next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: false,  // Wichtig: kein silent Update
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.nextgen-crm\.com\/api\/(contacts|deals|leads)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 300 },
      }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }
      }
    }
  ],
});
```

## BLOCK 2: Service-Worker-Update-Strategie (NEU v3.0)

**Problem:** `skipWaiting: true` lädt neue Version silently — User arbeitet evtl. mit alter Version und verliert ungespeicherte Form-Daten.

**Lösung:** Explicit-Update-Prompt im UI:

```typescript
// apps/web/components/PWAUpdatePrompt.tsx
'use client';
export function PWAUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);  // Update verfügbar → Toast zeigen
          }
        });
      });
    });
  }, []);

  if (!waitingWorker) return null;
  return (
    <Toast>
      Neue Version verfügbar.
      <Button onClick={() => {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }}>Jetzt aktualisieren</Button>
    </Toast>
  );
}
```

## BLOCK 3: Web-App-Manifest + Multi-Size-Icons (NEU v3.0)

`apps/web/public/manifest.json`:
```json
{
  "name": "NextGen CRM",
  "short_name": "NextGen",
  "description": "B2B-CRM mit KI-Enrichment",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-72.png",  "sizes": "72x72",  "type": "image/png" },
    { "src": "/icons/icon-96.png",  "sizes": "96x96",  "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128","type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144","type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152","type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192","type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-384.png", "sizes": "384x384","type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512","type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [
    { "name": "Neuer Deal", "url": "/deals/new", "icons": [{"src":"/icons/shortcut-deal.png","sizes":"96x96"}] },
    { "name": "Pulse", "url": "/pulse" }
  ]
}
```

**Icon-Generation:** `sharp`-basiertes Node-Script in `scripts/generate-icons.js` — nimmt `logo-source-1024.png` und generiert alle 8 Größen inkl. maskable-Icons.

## BLOCK 4: Dockerfile (Production-optimiert)

Multi-Stage-Build für `apps/web` und `apps/api`:

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

## BLOCK 5: GitHub-Actions CI/CD-Pipeline

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push: { branches: [main] }

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_PASSWORD: test }
        options: --health-cmd pg_isready
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck
      - run: pnpm test:coverage
      - run: pnpm test:integration
      - uses: codecov/codecov-action@v4
      - run: pnpm --filter web build
      - run: pnpm --filter api build

  e2e:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-traces, path: apps/web/test-results/ }
```

`.github/workflows/deploy.yml` (nur `main`, nur nach grünem CI):
```yaml
name: Deploy-Production
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    environment: production  # mit Manual-Approval
    steps:
      - uses: actions/checkout@v4
      - name: Build & Push Docker
        run: |
          docker build -f apps/web/Dockerfile -t ${{secrets.REGISTRY}}/nextgen-web:${{github.sha}} .
          docker push ${{secrets.REGISTRY}}/nextgen-web:${{github.sha}}
      - name: Deploy to K8s
        run: |
          kubectl set image deployment/nextgen-web web=${{secrets.REGISTRY}}/nextgen-web:${{github.sha}}
          kubectl rollout status deployment/nextgen-web --timeout=5m
```

## BLOCK 6: Kubernetes-Manifeste (NEU v3.0)

`k8s/deployment.yaml` — 3 Replicas, Rolling-Update, Liveness/Readiness-Probes, EU-Region-Node-Selector.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: nextgen-web, namespace: nextgen-prod }
spec:
  replicas: 3
  strategy: { type: RollingUpdate, rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }}
  selector: { matchLabels: { app: nextgen-web }}
  template:
    metadata: { labels: { app: nextgen-web }}
    spec:
      nodeSelector: { topology.kubernetes.io/region: eu-central-1 }  # DSGVO
      containers:
        - name: web
          image: registry.example/nextgen-web:latest
          ports: [{ containerPort: 3000 }]
          resources:
            requests: { cpu: 250m, memory: 512Mi }
            limits: { cpu: 1000m, memory: 1Gi }
          livenessProbe:
            httpGet: { path: /api/health, port: 3000 }
            initialDelaySeconds: 30
          readinessProbe:
            httpGet: { path: /api/health, port: 3000 }
            initialDelaySeconds: 5
          envFrom: [{ secretRef: { name: nextgen-secrets }}]
---
apiVersion: v1
kind: Service
metadata: { name: nextgen-web }
spec:
  type: ClusterIP
  selector: { app: nextgen-web }
  ports: [{ port: 80, targetPort: 3000 }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nextgen-web
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls: [{ hosts: [nextgen-crm.com], secretName: nextgen-tls }]
  rules:
    - host: nextgen-crm.com
      http:
        paths: [{ path: /, pathType: Prefix, backend: { service: { name: nextgen-web, port: { number: 80 }}}}]
```

Zusätzlich: `HorizontalPodAutoscaler` (CPU 70 % → 3–10 Replicas), `NetworkPolicy` (Deny-All + explizite Allows), `PodDisruptionBudget` (`minAvailable: 2`).

## BLOCK 7: Observability

- **Logs:** strukturiert (pino), gepusht zu Loki/Grafana
- **Metrics:** Prometheus-Endpoint `/metrics` (API-Latenz, Error-Rate, BullMQ-Queue-Depth)
- **Traces:** OpenTelemetry → Tempo/Jaeger
- **Uptime:** externer Check (Uptime-Robot oder Grafana-Synthetics), 1-min-Intervall
- **Alerts:** Grafana-Alerts → PagerDuty (5xx-Rate > 1 %, p95 > 1 s, Queue-Depth > 1000)

## BLOCK 8: Backup-Strategie

- Postgres: tägliches pg_dump → S3-EU-Bucket, 30 Tage Retention
- Redis: nicht backupt (nur Cache, stateless)
- MinIO: Cross-Region-Replication innerhalb EU
- Disaster-Recovery-Playbook in `docs/runbooks/disaster-recovery.md`

## AKZEPTANZKRITERIEN

- [ ] Lighthouse-PWA-Score ≥ 95
- [ ] App installierbar auf iOS + Android (manuelle Tests)
- [ ] Service-Worker-Update-Prompt erscheint bei neuer Version (kein Silent-Update)
- [ ] Alle 8 Icon-Größen vorhanden, maskable-Icons getestet
- [ ] CI-Pipeline: grüner Build → Auto-Deploy nach `main` (mit Manual-Approval für prod)
- [ ] K8s-Deployment rolled out ohne Downtime (Rolling-Update getestet)
- [ ] Alle Pods auf EU-Region-Nodes (DSGVO)
- [ ] `/api/health` liefert 200 bei gesundem Service, 503 bei DB-Fehler
- [ ] Prometheus-Metrics exposed, Grafana-Dashboard vorhanden
- [ ] pg_dump-Cron läuft, Restore-Test erfolgreich
```

### 🏁 Session-Closer & Finale

Nach Abschluss **Session-Closer** + **optionales Review**. Nach Session 16b ist das Projekt **Production-Ready** — erwäge vor Go-Live:

1. **Externen Pen-Test** (z. B. Cobalt, HackerOne — 1–2 Wochen)
2. **Load-Test** in Production-Mirror (k6 gegen Staging mit Prod-Daten-Kopie)
3. **Soft-Launch** mit 10 % Traffic, Feature-Flag-gesteuert (LaunchDarkly / Unleash)

---

# 🎯 Abschluss-Checkliste & Git-Workflow

## Git-Branch-Strategie

```
main                    ← immer deployable, geschützt
 ├─ feature/session-0-scaffolding
 ├─ feature/session-1-db-schema
 ├─ ...
 └─ feature/session-16b-pwa-cicd
```

**Pro Session:**
1. `git checkout main && git pull`
2. `git checkout -b feature/session-{N}-{name}`
3. Session-Opener → Implementierung → Session-Closer
4. `git push -u origin feature/session-{N}-{name}`
5. Pull-Request öffnen (Template in `.github/pull_request_template.md`)
6. CI grün → Review → Merge (squash) → Branch löschen

## Pull-Request-Template

`.github/pull_request_template.md`:
```markdown
## Session {N}: {Modul}

### Was wurde gebaut
- [ ] Feature 1
- [ ] Feature 2

### Akzeptanzkriterien (aus Pflichtenheft)
- [ ] AC-0XX
- [ ] AC-0YY

### Tests
- [ ] Unit-Coverage ≥ 80 %
- [ ] Integration-Tests grün
- [ ] Manuell getestet: {Checkliste}

### Security-Review
- [ ] Keine Secrets committed
- [ ] Input-Validation vorhanden
- [ ] Authz-Checks vorhanden

### Docs
- [ ] CLAUDE.md aktualisiert
- [ ] session-{N}-summary.md erstellt
```

## Gesamt-Token-Budget (Schätzung)

| Session | Modell | Thinking | Est. Tokens (Input+Output+Thinking) | Est. Kosten |
|---------|--------|----------|-------------------------------------|-------------|
| 0 | Opus 4.7 | ultrathink | ~180 k | ~$4 |
| 1 | Opus 4.7 | ultrathink | ~220 k | ~$5 |
| 2 | Opus 4.7 | think harder | ~150 k | ~$3 |
| 3 | Sonnet 4.6 | think | ~80 k | ~$0.80 |
| 4 | Sonnet 4.6 | think hard | ~140 k | ~$1.50 |
| 5 | Opus 4.7 | ultrathink | ~260 k | ~$6 |
| 6 | Sonnet 4.6 | think hard | ~130 k | ~$1.40 |
| 7 | Sonnet 4.6 | think hard | ~140 k | ~$1.50 |
| 8 | Sonnet 4.6 | think hard | ~150 k | ~$1.60 |
| 9 | Sonnet 4.6 | think | ~110 k | ~$1.10 |
| 10 | Sonnet 4.6 | think | ~100 k | ~$1 |
| 11 | Opus 4.7 | ultrathink | ~280 k | ~$6.50 |
| 12 | Sonnet 4.6 | think hard | ~160 k | ~$1.70 |
| 13 | Sonnet 4.6 | think hard | ~140 k | ~$1.50 |
| 14 | Opus 4.7 | ultrathink | ~250 k | ~$5.80 |
| 15 | Opus 4.7 | think harder | ~200 k | ~$4.50 |
| 16a | Sonnet 4.6 | think hard | ~180 k | ~$1.90 |
| 16b | Sonnet 4.6 | think hard | ~160 k | ~$1.70 |
| **Summe** | | | **~3 M Tokens** | **~$50** |

Ein 18-Session-Projekt kostet also **ca. 50 USD** an Claude-Code-API-Tokens — deutlich günstiger als die eingesparte Entwicklungszeit.

## Abschluss-Checkliste (vor Production-Launch)

- [ ] Alle 18 Sessions grün gemergt
- [ ] Coverage-Thresholds eingehalten
- [ ] Externer Pen-Test durchgeführt (empfohlen)
- [ ] Load-Test bestanden (k6)
- [ ] DSGVO-Checkliste (AV-Verträge, Impressum, Datenschutzerklärung, Cookie-Banner)
- [ ] Monitoring + Alerting live
- [ ] Runbooks dokumentiert (`docs/runbooks/`)
- [ ] Backup + Restore-Test erfolgreich
- [ ] Domain + SSL produktiv
- [ ] Soft-Launch-Plan definiert

---

**Viel Erfolg mit dem NextGen-CRM-Projekt!** 🚀

Fragen, Verbesserungen oder Edge-Cases, die in diesem v3.0-Dokument fehlen? Ein Issue im Projekt-Repo anlegen oder einen separaten Claude-Code-Chat eröffnen mit dem Kontext `Ich habe Feedback zum DevSessions-Guide v3.0`.
