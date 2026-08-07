# Gastos de Viaje — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/freeware/gastos-viaje`, a browser-only travel expense report builder that exports a deliverable PDF (cover + expense table + receipt annex), a CSV, and a portable `.json`, and register it in ACACIA Mission Control.

**Architecture:** A static freeware tool inside `acaciaco-site/freeware/`, following the module's existing conventions: one `index.html` carrying SEO, JSON-LD and the OKLCH design tokens, plus React 18 + Babel standalone loaded from vendored files. Logic is split by responsibility across four files — `calc.js` (pure math, testable under `node --test`), `store.jsx` (IndexedDB), `pdf.jsx` (pdf-lib document builder), `app.jsx` (UI and state). Mission Control integration is one idempotent seed migration plus an export-event tracking pixel; no schema or RLS changes.

**Tech Stack:** React 18.3.1 + Babel standalone (vendored under `/assets/vendor/`), `pdf-lib@1.17.1` from unpkg, IndexedDB (no wrapper library), `node --test` for the pure calc layer, Supabase SQL migration in `acacia-mission-control`.

**Spec:** `docs/superpowers/specs/2026-08-07-gastos-viaje-design.md`

## Global Constraints

- Slug is exactly `gastos-viaje`; app id in the registry is exactly `fw-gastos-viaje`.
- Everything runs in the browser. No expense data, receipt, or PDF is ever uploaded. The only network calls are the analytics pixel and the optional `/api/exchange-rate` lookup.
- Full ES/EN via a `STRINGS` object plus `makeT(lang)`, exactly as `freeware/generador-facturas/app.jsx` does. Language in `localStorage` key `acacia-lang`, theme in `acacia-theme`.
- Light and dark themes, both defined in the `<style>` block of `index.html` using the shared OKLCH token names (`--paper`, `--paper-2`, `--card`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--line-2`, `--accent`, `--accent-2`, `--accent-soft`, `--shadow`, `--radius`). Accent stays teal, matching the rest of the freeware.
- `/styles/freeware-premium.css` is linked **after** the inline `<style>`.
- The page includes `<div id="acacia-promo"></div>` and `/scripts/freeware-promo.js`, plus `/scripts/analytics.js`.
- Money is summed in integer cents; rounding happens only at display time.
- Report currency default is `MXN`. Supported currencies for expenses: MXN, USD, EUR, CAD, GBP, COP, ARS, CLP, BRL.
- Receipt file types accepted: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, plus HEIC attempted-then-rejected per the spec.
- Work on branch `claude/travel-expense-reports-app-ttkosx` in both repos.

---

### Task 1: `calc.js` — pure calculation layer

**Files:**
- Create: `freeware/gastos-viaje/calc.js`
- Test: `freeware/gastos-viaje/calc.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces, on `globalThis.GVCalc` in the browser and via `module.exports` under Node:
  - `CATEGORIES: string[]` — `['transporte_largo','hospedaje','alimentos','transporte_local','combustible','otros']`
  - `CURRENCIES: string[]`
  - `toCents(value): number` — accepts number or string with commas; non-numeric → `0`
  - `centsToNumber(cents): number`
  - `expenseFx(expense, reportCurrency): number` — `1` when currencies match, else `parseFloat(expense.fx) || 0`
  - `expenseCents(expense, reportCurrency): number`
  - `expenseTaxCents(expense, reportCurrency): number`
  - `isIncomplete(expense, reportCurrency): boolean`
  - `totals(report): { totalCents, taxCents, advanceCents, balanceCents, count, incompleteCount }`
  - `balanceKind(balanceCents): 'refund' | 'return' | 'settled'`
  - `formatMoney(cents, symbol): string`
  - `toCsv(report, labels): string`

- [ ] **Step 1: Write the failing tests**

Create `freeware/gastos-viaje/calc.test.js`:

```js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const C = require('./calc.js')

const report = (over = {}) => ({
  v: 1,
  trip: { currency: 'MXN', advance: 0, ...(over.trip || {}) },
  expenses: over.expenses || [],
})
const exp = (o) => ({ id: 'x', date: '2026-03-12', category: 'hospedaje', description: '',
  amount: 0, currency: 'MXN', fx: 1, taxAmount: 0, deductible: false, receiptId: null, ...o })

test('toCents parses numbers, strings and commas', () => {
  assert.equal(C.toCents(1234.5), 123450)
  assert.equal(C.toCents('1,234.50'), 123450)
  assert.equal(C.toCents(''), 0)
  assert.equal(C.toCents('abc'), 0)
  assert.equal(C.toCents(0.1 + 0.2), 30)
})

test('expenseFx is 1 for the report currency and the stored rate otherwise', () => {
  assert.equal(C.expenseFx(exp({ currency: 'MXN', fx: 99 }), 'MXN'), 1)
  assert.equal(C.expenseFx(exp({ currency: 'USD', fx: '18.42' }), 'MXN'), 18.42)
  assert.equal(C.expenseFx(exp({ currency: 'USD', fx: '' }), 'MXN'), 0)
})

test('expenseCents converts with the exchange rate', () => {
  assert.equal(C.expenseCents(exp({ amount: 100, currency: 'MXN' }), 'MXN'), 10000)
  assert.equal(C.expenseCents(exp({ amount: 100, currency: 'USD', fx: 18.42 }), 'MXN'), 184200)
})

test('tax counts only for deductible expenses', () => {
  const r = report({ expenses: [
    exp({ amount: 1000, taxAmount: 160, deductible: true }),
    exp({ amount: 500, taxAmount: 80, deductible: false }),
  ]})
  const t = C.totals(r)
  assert.equal(t.totalCents, 150000)
  assert.equal(t.taxCents, 16000)
})

test('tax converts with the same rate as the expense', () => {
  const r = report({ expenses: [
    exp({ amount: 100, taxAmount: 16, currency: 'USD', fx: 18.5, deductible: true }),
  ]})
  assert.equal(C.totals(r).taxCents, Math.round(1600 * 18.5))
})

test('balance is total minus advance, in its three shapes', () => {
  const owed = C.totals(report({ trip: { currency: 'MXN', advance: 1000 },
    expenses: [exp({ amount: 4240 })] }))
  assert.equal(owed.balanceCents, 324000)
  assert.equal(C.balanceKind(owed.balanceCents), 'refund')

  const back = C.totals(report({ trip: { currency: 'MXN', advance: 5000 },
    expenses: [exp({ amount: 4240 })] }))
  assert.equal(back.balanceCents, -76000)
  assert.equal(C.balanceKind(back.balanceCents), 'return')

  const even = C.totals(report({ trip: { currency: 'MXN', advance: 4240 },
    expenses: [exp({ amount: 4240 })] }))
  assert.equal(even.balanceCents, 0)
  assert.equal(C.balanceKind(even.balanceCents), 'settled')
})

test('sums stay exact across many fractional conversions', () => {
  const expenses = Array.from({ length: 100 }, () =>
    exp({ amount: 0.1, currency: 'USD', fx: 18.33 }))
  assert.equal(C.totals(report({ expenses })).totalCents, 100 * Math.round(10 * 18.33))
})

test('isIncomplete flags missing date, zero amount and a missing rate', () => {
  assert.equal(C.isIncomplete(exp({ amount: 100 }), 'MXN'), false)
  assert.equal(C.isIncomplete(exp({ amount: 100, date: '' }), 'MXN'), true)
  assert.equal(C.isIncomplete(exp({ amount: 0 }), 'MXN'), true)
  assert.equal(C.isIncomplete(exp({ amount: 100, currency: 'USD', fx: '' }), 'MXN'), true)
})

test('totals counts expenses and incomplete ones', () => {
  const t = C.totals(report({ expenses: [exp({ amount: 100 }), exp({ amount: 0 })] }))
  assert.equal(t.count, 2)
  assert.equal(t.incompleteCount, 1)
})

test('formatMoney groups thousands and always shows two decimals', () => {
  assert.equal(C.formatMoney(123450, '$'), '$1,234.50')
  assert.equal(C.formatMoney(-76000, '$'), '-$760.00')
  assert.equal(C.formatMoney(0, '$'), '$0.00')
})

test('toCsv emits a header plus one row per expense and escapes quotes', () => {
  const csv = C.toCsv(report({ expenses: [exp({ amount: 100, description: 'Hotel "Centro"' })] }),
    { date: 'Fecha', category: 'Categoría', description: 'Descripción', currency: 'Moneda',
      amount: 'Monto', fx: 'TC', converted: 'Importe', tax: 'IVA', deductible: 'Deducible' })
  const lines = csv.trim().split('\n')
  assert.equal(lines.length, 2)
  assert.match(lines[0], /^#,Fecha,/)
  assert.match(lines[1], /"Hotel ""Centro"""/)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/user/acaciaco-site && node --test freeware/gastos-viaje/calc.test.js`
Expected: FAIL — `Cannot find module './calc.js'`

- [ ] **Step 3: Write `calc.js`**

Pure JavaScript, no JSX, no browser globals. Ends with the dual export so the browser loads it as a classic script and Node requires it:

```js
/* Gastos de Viaje — cálculos puros. Sin DOM, sin React: se prueba con node --test.
 * Todo el dinero se suma en centavos enteros; el redondeo ocurre al presentar. */
(function (root) {
  var CATEGORIES = ['transporte_largo','hospedaje','alimentos','transporte_local','combustible','otros']
  var CURRENCIES = ['MXN','USD','EUR','CAD','GBP','COP','ARS','CLP','BRL']

  function toCents(v) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) : 0
    var n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''))
    return isFinite(n) ? Math.round(n * 100) : 0
  }
  function centsToNumber(c) { return c / 100 }
  function expenseFx(e, reportCurrency) {
    if (!e.currency || e.currency === reportCurrency) return 1
    var n = parseFloat(e.fx)
    return isFinite(n) && n > 0 ? n : 0
  }
  function expenseCents(e, cur) { return Math.round(toCents(e.amount) * expenseFx(e, cur)) }
  function expenseTaxCents(e, cur) { return Math.round(toCents(e.taxAmount) * expenseFx(e, cur)) }
  function isIncomplete(e, cur) {
    return !e.date || toCents(e.amount) === 0 || expenseFx(e, cur) === 0
  }
  function totals(report) {
    var cur = report.trip.currency, total = 0, tax = 0, incomplete = 0
    for (var i = 0; i < report.expenses.length; i++) {
      var e = report.expenses[i]
      total += expenseCents(e, cur)
      if (e.deductible) tax += expenseTaxCents(e, cur)
      if (isIncomplete(e, cur)) incomplete++
    }
    var advance = toCents(report.trip.advance)
    return { totalCents: total, taxCents: tax, advanceCents: advance,
             balanceCents: total - advance, count: report.expenses.length,
             incompleteCount: incomplete }
  }
  function balanceKind(c) { return c > 0 ? 'refund' : c < 0 ? 'return' : 'settled' }
  function formatMoney(cents, symbol) {
    var sign = cents < 0 ? '-' : ''
    var parts = (Math.abs(cents) / 100).toFixed(2).split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return sign + (symbol || '$') + parts.join('.')
  }
  function csvCell(v) {
    var s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  function toCsv(report, L) {
    var cur = report.trip.currency
    var head = ['#', L.date, L.category, L.description, L.currency, L.amount, L.fx,
                L.converted + ' (' + cur + ')', L.tax, L.deductible]
    var rows = report.expenses.map(function (e, i) {
      return [i + 1, e.date, e.category, e.description, e.currency,
              centsToNumber(toCents(e.amount)).toFixed(2), expenseFx(e, cur),
              centsToNumber(expenseCents(e, cur)).toFixed(2),
              centsToNumber(expenseTaxCents(e, cur)).toFixed(2),
              e.deductible ? '1' : '0'].map(csvCell).join(',')
    })
    return [head.map(csvCell).join(',')].concat(rows).join('\n') + '\n'
  }

  var API = { CATEGORIES: CATEGORIES, CURRENCIES: CURRENCIES, toCents: toCents,
    centsToNumber: centsToNumber, expenseFx: expenseFx, expenseCents: expenseCents,
    expenseTaxCents: expenseTaxCents, isIncomplete: isIncomplete, totals: totals,
    balanceKind: balanceKind, formatMoney: formatMoney, toCsv: toCsv }

  root.GVCalc = API
  if (typeof module !== 'undefined' && module.exports) module.exports = API
})(typeof globalThis !== 'undefined' ? globalThis : this)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/user/acaciaco-site && node --test freeware/gastos-viaje/calc.test.js`
Expected: PASS — `# pass 11`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add freeware/gastos-viaje/calc.js freeware/gastos-viaje/calc.test.js
git commit -m "Add pure calculation layer for the Gastos de Viaje freeware tool"
```

---

### Task 2: `index.html` shell and `favicon.svg`

**Files:**
- Create: `freeware/gastos-viaje/index.html`
- Create: `freeware/gastos-viaje/favicon.svg`

**Interfaces:**
- Consumes: `calc.js` from Task 1 (loaded as a classic `<script>` before the JSX files).
- Produces: an `#root` div for React, plus the global token/CSS class vocabulary every later task styles against.

Copy the head structure of `freeware/generador-facturas/index.html` verbatim in shape and adapt content:

- `<title>`: `Reporte de Gastos de Viaje y Viáticos en PDF gratis (sin registro) — ACACIA`
- Meta description, keywords (`reporte de gastos de viaje, comprobación de viáticos, formato de reporte de gastos, plantilla viáticos excel, reporte de viáticos pdf`), canonical `https://acaciaco.com.mx/freeware/gastos-viaje`, OG and Twitter cards.
- The `acacia-theme` bootstrap `<script>` before any paint.
- JSON-LD array with `SoftwareApplication`, `BreadcrumbList` and `FAQPage` (three questions: *¿Sirve para comprobar viáticos ante mi empresa?*, *¿Mis tickets se suben a algún servidor?*, *¿Puedo capturar gastos en dólares?*).
- The inline `<style>` block with the light and dark token sets plus layout classes.
- `<link rel="stylesheet" href="/styles/freeware-premium.css">` **after** the inline style.
- Body: `<div id="root"></div>`, `<div id="acacia-promo"></div>`, an `<article class="seo-article">` with real prose about travel expense reports.
- Script order at the end of body:

```html
<script src="/assets/vendor/react@18.3.1/react.production.min.js"></script>
<script src="/assets/vendor/react-dom@18.3.1/react-dom.production.min.js"></script>
<script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js" crossorigin="anonymous"></script>
<script src="/freeware/gastos-viaje/calc.js"></script>
<script src="/assets/vendor/babel-standalone@7.29.0/babel.min.js"></script>
<script type="text/babel" src="/freeware/gastos-viaje/store.jsx"></script>
<script type="text/babel" src="/freeware/gastos-viaje/pdf.jsx"></script>
<script type="text/babel" src="/freeware/gastos-viaje/app.jsx"></script>
<script src="/scripts/freeware-promo.js" defer></script>
<script src="/scripts/analytics.js" defer></script>
```

`favicon.svg`: a 32×32 suitcase mark in the teal accent, same visual weight as the other tool icons.

- [ ] **Step 1: Write `favicon.svg` and `index.html`**
- [ ] **Step 2: Verify the page serves and the tokens apply**

Run: `cd /home/user/acaciaco-site && python3 -m http.server 8099 >/dev/null 2>&1 & sleep 1; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8099/freeware/gastos-viaje/index.html`
Expected: `200`

- [ ] **Step 3: Verify the JSON-LD parses**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('freeware/gastos-viaje/index.html','utf8');
const m=h.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/);
JSON.parse(m[1]);console.log('json-ld ok')"
```
Expected: `json-ld ok`

- [ ] **Step 4: Commit**

```bash
git add freeware/gastos-viaje/index.html freeware/gastos-viaje/favicon.svg
git commit -m "Add page shell, SEO metadata and design tokens for Gastos de Viaje"
```

---

### Task 3: `store.jsx` — IndexedDB persistence and receipts

**Files:**
- Create: `freeware/gastos-viaje/store.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces `window.GVStore`:
  - `available: boolean` — false when IndexedDB is missing or blocked
  - `load(): Promise<report|null>`
  - `save(report): Promise<void>` — debounced by the caller, not here
  - `putReceipt(blob, name, type): Promise<string>` — returns the new `receiptId`
  - `getReceipt(id): Promise<{ id, blob, name, type }|null>`
  - `deleteReceipt(id): Promise<void>`
  - `clearAll(): Promise<void>`
  - `shrinkImage(file): Promise<Blob>` — canvas downscale to max 1600 px, JPEG q 0.8; rejects with `Error('unreadable')` when the browser cannot decode (HEIC outside Safari)
  - `exportJson(report): Promise<Blob>` — receipts inlined as base64
  - `importJson(file): Promise<report>` — rejects with `Error('version')` when `v !== 1`

