---
description: Actionable regression, link, form, layout, performance and release-readiness audit of the AcaciaCo site — auto-fixes safe/mechanical issues, commits, pushes a branch, and opens a draft PR (real Vercel preview deploy on push); production deploy still needs a human merge. Never touches money/PII code (Roseta invoicing, Sheets, Resend, admin auth) or CSP/security headers.
---

# Claude Code Routine — AcaciaCo Site Regression, Link, Form, Layout, Performance & Release Readiness Audit (actionable)

> This routine **diagnoses and fixes**. For issues in the *safe/mechanical* tier (§0 below) it edits the code, verifies with `npm test` + a local static/functions smoke check, commits, pushes a dedicated branch, and opens a draft PR — that push is a real, live Vercel preview deploy. Production still ships only when a human merges the PR. Issues in the *escalate* tier (anything touching money, PII, the Roseta invoice flow, the admin panel, security headers, or secrets) are **never** auto-fixed — they're reported for a human to fix by hand, no matter how confident the diagnosis is. This routine never submits a real form to a production endpoint, never emails a real customer, never writes a real row to the Roseta Sheet, and never touches the admin panel's password gate.

---

## Target

- **Site (apex):** https://acaciaco.com.mx/
- **Repository:** `jospabloh/acaciaco-site` (assume checked out in the current working directory; if not present, clone it or ask before proceeding). Per its `CLAUDE.md`: **static HTML, no framework, no build step** — pages are served as authored; Vercel serverless handlers live under `api/`.

**This is a single Vercel project on the apex domain.** Unlike a multi-tenant setup, this repo's own "micrositios" (Roseta Café, Baristop) are **paths under the apex** (`/roseta/*`, `/baristop`), not separate subdomains — confirm that's still true from `vercel.json`/DNS before assuming otherwise. The one real `*.acaciaco.com.mx` subdomain in the portfolio, `control.acaciaco.com.mx` (Mission Control), is a **separate repo and Vercel project** (`jospabloh/acacia-mission-control`) — out of scope here; audit it with that repo's own `/mission-control-audit` routine instead. If DNS reveals any other live subdomain, note it and stop — that's a discovery finding, not something to route-enumerate as if it were a path on this site.

Discovery is by PATTERN and exhaustive — the paths named in this routine (`/roseta`, `/apps/flowfin`, `/freeware/...`) are illustrations to sanity-check discovery, not the definition of scope. Stay in scope: `acaciaco.com.mx` (apex + its paths) and this repo. Never place any data in URL query strings. Never submit real data to production endpoints (see §5).

---

## §0 — Auto-fix scope, and the fix → commit → push → PR workflow

### Two tiers. Every finding gets sorted into exactly one.

