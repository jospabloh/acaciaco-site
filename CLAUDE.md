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

### The review step must never dead-end (2026-09-09)

A real customer (a persona moral) filled the form correctly, reached "Revisa tu
solicitud", pressed *Confirmar y enviar* and got `Revisa los datos del
formulario, algo no es válido.` — with **no field marked, no way back, and no
way to reach anyone**. Three separate things had to be wrong at once, and each
one is worth keeping in mind:

1. **A CSF for a persona moral prints the régimen's description but not always
   its clave.** Claude reports what it sees, so `clave` came back empty and
   `renderRegimenFromCsf()` built an `<option value="">` from it.
2. **An empty `<option>` only trips `required` when it is the FIRST one.** By
   spec, only the *placeholder label option* counts as missing — an empty
   option further down passes `form.checkValidity()`. So the form advanced,
   the payload carried `regimen_fiscal: ""`, and only the server caught it.
   Verified in Chromium, not inferred: `checkValidity()` returns `true`.
3. **The error named nothing.** One boolean `if` over eleven fields collapsed
   into one string, and the client had nowhere to put it but a `<p>`.

The fixes, in the order they matter:

- `resolveRegimenClave()` recovers the clave from the description by matching
  against **the static `<option>` list in `index.html`** — that list is the
  catalog, there is no second copy. Matching is exact-then-significant-words
  (the SAT's wording is longer than the catalog's, and for 625 neither string
  contains the other), and it accepts **only a unique match** — never a best
  guess. An entry that can't be resolved is dropped, and if none resolve the
  full catalog stays and the hint turns amber.
- `api/roseta/_facturaValidation.ts` (import-free, so `node --test` loads it)
  returns **which** fields are invalid; `factura-submit.ts` sends them back as
  `fields`. `REGIMEN_CLAVES`/`USO_CLAVES` are enforced there, and
  `tests/facturaValidation.test.ts` reads `index.html` off disk and fails if
  the dropdowns drift from them — the same guarantee `_soporteValidation.ts`
  has over `soporte.html`.
- `emptyRequiredSelects()` closes the spec hole client-side for every
  `select[required]`, since `renderUsoOptions()` rebuilds its list too.
- `#rf-fallback` is the escape hatch. A named field gets *Corregir el dato*
  (returns to the form, scrolls, focuses, marks it `.rf-invalid`); anything
  else gets *Intentar de nuevo*. **Both always offer WhatsApp and correo, with
  the whole request prefilled** so the customer never retypes it. Note
  `base.css` sets `.btn{display:inline-flex}`, which outranks the browser's
  `[hidden]` rule — hence `.rf-fallback-actions .btn[hidden]{display:none}`.

**The rule this leaves behind: a validation error that can't name its field is
a bug, and any terminal screen needs a human channel on it.** Roseta's
facturación WhatsApp (449 895 8291) always works; the form is the convenience,
not the only door.

## `freeware/plink-fx/` es la copia canónica de Plink FX (2026-08-22)

Plink FX existe dos veces: aquí y en el repo `jospabloh/plink_fx`, que es su
build PWA independiente. **La de aquí es la que la gente carga y la que manda.**

Tres archivos tienen que quedar idénticos en los dos lados — `app.jsx`,
`tweaks-panel.jsx` y el bloque `<style>` de `index.html`. El resto de
`index.html` es distinto a propósito: aquí lleva el SEO en español, el JSON-LD,
el artículo y la nav del sitio; allá es una PWA en inglés con su propio
manifest.

Se dejaron divergir durante meses y las dos perdieron cosas — el detalle está en
el CLAUDE.md de `plink_fx`, incluido un `ReferenceError` de TDZ que vivía en la
copia servida y que `@babel/standalone` escondía al compilar `const` a `var`.
**Haz el cambio aquí primero**, cópialo al otro repo y corre su `npm run bundle`;
`npm run check:mirror` allá compara contra lo que este sitio realmente sirve y
falla si se separan.

Los `.jsx` se sirven tal cual y los transpila `@babel/standalone` en el
navegador, así que son archivos públicos: eso es justo lo que le permite al
chequeo de espejo leerlos. jsPDF ya no viene de unpkg — está vendorizado en
`assets/vendor/jspdf@2.5.2/` y se carga bajo demanda; la página declara dónde
está en `<html data-jspdf="…">`.

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

## Selector de tema: claro / oscuro / dispositivo (módulo 12, 2026-08-21)

`scripts/theme-switcher.js` es ahora **el único dueño del tema en todo el
sitio** — las 48 páginas lo cargan, incluidas las ~20 herramientas de
`freeware/`. Guarda la preferencia (`light` | `dark` | `system`) bajo
`acacia-theme`, resuelve `system` contra `prefers-color-scheme` en vivo, aplica
`data-theme` y dibuja el control: un círculo pequeño en la esquina inferior
derecha que crece de lado en una pista de tres ranuras al pulsarlo. Es el gemelo
en vanilla del `ThemeSwitcher.jsx` que llevan las apps del portafolio; la fuente
canónica de ambos está en `jospabloh/acacia-app-standard` → `shared/theme/`.

**Nada más puede escribir `data-theme`.** Dos escritores se pelean por él, así
que salieron: el botón `#theme-toggle` del nav (24 páginas), el `initTheme()` de
`scripts/shared.js`, y el estado `theme` + el `useEffect` + el botón sol/luna
propios de cada herramienta de `freeware/` (20 apps, más sus claves de
traducción `theme_label`, que se quedaron sin consumidor).

