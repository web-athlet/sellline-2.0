---
name: project-session8-leads
description: Session 8 — M2 Leads & Webformulare completed. BullMQ lead-enrichment queue, DOMPurify XSS protection, DnD form builder.
metadata:
  type: project
---

Session 8 (M2 Leads & Webformulare) completed on branch `feature/session-8-leads`.

**What was built:**
- `FormsModule`: CRUD for form definitions with DOMPurify sanitization of labels/placeholders (XSS prevention)
- `LeadsModule`: CRUD, soft-delete, `convert` (creates Person + Deal in a transaction), `reEnqueue`
- `PublicModule`: `POST /api/v1/public/forms/:id/submit` — rate-limited 5/min/IP via `@Throttle`, `@Public()`, enqueues BullMQ `lead-enrichment` job
- BullMQ queue `lead-enrichment` wired in `LeadsModule` (worker code comes in Session 14)
- `LeadEnrichedEvent` in `@nextgen/types`, `EventsGateway.emitLeadEnriched` (broadcasts to all sockets)
- Frontend: `LeadTable`, `EnrichmentBadge`, `ConvertLeadModal`, `FormBuilder` (DnD @dnd-kit 3-panel), pages at `/leads`, `/forms`, `/forms/builder`, `/forms/builder/[id]`, `/f/[id]` (public embed)

**Why:** Enables web-to-lead capture, enrichment pipeline stub, and deal conversion flow.

**How to apply:** Next session (9) builds M10 Products. The `LEAD_ENRICHMENT_QUEUE` constant is exported from `leads.service.ts` for the Session 14 worker.

**Test counts after Session 8:** 295 API tests, 321 Web tests. Quality Gate 10/10 ✅.

**Coverage:** API 86.25% stmt / 80.35% branch; Web 87.7% stmt / 83.46% branch.

**Tech-debt added:**
- FormBuilder excluded from web coverage (DnD not unit-testable)
- Public submit CORS: `@Header('Access-Control-Allow-Origin', '*')` override; full CORS middleware for cross-domain embeds deferred to Session 15
- Lead enrichment worker deferred to Session 14

[[project-session7-activities]]