**Tier A — safe/mechanical, auto-fix it:** a broken internal `href`/asset path (typo, stale path missing from the `redirects` table in `vercel.json`, moved page) · a missing/incorrect entry in `sitemap.xml` for a route that exists (or a stale entry for one that doesn't) · a missing `alt` on a meaningful image · an obvious copy typo or a stale app name/pricing figure that's visibly wrong vs. the current portfolio · a broken favicon/OG-image reference · a dead/duplicate `<script>`/`<link>` include · a `robots.txt` mistake (e.g. accidentally blocking a public page) · a failing test under `tests/*.test.ts` for a **pure, non-money, non-PII helper** (e.g. `_cfdiFiles.ts`'s file-extension/magic-byte check, `_adminAuth.ts`'s password compare, `_ratelimit.ts`) with an unambiguous one-line fix · a CSS class typo that visibly breaks layout. Every Tier A fix must be **re-verified** before it's committed: re-run the specific check that found it, plus `npm test`, plus a local static-serve smoke pass on the touched page(s) — never commit a fix you haven't re-checked.

**Tier B — escalate, never auto-fix:** anything under `api/roseta/*` (the invoice request/deliver/verify/track flow — mail-first-then-Sheet ordering, "recipient read from the Sheet row, never the request body," re-read-before-write, PDF+XML-both-required, the data-poor public lookup allowlist in `publicSolicitud()`, and `ROSETA_ADMIN_PASSWORD` fail-closed behavior are all load-bearing rules from this repo's `CLAUDE.md` — do not touch them) · `api/sheets/append.ts` and anything using `GOOGLE_SERVICE_ACCOUNT_JSON`/`SHEETS_APPEND_SECRET` · `RESEND_API_KEY`/email-sending code · the `Content-Security-Policy` and other security headers in `vercel.json` · any Mercado Pago link/checkout reference (`apps/*.html`, `legal/*.html`) · the freeware calculators that compute real tax/legal/financial numbers (`calculadora-iva`, `calculadora-finiquito`, `gastos-viaje/calc.js`, `generador-facturas`) — a silently "corrected" tax formula is worse than a flagged one · anything in `.env.example`/secrets handling · a `vercel.json` `redirects`/`headers` change broad enough to affect SEO/canonical URLs beyond the one broken link being fixed. No matter how confident or "obviously correct" a fix in these areas looks, it goes to the report and the PR's "Flagged — needs a human" section instead of into a commit.

### Workflow for Tier A fixes

1. Make sure the working tree is clean and up to date with the default branch (`git fetch origin main && git status`).
2. Create a fresh, dated branch off `main`: `chore/audit-site-<YYYY-MM-DD>`. Never commit straight to `main`, never force-push over a human's commits; if that branch already has unmerged work from an earlier run today, add commits on top instead of duplicating it.
3. Apply every Tier A fix. Re-run `npm test` and the specific checks that found each issue (link check, sitemap/route reconciliation, local static-serve smoke pass) — all must be clean before committing.
4. Commit with a clear message per logical fix (prefix `audit:`), e.g. `audit: fix broken /catequesis link now that the route is /apps/cateqhub`.
5. `git push -u origin chore/audit-site-<YYYY-MM-DD>` (retry with backoff on network errors). This push **is** a real deploy — Vercel builds a live preview URL for the branch automatically. Report that preview URL once available.
6. Open a **draft PR** into `main` (check for a PR template first). The PR body must contain: a summary of every Tier A fix shipped, the full Tier B "flagged — needs a human" list with rationale and file:line, and the verification output (`npm test` + link/sitemap check results). **Production only ships when a human merges this PR** — do not merge it yourself, do not enable auto-merge.
7. If Tier A found nothing to fix, skip the branch/PR entirely and just report the Tier B findings (if any) — never open an empty PR.

### Production-safety hard rules (apply regardless of tier)

1. **Never submit any form to a production endpoint** — especially `api/roseta/factura-submit.ts` (mails Roseta + ACACIA + the customer and appends a Sheet row) and `api/roseta/factura-admin-send.ts` (mails a stamped CFDI to a real customer). Verify form behavior from the code and, for client-side checks (required fields, validation, disabled/loading states), from the DOM/JS without firing the actual submit.
2. **Never call `api/sheets/append.ts` with real data** — it's a shared, secret-gated endpoint used elsewhere; a stray test row pollutes a real spreadsheet.
3. **Never attempt to log into `/roseta/factura/admin`** or otherwise probe `ROSETA_ADMIN_PASSWORD` — verify its fail-closed behavior by reading `_adminAuth.ts`/`_adminGuard.ts`, not by trying it.
4. **Never click through to a real Mercado Pago checkout or complete a payment.** Verify the link target and that it opens the right plan/app, nothing more.
5. Never place tokens, the Roseta admin password, `SHEETS_APPEND_SECRET`, `RESEND_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, or `ANTHROPIC_API_KEY_Roseta` in a URL, log line, or committed file during this audit.
6. Never merge the PR this routine opens, never bypass CI to force a merge.

---

## Phase 0 — Recon (do this FIRST, before touching the live site)

Build the audit from the code, not from assumptions.

1. **Read the repo structure.** `package.json` (only script is `test`; there is no build/lint step per `CLAUDE.md`), `vercel.json` (`cleanUrls`, `trailingSlash`, the full `redirects` table, the CSP/security `headers` block), `robots.txt`, `sitemap.xml`, favicon/OG assets under `assets/`.
2. **Enumerate every route exhaustively.** `sitemap.xml` is the primary source; do not rely on nav/footer links alone. Reconcile it against:
   - **Top-level pages**: `index.html`, `servicios.html`, `contacto.html`, `gracias.html`, `trabaja-con-nosotros.html`, plus directories that serve `index.html` via `cleanUrls` (`faq/`, `pricing/`, `trial/`, `legal/{privacidad,terminos}`, `underconstruction/`).
   - **`apps/*.html`** — one page per portfolio app (as of writing: `rumbo`, `stockflow`, `liuma`, `flowfin`, `puntos-plus`, `cateqhub`, plus `apps/index.html`) — re-derive the actual set from the directory, don't trust this snapshot.
   - **`freeware/*`** — ~20 standalone tool directories (`freeware/index.html` lists them; each has its own `index.html`/`app.jsx`/`favicon.svg`).
   - **`roseta/`** (the Roseta Café micro-site incl. `/roseta/factura`, `/roseta/factura/admin`, `/roseta/factura/estatus`) and **`baristop/`** (client micro-site) — both paths, not subdomains.
   - **The `redirects` table in `vercel.json`** — every source there is a route that must resolve, and every destination must be a real, currently-existing route; a redirect pointing at a route that itself 404s is itself a finding.
   - **Three-way reconcile**: `sitemap.xml` ∪ (HTML files on disk) ∪ (hardcoded internal `href`s grepped from source). Anything in one list but missing from another is a finding.
   - Produce a flat URL coverage list. This list is the contract: a page not on it was not audited.
3. **Inventory forms from code.** For every form (contact, Roseta factura request, Roseta admin, freeware tools with inputs, trial/pricing CTAs), record its handler: `api/roseta/factura-submit.ts`, `api/roseta/factura-admin-send.ts`, `api/sheets/append.ts`, or a client-only freeware tool with no backend at all.
4. **Inventory external services**: Google Fonts/unpkg/jsdelivr (the only CDNs the CSP allows — anything else silently breaks), analytics (`scripts/analytics.js`), Mercado Pago links, WhatsApp deep links, Google Sheets/Docs embeds, the vendored React/Babel/Supabase bundles under `assets/vendor/`.
5. **Determine how to run it locally.** `npx vercel dev` (needs env vars, exercises `api/`) or `python3 -m http.server 8899` (static-only preview; `api/` calls will 404 — say so explicitly for any check that needed a live function). `npm test` runs the Node-native `tests/**/*.test.ts` suite (helpers with no imports, per the repo's own gotcha about extensionless-import modules not being `node --test`-loadable).
6. **Checkpoint:** print detected stack, the full flat URL coverage list (with counts), the form→endpoint map, and whether you're testing local-static, local-with-functions, or code-only. State which routes/forms fell back to code-only review and why.

**Fail-loud rule for the whole routine:** every check is marked `VERIFIED (local-static)`, `VERIFIED (local-functions)`, `VERIFIED (code)`, or `NOT VERIFIED — reason`. A check you could not run is never reported as passed.

---

## Primary Objective

Audit the site for regressions, broken flows, broken links, form issues, mobile/desktop layout issues, external-resource failures, and performance slowdowns. Produce a findings report organized by severity: Critical / High / Medium / Low, with every finding sorted into Tier A (fixed) or Tier B (flagged).

If all checks genuinely pass (and were actually run), confirm the site is in good standing. If any check could not be run, the site is **not** confirmed — state exactly which.

## 1. Page Load & Runtime Error Check

Per page from the Phase 0 coverage list: loads successfully · no blank screen · no broken route (respecting `cleanUrls`) · no 404 on an expected public page · no console error · no missing critical asset · no redirect loop · `underconstruction/` correctly carries `X-Robots-Tag: noindex, nofollow` and nothing public-facing accidentally does. A page that fails to load and blocks access → **Critical**.

## 2. Link Validation

Check nav, footer, CTAs, `apps/*` → portfolio-app links (including the ones pointing at `control.acaciaco.com.mx` or other live app subdomains — verify the target resolves, but don't audit *inside* that target here), pricing/trial links, contact/WhatsApp/`mailto:` links, legal links, every `redirects` entry in `vercel.json`. Cross-check hardcoded `href`s against live status codes. Broken primary-CTA or Mercado Pago-checkout links → **High** or **Critical** by impact (report only — the Mercado Pago link itself is Tier B, but the fact that it's broken is still a Critical/High finding).

## 3. External Resources Check

Verify images/logos/icons/fonts/scripts/analytics/vendored bundles load, and specifically that nothing outside the CSP's allowed CDNs (`self`, Google Fonts, unpkg, jsdelivr) has snuck in — that would silently 404 in production regardless of local behavior. Flag missing images, broken logos, mixed-content, resources that fail only on mobile.

## 4. Mobile & Desktop Visual Regression Review

Test viewports (~390px, ~768px, ~1280px+) on the pages that actually need it: homepage, `apps/*`, `pricing/`, `roseta/factura` (the form is the highest-traffic conversion flow on this site), `freeware/index.html` and a couple of representative tool pages. Check header/nav overlap, mobile menu open/close, CTA visibility, text cut-off, misaligned cards, horizontal scroll, dark-theme contrast (`[data-theme="dark"]` — per `CLAUDE.md`, any hardcoded color instead of a `styles/base.css` token is a likely dark-mode bug), duplicate/repeated sections. Anything blocking reading, navigating, or converting → **High** or **Critical**.

## 5. Forms & Submission Flows — PRODUCTION-SAFE (hard rules apply, see §0)

For the Roseta factura request form, the contact form, and any freeware tool with real input validation: verify (by code review, or client-side-only interaction without a real submit) required-field enforcement, invalid email/RFC/phone rejection, loading/disabled states, and pre-submit UX. **Do not fire a real submit against `factura-submit.ts`, `factura-admin-send.ts`, or `api/sheets/append.ts`.** Where a live check would need a real submit, write out the exact manual test to run in staging instead, and say why it wasn't executed here.

## 6. Performance

Note: unoptimized/oversized images under `assets/`, render-blocking scripts, whether `scripts/shared.js`/`scripts/analytics.js` are appropriately deferred, LCP-relevant hero images, and anything in the vendored React/Babel bundle that looks stale vs. `package.json`'s intent. Pull real numbers where possible (page weight, request count via the headless browser or `curl -sI`/`-w`).

## 7. Accessibility & Basic Usability

Contrast (both themes), focus states, keyboard nav for the mobile menu and every form, form labels, `alt` text, link-text clarity, tap-target size on mobile, understandable error messages (especially on the Roseta form, which real non-technical users depend on).

## 8. SEO & Metadata Sanity

Title, meta description, canonical, OG image, no accidental `noindex` on a public page, correct/current app names and pricing, sitemap/robots consistency with the Phase 0 coverage list, no broken legal links.

## 9. Findings Format

For every finding include: **Severity · Confidence tag (`[Certain]`/`[Likely]`/`[Guessing]`) · How verified (local-static/local-functions/code/NOT VERIFIED) · Page/area · Issue · Expected behavior · Actual behavior · User impact · Recommended fix · Tier (A/B) · Outcome (`Fixed — commit <sha>` / `Flagged — needs a human` / `Reported only, not shippable this run`) · Blocks release? (yes/no).**

## 10. Severity Rules

- **Critical:** a key page doesn't load · homepage broken · primary CTA or Mercado Pago link broken · the Roseta request form is unusable · users sent to the wrong app/product · sensitive data exposed (a Roseta Sheet field leaking into the public lookup, a secret in a committed file) · mobile users can't navigate.
- **High:** important links broken · the Roseta form's validation/error path fails · pricing/app content wrong · major mobile layout regression · a CSP-blocked resource breaks important content.
- **Medium:** non-critical links broken · noticeably slow load · visible but non-blocking layout issues · a11y issues affecting some users · incorrect-but-not-catastrophic metadata.
- **Low:** minor copy/layout polish · non-blocking visual inconsistencies · optional resource failing without major impact · minor SEO cleanup.

---

## 11. Final Report

Output in this structure:

```
# AcaciaCo Site Audit Report

## Final Status
Passed — nothing to fix or flag | Shipped fixes — PR open for merge | Flagged issues need a human | Failed — Critical issues found | Blocked

## Coverage & Verification
Stack detected · tested against (local-static/local-functions/code) · any checks NOT VERIFIED and why.

## Executive Summary
Brief condition of the site, and whether a PR was opened this run.

## Shipped This Run (Tier A)
Branch name · PR URL (draft) · Vercel preview URL · commit list · what each commit fixed · verification results after the fixes. `None` if nothing was auto-fixable.

## Flagged For A Human (Tier B)
Every finding NOT auto-fixed, with severity, file:line/page, why it's Tier B, and the recommended fix. `None` if there weren't any.

## Critical Findings
(list or `None`)

## High Findings
(list or `None`)

## Medium Findings
(list or `None`)

## Low Findings
(list or `None`)

## Pages Reviewed
(every URL from the Phase 0 coverage list, with verification method. If discovered ≠ audited, status cannot be "Passed.")

## Forms Tested
(every form + method used + result; note any deferred to staging and why)

## Links Reviewed
(summary)

## Mobile/Desktop Layout Review
(summary)

## Performance Notes
(observations, with numbers where available)

## Blockers
(list or `None`)

## Recommended Next Actions
(what the human reviewer should do: merge the PR, decide on each flagged Tier B item, or nothing)
```

## Final Confirmation

If every check ran clean and nothing needed fixing or flagging:
`Website audit complete. No Critical, High, Medium, or Low issues were found in the reviewed scope.`

If Tier A fixes were shipped: state the PR URL plainly and that it's waiting on a human merge to reach production — never claim the fix is live in production until it's merged.

If Tier B issues were flagged or any check was NOT VERIFIED: do not say the site is in good standing. State the exact severity, what remains unverified or unfixed, and the recommended next action for a human.

---

**Checkpoint discipline:** after each phase, print a one-line summary (done / verified / remaining). If you lose the thread or run past a sensible token budget, stop, summarize, and replan rather than pushing through.