One database `gastos-viaje` version 1, two object stores: `meta` (key `report`) and `receipts` (keyed by id). Every public method resolves to a harmless value rather than throwing when `available` is false, so the UI degrades to memory-only.

- [ ] **Step 1: Write `store.jsx`**
- [ ] **Step 2: Verify the file has balanced braces and no stray syntax**

This repo has no Babel toolchain outside the browser, so there is no offline JSX
parser to run. Sanity-check the file loads by opening the page and confirming
the console is clean — the same way every other `.jsx` in `freeware/` is
validated. The full check happens in Task 8.

Run: `cd /home/user/acaciaco-site && node -e "const s=require('fs').readFileSync('freeware/gastos-viaje/store.jsx','utf8'); const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length; console.log(o===c ? 'braces balanced' : 'MISMATCH '+o+'/'+c)"`
Expected: `braces balanced`

- [ ] **Step 3: Commit**

```bash
git add freeware/gastos-viaje/store.jsx
git commit -m "Add IndexedDB store with receipt downscaling for Gastos de Viaje"
```

---

### Task 4: `pdf.jsx` — the deliverable document

**Files:**
- Create: `freeware/gastos-viaje/pdf.jsx`

**Interfaces:**
- Consumes: `GVCalc` from Task 1; receipt blobs fetched by the caller via `GVStore.getReceipt`.
- Produces `window.GVPdf.buildPdf(report, receipts, t): Promise<Blob>` where `receipts` is a `Map<receiptId, {blob,type}>` and `t` is the translator from `app.jsx`.

