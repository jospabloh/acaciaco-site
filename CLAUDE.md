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

### Sheet layout (`Solicitudes` tab, range `A:V`)

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
| K | Fecha de consumo | V | Hora de solicitud |

**V holds the full timestamp of the request** (`fechaSolicitud` is only ever
a bare date, B stays that way for Roseta reading the Sheet) — added for the
admin panel's business-*hours* heat bar, see below. Rows written before V
existed read as empty; the admin panel falls back to assuming they landed at
opening.

**Column E holds the clave AND the name** (`601 · General de Ley Personas
Morales`), because a bare `601` tells whoever is checking a request against a
CSF nothing. `regimenDisplay()` in `_facturaValidation.ts` formats it, and it
is idempotent, so the admin panel re-formats on read and legacy rows holding a
bare clave display the same as new ones. **The `ClientesRFC` tab keeps the bare
clave**, deliberately: `factura-lookup` returns that column and the form
assigns it to `<select id="regimen">.value`, so a label there would match no
`<option>` and the autofill would silently select nothing. Same split as
`fmtMoney`/`plainAmount` — the panel *shows* clave + name and its "Copiar"
button *yields* the bare clave, which is what the stamping software wants.

**O and P are edited by hand in the Sheet — nothing may shift them.** New columns
append strictly after the last one, and `factura-submit.ts` must write the full
`A:V` range (empty trailing cells where nothing is known yet) so Sheets does not
have to infer table bounds.
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

### Heat bar en el panel: horas hábiles, no días (2026-09-19 → 2026-09-21)

The admin list (`/roseta/factura/admin`) shows Roseta a heat bar per request:
a track that fills — and heats up from green through amber to red — as the
request approaches the "recíbela en un máximo de 3 días hábiles" promise
quoted across the public pages, so a stale request is visible without opening
every row. It shipped first as whole-day counting (2026-09-19), then Roseta
pointed out the real unfairness in that: **a request filed at 5pm got credited
with a whole business day it never had.** The fix was to switch the unit from
days to hours — a request that lands late in the day now only earns the few
hours actually left before closing, which is what "cuentes las hrs para sumar
3 días hábiles" asks for, and it needed no separate cutoff rule: correct hour
math already produces that behavior on its own.

