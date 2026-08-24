# Soporte a Apps (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public "Soporte a Apps" section to acaciaco-site where a visitor picks a portfolio app (or "Otra idea / app nueva"), submits Soporte/Mejora/Idea, gets a confirmation email, ACACIA gets an internal alert, and the submission shows up in Mission Control's CRM pillar filterable by type — without touching any of the 9 Base44 apps.

**Architecture:** `soporte.html` posts to a new acaciaco-site serverless handler (`api/soporte-apps.ts`), which validates + rate-limits, persists the submission server-to-server into Mission Control's `leads` table (via the existing `api/ingest/lead.js`, extended with a `type` column), and only then sends two emails via Resend. Mission Control's CRM page gets a `type` column/filter so the submissions are actually visible, not just present in `raw` JSON.

**Tech Stack:** acaciaco-site — vanilla HTML/JS, Vercel serverless functions (TypeScript, Node 22 type-stripping), Resend, `node --test`. Mission Control — Vercel serverless functions (JS/ESM), Supabase (Postgres + RLS), React/Vite, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-24-soporte-apps-design.md` (this repo).

## Global Constraints

- User-facing strings in Spanish; code identifiers and comments in English (acaciaco-site convention).
- acaciaco-site client code stays vanilla: no framework, no bundler, `createElement`/`textContent` for anything carrying user data (this page never injects untrusted HTML, so plain DOM APIs and the existing string-templating pattern from `contacto.html` are both fine here — no `innerHTML` of *submitted* data anywhere).
- Reuse `styles/base.css` tokens (`--bg-card`, `--border`, `--text`, `--radius-card`) — no hardcoded colors.
- No new CDN — `vercel.json`'s CSP only allows `'self'`, Google Fonts, unpkg, jsdelivr; this feature needs none of them.
- acaciaco-site tests: `node --test "tests/**/*.test.ts"`, files under `tests/`, never under `api/`. Any file under `api/` whose name doesn't start with `_` becomes its own Vercel function — do not add stray files there.
- acaciaco-site `api/` files that need `node --test` coverage must import nothing else non-trivial (mirrors `_adminAuth.ts`) — request-shaped code goes in the handler instead.
- Mission Control: `npm run lint` (ESLint, 0 errors) and `npm run build` (Vite) must pass. Its `node --test` picks up `*.test.js` colocated anywhere under the repo, including `api/_lib/`.
- Migrations: `add column if not exists`, matching every existing migration in `supabase/migrations/`.
- Never introduce a second source of truth for a ticket that could "live" both in Mission Control and inside an app's own backend without a real bridge write path — that's exactly why this plan targets `leads`, not `tickets` (see spec).

---

## Part A — acacia-mission-control

### Task 1: Migration — `type` column on `leads`

**Files:**
- Create: `supabase/migrations/0042_leads_type.sql`

**Interfaces:**
- Produces: `public.leads.type` (`text`, nullable, `check (type in ('soporte','mejora','idea'))`), read by Task 3 (write) and Task 4 (read/filter).

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- Soporte a Apps (Fase 1, docs/superpowers/specs/2026-08-24-soporte-apps-design.md)
-- — a visitor on acaciaco.com.mx can ask for support/an improvement on an app,
-- or propose a new app idea, without ever entering an app. Lands in `leads`
-- (NOT `tickets` — a ticket fabricated with no real SupportTicket behind it in
-- the app would break the moment an operator replied to it from the panel,
-- since a reply always writes back to the app's own backend via its
-- acaciaControl bridge; see the spec for the full reasoning).
--
-- `type` distinguishes this from an ordinary sales lead (`null`, the table's
-- original and only meaning until now).
-- ============================================================================

alter table public.leads
  add column if not exists type text check (type in ('soporte', 'mejora', 'idea'));

create index if not exists leads_type on public.leads (type);
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Apply via the Supabase MCP `apply_migration` tool (name: `leads_type`, using the SQL above), or `supabase db push` from a machine with the Supabase CLI linked to this project. Verify afterward:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'leads' and column_name = 'type';
```
Expected: one row, `type | text`.

- [ ] **Step 3: Commit**

```bash
cd /home/user/acacia-mission-control
git add supabase/migrations/0042_leads_type.sql
git commit -m "feat: add leads.type for Soporte a Apps submissions"
```

---

### Task 2: Pure `type` validator + test

**Files:**
- Create: `api/_lib/leadType.js`
- Create: `api/_lib/leadType.test.js`

**Interfaces:**
- Produces: `normalizeLeadType(v: unknown): 'soporte'|'mejora'|'idea'|null`, `LEAD_TYPES: string[]` — consumed by Task 3's `api/ingest/lead.js`.

- [ ] **Step 1: Write the failing test**

```js
// api/_lib/leadType.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLeadType, LEAD_TYPES } from './leadType.js'

test('normalizeLeadType accepts each known type', () => {
  for (const t of LEAD_TYPES) assert.equal(normalizeLeadType(t), t)
})

test('normalizeLeadType is case-insensitive and trims', () => {
  assert.equal(normalizeLeadType(' Soporte '), 'soporte')
})

test('normalizeLeadType rejects unknown values to null', () => {
  assert.equal(normalizeLeadType('urgente'), null)
  assert.equal(normalizeLeadType(''), null)
})

test('normalizeLeadType passes through null/undefined as null', () => {
  assert.equal(normalizeLeadType(null), null)
  assert.equal(normalizeLeadType(undefined), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/acacia-mission-control && node --test api/_lib/leadType.test.js`
Expected: FAIL — `Cannot find module './leadType.js'`

- [ ] **Step 3: Write the implementation**

```js
// api/_lib/leadType.js
// Pure, import-free so it's independently unit-testable (same reasoning as
// acaciaco-site's api/roseta/_adminAuth.ts: keep validation logic free of
// imports that would need a bundler). `null` keeps meaning "ordinary sales
// lead" — only acaciaco-site's api/soporte-apps.ts ever sends a `type`.
export const LEAD_TYPES = ['soporte', 'mejora', 'idea']

export function normalizeLeadType(v) {
  if (v == null) return null
  const s = String(v).trim().toLowerCase()
  return LEAD_TYPES.includes(s) ? s : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api/_lib/leadType.test.js`
