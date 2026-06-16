# E2E Tests (Playwright) — Session 16a, Block 6

**Status: scaffold.** These five happy-path specs are written against the real
app routes but are **not** part of the unit/integration quality-gate. They
require the full stack running and the browser binaries installed.

## Prerequisites

```bash
pnpm add -D @playwright/test        # already in root devDependencies
pnpm exec playwright install        # downloads Chromium/Firefox/WebKit (~500 MB)
```

A running stack on the default ports:

- web → http://localhost:3000
- api → http://localhost:3001
- Postgres + Redis (see `docker/`), with migrations applied and an E2E seed.

## Run

```bash
# against an already-running stack
pnpm exec playwright test

# or let Playwright boot `pnpm dev` itself
PLAYWRIGHT_WEB_SERVER=1 pnpm exec playwright test
```

## Happy-paths covered

1. `auth.spec.ts` — Registration → Login (2FA challenge variant noted).
2. `deals.spec.ts` — Contact → Deal → Stage drag-drop → Close Won.
3. `leads.spec.ts` — CSV lead import → Enrichment run → Auto-convert to Deal.
4. `campaigns.spec.ts` — Create campaign → pick recipients → test send → open tracking.
5. `dashboard.spec.ts` — Add widget → move → save → refresh persists.

## Known gaps (to harden before enabling in CI on every PR)

- Selectors use `getByRole`/`getByText`; some screens still need stable
  `data-testid` hooks added in the web app (tracked as a Session 16a follow-up).
- A deterministic E2E seed (fixed users/pipelines) and an isolated E2E database
  are required so runs don't depend on dev data.
- Enrichment/auto-convert (`leads.spec.ts`) needs `SERPER_API_KEY` and the
  BullMQ worker running, or a stubbed enrichment mode.