**Business hours are Mon–Fri 7:00–18:00, Aguascalientes local time (Zona
Centro, a fixed UTC-6 year-round — Mexico dropped national daylight saving in
2022, so there's no DST table to maintain).** 11 hours/day × 3 días hábiles =
`FACTURA_SLA_BUSINESS_HOURS` = 33, the bar's 100%. `businessHoursElapsed()` in
`_facturaRows.ts` (import-free, so `node --test` loads it) sums the overlap
between `[from, to)` and each business day's open window, skipping weekends
and the same nationwide LFT Art. 74 holidays as before (`mexicanHolidays()`,
computed per year rather than hardcoded so the list never goes stale — the
two floating ones are "Nth Monday of the month"). A request outside business
hours contributes nothing until the window next opens; that's the whole fix,
with no special-casing.

**The clock starts at `fecha_solicitud`, not `fecha_consumo`.** The promise is
about the request, not the visit — `fecha_consumo` is only fiscal data that
goes on the invoice itself, per Roseta directly. (An earlier version of this
feature briefly had this backwards; if `fecha_consumo` ever shows up near
`businessHoursElapsed()` again, that's the bug to check for.)

**Getting hour precision needed an actual timestamp, and the Sheet only ever
stored a date.** Column B (`Fecha de solicitud`) stays a bare date — Roseta
still scans it in the Sheet — so `factura-submit.ts` now also writes column
**V**, `Hora de solicitud`, the full instant (`COL.HORA_SOLICITUD`,
`SOLICITUDES_RANGE` extended to `A:V`). A row written before V existed falls
back to `fallbackSolicitudTimestamp()` — assume it landed right at opening.
`Fecha de facturación` (P) has the opposite problem permanently: Roseta always
hand-types it as a bare date, so there's no real delivery minute to recover —
`fallbackFacturacionTimestamp()` assumes the full business day was used, the
same "give the benefit of the doubt" bias as the solicitud fallback.
`factura-admin-list.ts` computes the count server-side from `fecha_solicitud`
(or its fallback) to `fecha_facturacion` (or ITS fallback) once a row is
`Facturada`, or to `nowISO()` while it's still `Pendiente` — a delivered row
keeps showing how long it actually took instead of creeping forward after the
fact.

**The bar's "heating up" look is a background-size trick, not a growing
rainbow.** The green→amber→red gradient is declared once on `.ad-heat-fill`;
each row sets that element's `width` to `elapsed/meta` as usual, but also
stretches `background-size` by the inverse fraction, which cancels out the
gradient's default re-stretch-to-fit-the-box behavior. Without it, a bar at
20% width would show the *entire* gradient smeared into that narrow strip
(green-to-red rainbow); with it, that same 20% only exposes the gradient's own
first-fifth (still green) — the same slice a 100%-wide bar would show at that
position. `admin.js` owns all of this display math; the 33-hour meta itself
comes from the server (`horas_habiles_meta`) so the threshold isn't
duplicated as a magic number client-side.

### Sólo Fico 3C — las otras sucursales se redirigen, nunca se facturan (2026-09-22)

Roseta Café has more than one branch, but this online system only ever
invoices **Fico 3C (Tres Centurias)**. The `#sucursal` select on the public
form (`roseta/factura/index.html`) has always listed the other branches too
(`Plaza Universidad`, `UAA`, `Otra`), so nothing stopped a customer from
picking one and ending up with a request this system was never going to
fulfill.

**Two layers, matching the "give the customer a channel, don't dead-end
them" rule from the régimen story below.** The select's own option text now
says "— no disponible en este sistema" for anything but Fico 3C, so the
heads-up is visible before the customer even picks one; and once picked,
`factura.js`'s `renderSucursalHint()` shows the actual phone number to call
instead — `#sucursal-hint`, styled like `.rf-regimen-hint`. Neither one
blocks submission: the select stays exactly as permissive as before, because
the second half of this feature is for customers who submit anyway.

**That second half lives in the admin panel, not the public form** — Roseta's
own correction, after an early version of this put it in the wrong place.
`api/roseta/factura-admin-redirect.ts` is a new admin-only endpoint,
structurally a sibling of `factura-admin-send.ts`: same `requireAdmin` gate,
same "recipient always comes from the Sheet row, never the request body"
rule, same re-read-before-write folio check, same retry-once-then-warn
bookkeeping shape. What it sends is never an invoice — just a short redirect
naming the real branch and, for the two known ones, its direct number
(`OTHER_BRANCH_CONTACTS` in `_facturaRows.ts`, now required in **international
format**, `+52 449 …`, at Roseta's request — everywhere else on the site
drops the `+52`, this is the one deliberate exception). `Otra` gets a
generic "contact the branch where you bought it" instead of a guessed
number, on purpose: `OTHER_BRANCH_CONTACTS` has no entry for it.

**The redirect email's own facts table shipped wrong on day one — caught
against a real Plaza Universidad ticket, same day.** It listed this
system's own `RF-…` folio as the request's reference. That folio means
nothing to the other branch: it's an id this online system assigned, and
their point-of-sale never heard of it. What Plaza Universidad's own staff
actually recognize is the ticket's own internal folio (`COL.FOLIO_TICKET` —
printed on the paper receipt, e.g. `26838`) and the fecha de consumo. So
`redirectHtml()`'s table now leads with **Sucursal / Folio del ticket / Fecha
de consumo / Monto**, and the contact paragraph explicitly tells the customer
to hand over the ticket's folio and date — and explicitly calls out the
`RF-…` folio by name as the wrong thing to give them, since a customer
skimming the email would otherwise read "folio" in the opening line and
assume that's what to quote. A request with no ticket folio (the "no lo
tengo" checkbox on the form) shows "No indicado — lleva tu ticket físico"
instead of a blank cell.

**Sending it writes `Estatus = sucursalRedirectEstatus(sucursal)`** — e.g.
"Roseta Plaza Universidad", not a generic "Sucursal incorrecta". That generic
label was the first version's own mistake, caught by Roseta the same day: a
status has to say where the customer was sent, the same way "Facturada" says
what happened rather than just that something did. Fecha de facturación (P)
stays empty on purpose — nothing was invoiced, so there's no delivery date to
record.

**Estatus's wording now varies per branch, so nothing downstream can
string-match it to detect a redirect — detection moved to Archivos enviados
(T) instead.** `factura-admin-redirect.ts` writes the fixed marker
`ARCHIVOS_AVISO_SUCURSAL` ("Aviso de sucursal") there; `factura-admin-send.ts`
only ever writes real PDF/XML filenames to that column, so the marker alone
tells `factura-admin-list.ts` and `admin.js` a row was redirected, regardless
of what Estatus actually says. `admin.js`'s badge then just **displays**
`s.estatus` as-is when a row is redirected — it doesn't recompute the label,
`sucursalRedirectEstatus()` in `_facturaRows.ts` is the one place that exists.

The admin panel treats a redirected row as resolved the same way it treats
`Facturada`: excluded from the default "Pendientes" filter, and — Roseta's
second correction, catching what the first draft missed — given its **own
filter tab, "Otra sucursal"**, rather than only being reachable through
"Todas". Moving a redirected row out of Pendientes without somewhere it's
still easy to find would have made it disappear, not resolve.

**The backlog of requests filed before this shipped needed no migration.**
`sucursal` was already stored on every row, so the redirect button's
visibility (`s.sucursal !== FICO_3C_SUCURSAL`) and a small "Otra sucursal"
flag badge next to the amount — Roseta's third question, "and what about the
ones already sitting in Pendientes?" — both key off data that was there all
along. An old row just starts showing the flag and the button the moment
this code deploys; nothing writes to the Sheet until she actually clicks
"Enviar aviso de sucursal" on it, at whatever pace she gets through them.

`admin.js` also drops the heat bar for a redirected row — "hours toward
delivery" stops meaning anything once there's no invoice coming — and reuses
the same `notified` flag (both flows write column S) but branches the note's
wording on `wrongBranch` (the Archivos marker, not `estatus`), since "Enviada
al cliente" and "Se avisó al cliente" are describing two different things
that happen to share a column.

`tests/facturaRows.test.ts` reads `index.html` off disk and asserts the
`#sucursal` option values, `FICO_3C_SUCURSAL`, and `OTHER_BRANCH_CONTACTS`'
keys haven't drifted apart — the same guarantee `facturaValidation.test.ts`
holds over the régimen/uso dropdowns.

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

#### …and the clave has to be recovered SERVER-side (2026-09-09, same day)

The fix above shipped with `resolveRegimenClave()` in `factura.js` only — and a
second customer hit the identical dead end hours later, because their browser
was still running a **cached copy of the old `factura.js`** against the already
fixed server. The tell, if it happens again: the error text is the new one
(`Revisa este dato: Régimen fiscal.`) but the régimen still reads
`· Descripción` with no clave and no `#rf-fallback` panel appears — new server,
old client.

So the resolution moved to `_facturaValidation.ts`, and there are now three
nets, in the order they catch:

1. **`factura-extract.ts` fills the clave in before the response leaves the
   server** (`withClaves()`), and drops any régimen it cannot tie to a real
   catalog clave. This is the one that matters: the form builds its
   `<option value>` out of that response, so **even a stale cached client gets
   a working dropdown** — verified in Chromium by running the pre-fix
   `factura.js` against the new response.
2. **`factura-submit.ts` re-resolves** from `regimen_descripcion` (the label the
   form displayed, now sent alongside the value), so a blank clave that still
   arrives is recovered rather than rejected.
3. **`factura.js` keeps its own copy** for the dropdown UX. It is now the
   least important of the three, and the only one that can go stale.

`REGIMEN_CATALOG` carries clave **and** label, because the matching compares a
CSF's wording against those labels — a test asserts both against the `<option>`s
in `index.html`, so a reworded option can't silently stop resolving its own
régimen. Matching is exact-then-significant-words and accepts **only a unique
match**; `"Ingresos"` alone resolves to nothing on purpose.

**The general rule, and it is the more important half of this whole episode: a
fix that only exists in `roseta/factura/*.js` is a fix a cached browser can
opt out of.** Anything that decides whether a customer's request is acceptable
belongs under `api/`, where the next deploy is the only version there is.

## `freeware/plink-fx/` es la única copia de Plink FX (2026-09-26)

Antes existía un espejo en el repo `jospabloh/plink_fx` (build PWA aparte) que
había que mantener idéntico a mano. **Ese repo ya no existe**: lo que vive aquí
es la única copia, sin nada que sincronizar. Si ves en el historial instrucciones
de "cópialo al otro repo" o `check:mirror`, ya no aplican.

Los `.jsx` se sirven tal cual y los transpila `@babel/standalone` en el
navegador. Ojo con eso: compila `const` a `var`, así que un `ReferenceError` de
TDZ puede quedar escondido en local y explotar en otro motor — declara antes de
usar. jsPDF está vendorizado en `assets/vendor/jspdf@2.5.2/` y se carga bajo
demanda; la página declara dónde está en `<html data-jspdf="…">`.

**Las tablas bajo las tarjetas (2026-09-26)** reemplazaron "Qué compra,
localmente" (tacos, hoteles, canopy — sólo existía para USD/MXN/CRC y no ayudaba
a decidir nada). "Cuánto recibes realmente" aplica a cada moneda los costos
típicos de `CHANNELS` en `app.jsx` (interbancario 0 %, app 0.6 %, tarjeta 3 %,
banco 5 %, aeropuerto 10 %): son rangos publicados aproximados, **no
cotizaciones**, y la copy lo dice; si se cambian, que siga diciéndolo. "Tabla
rápida de precios" usa `priceSteps()`, escalado para que el paso menor sea
~1 USD en la moneda destino. Las dos se prenden/apagan con el tweak `showCosts`.

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