Expected: PASS — 4 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add api/_lib/leadType.js api/_lib/leadType.test.js
git commit -m "feat: add normalizeLeadType helper"
```

---

### Task 3: Extend `api/ingest/lead.js` to persist `type`

**Files:**
- Modify: `api/ingest/lead.js`

**Interfaces:**
- Consumes: `normalizeLeadType` from Task 2 (`api/_lib/leadType.js`).
- Produces: `POST /api/ingest/lead` now accepts an optional `type` field in the JSON body; unchanged for every existing caller that doesn't send one.

- [ ] **Step 1: Write the full updated file**

```js
// api/ingest/lead.js
// Public lead ingest. The acaciaco.com.mx contact form (and any landing) can POST
// a lead here; it lands in the bodega's `leads` table (status 'new') for the CRM
// pillar. Validated + length-capped; CORS-open (it's a public form target). If
// INGEST_LEAD_SECRET is set, an `x-lead-secret` header must match.
//
// `type` ('soporte'|'mejora'|'idea') is optional — omitted, it's an ordinary
// sales lead same as always. Set by acaciaco-site's Soporte a Apps form
// (Fase 1, docs/superpowers/specs/2026-08-24-soporte-apps-design.md there).
import { supabaseAdmin, requireSupabase } from '../_lib/supabaseAdmin.js'
import { normalizeLeadType } from '../_lib/leadType.js'

const cap = (v, n) => (v == null ? null : String(v).slice(0, n))
const looksEmail = (e) => typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-lead-secret')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  if (!requireSupabase(res)) return

  const secret = process.env.INGEST_LEAD_SECRET
  if (secret && req.headers['x-lead-secret'] !== secret) return res.status(401).json({ error: 'unauthorized' })

  const b = req.body ?? {}
  const name = cap(b.name, 200)
  const email = cap(b.email, 255)
  if (!name && !looksEmail(email)) return res.status(400).json({ error: 'se requiere nombre o email válido' })

  const lead = {
    source: cap(b.source, 80) || 'acaciaco.com.mx',
    name, email: looksEmail(email) ? email : null,
    phone: cap(b.phone, 40),
    app_interest: cap(b.app_interest ?? b.interest, 80),
    message: cap(b.message, 4000),
    type: normalizeLeadType(b.type),
    status: 'new',
    raw: typeof b === 'object' ? b : {},
  }
  const { error } = await supabaseAdmin.from('leads').insert(lead)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ ok: true })
}
```

- [ ] **Step 2: Verify existing behavior is unchanged**

Run: `cd /home/user/acacia-mission-control && npm run lint`
Expected: 0 errors.

This handler has no dedicated test file today (confirmed: no `lead.test.js` exists) — the change is additive (one new optional field, defaulting to `null` exactly as before), so no regression test is added here; Task 4 verifies `type` end-to-end through the UI once both sides exist.

- [ ] **Step 3: Commit**

```bash
git add api/ingest/lead.js
git commit -m "feat: accept optional type on lead ingest"
```

---

### Task 4: `type` column + filter on the CRM page

**Files:**
- Modify: `src/pages/CRM.jsx`

**Interfaces:**
- Consumes: `Badge`, `FilterChips` from `src/components/ui.jsx` (existing: `Badge({tone, children, title, className})`, `FilterChips({options, value, onChange, ariaLabel})` where each option is `{value, label, count}`).
- Consumes: `leads.type` column (Task 1).

- [ ] **Step 1: Write the full updated file**

```jsx
// src/pages/CRM.jsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageHeader, StatCard } from '../components/PageHeader.jsx'
import { Badge, FilterChips } from '../components/ui.jsx'

const PIPELINE = ['new', 'contacted', 'qualified', 'won', 'lost']
const STATUS_LABEL = { new: 'Nuevo', contacted: 'Contactado', qualified: 'Calificado', won: 'Ganado', lost: 'Perdido' }
const STATUS_STYLE = {
  new: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  contacted: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
  qualified: 'bg-violet-50 text-violet-700',
  won: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  lost: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
}
// `type` distinguishes a Soporte a Apps submission (acaciaco-site) from an
// ordinary sales lead (`null` — the table's original and only meaning).
const TYPE_LABEL = { soporte: 'Soporte', mejora: 'Mejora', idea: 'Idea / app nueva' }
const TYPE_TONE = { soporte: 'bad', mejora: 'info', idea: 'ok' }
const TYPE_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'sales', label: 'Ventas' },
  { value: 'soporte', label: 'Soporte' },
  { value: 'mejora', label: 'Mejora' },
  { value: 'idea', label: 'Idea / app nueva' },
]