Document structure, using `PDFLib` exactly as `freeware/generador-facturas/app.jsx` does:

1. **Cover** — title, traveler, company, employee id, destination, purpose, period; a right-hand figure block with total, deductible VAT, advance, and the balance rendered large with its label (*Te deben* / *Debes devolver* / *Cuentas saldadas*).
2. **Expense table** — columns `# · fecha · categoría · descripción · moneda · TC · importe · IVA · ded.`, wrapping onto new pages with the header repeated, then two signature rules labelled *Elaboró* and *Autorizó*.
3. **Receipt annex** — one page per receipt, headed `Gasto #N · <fecha> · <categoría> · <importe>`. Images go through `embedJpg`/`embedPng` scaled to fit the printable area; `application/pdf` receipts are appended with `copyPages`.

- [ ] **Step 1: Write `pdf.jsx`**
- [ ] **Step 2: Commit**

```bash
git add freeware/gastos-viaje/pdf.jsx
git commit -m "Add PDF builder with cover, expense table and receipt annex"
```

---

### Task 5: `app.jsx` — the interface

**Files:**
- Create: `freeware/gastos-viaje/app.jsx`

**Interfaces:**
- Consumes: `GVCalc`, `GVStore`, `GVPdf`.
- Produces: mounts `<App />` into `#root`.

