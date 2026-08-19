# AcaciaCo Site — Project Notes

Static marketing site for ACACIA plus its client micro-sites and free tools,
with Vercel serverless handlers in `api/`. No framework, no build step: the HTML
is served as authored.

## Commands

```bash
npm test              # node --test over tests/ — unit tests for the Roseta helpers
npx vercel dev        # local server WITH the api/ handlers (needs env vars)
python3 -m http.server 8899   # static-only preview; api/ calls will 404
```

There is no build, lint or bundler step. `npm test` is the only script.

## Layout

```
index.html, servicios.html, contacto.html …   top-level pages
apps/          one page per portfolio app (rumbo, stockflow, liuma, …)
freeware/      ~20 standalone free tools, one directory each
roseta/        Roseta Café micro-site (client) — includes the invoice flow
baristop/      Baristop micro-site (client)
legal/ faq/ pricing/ trial/
assets/        images and logos
styles/base.css          design tokens + shared components for the whole site
scripts/shared.js        nav, theme toggle, cookie banner — loaded by every page
api/           Vercel serverless handlers
tests/         unit tests (deliberately NOT under api/ — see Gotchas)
docs/superpowers/{specs,plans}/   design specs and implementation plans
```

## Gotchas

These are the ones that actually cost time.

- **Every file under `api/` becomes a serverless function** — except those whose
  name starts with `_`. Shared helpers must carry that prefix (`_sheets.ts`,
  `_facturaRows.ts`), and tests must live outside `api/` entirely.
- **Extensionless relative imports (`./_sheets`) work under Vercel's bundler but
  not under Node's native ESM.** A module that imports one cannot be loaded by
  `node --test`. Keep logic you want unit-tested import-free — that is why the
  password compare lives in `_adminAuth.ts` (no imports) while the request guard
  that needs `_ratelimit` lives in `_adminGuard.ts`.
- **`node --test tests/` fails** — it resolves the directory as a module path.
  The working form is the glob in `package.json`: `node --test "tests/**/*.test.ts"`.
  Node 22 runs TypeScript directly via type stripping; no transpiler is involved.
- **`vercel.json` sets a strict CSP.** `script-src`/`style-src` allow only
  `'self'`, Google Fonts, unpkg and jsdelivr. Adding any other CDN silently
  breaks the page — vendor the file under `assets/vendor/` instead.
- **`cleanUrls: true`**, so `/roseta/factura` serves `roseta/factura/index.html`.
- **A new env var does not reach an already-built deployment.** Setting one in
  Vercel and clicking Redeploy is not always enough; if a function still reports
  the variable as missing, check which deployment served the request before
  assuming the value is wrong.
- **Runtime logs on this project are short-lived.** Diagnose from logs while the
  event is minutes old; after that the Sheet is the only durable record.

## Roseta Café · invoice flow

Lives in `roseta/factura/` (public) + `roseta/factura/admin/` (internal) +
`api/roseta/`. Google Sheets is the store; Resend sends the mail; Claude vision
pre-fills the form. Spec and plan are in `docs/superpowers/`.

**The four steps:**

1. **Request** — `/roseta/factura`. Customer fills the form; `factura-extract.ts`
   reads the uploaded ticket and CSF with Claude vision to pre-fill it, and
   `factura-lookup.ts` autofills from a previous request with the same RFC.
   `factura-submit.ts` mails Roseta + ACACIA with attachments, mails the customer
   a confirmation, and appends a row.
2. **Deliver** — `/roseta/factura/admin`, password-gated. Roseta uploads the
   stamped PDF **and** XML; `factura-admin-send.ts` mails them to the customer,
   marks the row `Facturada` and records the send, and — separately —
   confirms the send to `NOTIFY_EMAILS` (the same `_facturaRows.ts` constant
   the request step mails) so Roseta knows the loop closed without reopening
   the panel. Best-effort: a failure to send this confirmation never turns
   into a failed request or a "mark it by hand" warning, since the customer's
   copy is the actual deliverable and already went out by the time it fires.
3. **Verify** — the panel links to that message's delivery record in Resend, so
   a bounce is distinguishable from a successful send.
4. **Track** — `/roseta/factura/estatus`. A folio returns that request with no
   time limit; an RFC returns every request from the last 30 days.