export function CRM() {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(null)
  const [flash, setFlash] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')

  function load() {
    return supabase.from('leads')
      .select('id, source, name, email, phone, app_interest, message, status, type, created_at')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => { if (error) console.error(error.message); setRows(data ?? []) })
  }
  useEffect(() => { load() }, [])

  async function setStatus(id, status) {
    setBusy(id); setFlash(null)
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (error) setFlash({ ok: false, msg: error.message })
    else setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    setBusy(null)
  }

  const kpis = useMemo(() => {
    const r = rows ?? []
    const weekAgo = Date.now() - 7 * 86_400_000
    const byStatus = {}
    let fresh = 0
    for (const l of r) {
      byStatus[l.status ?? 'new'] = (byStatus[l.status ?? 'new'] ?? 0) + 1
      if (new Date(l.created_at).getTime() >= weekAgo) fresh++
    }
    return { total: r.length, fresh, won: byStatus.won ?? 0, open: (byStatus.new ?? 0) + (byStatus.contacted ?? 0) + (byStatus.qualified ?? 0), byStatus }
  }, [rows])

  const typeOptions = useMemo(() => {
    const r = rows ?? []
    const counts = { all: r.length, sales: 0, soporte: 0, mejora: 0, idea: 0 }
    for (const l of r) counts[l.type ?? 'sales'] = (counts[l.type ?? 'sales'] ?? 0) + 1
    return TYPE_FILTERS.map((f) => ({ ...f, count: counts[f.value] ?? 0 }))
  }, [rows])

  const filteredRows = useMemo(() => {
    const r = rows ?? []
    if (typeFilter === 'all') return r
    if (typeFilter === 'sales') return r.filter((l) => !l.type)
    return r.filter((l) => l.type === typeFilter)
  }, [rows, typeFilter])

  if (rows === null) return (<div><PageHeader title="CRM" /><p className="text-sm text-ink-mute">Cargando…</p></div>)

  return (
    <div>
      <PageHeader title="CRM" subtitle="Leads del sitio y seguimiento de pipeline." />
      {flash && <p className={`mb-4 text-sm ${flash.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{flash.msg}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Leads" value={kpis.total} hint={`${kpis.fresh} nuevos ≤7d`} />
        <StatCard label="Abiertos" value={kpis.open} accent hint="por trabajar" />
        <StatCard label="Ganados" value={kpis.won} />
        <StatCard label="Perdidos" value={kpis.byStatus.lost ?? 0} />
      </div>

      <div className="mt-6">
        <FilterChips options={typeOptions} value={typeFilter} onChange={setTypeFilter} ariaLabel="Filtrar por tipo" />
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-hair bg-paper-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-mute border-b border-hair">
            <tr>
              <th className="px-4 py-3">Lead</th><th className="px-4 py-3">Interés</th><th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Origen</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Mover a</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-b border-hair last:border-0 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{r.name ?? '—'}</div>
                  <div className="text-xs text-ink-faint">{r.email ?? ''}{r.phone ? ` · ${r.phone}` : ''}</div>
                  {r.message && <div className="mt-1 max-w-xs truncate text-xs text-ink-mute" title={r.message}>{r.message}</div>}
                </td>
                <td className="px-4 py-3 text-ink-soft">{r.app_interest ?? '—'}</td>
                <td className="px-4 py-3">{r.type ? <Badge tone={TYPE_TONE[r.type] ?? 'neutral'}>{TYPE_LABEL[r.type] ?? r.type}</Badge> : <span className="text-ink-faint">Venta</span>}</td>
                <td className="px-4 py-3 text-ink-faint">{r.source ?? '—'}</td>
                <td className="px-4 py-3 text-ink-soft">{r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX') : '—'}</td>
                <td className="px-4 py-3"><span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? 'bg-paper-subtle text-ink-mute'}`}>{STATUS_LABEL[r.status] ?? r.status ?? '—'}</span></td>
                <td className="px-4 py-3">
                  <select value="" disabled={busy === r.id} onChange={(e) => e.target.value && setStatus(r.id, e.target.value)}
                    className="rounded-md border border-hair bg-paper-card px-2 py-1 text-xs text-ink disabled:opacity-50">
                    <option value="">{busy === r.id ? '…' : 'Cambiar…'}</option>
                    {PIPELINE.filter((s) => s !== r.status).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-4 text-ink-faint">{rows.length === 0 ? <>Sin leads aún. Conecta el formulario de acaciaco.com.mx al endpoint <code className="font-mono text-ink">/api/ingest/lead</code> y entrarán aquí.</> : 'Sin resultados para este filtro.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds and lints**

Run: `cd /home/user/acacia-mission-control && npm run lint && npm run build`
Expected: both pass, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/CRM.jsx
git commit -m "feat: show and filter leads by type in the CRM page"
```

---

### Task 5: Verify Part A end-to-end

- [ ] **Step 1: Full repo check**

Run: `cd /home/user/acacia-mission-control && npm run lint && npm run build && npm test`
Expected: all pass, including the new `api/_lib/leadType.test.js`.

- [ ] **Step 2: Push**

```bash
git push
```

---

## Part B — acaciaco-site

### Task 6: `.env.example` additions

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append the new block**

Add to the end of `.env.example`:

```
# --- Soporte a Apps (api/soporte-apps.ts) ---

# Mission Control's public lead-ingest endpoint. Defaults to production if unset.
MISSION_CONTROL_INGEST_URL=https://control.acaciaco.com.mx/api/ingest/lead

# Optional shared secret Mission Control's api/ingest/lead.js checks via the
# `x-lead-secret` header (its own env var is INGEST_LEAD_SECRET too — the two
# must match). Leave unset to match the existing acaciaco.com.mx/contacto lead
# form's current behavior (no secret sent, none required).
INGEST_LEAD_SECRET=

# Resend sender identity for Soporte a Apps' two emails (internal alert +
# confirmation to the visitor). Deliberately separate from RESEND_FROM_EMAIL
# above — that one is branded "Roseta Café" for the invoice flow, which would
# be the wrong branding here. Requires a domain verified in Resend (same
# account as RESEND_API_KEY).
SOPORTE_RESEND_FROM_EMAIL="ACACIA <soporte@acaciaco.com.mx>"

# Who receives the internal alert when someone submits Soporte a Apps
# (comma-separated). Defaults to soporte@acaciaco.com.mx,h.josepablo@gmail.com
# when unset — same default Mission Control's own SUPPORT_ALERT_EMAILS uses.
SUPPORT_APPS_NOTIFY_EMAIL=
```

- [ ] **Step 2: Commit**

```bash
cd /home/user/acaciaco-site
git add .env.example
git commit -m "docs: document Soporte a Apps env vars"
```

---

### Task 7: Rate limiter for the new handler

**Files:**
- Create: `api/_ratelimit.ts`

**Interfaces:**
- Produces: `isRateLimited(key: string, windowMs: number, max: number): boolean`, `getClientKey(req: VercelRequest): string` — consumed by Task 9.

This duplicates `api/roseta/_ratelimit.ts` on purpose, as a fresh top-level copy — it stays generically named and outside `api/roseta/` so `soporte-apps.ts` doesn't reach into a directory scoped to a different flow. Matches this repo's existing pattern of small colocated `_`-prefixed helpers with no cross-directory imports.

- [ ] **Step 1: Write the file**

```ts
// api/_ratelimit.ts
import type { VercelRequest } from "@vercel/node";

// Simple in-memory sliding-window rate limit — same pattern as
// api/roseta/_ratelimit.ts, duplicated here rather than imported across
// directories (each api/ subtree in this repo keeps its own colocated
// copies of small stateless helpers, so touching one flow never risks
// another). Persists across warm invocations, resets on cold start; good
// enough for a low-traffic public form, not meant to survive a distributed
// serverless fleet at scale.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const recent = (hits.get(key) || []).filter((ts) => ts > windowStart);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) hits.clear(); // guard against unbounded growth
  return recent.length > max;
}

export function getClientKey(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const ip = Array.isArray(fwd) ? fwd[0] : (fwd || "").split(",")[0].trim();
  return ip || req.socket?.remoteAddress || "unknown";
}
```

- [ ] **Step 2: Commit**

```bash
git add api/_ratelimit.ts
git commit -m "feat: add top-level rate limiter for soporte-apps"
```

---

### Task 8: Pure submission validator + test

**Files:**
- Create: `api/_soporteValidation.ts`
- Test: `tests/soporteValidation.test.ts`

**Interfaces:**
- Produces: `validateSoporteSubmission(body: Record<string, unknown>): ValidationResult`, `KNOWN_APPS: readonly string[]`, types `SoporteType`, `SoporteSubmission`, `ValidationResult` — consumed by Task 9's `api/soporte-apps.ts` and by `soporte.html`'s `<option>` values (Task 10, kept in sync by hand since one side is a static HTML file).

- [ ] **Step 1: Write the failing test**

```ts
// tests/soporteValidation.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSoporteSubmission, KNOWN_APPS } from "../api/_soporteValidation.ts";

test("accepts a valid soporte submission for a known app", () => {
  const r = validateSoporteSubmission({
    name: "Ana Pérez", email: "ana@example.com",
    app_interest: "StockFlow", type: "soporte", message: "No me deja guardar un gasto.",
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { name: "Ana Pérez", email: "ana@example.com", appInterest: "StockFlow", type: "soporte", message: "No me deja guardar un gasto." });
});

test("accepts mejora the same way", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "Rumbo", type: "mejora", message: "Sería útil exportar a Excel." });
  assert.equal(r.ok, true);
  assert.equal(r.data?.type, "mejora");
});