## ArtisKids logo landed (2026-09-22)

`assets/artiskids-logo.jpg` (origami-crane mark, 1024×1024, JPEG despite the
source file at `jospabloh/artiskids`'s `resources/artiskids_logo.png` having a
`.png` name — copied with the extension matching its real content). Replaces
the inline-SVG placeholder that stood in for it in `apps/artiskids.html`'s
`product-mark` and the homepage `#apps` grid's `.app-card` — both now use the
same `<img>` pattern every other app's page and card already use. No wide
lockup/screenshot exists, so `og:image`/`twitter:image` still fall back to the
portfolio-wide `acacia-og.png` rather than stretching the square into a
1200×630 card.

## ArtisKids marketing page: a distinct identity, not the shared template (2026-09-22)

Every product page shares the portfolio's nav, footer, type system (Space
Grotesk + DM Sans) and `--primary` blue — that's the studio's brand, fixed on
purpose, not a per-app choice. But `apps/artiskids.html` had been using the
*same generic hero-mock-plus-blue-CTA layout* as every other app, right down
to reusing `.mock`'s browser-chrome dots for a product with no screenshot.
Nothing about it said "children's drawings" instead of "SaaS dashboard."

`styles/artiskids.css` (new, linked only from this one page after
`base.css`) scopes a page-specific identity under `.ak-page` (the class on
`<main>`), without touching `base.css` or any other app's page:

