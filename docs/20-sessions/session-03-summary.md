---
title: "Session 3 — Navigation / App-Shell"
tags: [session, session-3, navigation, layout, zustand, lucide]
status: completed
date: 2026-05-10
duration: ~halber Tag
model: claude-sonnet-4-6
thinking: think
review: pending
last_updated: 2026-05-10
summary: "NavRail (60/220px), DashboardLayout 3-Spalten, 10 Stub-Pages, Zustand-UIStore mit localStorage-Persist, Mobile Bottom-Nav + Sheet. Kein Schema-Delta, keine neuen Env-Vars. 45 Web-Tests, 99.8% Coverage."
---

# Session 3 — Navigation / App-Shell

## TLDR (5 Zeilen — Agents lesen NUR diese 5 Punkte)

1. **Gebaut:** NavRail (Navy #1B2559, 60px/220px, Hamburger+Hover-Toggle, 10 Lucide-Icons, Badges für Inbox+Aktivitäten, Footer mit User-Dropdown+Logout); DashboardLayout (CSS-Flex 3 Spalten: NavRail | opt. Kontext-Sidebar 200px | Main flex-1); Zustand-UIStore (`navExpanded` persisted, `sidebarOpen` flüchtig); Mobile Bottom-Nav (< `md`) + Sheet-Slide-Over für Sidebar (< `sm`).
2. **Routing:** 10 Stub-Pages unter `app/(dashboard)/` (Pulse, Leads, Deals, Projekte, Campaigns, Inbox, Aktivitäten, Kontakte, Einblicke, Produkte). Root `/` redirectet zu `/pulse`. `(dashboard)/layout.tsx` wraps mit `DashboardLayout`.
3. **Design-Tokens:** CSS-Variablen für alle Farben, Radien, Shadow in `globals.css`; Tailwind-Theme-Extension als Aliases in `tailwind.config.ts`. `.scrollbar-hide` Utility ergänzt.
4. **Keine Schema-Änderungen, keine neuen Env-Variablen.** Neue Pakete: `lucide-react`, `zustand`.
5. **Nächste Session braucht:** Session 4 (M8 Kontakte) kann `DashboardLayout` mit `sidebar`-Prop direkt nutzen; `/contacts`-Stub existiert; `useSession()`, `apiFetch()`, `RolesGuard` aus Session 2 verfügbar.

---

## Was wurde implementiert

### Neue Pakete

| Paket | Zweck |
|-------|-------|
| `lucide-react` | Nav-Icons (Radar, Target, DollarSign, CheckSquare, Megaphone, Mail, Calendar, Users, BarChart3, Package, Settings, HelpCircle, Bell, Menu, LogOut) |
| `zustand` | UI-State-Management (navExpanded, sidebarOpen) |

### Design-Tokens (`app/globals.css` + `tailwind.config.ts`)

CSS-Variablen: `--color-primary` (#6366f1), `--color-primary-dark` (#4f46e5), `--color-success` (#22c55e), `--color-danger` (#ef4444), `--color-warning` (#f59e0b), `--color-nav-bg` (#1b2559), `--color-surface` (#ffffff), `--color-bg` (#f8fafc), `--radius-card`, `--radius-button`, `--shadow-card`. Alle als Tailwind-Aliases unter `colors.primary`, `colors.nav-bg`, `borderRadius.card`, `boxShadow.card` etc. `.scrollbar-hide` Utility für horizontale Bottom-Nav.

### `stores/ui-store.ts`

Zustand-Store mit `persist`-Middleware (Key `ui-store`, `partialize` nur `navExpanded`). `sidebarOpen` ist flüchtig. Actions: `toggleNav`, `setNavExpanded`, `toggleSidebar`, `setSidebarOpen`.

### `components/layout/NavRail.tsx`

- Hintergrund `#1B2559`, kollabiert 60px / expanded 220px
- Expanded-Logik: `isExpanded = navExpanded || hovered` (Hamburger = persistent, Hover = temporär)
- 10 Nav-Einträge mit `border-l-4` (transparent→`border-indigo-500`) + aktiver BG `#2D3882`; Hover `#252F7A`
- Badges: rote Kreise (`bg-red-500`) auf Inbox und Aktivitäten, Anzeige nur wenn `count > 0`
- Footer: Settings-Link, Help-Link, Bell-Button (kein Handler), User-Avatar mit Dropdown-Menü (role="menu"); Logout via `signOut({ callbackUrl: '/login' })`
- Click-Outside: `useRef` + `useEffect` mousedown-Listener schließt User-Dropdown
- Mobile (< `md`): Bottom-Navigation (`fixed bottom-0`, horizontaler Scroll), aktive Seite via Top-Indikator-Bar
- A11y: `aria-current="page"`, `role="navigation"` + `aria-label`, `role="menu"` + `role="menuitem"`, `aria-expanded`, `aria-haspopup`, `focus-visible:ring-2 ring-indigo-400` auf allen interaktiven Elementen

### `components/layout/DashboardLayout.tsx`

- CSS-Flex: NavRail (shrink-0, sticky) | Desktop-Sidebar (`hidden sm:block w-[200px]`, nur wenn `sidebar` prop gesetzt) | Main (`flex-1 overflow-y-auto pb-[64px] md:pb-0`)
- Mobile Sheet: Backdrop (`data-testid="sidebar-backdrop"`, `aria-hidden`) + Slide-Over (`translate-x-0/-full`), toggled via `sidebarOpen` aus UIStore
- `useEffect` schließt Sidebar automatisch bei `window.resize` ≥ 640px

### Route-Gruppe `app/(dashboard)/`

Layout wraps mit `DashboardLayout`. 10 Stub-Pages mit Placeholder-Text je Modul-Session. `app/page.tsx` ersetzt WebSocket-Echo-Demo durch `redirect('/pulse')`.

### `vitest.config.ts`

`include` und `coverage.include` erweitert auf `components/**/*.test.{ts,tsx}` und `stores/**/*.test.{ts,tsx}`.

---

## Schema-Änderungen

Keine.

## Neue Env-Variablen

Keine.

## Test-Coverage

| Package | Tests | Statements | Branches | Functions | Lines |
|---------|-------|-----------|----------|-----------|-------|
| `apps/web` | 45 (+31) | 99.8% | 93.75% | 95.83% | 99.8% |
| `apps/api` | 97 | 97.1% | 91.14% | 97.75% | 97.1% |
| `packages/db` | 3 | unverändert | — | — | — |
| `packages/utils` | 7 | unverändert | — | — | — |

Neue Testdateien: `components/layout/NavRail.test.tsx` (18 Tests), `components/layout/DashboardLayout.test.tsx` (8 Tests), `stores/ui-store.test.ts` (5 Tests).

## Bekannte Limitierungen / Tech-Debt

| ID | Beschreibung | Geplant |
|----|-------------|---------|
| TD-3-1 | Badge-Counts (`inboxCount`, `overdueCount`) Placeholder-Props (default 0) | Session 11 / 7 |
| TD-3-2 | Bell-Button ohne onClick-Handler | Session 6/7 |
| TD-3-3 | Help-Link (`/help`) nicht existent | Künftige Session |
| TD-3-4 | `settings/security`-Page ohne DashboardLayout | Session 4 oder eigenem PR |
| TD-3-5 | Kein Refresh-on-401 in `apiFetch()` (aus Session 2) | Bei Bedarf |

## ACs-Status (10/10 ✅)

- [x] AC-1: NavRail mit 10 Icons, korrekten Routes, aktiver Hervorhebung
- [x] AC-2: 60px/220px Toggle (Hamburger + Hover)
- [x] AC-3: Badges für Inbox und Aktivitäten
- [x] AC-4: Footer (Settings, Help, Bell, User-Avatar + Logout-Dropdown)
- [x] AC-5: DashboardLayout 3-Spalten mit optionaler Sidebar
- [x] AC-6: Mobile Bottom-Navigation bei md-Breakpoint
- [x] AC-7: Mobile Context-Sidebar als Sheet bei sm-Breakpoint
- [x] AC-8: Zustand-Store mit localStorage-Persist
- [x] AC-9: Design-Tokens in globals.css + Tailwind-Theme-Extension
- [x] AC-10: CLAUDE.md aktualisiert

## Review

Datei: docs/30-reviews/session-3-light-review.md (ausstehend — User soll `/review-light` in neuer Session ausführen).
