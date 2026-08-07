# AcaciaCo Site

Static marketing site and serverless API routes for AcaciaCo properties.

## Project structure

- `index.html` and `*/index.html`: landing pages and product-specific pages.
- `assets/`: shared CSS, JavaScript, images, and logos.
- `api/`: Vercel serverless handlers, including:
  - `api/health.js` for health checks.
  - `api/sheets/append.ts` for Google Sheets append integrations.
  - `api/roseta/`: Roseta Café's invoice flow, end to end. The public side
    emails the "Factura por consumo solicitada" request (with CSF and ticket
    attachments) via Resend, tracks status and RFC autofill data in Google
    Sheets, and best-effort pre-fills the form by reading the uploaded CSF
    and ticket with Claude vision (`factura-extract.ts`). `factura-status.ts`
    backs the public lookup: a folio returns that request, an RFC returns
    every request from the last 30 days.

    The delivery side is the internal panel at `/roseta/factura/admin`,
    protected by `ROSETA_ADMIN_PASSWORD`. `factura-admin-list.ts` lists the
    requests; `factura-admin-send.ts` mails the stamped CFDI (PDF + XML) to
    the customer, marks the row `Facturada` and records the send in the
    Sheet's `Notificado el` (S) and `Archivos enviados` (T) columns. Files
    prefixed with `_` are shared helpers, not endpoints — Vercel skips them
    when building functions. See `.env.example` for required env vars.
- `vercel.json`: Vercel runtime and routing configuration.

## Local development

Open any HTML page directly in a browser for static page edits.

For API handlers, use Vercel local development tooling:

```bash
npx vercel dev
```

Unit tests cover the pure helpers behind the Roseta invoice flow — column
mapping, the 30-day window, CFDI file validation and the password compare.
They use Node's built-in runner, which executes TypeScript directly, so
there is nothing to install:

```bash
npm test
```

Tests live in `tests/` rather than beside the code they exercise: Vercel
turns every file under `api/` into a serverless function.

## Deployment

Deploys are configured for Vercel via `vercel.json` and the `api/` directory conventions.