Contents:

- `STRINGS` with full `es` and `en` sets and `makeT(lang)`, matching the shape used by `generador-facturas`.
- Topbar (back link, language segment, theme toggle), hero with the privacy chip, trip card, expense list, sticky summary panel, export buttons, disclaimer, CTA to `/contacto`, FAQ `<details>`, and the standard footer.
- State: one `report` object; autosave to `GVStore.save` debounced 600 ms; initial `GVStore.load()`.
- Each expense row: date, category select, description, amount + currency, an fx field shown only when the currency differs from the report's (with a *sugerir* button that calls `/api/exchange-rate` and only applies for USD→MXN), VAT amount, deductible checkbox, receipt attach/preview/remove, delete row.
- Incomplete rows get a visible marker; the export button warns with the count but still exports.
- A one-time discreet notice when `GVStore.available` is false.

- [ ] **Step 1: Write `app.jsx`**
- [ ] **Step 2: Commit**

```bash
git add freeware/gastos-viaje/app.jsx
git commit -m "Add Gastos de Viaje interface with autosave and exports"
```

---

### Task 6: Register the tool in the site

**Files:**
- Modify: `freeware/index.html` — grid card, footer list item, JSON-LD `ItemList` position 21
- Modify: `sitemap.xml` — one `<url>` entry