test("__idea__ sentinel with an explicit non-idea type is rejected, not silently overridden", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "__idea__", type: "soporte", message: "Deberían tener una app para X." });
  assert.equal(r.ok, false);
});

test("__idea__ sentinel with no type (or type=idea) succeeds with appInterest null", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "__idea__", message: "Deberían tener una app para X." });
  assert.equal(r.ok, true);
  assert.equal(r.data?.appInterest, null);
  assert.equal(r.data?.type, "idea");
});

test("rejects an unknown app name", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "AppQueNoExiste", type: "soporte", message: "x" });
  assert.equal(r.ok, false);
});

test("rejects missing name", () => {
  const r = validateSoporteSubmission({ email: "a@a.com", app_interest: "StockFlow", type: "soporte", message: "x" });
  assert.equal(r.ok, false);
});

test("rejects invalid email", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "no-es-correo", app_interest: "StockFlow", type: "soporte", message: "x" });
  assert.equal(r.ok, false);
});

test("rejects empty message", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "StockFlow", type: "soporte", message: "   " });
  assert.equal(r.ok, false);
});

test("rejects a real app with neither soporte nor mejora as type", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "StockFlow", type: "idea", message: "x" });
  assert.equal(r.ok, false);
});

test("KNOWN_APPS has the 9 portfolio apps, matching the sales lead form's dropdown text", () => {
  assert.deepEqual(KNOWN_APPS, ["Puntos+", "FlowFin", "StockFlow", "Rumbo", "LIUMA", "CateqHub", "RADAR", "CtrlHQ", "KitchOps"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/acaciaco-site && node --test tests/soporteValidation.test.ts`
Expected: FAIL — `Cannot find module '../api/_soporteValidation.ts'`

- [ ] **Step 3: Write the implementation**

```ts
// api/_soporteValidation.ts
// Pure validation for Soporte a Apps (api/soporte-apps.ts). No imports, so
// `node --test` can load this directly — same reasoning as
// api/roseta/_adminAuth.ts: the request-shaped code that needs _ratelimit
// lives in the handler, not here.

export const KNOWN_APPS = [
  "Puntos+", "FlowFin", "StockFlow", "Rumbo", "LIUMA",
  "CateqHub", "RADAR", "CtrlHQ", "KitchOps",
] as const;

export type SoporteType = "soporte" | "mejora" | "idea";

export interface SoporteSubmission {
  name: string;
  email: string;
  appInterest: string | null; // null → "Otra idea / app nueva"
  type: SoporteType;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  data?: SoporteSubmission;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// The client sends the sentinel "__idea__" for "Otra idea / app nueva" (see
// soporte.html) — this is the one place that sentinel is interpreted.
export function validateSoporteSubmission(body: Record<string, unknown>): ValidationResult {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const rawApp = String(body.app_interest ?? "").trim();
  const rawType = String(body.type ?? "").trim();

  if (!required(name) || name.length > 200) return { ok: false, error: "Nombre inválido." };
  if (!EMAIL_RE.test(email) || email.length > 255) return { ok: false, error: "Correo inválido." };
  if (!required(message) || message.length > 4000) return { ok: false, error: "Escribe tu mensaje (máx. 4000 caracteres)." };

  const isIdea = rawApp === "__idea__";
  const appInterest = isIdea ? null : rawApp;

  if (!isIdea && !(KNOWN_APPS as readonly string[]).includes(appInterest as string)) {
    return { ok: false, error: "Elige una app válida." };
  }

  // The invariant the spec's decisions table describes: type is fixed to
  // "idea" when there's no real app, and must be soporte/mejora otherwise —
  // enforced here too, not just by hiding the selector client-side.
  if (isIdea) {
    if (rawType !== "" && rawType !== "idea") return { ok: false, error: "Tipo inválido para una idea nueva." };
    return { ok: true, data: { name, email, appInterest: null, type: "idea", message } };
  }
  if (rawType !== "soporte" && rawType !== "mejora") {
    return { ok: false, error: "Elige Soporte o Mejora." };
  }
  return { ok: true, data: { name, email, appInterest, type: rawType, message } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/soporteValidation.test.ts`
Expected: PASS — 9 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add api/_soporteValidation.ts tests/soporteValidation.test.ts
git commit -m "feat: add Soporte a Apps submission validator"
```

---

### Task 9: `api/soporte-apps.ts` handler

**Files:**
- Create: `api/soporte-apps.ts`

**Interfaces:**
- Consumes: `isRateLimited`, `getClientKey` (Task 7); `validateSoporteSubmission` (Task 8); env vars from Task 6.
- Produces: `POST /api/soporte-apps` — request body `{name, email, app_interest, type?, message, website?}` (`website` is the honeypot), response `{ok: true}` / `{ok: false, error}`. Consumed by `soporte.html` (Task 10).

- [ ] **Step 1: Write the file**

```ts
// api/soporte-apps.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { getClientKey, isRateLimited } from "./_ratelimit";
import { validateSoporteSubmission } from "./_soporteValidation";

function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const TYPE_LABEL: Record<string, string> = { soporte: "Soporte", mejora: "Mejora", idea: "Idea / app nueva" };

interface SubmissionData {
  name: string;
  email: string;
  appInterest: string | null;
  type: string;
  message: string;
}

async function sendInternalAlert(resend: Resend, from: string, data: SubmissionData): Promise<void> {
  const to = (process.env.SUPPORT_APPS_NOTIFY_EMAIL || "soporte@acaciaco.com.mx,h.josepablo@gmail.com")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const html =
    `<h2>${TYPE_LABEL[data.type] ?? data.type} — Soporte a Apps</h2>` +
    `<p><strong>App:</strong> ${escapeHtml(data.appInterest ?? "— (idea / app nueva)")}</p>` +
    `<p><strong>Nombre:</strong> ${escapeHtml(data.name)}</p>` +
    `<p><strong>Correo:</strong> ${escapeHtml(data.email)}</p>` +
    `<p><strong>Mensaje:</strong></p><p>${escapeHtml(data.message).replace(/\n/g, "<br/>")}</p>`;
  const result = await resend.emails.send({
    from, to, replyTo: data.email,
    subject: `${TYPE_LABEL[data.type] ?? data.type}${data.appInterest ? " · " + data.appInterest : ""} — acaciaco.com.mx/soporte`,
    html,
  });
  if (result.error) console.error("Resend error (internal alert)", result.error);
}

async function sendConfirmationEmail(resend: Resend, from: string, data: SubmissionData): Promise<void> {
  const typeLabel = data.type === "idea" ? "idea" : (TYPE_LABEL[data.type] ?? data.type).toLowerCase();
  const html =
    `<h2>¡Recibimos tu solicitud!</h2>` +
    `<p>Hola ${escapeHtml(data.name)}, confirmamos que recibimos tu ${typeLabel}.</p>` +
    `<p>Te contactamos en menos de 24 horas hábiles.</p>` +
    `<p>¿Dudas mientras tanto? Responde a este correo o escríbenos por WhatsApp al 449 895 8291.</p>` +
    `<p style="margin-top:16px;color:#888;font-size:12px;">ACACIA · acaciaco.com.mx</p>`;
  try {
    const result = await resend.emails.send({
      from, to: [data.email],
      subject: "Recibimos tu solicitud · ACACIA",
      html,
    });
    if (result.error) console.error("Resend error (confirmation)", result.error);
  } catch (err) {
    console.error("Confirmation email failed", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    if (isRateLimited("soporte-apps:" + getClientKey(req), 60 * 60_000, 5)) {
      return res.status(429).json({ ok: false, error: "Demasiadas solicitudes, intenta de nuevo más tarde." });
    }

    const body = req.body || {};

    // Honeypot: real visitors never fill this hidden field. Respond as if it
    // worked so a bot doesn't learn the check exists, but do nothing further
    // — no ingest call, no email.
    if (required(body.website)) {
      return res.status(200).json({ ok: true });
    }

    const validation = validateSoporteSubmission(body);
    if (!validation.ok || !validation.data) {
      return res.status(400).json({ ok: false, error: validation.error || "Revisa los datos del formulario." });
    }
    const data = validation.data;

    // 1) Persist in Mission Control FIRST — this is what "que cada app vea
    // sus tickets" depends on. If this fails, no email goes out either:
    // there would be nothing for either message to confirm. This is the
    // inverse of api/roseta/factura-submit.ts's mail-first order, on purpose
    // — see the spec's "Orden escritura/correo" decision.
    const ingestUrl = process.env.MISSION_CONTROL_INGEST_URL || "https://control.acaciaco.com.mx/api/ingest/lead";
    const ingestSecret = process.env.INGEST_LEAD_SECRET;
    let ingestOk = false;
    try {
      const ingestRes = await fetch(ingestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(ingestSecret ? { "x-lead-secret": ingestSecret } : {}),
        },
        body: JSON.stringify({
          source: "acaciaco.com.mx/soporte",
          name: data.name,
          email: data.email,
          app_interest: data.appInterest,
          type: data.type,
          message: data.message,
        }),
      });
      ingestOk = ingestRes.ok;
      if (!ingestOk) console.error("Mission Control ingest failed", ingestRes.status, await ingestRes.text());
    } catch (err) {
      console.error("Mission Control ingest request failed", err);
    }
    if (!ingestOk) {
      return res.status(502).json({ ok: false, error: "No se pudo enviar tu solicitud, intenta de nuevo en un momento." });
    }

    // 2) Only now the two emails — best-effort each, but their failure must
    // never look like the request itself failed: the submission is already
    // saved in Mission Control by this point.
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      const from = process.env.SOPORTE_RESEND_FROM_EMAIL || "ACACIA <soporte@acaciaco.com.mx>";
      try {
        await sendInternalAlert(resend, from, data);
      } catch (err) {
        console.error("Internal alert email failed", err);
      }
      await sendConfirmationEmail(resend, from, data);
    } else {
      console.error("RESEND_API_KEY not configured — Soporte a Apps submission saved but no email sent");
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." });
  }
}
```

- [ ] **Step 2: Manual smoke check against a local dev server**

This handler has no dedicated test file — same as `api/roseta/factura-submit.ts`, which also has none (only its pure helpers do; `_soporteValidation.ts` already covers the branching logic in Task 8). Verify by running it:

Run: `npx vercel dev` (needs `RESEND_API_KEY` etc. set locally, or it degrades gracefully per the `if (apiKey)` branch above)

Then, in another terminal:
```bash
curl -s -X POST http://localhost:3000/api/soporte-apps \
  -H 'content-type: application/json' \
  -d '{"name":"Prueba","email":"prueba@example.com","app_interest":"StockFlow","type":"soporte","message":"Prueba de humo"}'
```
Expected: `{"ok":true}` (or `{"ok":false,"error":"No se pudo enviar tu solicitud, intenta de nuevo en un momento."}` if `MISSION_CONTROL_INGEST_URL` isn't reachable from this environment — expected in a sandbox per every CLAUDE.md in this portfolio; confirm the full path against a real preview deploy instead, see Task 12).

Also check the honeypot and rate limit:
```bash
curl -s -X POST http://localhost:3000/api/soporte-apps \
  -H 'content-type: application/json' \
  -d '{"name":"Bot","email":"a@a.com","app_interest":"StockFlow","type":"soporte","message":"x","website":"http://spam.example"}'
```
Expected: `{"ok":true}` with no email/ingest call (check the server log — no "Mission Control ingest" line should print).

- [ ] **Step 3: Commit**

```bash
git add api/soporte-apps.ts
git commit -m "feat: add Soporte a Apps handler"
```

---

### Task 10: `soporte.html` page

**Files:**
- Create: `soporte.html`

**Interfaces:**
- Consumes: `POST /api/soporte-apps` (Task 9). Dropdown `<option value>` set must stay in sync with `KNOWN_APPS` in `api/_soporteValidation.ts` (Task 8) — both list the same 9 apps by hand, no shared source (this repo has no build step to generate one from the other).

- [ ] **Step 1: Write the file**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Soporte a Apps · ACACIA</title>
  <meta name="description" content="Pide soporte o una mejora para cualquier app del portafolio ACACIA, o propón una idea para una app nueva. Te contactamos en menos de 24 horas hábiles." />
  <link rel="canonical" href="https://acaciaco.com.mx/soporte" />

  <meta property="og:type" content="website" />
  <meta property="og:locale" content="es_MX" />
  <meta property="og:url" content="https://acaciaco.com.mx/soporte" />
  <meta property="og:title" content="Soporte a Apps · ACACIA" />
  <meta property="og:description" content="Pide soporte o una mejora para cualquier app del portafolio ACACIA, o propón una idea para una app nueva." />
  <meta property="og:image" content="https://acaciaco.com.mx/assets/acacia-og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="ACACIA Consultoría" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Soporte a Apps · ACACIA" />
  <meta name="twitter:description" content="Pide soporte o una mejora para cualquier app del portafolio ACACIA, o propón una idea para una app nueva." />
  <meta name="twitter:image" content="https://acaciaco.com.mx/assets/acacia-og.png" />

  <link rel="icon" href="/assets/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet" />

  <script>
    (function () {
      try {
        var p = localStorage.getItem('acacia-theme');
        if (p !== 'light' && p !== 'dark') p = 'system';
        var d = p === 'dark' || (p === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
        document.documentElement.style.colorScheme = d ? 'dark' : 'light';
      } catch (e) {}
    })();
  </script>

  <link rel="stylesheet" href="/styles/base.css" />

  <style>
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
    .hp-field{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;}
  </style>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": "Soporte a Apps — ACACIA Consultoría",
    "url": "https://acaciaco.com.mx/soporte"
  }
  </script>
</head>

<body>
  <a class="skip-link" href="#main">Saltar al contenido principal</a>

  <!-- NAV -->
  <header class="site-nav" role="banner">
    <div class="nav-inner">
      <a href="/" class="brand" aria-label="ACACIA inicio">
        <img src="/assets/acacia-logo.jpg" alt="ACACIA" width="32" height="32" />
        ACACIA
      </a>
      <nav aria-label="Navegación principal">
        <ul class="nav-links" role="list">
          <li><a href="/#como-trabajamos">Soluciones</a></li>
          <li><a href="/#como-trabajamos">Cómo trabajamos</a></li>
          <li><a href="/#apps">Apps</a></li>
          <li><a href="/servicios">Servicios</a></li>
          <li><a href="/contacto">Contacto</a></li>
        </ul>
      </nav>
      <div class="nav-tools">
        <div class="currency-toggle" role="group" aria-label="Moneda">
          <button data-currency="MXN" aria-pressed="true" class="active">MXN</button>
          <button data-currency="USD" aria-pressed="false">USD</button>
        </div>
        <a href="/contacto" class="btn btn-primary btn-sm nav-cta">Iniciar</a>
        <button class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Abrir menú">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </div>
  </header>

  <main id="main">

    <!-- HERO -->
    <section class="section" aria-labelledby="sop-h1" style="padding-block: clamp(6rem, 12vw, 10rem) clamp(3rem, 5vw, 4rem);">
      <div class="container">
        <div class="reveal" style="max-width:640px;">
          <span class="eyebrow"><span class="dot" aria-hidden="true"></span> Soporte a Apps</span>
          <h1 id="sop-h1">¿Necesitas ayuda con una app, o tienes una idea?</h1>
          <p class="lead">Elige la app, cuéntanos qué pasa o qué te gustaría, y te contactamos en menos de 24 horas hábiles. ¿Buscas hablar de un proyecto nuevo o una cotización? Ve a <a href="/contacto">Contacto</a>.</p>
        </div>
      </div>
    </section>

    <!-- FORM -->
    <section class="section" style="padding-top:0;" aria-labelledby="sop-form-h2">
      <div class="container">
        <h2 id="sop-form-h2" class="sr-only">Formulario de soporte</h2>
        <div class="reveal" style="max-width:640px;margin:0 auto;">
          <form id="soporte-form" style="display:grid;gap:.9rem;">
            <label for="sop-app">App</label>
            <select id="sop-app" name="app_interest" required style="width:100%;padding:.8rem 1rem;border:1px solid var(--border);border-radius:.7rem;font:inherit;background:var(--bg-card);color:var(--text);">
              <option value="" disabled selected>Elige una app…</option>
              <option value="Puntos+">Puntos+</option>
              <option value="FlowFin">FlowFin</option>
              <option value="StockFlow">StockFlow</option>
              <option value="Rumbo">Rumbo</option>
              <option value="LIUMA">LIUMA</option>
              <option value="CateqHub">CateqHub</option>
              <option value="RADAR">RADAR</option>
              <option value="CtrlHQ">CtrlHQ</option>
              <option value="KitchOps">KitchOps</option>
              <option value="__idea__">Otra idea / app nueva</option>
            </select>

            <div id="sop-type-wrap">
              <label class="sr-only" for="sop-type">Tipo</label>
              <select id="sop-type" name="type" style="width:100%;padding:.8rem 1rem;border:1px solid var(--border);border-radius:.7rem;font:inherit;background:var(--bg-card);color:var(--text);">
                <option value="soporte">Soporte — algo no funciona</option>
                <option value="mejora">Mejora — una sugerencia</option>
              </select>
            </div>

            <label class="sr-only" for="sop-name">Nombre</label>
            <input id="sop-name" name="name" required maxlength="200" placeholder="Nombre" style="width:100%;padding:.8rem 1rem;border:1px solid var(--border);border-radius:.7rem;font:inherit;background:var(--bg-card);color:var(--text);" />

            <label class="sr-only" for="sop-email">Correo</label>
            <input id="sop-email" name="email" type="email" required maxlength="255" placeholder="Correo" style="width:100%;padding:.8rem 1rem;border:1px solid var(--border);border-radius:.7rem;font:inherit;background:var(--bg-card);color:var(--text);" />

            <label class="sr-only" for="sop-message">Mensaje</label>
            <textarea id="sop-message" name="message" required rows="5" maxlength="4000" placeholder="Cuéntanos qué pasa, qué te gustaría, o tu idea…" style="width:100%;padding:.8rem 1rem;border:1px solid var(--border);border-radius:.7rem;font:inherit;background:var(--bg-card);color:var(--text);resize:vertical;"></textarea>

            <div class="hp-field" aria-hidden="true">
              <label for="sop-website">No llenes este campo</label>
              <input id="sop-website" name="website" type="text" tabindex="-1" autocomplete="off" />
            </div>

            <button class="btn btn-primary" type="submit">Enviar</button>
            <p id="sop-msg" role="status" aria-live="polite" style="margin:0;font-size:.92rem;"></p>
          </form>
        </div>
        <script>
        (function () {
          var form = document.getElementById('soporte-form');
          if (!form) return;
          var appSelect = document.getElementById('sop-app');
          var typeWrap = document.getElementById('sop-type-wrap');
          var typeSelect = document.getElementById('sop-type');
          var submitBtn = form.querySelector('button[type="submit"]');
          var msg = document.getElementById('sop-msg');

          function syncTypeVisibility() {
            var isIdea = appSelect.value === '__idea__';
            typeWrap.style.display = isIdea ? 'none' : '';
            typeSelect.required = !isIdea;
          }
          appSelect.addEventListener('change', syncTypeVisibility);
          syncTypeVisibility();

          form.addEventListener('submit', function (e) {
            e.preventDefault();
            submitBtn.disabled = true;
            msg.style.color = '#888';
            msg.textContent = 'Enviando…';
            var data = Object.fromEntries(new FormData(form).entries());
            if (appSelect.value === '__idea__') data.type = 'idea';
            fetch('/api/soporte-apps', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(data),
            }).then(function (r) {
              return r.json().then(function (respBody) { return { ok: r.ok, body: respBody }; });
            }).then(function (result) {
              if (!result.ok || !result.body.ok) throw new Error((result.body && result.body.error) || 'Error');
              msg.style.color = '#0a7';
              msg.textContent = '¡Gracias! Te contactamos en menos de 24 horas hábiles.';
              form.reset();
              syncTypeVisibility();
            }).catch(function (err) {
              msg.style.color = '#c33';
              msg.textContent = err.message && err.message !== 'Error' ? err.message : 'No se pudo enviar — escríbenos a contacto@acaciaco.com.mx.';
            }).finally(function () {
              submitBtn.disabled = false;
            });
          });
        })();
        </script>
      </div>
    </section>

  </main>

  <!-- FOOTER -->
  <footer class="site-footer" role="contentinfo">
    <div class="footer-grid">
      <div class="col-brand">
        <a href="/" class="brand" aria-label="ACACIA inicio">
          <img src="/assets/acacia-logo.jpg" alt="ACACIA" width="32" height="32" />
          ACACIA
        </a>
        <p>Tecnología, consultoría y soluciones digitales para operaciones que buscan claridad y crecimiento.</p>
      </div>
      <div>
        <h4>Apps</h4>
        <ul>
          <li><a href="/apps/stockflow">StockFlow</a></li>
          <li><a href="/apps/flowfin">FlowFin</a></li>
          <li><a href="/apps/puntos-plus">Puntos+</a></li>
          <li><a href="/apps/liuma">LIUMA</a></li>
          <li><a href="/apps/rumbo">Rumbo</a></li>
          <li><a href="/apps/cateqhub">CateqHub</a></li>
          <li><a href="/apps/radar">RADAR</a></li>
          <li><a href="/apps/ctrlhq">CtrlHQ</a></li>
          <li><a href="/apps/kitchops">KitchOps</a></li>
        </ul>
      </div>
      <div>
        <h4>Servicios</h4>
        <ul>
          <li><a href="/servicios">Consultoría</a></li>
          <li><a href="/servicios">Implementación</a></li>
          <li><a href="/servicios">Desarrollo</a></li>
          <li><a href="/servicios">Precios</a></li>
        </ul>
      </div>
      <div>
        <h4>ACACIA</h4>
        <ul>
          <li><a href="/#como-trabajamos">Cómo trabajamos</a></li>
          <li><a href="/soporte">Soporte</a></li>
          <li><a href="/contacto">Contacto</a></li>
          <li><a href="/trabaja-con-nosotros">Trabaja con nosotros</a></li>
          <li><a href="/legal/privacidad">Privacidad</a></li>
          <li><a href="/legal/terminos">Términos</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 ACACIA · Todos los derechos reservados</span>
      <a href="mailto:contacto@acaciaco.com.mx">contacto@acaciaco.com.mx</a>
    </div>
  </footer>

  <!-- COOKIE BANNER -->
  <div class="cookie-banner" id="cookie-banner" role="dialog" aria-label="Aviso de cookies" aria-live="polite">
    <h4>Cookies y privacidad</h4>
    <p>Usamos cookies para mejorar tu experiencia. Consulta nuestra <a href="/legal/privacidad">política de privacidad</a>.</p>
    <div class="actions">
      <button class="btn btn-primary btn-sm" data-cookies="all">Aceptar</button>
      <button class="btn btn-ghost btn-sm" data-cookies="essential">Solo esenciales</button>
    </div>
  </div>

  <script src="/scripts/shared.js"></script>
  <script src="/scripts/analytics.js" defer></script>
  <script defer src="/scripts/theme-switcher.js"></script>
</body>
</html>
```

Note on nav: `nav-links` deliberately matches the standard 5-item set every secondary page uses (confirmed against `faq/index.html` and `roseta/factura/index.html` — neither adds itself, or is added, to the primary nav). `/soporte` is reached via the footer's "ACACIA" column (added here) and the cross-link from `contacto.html` (Task 11), not via the top nav — consistent with how every other secondary page in this site already works.

- [ ] **Step 2: Manual visual check**

Run: `python3 -m http.server 8899` from the repo root, open `http://localhost:8899/soporte.html`.
Expected: page renders with the site's theme, the type selector hides when "Otra idea / app nueva" is chosen and reappears otherwise, in both light and dark theme (toggle via the corner theme switcher).

- [ ] **Step 3: Commit**

```bash
git add soporte.html
git commit -m "feat: add soporte.html page"
```

---

### Task 11: Cross-link from `contacto.html`

**Files:**
- Modify: `contacto.html`

- [ ] **Step 1: Add a short line above the existing lead form**

In `contacto.html`, right before the `<!-- Native lead form → ACACIA Mission Control CRM -->` comment block (around line 167), insert:

```html
        <p class="reveal" style="max-width:640px;margin:clamp(2.5rem,5vw,4rem) auto 0;text-align:center;">
          ¿Ya usas alguna de nuestras apps y necesitas soporte o quieres proponer una mejora?
          <a href="/soporte">Ve a Soporte →</a>
        </p>
```

And change the lead-form wrapper's own top margin from `margin:clamp(2.5rem,5vw,4rem) auto 0;` to `margin:1.5rem auto 0;` so the two blocks read as one group instead of two separately-spaced sections (the new `<p>` above it now carries the top margin instead).

- [ ] **Step 2: Manual visual check**

Run: `python3 -m http.server 8899`, open `http://localhost:8899/contacto.html`.
Expected: the new line appears above "O escríbenos directo", links to `/soporte`, spacing looks intentional (not two disconnected gaps).

- [ ] **Step 3: Commit**

```bash
git add contacto.html
git commit -m "feat: cross-link contacto.html to soporte.html"
```

---

### Task 12: Verify Part B end-to-end

- [ ] **Step 1: Run the full test suite**

Run: `cd /home/user/acaciaco-site && npm test`
Expected: all pass, including the 9 new `tests/soporteValidation.test.ts` tests, and every pre-existing test unaffected.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Note what still needs a live preview to confirm**

Cannot be verified from this sandbox (proxy allowlist excludes `control.acaciaco.com.mx` and Resend — same limitation every CLAUDE.md in this portfolio documents). Once deployed to a Vercel preview:

1. Submit the form for a real app (type Soporte) → confirm the internal alert and the confirmation email both arrive, and the row shows up in Mission Control's CRM page under the "Soporte" filter chip with the right app in "Interés".
2. Submit "Otra idea / app nueva" → confirm it lands with `app_interest: null` and shows under the "Idea / app nueva" filter chip.
3. Submit 6 times quickly from the same IP → confirm the 6th is rejected with the rate-limit message and produces no email/row.
4. Fill the hidden `website` field via devtools and submit → confirm no email, no row, and the page still shows the normal success message.

---

## Self-Review Notes

- **Spec coverage:** dropdown with the 9 apps + "Otra idea / app nueva" (Task 10) · type selector hidden for idea (Task 10 script) · internal + confirmation email (Task 9) · write-then-email order (Task 9, Step 1 comment) · honeypot + rate limit (Tasks 7, 9) · `leads` not `tickets`, with `type` column (Tasks 1–4) · CRM page shows/filters by type (Task 4) · cross-link between `contacto.html` and `soporte.html` (Tasks 10, 11). No spec section without a task.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code.
- **Type consistency:** `SoporteSubmission.appInterest`/`type` (Task 8) match the property names read in `api/soporte-apps.ts` (Task 9) and the field names (`app_interest`, `type`) sent to `/api/ingest/lead` (Task 3) and read by `normalizeLeadType`/`leads.type` (Tasks 1–2) — traced end to end, no renames across the chain.