Any amount meant to be copied — the admin panel's "Copiar" buttons and the
"ya se envió" confirmation above — uses `plainAmount()` (`_facturaRows.ts`):
`###.##`, no `$`, no `MXN`. That's the opposite tradeoff from `fmtMoney()`
(used for on-screen/email display): Roseta pastes these straight into her
stamping or bookkeeping software, which wants a bare number.

**Future**: if a Roseta tenant ever onboards onto CtrlHQ, this flow's
income-side data (the invoiced amounts, mirroring CtrlHQ's own Ingresos) is a
plausible sync target over CtrlHQ's `acaciaControl` bridge — nothing here
depends on that today, but a schema change to `Solicitudes`/`ClientesRFC`
down the line should keep that eventual consumer in mind.

### Sheet layout (`Solicitudes` tab, range `A:U`)

| Col | Field | Col | Field |
|---|---|---|---|
| A | Folio | L | Monto |
| B | Fecha de solicitud | M | Forma de pago |
| C | RFC | N | Movimiento / folio de ticket |
| D | Razón social | **O** | **Estatus** |
| E | Régimen fiscal | **P** | **Fecha de facturación** |
| F | Uso de CFDI | Q | Subtotal |
| G | Código postal | R | IVA |
| H | Correo | S | Notificado el |
| I | Teléfono | T | Archivos enviados |
| J | Sucursal | U | ID de Resend |
| K | Fecha de consumo | | |

**O and P are edited by hand in the Sheet — nothing may shift them.** New columns
append strictly after the last one, and `factura-submit.ts` must write the full
`A:U` range (empty trailing cells) so Sheets does not have to infer table bounds.
A second tab, `ClientesRFC` (`A:H`), remembers each RFC's fiscal data for
autofill. Column indices live in one place: `COL` in `_facturaRows.ts`.

### Rules that are load-bearing

- **Mail first, Sheet second.** A mail failure must leave the row `Pendiente` —
  the status page must never claim `Facturada` for an invoice nobody received.
  If the mail lands but the Sheet write fails, the response carries a `warning`
  telling Roseta to mark it by hand, and deliberately does *not* invite a resend.
- **The recipient is read from the Sheet row, never from the request body**, so a
  leaked panel password cannot mail arbitrary files to arbitrary addresses.
- **Before writing a status, re-read the row and re-check its folio.** Rows
  edited by hand mid-request shift the index.
- **Both PDF and XML are required.** The XML is the valid fiscal receipt; the PDF
  alone is not deductible. Files are validated by extension *and* magic bytes.
- **The public lookup stays data-poor** — no email, name, postal code, phone or
  Resend id. An individual's RFC is derivable from their name and date of birth,
  so `publicSolicitud()` in `_facturaRows.ts` is the allowlist, and a test fails
  if anything else leaks into it.
- `ROSETA_ADMIN_PASSWORD` unset makes the panel endpoints **fail closed**, never
  open.

## Environment

See `.env.example`. All secrets are server-only — this site has no client-side
build, so nothing in `api/` is ever exposed to the browser.

`BANXICO_TOKEN`, `EXCHANGE_RATE_FALLBACK` · `SPREADSHEET_ID`,
`GOOGLE_SERVICE_ACCOUNT_JSON`, `SHEETS_APPEND_SECRET` · `RESEND_API_KEY`,
`RESEND_FROM_EMAIL` · `ROSETA_FACTURA_SPREADSHEET_ID`, `ROSETA_ADMIN_PASSWORD`,
`ANTHROPIC_API_KEY_Roseta`

`RESEND_FROM_EMAIL` must be a domain verified in Resend — it cannot send from a
Gmail address.

## Conventions

- **Vanilla everything** on the client: IIFE, `var`, no framework, no bundler.
  Build DOM with `createElement`/`textContent`, never `innerHTML`, for anything
  that carries data from a form or a Sheet.
- **Reuse `styles/base.css` tokens** (`--bg-card`, `--border`, `--text-muted`,
  `--radius-card`) rather than hard-coding colours. The site has a dark theme:
  any new colour needs a `[data-theme="dark"]` restatement or it will wash out.
- **Comments and identifiers in English; every user-facing string in Spanish.**
