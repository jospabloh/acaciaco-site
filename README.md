# AcaciaCo Site

Static marketing site and serverless API routes for AcaciaCo properties.

## Project structure

- `index.html` and `*/index.html`: landing pages and product-specific pages.
- `assets/`: shared CSS, JavaScript, images, and logos.
- `api/`: Vercel serverless handlers, including:
  - `api/health.js` for health checks.
  - `api/sheets/append.ts` for Google Sheets append integrations.
  - `api/roseta/`: Roseta Café's invoice-request flow — emails the
    "Factura por consumo solicitada" request (with CSF and ticket
    attachments) via Resend, tracks status and RFC autofill data in Google
    Sheets. See `.env.example` for required env vars.
- `vercel.json`: Vercel runtime and routing configuration.

## Local development

Open any HTML page directly in a browser for static page edits.

For API handlers, use Vercel local development tooling:

```bash
npx vercel dev
```

## Deployment

Deploys are configured for Vercel via `vercel.json` and the `api/` directory conventions.