- [ ] **Step 1: Add the JSON-LD entry** after the `metodo-cubetas` item at position 20:

```json
,
        { "@type": "ListItem", "position": 21, "url": "https://acaciaco.com.mx/freeware/gastos-viaje", "name": "Gastos de Viaje — Reporte de viáticos en PDF con comprobantes" }
```

- [ ] **Step 2: Add the grid card**, matching the surrounding markup exactly:

```html
          <a href="/freeware/gastos-viaje" class="app-card reveal">
            <div class="head"><div class="logo"><img src="/freeware/gastos-viaje/favicon.svg" alt="Gastos de viaje" width="40" height="40" /></div><span class="badge available">Gratis</span></div>
            <h3>Gastos de viaje</h3>
            <p>Arma tu reporte de viáticos con comprobantes, varias monedas y anticipo. Descarga el PDF listo para entregar.</p>
            <span class="more">Abrir herramienta →</span>
          </a>
```

- [ ] **Step 3: Add the footer list item** in the `Gratis` column:

```html
          <li><a href="/freeware/gastos-viaje">Gastos de viaje</a></li>
```

- [ ] **Step 4: Add the sitemap entry**

```xml
  <url><loc>https://acaciaco.com.mx/freeware/gastos-viaje</loc><lastmod>2026-08-07</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
```

