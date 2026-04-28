# ACACIA refactor — notes

## Branch
- Working branch: `claude/refactor-acacia-foundation-vINZh` (per harness instruction; takes precedence over the `refactor-2026-04` name in the original brief).

## Pre-existing files preserved
These belong to the live production site; the refactor does not touch them in Phase 1.

### Routes / pages (still served)
- `apps/index.html`
- `bienvenida/`, `bolsa-empleo/`, `contacto/`, `faq/`, `finflow/`, `flowfin/`, `gracias/`, `liuma/`, `pricing/`, `privacy/`, `puntosplus/`, `servicios/`, `stockflow/`, `terms/`, `trial/`, `underconstruction/`

### Assets kept
- `assets/Logo_ACACIA_HighRes.jpg`, `assets/acacia-logo.jpg`
- `assets/stockflow-logo.png` + `.svg`, `assets/flowfin-logo.png` + `.svg`, `assets/puntosplus-logo.png`, `assets/liuma-logo.png`
- `assets/css/site.css`, `assets/css/site-fixes-v3.css`, `assets/css/acacia-intro.css`
- `assets/js/site.js`, `assets/js/acacia-intro.js`

### API kept
- `api/health.js`, `api/sheets/` (Google Sheets append integration, used by forms)

### Config kept
- `package.json`, `package-lock.json` (used by `api/sheets/` server function)
- `.gitignore`, `README.md`

## Files replaced in Phase 1
- `index.html` — rewritten from scratch per spec. Día del Niño overlay preserved verbatim (markup, CSS, and JS). Old `index.html` (445 lines, served `home-premium-v5` design) is replaced.
- `api/exchange-rate.js` — replaced with the spec's exact handler. Old version used env `BANXICO_API_TOKEN`; new spec uses `BANXICO_TOKEN`. Action item: in Vercel dashboard, copy the existing token value to a new `BANXICO_TOKEN` env var (or rename).
- `vercel.json` — extended. Original redirects (`/finflow`→`/flowfin`, `/bienvenida`→`/`) and security headers are preserved; added `cleanUrls` and `trailingSlash:false` per spec.

## Files added in Phase 1
- `styles/base.css` — design tokens (light + dark) and full component CSS for the new home.
- `scripts/shared.js` — theme toggle, currency toggle, cookie banner, mobile menu, scroll reveals.
- `sitemap.xml`, `robots.txt`, `.env.example`

## Día del Niño overlay
- Found at:
  - Markup: `index.html` lines 28–108 in the previous version.
  - CSS: `assets/css/acacia-intro.css`
  - JS: `assets/js/acacia-intro.js` — window is **April 25–30** in `America/Mexico_City` (NOT April 28–30 as the brief said). The brief's date window is wrong; the deployed code's 25–30 window is preserved verbatim per "DO NOT remove or alter it."
- The new `index.html` references the same external CSS/JS files and includes the same markup so behavior is identical.

## Decisions / deviations
- Branch name: used the harness-mandated branch (see top).
- `BANXICO_TOKEN` vs `BANXICO_API_TOKEN`: kept the spec value (`BANXICO_TOKEN`). The user must rename the env var in Vercel.
- `vercel.json`: merged spec keys with existing redirects + headers rather than replacing.
- Día del Niño date window: kept production's April 25–30 (not the brief's April 28–30).
- Logos: all four product logos exist in `/assets/`. The acacia logo is `.jpg`, not `.png`; the new HTML references the `.jpg`.