- **Palette sampled directly from the real logo** — a terracotta `--primary`
  (`#b05619`, darkened from the logo's raw orange `#d9712a` so white button
  text still clears WCAG AA 4.5:1 in both themes) plus a four-colour "crayon
  box" (magenta/green/blue/orange) cycled onto the feature-card icons via
  `:nth-of-type(4n±k)` — each `.features-grid` restarts the cycle, so the
  3-card "Cómo funciona" grid and the 6-card "Funcionalidades" grid both read
  as pulled from the same box instead of one repeated blue. Contrast was
  checked by hand for both text-on-background and white-on-button uses in
  both themes before picking the hex values (the numbers are in the
  stylesheet's own comments) — dark mode needed a *second*, brighter orange
  (`--ak-accent-text`) for the two places the colour sits directly on page
  background as text (the h1 accent word, the pricing badge), since the
  darker terracotta that works for white-on-button contrast doesn't clear
  AA against a near-black page.
- **Signature element: a corkboard of pinned drawings**, replacing the old
  `.mock` browser-chrome hero visual. Four small hand-drawn-style SVGs (sun,
  house, flower, rainbow — thick rounded strokes, flat crayon colours, no
  screenshot pretense) sit taped and tilted on a warm paper background, each
  with a reaction-heart chip and a family caption ("Sofía · hoy"). This is
  deliberately NOT styled as app UI — CLAUDE.md's own rule from the previous
  pass is that a fake screenshot must never stand in for a real one, and a
  browser-chrome mock implies a screenshot exists. The corkboard shows the
  product's actual loop (a family's drawings get put up and reacted to)
  honestly, as an illustration.