- [ ] **Step 5: Verify the hub's JSON-LD still parses**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('freeware/index.html','utf8');
const m=h.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/);
JSON.parse(m[1]);console.log('hub json-ld ok')"
```
Expected: `hub json-ld ok`

- [ ] **Step 6: Commit**

```bash
git add freeware/index.html sitemap.xml
git commit -m "List Gastos de Viaje in the freeware hub and sitemap"
```

---

### Task 7: Mission Control registration and the export event

**Files:**
- Create: `/home/user/acacia-mission-control/supabase/migrations/0032_seed_gastos_viaje.sql`
- Modify: `freeware/gastos-viaje/app.jsx` — fire the export pixel

- [ ] **Step 1: Write the migration**, copying the shape of `0029_seed_metodo_cubetas.sql`:

```sql
-- ============================================================================
-- Gastos de Viaje (acaciaco-site/freeware/gastos-viaje/) — alta en el registro.
-- Herramienta freeware estática: el reporte de viáticos se arma y se exporta
-- 100% en el navegador, sin backend propio. Con esta fila, api/web-kpis.js le
-- atribuye el tráfico por prefijo de URL (/freeware/gastos-viaje) y la app
-- aparece en Portafolio con visitas y visitantes únicos de 30 días. La misma
-- atribución recoge el evento de exportación que la herramienta manda a
-- /api/track como /freeware/gastos-viaje/exportado.
-- ============================================================================
insert into public.apps (id, name, backend, category, url, status, config) values
  ('fw-gastos-viaje','Gastos de Viaje','static','freeware','https://acaciaco.com.mx/freeware/gastos-viaje','active','{}')