El script se inyecta a sí mismo el CSS, porque tiene que funcionar sobre dos
sistemas de tokens distintos: el de `styles/base.css` (`--bg-card`, `--border`,
`--text`, `--text-muted`, `--primary`) y el de las herramientas (`--card`,
`--line`, `--ink`, `--ink-2`, `--accent`). Las cadenas `var(a, var(b, literal))`
cubren los dos; si añades un tercer sistema de tokens, extiéndelas.

El aviso de cookies vive en esa misma esquina y gana en `z-index`, así que el
switcher se sube por encima mientras está visible (`MutationObserver` sobre su
clase) y vuelve a su sitio al descartarlo.

El script pre-montaje que ya traía cada página se actualizó para entender
`system`: sigue escribiendo `data-theme` con el color **resuelto** (`light` /
`dark`), que es lo que espera el CSS, y ahora además fija `color-scheme`.

## `npm run test:smoke` — comprueba el sitio DESPLEGADO (2026-08-22)

`tests/smoke/smoke.spec.js` es la suite compartida del portafolio, idéntica byte
a byte en todos los repos; la fuente canónica está en
`jospabloh/acacia-app-standard` → `shared/smoke/`. Lo propio de esta app vive en
`tests/smoke/smoke.config.js` (URL, `<title>`, cómo representa el tema).

**No comprueba el build local: comprueba lo que se sirve.** Es la automatización
de la regla que cada CLAUDE.md repite — mergear no deploya nada, y hay que
verificar por contenido y no por hash. Afirma cuatro cosas, todas derivadas de
lo que el propio repo produce (nunca de copy adivinado, que se rompe al cambiar
una palabra y enseña a ignorar la suite):

1. responde 200 y el `<title>` es el de esta app — no un deploy viejo ni otro;
2. no lanza excepciones al pintar;
3. el tema llega resuelto desde el primer frame (el script pre-montaje viajó);
4. el selector de esquina está montado, cambia el tema y la preferencia
   sobrevive a un reload.

**No corre en el pipeline normal ni desde un sandbox de desarrollo**: la salida
HTTPS ahí va por un proxy con allowlist que no incluye estos dominios. Corre en
GitHub Actions (`.github/workflows/smoke.yml`): `workflow_dispatch` para
dispararla a mano justo después de un deploy, y un cron diario como red.

    npm run test:smoke                      # contra producción
    SMOKE_URL=https://… npm run test:smoke  # contra un preview

Desde el 2026-08-22 la suite añade una quinta afirmación, del **módulo 12**: el
selector no tapa nada y nada lo tapa, en móvil (390), tablet (834) y escritorio
(1440), plegado y desplegado. Un control anclado por encima de todo en una
esquina es justo lo que acaba sentado sobre una barra inferior o un botón
flotante, y entonces la app pierde una función al ancho que nadie abrió. La
comprobación distingue las dos direcciones — algo pintado encima del selector, y
el selector respondiendo por un control que hay debajo — y nombra el control
afectado. Se coloca con `--theme-switcher-bottom/right`; si otra cosa ya es dueña
de esa esquina, se mueve el selector, no el control.

## Soporte a Apps

Lives in `soporte.html` (public form) + `api/soporte-apps.ts` (handler) +
`api/_soporteValidation.ts` (pure validation, no imports — same "importable by
`node --test`" reasoning as `api/roseta/_adminAuth.ts`). One form covers three
intents for any of the 9 portfolio apps: soporte (something's broken), mejora
(a suggestion), or — via the `__idea__` sentinel — a pitch for an app that
doesn't exist yet. A honeypot field (`website`) and a per-IP rate limit
(`_ratelimit.ts`, 5/hour) gate the handler before validation runs.

**Env vars**: `MISSION_CONTROL_INGEST_URL` (defaults to
`https://control.acaciaco.com.mx/api/ingest/lead`), `INGEST_LEAD_SECRET` (sent
as `x-lead-secret`), `SOPORTE_RESEND_FROM_EMAIL` (defaults to
`ACACIA <soporte@acaciaco.com.mx>`), `SUPPORT_APPS_NOTIFY_EMAIL` (comma-separated
internal recipients, defaults to `soporte@acaciaco.com.mx,h.josepablo@gmail.com`).

**Write-then-email, not mail-first — the opposite of Roseta's rule above, and
on purpose.** Roseta's invoice flow mails first because the email *is* the
deliverable — a Sheet row with no email sent would be a customer who thinks
they're getting an invoice and never does. Soporte a Apps is the other shape:
the thing that must not go missing is the lead landing in Mission Control,
where each app's own team actually triages it — the two emails are just
notifications *about* that lead, to ACACIA internally and a confirmation to
the visitor. So the handler writes to Mission Control's ingest endpoint
first (`POST /api/ingest/lead`, requiring the real contract's `201` — not any
2xx — with an 8s timeout so a hang there can't run the function to the
platform's max duration) and only sends either email once that succeeds; a
failed ingest returns `502` and neither email fires, because there would be
nothing for either message to confirm. The two Resend calls afterward are
best-effort and self-catching (never throw, never fail the response) and run
concurrently via `Promise.allSettled` rather than sequentially.

**The 9 `<option value>`s in `soporte.html`'s `#sop-app` select must stay
identical to `KNOWN_APPS` in `api/_soporteValidation.ts`.** Both files carry a
comment pointing at the other, but the comments alone are a promise, not a
guarantee — `tests/soporteValidation.test.ts` reads `soporte.html` off disk,
extracts the `<option value="...">` values, and asserts that set equals
`[...KNOWN_APPS, "__idea__"]`. Add or rename an app in one place and forget
the other, and `npm test` fails instead of shipping a dropdown option the
backend silently rejects (or a `KNOWN_APPS` entry nothing can ever select).