- `.btn-mp` (Mercado Pago's own brand blue `#009EE3`, used for every app's
  pricing-card CTA regardless of that button's actual label text) was
  deliberately left alone — it's a portfolio-wide convention marking "this is
  the purchase-path button," not a stray blue that leaked past the new
  orange scope.

Verified: `npm test` (111/111, unchanged), HTML parse + JSON-LD validity on
the touched page, and Playwright screenshots (Chromium, light + dark +
mobile-390 + desktop-1400) against a local static server — the only way to
actually see rendered output in this sandbox, since `test:smoke` needs a
live deploy this proxy can't reach. One screenshot-methodology trap worth
recording: a naive full-page capture showed large blank bands where the
`.reveal` (scroll-triggered fade-in) sections should be — not a real bug,
just the IntersectionObserver never firing during a scripted `scrollTo` with
short waits. Forcing `.reveal { opacity: 1 !important }` before capture
confirmed the content was always there; a real visitor scrolling normally
never sees this.

## Estado, precio y prueba de las apps — reglas del dueño (2026-10-07)

Decididas por JP tras una auditoría que comparó cada página contra el código
de su app. Aplican a `index.html`, `apps/`, `pricing/` y `trial/`:

- **Solo hay dos estados.** `Disponible · 30 días de prueba` (StockFlow,
  FlowFin, CateqHub, Puntos+, LIUMA, Rumbo, ArtisKids) y `En desarrollo ·
  disponible para probar` (Sommel, KitchOps, CtrlHQ, RADAR). No existe "Demo"
  ni acceso por invitación. Mover una app de grupo es decisión del dueño.
- **Nada es gratis.** Ninguna app tiene plan gratuito ni "$0". La prueba se
  escribe "30 días de prueba, sin tarjeta" — nunca "prueba gratis". La palabra
  "gratis" queda reservada a las herramientas de `freeware/`.
- **Toda app publica precio**, también las que están en desarrollo ("Precios
  de lanzamiento previstos, sujetos a confirmación"). El mismo precio tiene
  que leerse igual en la página de la app, el inicio, `/apps`, `/pricing`,
  `/trial` y el JSON-LD: son seis lugares y se cambian juntos.
- **El botón principal de cada app lleva a `/trial#<slug>`**, y `/trial` tiene
  un bloque con ese `id` por app con sus límites de prueba (2 usuarios en
  StockFlow, 4 miembros en FlowFin, 5/5 en Rumbo, 500 MB en ArtisKids…). Una
  app nueva necesita su bloque ahí y su tarjeta con `id` en `/pricing`.
  RADAR es la excepción: su prueba la activa ACACIA, así que su bloque lleva a
  WhatsApp.
- **Una página solo afirma lo que la app hace hoy.** Lo que el código no
  respalda se quita; lo que existe a medias se describe como es. Las apps en
  desarrollo pueden listar lo planeado únicamente en una lista aparte titulada
  "En camino". Si una diferencia entre planes no se aplica en el código, la
  tarjeta dice "Todas las funciones" y solo el límite que sí cambia.
- **Sin testimonios escritos a mano.** Los tres que había no tenían respaldo
  y salieron. Los próximos llegan desde Soporte dentro de cada app, con
  consentimiento y revisión en Mission Control (Módulo 29 del estándar).
- **Capturas:** son pantallas reales de cuentas demo. La de CateqHub está
  recortada (1600×500) para no mostrar el plan Gratis retirado; hay que
  volver a tomarla, igual que las de RADAR y CtrlHQ. Sommel y ArtisKids no
  tienen captura y no se les inventa una.

Pendiente fuera de este repo cuando se escribió: las pantallas de planes
dentro de varias apps (Puntos+, Rumbo, RADAR, LIUMA, FlowFin, StockFlow)
todavía dicen "gratis", muestran niveles gratuitos o anuncian funciones por
plan que el sitio ya no promete.

## Ranking mensual, "App del mes", movimiento y opiniones (2026-10-07)

**El orden de las tarjetas cambia una vez al mes.** `scripts/apps-grid.js` decide
la métrica en un solo lugar, `metricFor(payload)`: si `/api/apps-visits` trae
`month`, ordena por `visitsMonth` (visitas del mes calendario anterior, un número
congelado hasta que cambie el mes); si no (Mission Control aún sin desplegar),
cae a `visits30` como antes; sin respuesta no hace nada y queda el orden del HTML.
Los empates —incluido todo en cero— conservan el orden estático (`__acaciaIdx`).
Homepage: nivel 1 = `data-status="live"`, nivel 2 = `dev`; `data-free` ya no
cuenta. `/apps` reordena `live` y `dev` (el grupo `demo` ya no existe) y
`freeware` + el teaser `#gratis` usan la misma métrica. La etiqueta del líder
dice "La más visitada de <mes>" (o "La más usada de <mes>" en freeware) y nunca
sale en un empate en cero; con `month`, `topApp`/`topFreeware` del servidor
mandan. Si las tarjetas cambian de lugar al llegar los datos se deslizan (FLIP,
450 ms, sólo `transform`; se omite con reduced-motion y para tarjetas fuera de
pantalla).

**Recuadro "App del mes"** (`#app-del-mes` en `index.html`). El HTML trae StockFlow
como valor por defecto (la página está completa sin JS). Los datos de las 11 apps
viven en un solo mapa, `SPOTLIGHT_DATA` en `scripts/app-spotlight.js`: es una
versión corta de lo que dice cada `apps/<slug>.html` y **hay que mantenerlo en
sincronía a mano**; `tests/appSpotlight.test.ts` vigila la estructura (11 slugs,
4–5 viñetas de ≤60 caracteres, existe la página, el estado coincide con el
eyebrow del hero, nada de gratis/demo, RADAR sin WhatsApp, y que el HTML por
defecto sea el de su entrada). Etiquetado honesto, decidido en
`chooseSpotlight()` (que comparte con la etiqueta de la grilla un único
`pickLeader()`, de modo que ambos nombran siempre la misma app; la lógica pura
la prueba `tests/rankingLogic.test.ts`): `month`+`topApp` → "App del mes · la más visitada de
<mes> <año>"; payload viejo con líder en `visits30` → "App más visitada ·
últimos 30 días"; sin datos o todo en cero → "App destacada" con StockFlow. Para
que un cambio de app no mueva el layout, el script mete copias invisibles
(`.spot-ghost`) del texto de las 11 apps en la misma celda de grid: la caja mide
lo que la más alta, y lo mismo con el eyebrow más largo, así que la altura es
idéntica para cualquier app y cualquier etiqueta (CLS medido en 0 a 1440 y 390
px con datos 0.3 s y 2 s tarde); el `min-height` de CSS (24.75rem; 27.75rem entre
821 y 1180 px) sólo cubre el instante previo al JS. Las viñetas sólo se ocultan cuando el script ya "armó" la
caja (`.is-armed`), así que si el JS falla nunca quedan invisibles.

**Reglas de movimiento** (`styles/home-motion.css`, sólo `index.html`): todo vive
bajo `prefers-reduced-motion: no-preference`; el estado por defecto es el estado
final visible. Sólo `transform`/`opacity`, con una excepción deliberada: el barrido
del acento del H1 (`background-position`, una vez, ~2 s, un elemento). Las
animaciones en bucle (brillo orbital, barrido de luz, marquesina, respiración de
las barras) arrancan en pausa y sólo corren con `.is-onscreen`, que pone
`shared.js` sobre los `[data-motion-watch]`. El retraso escalonado de los
`.reveal` es `--reveal-delay`, que `shared.js` asigna sólo bajo `[data-reveal-stagger]`
(`<main>` de la home) y quita al terminar. La home lleva
`<noscript><style>.reveal{opacity:1!important…}` en el `<head>`. Sólo en la home,
además, `.reveal` es visible por defecto y se oculta únicamente mientras
`<html>` lleva `.js-reveal`, que un script inline del `<head>` pone y quita a los
3 s si `shared.js` no marcó `data-shared-ready`: un `shared.js` caído nunca deja
la página en blanco. Sin soporte de `oklch()`/`color-mix()` todo sigue legible:
el barrido del H1 va dentro de `@supports`, y `color-mix()` que lleva `var()` se
declara en `@supports` (un respaldo en la misma regla NO sirve: una declaración
con `var()` no se descarta al parsear y dejaría el fondo en blanco).

**Claves que vienen del servidor** (`topApp`, `topFreeware`, `app` de una
opinión, las claves de `visits`) sólo se buscan como propiedades propias
(`Object.prototype.hasOwnProperty.call`): `"constructor"` o `"__proto__"` jamás
resuelven a algo heredado. Un `topApp` se respeta únicamente si existe entre las
tarjetas y su valor de la métrica activa es > 0; si no, manda el máximo real, y
con máximo 0 no hay etiqueta ni afirmación.

**Opiniones** (`scripts/testimonials.js`, en la home y las 11 páginas de app, que
sólo ganaron el `<div data-testimonials="slug">` antes de "A LA MEDIDA" y el
`<script defer>`). Pide `https://control.acaciaco.com.mx/api/testimonials[?app=]`
(`connect-src 'self' https:` ya lo permite) con 2.5 s de tope y **no pinta nada**
—ni encabezado ni marcador— si no hay endpoint, hay cero opiniones o algo falla:
seguirá vacío hasta que Mission Control publique opiniones aprobadas. Sólo
`textContent`, sin marcado JSON-LD de reseñas. Estilos en `styles/base.css`
(`.tm-*`). Los nombres de app que usa están duplicados con el mapa del recuadro y
un test los compara.

`.app-card__popular-tag` tenía `position: relative` ganado por `.app-card > *`
(misma especificidad, más abajo) y se veía como barra de ancho completo; se
restauró el `absolute` con `.app-card > .app-card__popular-tag` en `base.css`.