on conflict (id) do update set
  name = excluded.name, backend = excluded.backend, category = excluded.category,
  url = excluded.url, status = excluded.status, updated_at = now();
```

- [ ] **Step 2: Add the export pixel** to `app.jsx`, fired right after the PDF download starts:

```js
function trackExport() {
  try {
    var img = new Image(1, 1)
    img.src = "https://control.acaciaco.com.mx/api/track?p=" +
      encodeURIComponent("/freeware/gastos-viaje/exportado") +
      "&h=" + encodeURIComponent(location.host) + "&t=" + Date.now()
  } catch (e) {}
}
```

- [ ] **Step 3: Verify the migration is valid SQL and idempotent by inspection**

Run: `cd /home/user/acacia-mission-control && npm run lint`
Expected: 0 errors (the migration is not linted, but this confirms the repo is untouched otherwise)

- [ ] **Step 4: Commit both repos**

```bash
cd /home/user/acaciaco-site && git add freeware/gastos-viaje/app.jsx \
  && git commit -m "Report Gastos de Viaje exports to Mission Control"
cd /home/user/acacia-mission-control && git add supabase/migrations/0032_seed_gastos_viaje.sql \
  && git commit -m "Register the Gastos de Viaje freeware tool in the app registry"
```

---

### Task 8: Verification pass

- [ ] **Step 1: Run the calc tests**

Run: `cd /home/user/acaciaco-site && node --test freeware/gastos-viaje/calc.test.js`
Expected: `# fail 0`

- [ ] **Step 2: Browser checklist** against `python3 -m http.server`:

1. Capture three expenses, two of them in USD with a rate, each with a photo.
2. Reload — everything returns, attachments included.
3. Download the PDF — check cover figures, paginated table, signature lines, annex headers.
4. Download the CSV and open it in a spreadsheet.
5. Export the `.json`, clear the data, re-import, confirm it round-trips.
6. Check light and dark, ES and EN, and a 390 px-wide viewport.
7. Confirm no console errors and that the export pixel request appears in the network tab.

- [ ] **Step 3: Push both branches and open the PRs**

---

## Self-Review

**Spec coverage:** every spec section maps to a task — architecture and files (Tasks 1–5), data model and calculations (Task 1), receipts (Tasks 3–4), deliverables (Tasks 4–5), interface (Tasks 2, 5), Mission Control (Task 7), site registration (Task 6), errors and edge cases (Tasks 3, 5), verification (Task 8).

**Type consistency:** `GVCalc`, `GVStore`, `GVPdf` are the three globals; `totals()` returns `totalCents / taxCents / advanceCents / balanceCents / count / incompleteCount` and nothing else references other names. `receiptId` is the single identifier linking an expense to its blob.

**Known gap:** Task 3 Step 2 has no automated syntax check for `.jsx` files — this repo has no Babel toolchain outside the browser. Syntax errors surface in the browser console during Task 8, which is where the other JSX files in `freeware/` are validated too.
