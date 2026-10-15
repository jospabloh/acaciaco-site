# Baristop v2 — design spec

Status: design, 2026-10-15. Input: `2026-10-15-baristop-v2-brief.md` + annotated
screenshots `baristop-v2-cliente/1.jpg … 19.jpg`. Live reference: `baristop/index.html`
(untouched until the switch, §7).

This document is the contract between three parallel workstreams (§9). Anything a
workstream needs from another — the content JSON shape, the API request/response
shapes, the image-spec table, file paths — is written here, not negotiated later.

---

## 0. Decisions at a glance

| Topic | Decision |
|---|---|
| Stack | Static HTML + vanilla JS (IIFE, `var`) + one CSS file. No framework, no bundler, no npm deps inside `baristop-v2/`. |
| Content store | One Google Sheet (one tab per section) + one Drive folder for images. |
| Backend | Google Apps Script Web App, **container-bound to the Sheet** (so "Make a copy" of the Sheet carries the script along). All calls `POST` with `Content-Type: text/plain`; JSON responses. |
| Host-specific value | Exactly one: `BARISTOP_API_URL` in `baristop-v2/config.js`. Empty string = demo mode. |
| Relative paths on a `cleanUrls` host | `vercel.json` serves the page at `/baristop-v2` (no trailing slash), where `css/site.css` would resolve to `/css/site.css`. Both pages open with a 6-line inline bootstrap that computes `<base href>` from `location.pathname` (§3.0). No absolute `/baristop-v2/…` path anywhere, so the folder still moves to any host unchanged. |
| Logo on the white hero | The round seal `assets/baristop-logo.png` (512 × 512, wine disc with cream lettering — what the client's Instagram shows). The transparent lockup `baristop-lockup.png` is tan-on-transparent and vanishes on white; it is kept only for the dark nav/footer (§1.3). |
| Quote e-mail | Subject `<branch.subjectTag> <Nombre> (<Negocio>)` with per-branch tags `[BARISTOP AGS]` / `[BARISTOP DGO]`; recipients = the branch list ∪ `site.quoteAlwaysTo` (Silvia, `roseta.cafeteria@gmail.com`, seeded and required non-empty). |
| URLs from the Sheet | Only `https://` is ever placed in an `href`, enforced in both `Shared.validateSection` and the renderer; `tel:`, `mailto:` and `wa.me` links are built by the renderer from digits/e-mails, never taken from data (§1.15). |
| First paint | Inline default copy in `index.html` → `data/default-content.json` → `localStorage` cache → live API. Each later layer re-renders only if its `updatedAt` is newer. |
| Preview gate | Vercel Routing Middleware (`middleware.js` at repo root), matcher limited to `/baristop-v2`, HttpOnly cookie, SHA-256 hash from `BARISTOP_PREVIEW_HASH`, fail closed. |
| Admin auth | Password → SHA-256 compared in Apps Script against a Script Property; signed expiring token; fail closed when unset. |
| Images | Admin resizes/compresses in the browser to the documented box, uploads base64 → Drive (anyone-with-link, reader) → URL `https://lh3.googleusercontent.com/d/<fileId>`. |
| Video | Recipe cards link out to the video URL (YouTube/Instagram/TikTok) in a new tab. No `<iframe>`/`<video>` on acaciaco.com.mx because `vercel.json`'s CSP (`frame-src`, no `media-src`) blocks them. Embeds are a post-migration option (§7.3). |
| Removed from the live page | Fake testimonial block ("testimonio de muestra"), every "mayoreo" wording, Refrigeración, Vitrinas, Tapioca, Vasos y desechables, "en Aguascalientes"-only wording, "Entrega a domicilio en la ciudad". |

---

## 1. Page structure (`baristop-v2/index.html`)

Mobile-first. Breakpoints: 680 px (phone → 2 columns), 820 px (hamburger → inline nav),
920 px (3-column grids). Visual language is the live page's: Fraunces (headings) +
Inter (body); tokens copied verbatim from the live `:root` (`--wine:#A3282A`,
`--wine-deep:#6E1B1D`, `--wine-900:#511518`, `--cream:#F3E8D6`, `--cream-card:#FBF3E6`,
`--gold:#C7973F`, `--gold-soft:#DDBE74`, `--espresso:#3A2218`, `--ink:#2B1A14`,
`--cream-text:#F5E9D5`, `--muted-cream:#D7B49E`, `--muted:#7A6253`, `--line`,
`--line-cream`, `--pad`, `--maxw:1200px`, `--shadow-card`, `--shadow-float`, `--ease`),
plus one new token `--paper:#FFFFFF` for the white hero. Paper-grain `body::after`
overlay, `.reveal` IntersectionObserver, condensing sticky nav and the gold hairline
under the nav all carry over. Fonts load from Google Fonts (allowed by the CSP and
reachable from any future host).

"Editable" below means the value comes from `content.json` (§2) and is overwritten
by the renderer; the HTML ships the same default text inline so the page reads
correctly without JS and for crawlers.

Section order and anchors:

```
#anuncios  Announcement bar (hidden when empty)
           Nav
#top       Hero image strip (4 images) + white hero
           Quick strip (4 facts)
#promos    Promos (hidden when empty)
#oferta    Qué ofrecemos (2 pillars)
#catalogo  Catálogo — Maquinaria (categories → detail dialog) + Insumos
#porque    Por qué Baristop (4 values)
#proceso   Cómo trabajamos (3 steps)
#recetas   Recetas
#franquicias  Baristop en tu ciudad
#cotiza    Cotiza / Contacto — two branches + shared social + form
#alianzas  Alianzas estratégicas (logos)
           Footer
```

### 1.1 Announcement bar `#anuncios`

Above the nav, `--wine-900` background, `--gold-soft` text, 13 px, centered, one
line (ellipsis on phones). Shows the first visible announcement whose date window
contains today (§2.11); nothing rendered (no empty bar, no spacing) when there is
none. Optional link wraps the text. A "×" (`aria-label="Cerrar aviso"`) hides it for
the session (`sessionStorage['baristop-v2:announcement-dismissed'] = id`).

### 1.2 Nav

Sticky, same look as live (`rgba(81,21,24,.86)` + blur, condenses to 60 px on scroll).

Links, in the order the client circled (img 1: the new slot sits after "Contacto"):

> Qué ofrecemos · Catálogo · Cómo trabajamos · Contacto · **Recetas** · [ **Cotiza tu equipo e insumos** ]

The CTA label is editable (`site.navCta`). Links are static and target:
`Qué ofrecemos → #oferta`, `Catálogo → #catalogo`, `Cómo trabajamos → #proceso`,
`Contacto → #cotiza` (the contact data and the form live in the same section),
`Recetas → #recetas`, CTA → `#cotiza`. **Franquicias is deliberately not in the nav**
(the client circled one new slot, for Recetas, and six items plus the CTA no longer
fit the condensed bar); it is linked from the footer (§1.14) and reachable by
scrolling. Nav brand = the lockup `assets/baristop-lockup.png` at 36 px tall (tan
lettering reads well on the wine bar).

**Phones (< 820 px):** the live page simply hides the links. v2 adds a hamburger
`<button class="nav-toggle" aria-expanded="false" aria-controls="nav-menu" aria-label="Abrir menú">`
(three bars drawn in CSS) that opens a full-width panel under the bar with the same
five links stacked plus the CTA. Closes on link click, on `Escape`, on outside click.
`aria-expanded` toggles; focus returns to the button on close. Nav CTA is hidden
under 480 px (the panel carries it) so the brand + toggle never wrap.

### 1.3 Hero image strip + hero `#top`

Directly under the nav (img 12: the four green boxes), a 4-up strip:
**maquinaria, salsas, jarabes, polvos** (editable, §2.5). Each tile: image
(`object-fit: cover`, 4:3), a small caption pill bottom-left in `--gold-soft` on
`rgba(81,21,24,.7)`. Grid: 2×2 under 680 px, 4×1 above. Gap 2 px, no radius on the
outer edges so it reads as a banner; 10 px radius on the inner tiles above 680 px.

The strip is **exactly four tiles**. The renderer takes the first four visible rows
in `order`; admin caps the `Portada` tab at four rows (§2.5) so nothing is silently
ignored. With fewer than four visible rows the grid still has four cells: the
missing ones show the `hero-4x3.svg` placeholder without a caption (the gap is never
collapsed, so the banner keeps its height and the client sees what is missing).
With zero visible rows the strip is not rendered at all and the hero starts
directly under the nav.

Then the hero, **white background** (`--paper`), with the live page's gold
"extraction line" kept on the left edge (it still reads on white). Two columns above
880 px (copy left, seal right); stacked on phones with the seal first, centered,
max-width 220 px.

Copy (all editable via `site.*`):

- Seal: `assets/baristop-logo.png` (512 × 512 PNG, wine `#A3282A` disc, cream
  lettering `BARISTOP` + arc `Insumos y Maquinaria para Cafetería`, transparent
  corners; copied unchanged from `baristop/assets/`). Rendered at 300 px (desktop) /
  220 px (phones) with a soft `--shadow-float`. This is the asset the client's
  Instagram uses and it is self-coloured, so it reads on `--paper` white. The
  transparent lockup (`baristop-lockup.png`, 512 × 336, tan lettering) is **not**
  used on the hero: on white its wordmark is near-invisible (checked 2026-10-15);
  it stays as the nav/footer brand on wine backgrounds.
- Eyebrow (`.seal-label`, **tinto** `--wine`): `Insumos y Maquinaria para Cafetería`
  (text, under the seal on phones / beside it on desktop — the client asked for the
  phrase in tinto, and the seal's own arc is cream, so the text version carries it).
- H1 (`--wine` for the first clause, `<em>` in `--gold` italic as today):
  `Todo para tu cafetería y <em>barra de bebidas</em>.`
- Subtitle (`--ink`):
  `Maquinaria profesional y consumibles para cafeterías, restaurantes y barras. Contamos con presencia en Aguascalientes y Durango. Enviamos a toda la República.`
- Standout line (Fraunces italic 500, `--wine-deep`, 1.35 em, own paragraph with a
  short gold rule above it): `Un solo proveedor, una sola entrega.`
- Buttons: `btn-gold` `Cotiza tu equipo e insumos →` (href `#cotiza`) ·
  `btn-ghost` (border `--wine` at .45 opacity on white) `Ver catálogo` (href `#catalogo`).
- Trust row (icons in `--gold`): `Aguascalientes` · `Durango` ·
  `Envíos a toda la República` · `Lun a Vie desde 9:00 am · Sáb en Durango` (last one
  editable: `site.heroTrustHours`; the seed covers both branches' hours as the brief
  asks — the full per-branch schedule is in §1.12, this is the one-line summary).

### 1.4 Quick strip

Wine band as today (`--wine-900`), four items (editable `site.strip1Title/Text … strip4`):

| Title | Text |
|---|---|
| `Maquinaria + Insumos` | `Todo en un mismo lugar` |
| `Asesoría` | `Te ayudamos a elegir` |
| `Envíos` | `A toda la República` |
| `Dos sucursales` | `Aguascalientes y Durango` |

**Flagged change:** the live item `Mayoreo / Precios para tu negocio` is dropped
(brief: strip "mayoreo" consistently).

### 1.5 Promos `#promos`

Only rendered when at least one promo is visible and inside its date window.
`--cream` background, `.seal-label` `Promociones`, cards (1 → 2 → 3 columns):
image (16:9, cover), title (Fraunces), text, optional button (`btn-wine`), and a
small `Vigente hasta <fecha>` line when `endsAt` is set. Dates shown as
`15 de noviembre` (es-MX, no year unless different from the current one).

### 1.6 Qué ofrecemos `#oferta`

`.seal-label` `Qué ofrecemos`. H2 `Dos cosas que tu barra no puede improvisar.`
Intro (editable `site.offerIntro`), **the "Lo dice nuestro nombre…" sentence removed**:

> `El equipo que sostiene tu operación y los consumibles que salen en cada bebida, surtidos por el mismo proveedor.`

Two pillar cards as today (wine / espresso):

- `01 — Equipo` · H3 `Maquinaria profesional` · text (editable `site.offerMachineryText`):
  `Cafeteras, molinos y licuadoras. Equipo confiable para operar sin pausas, con asesoría para elegir lo que tu volumen necesita.`
  Chips = names of visible machinery categories (§2.6) → `Cafeteras espresso` `Molinos` `Licuadoras`.
  Link `Ver maquinaria →` `#catalogo`.
- `02 — Consumibles` · H3 `Insumos para bebidas` · text (editable `site.offerSuppliesText`):
  `Café, polvos y bases, jarabes y salsas, y tisanas. Todo para que tu carta salga igual, turno tras turno, sin quedarte corto.`
  Chips = names of visible insumos (§2.8) → `Café` `Polvos y bases` `Jarabes y salsas` `Tisanas`.
  Link `Ver insumos →` `#catalogo`.

Chips are derived from the catalog so removing a category in admin removes its chip.

### 1.7 Catálogo `#catalogo`

`.seal-label` `Catálogo`, H2 `Surtimos tu barra de principio a fin.` (editable
`site.catalogTitle`), intro (editable `site.catalogIntro`):
`Una cotización para todo: del equipo a los consumibles. Estas son las líneas que más nos piden cafeterías y restaurantes.`

**Maquinaria** (`<h3>Maquinaria <span class="tag">Equipo</span></h3>`). One card per
visible category, **image on the card** (3:2, cover, top of the card, 10 px radius),
name, tagline, and a `Ver equipos →` affordance. The whole card is a `<button>`
(`aria-haspopup="dialog"`). Seed: `Cafeteras espresso / Semi y automáticas`,
`Molinos / Molienda constante`, `Licuadoras / Para frappés y smoothies`.
Refrigeración and Vitrinas do not exist in the seed.

Clicking opens a **detail dialog** (`<dialog>` with a `div[role=dialog]` fallback
for Safari < 15.4): category name as H3, description, then one row per visible
machine of that category: image (4:3, 160 px wide on desktop, full width on phones),
name (Fraunces 600), description, optional specs rendered as a `<ul>` (one `<li>` per
line of the specs field). Each machine row has a link `Cotizar este equipo` → closes
the dialog, scrolls to `#cotiza`, sets the select to `Maquinaria / equipo` and
prefills the message with `Me interesa: <nombre>`. Close button `Cerrar`, `Escape`,
backdrop click. Focus is trapped inside while open and returns to the card on close.
Empty category copy: `Estamos actualizando este catálogo. Cotiza por WhatsApp y te enviamos opciones.`
URL hash `#maquinaria-<categoryId>` is set while open so a link can deep-link to a
category.

**Insumos** (`<h3>Insumos <span class="tag">Consumibles</span></h3>`). One card per
visible insumo: image (4:5, cover; the example posters are portrait), name, tagline,
and the description paragraph. Seed copy (from the brief, verbatim where given):

| Name | Tagline | Description |
|---|---|---|
| `Café` | `Finca en Coatepec, Veracruz` | `Trabajamos con una finca en Coatepec, Veracruz. Sin intermediarios.` |
| `Polvos y bases` | `Frappé, chai, taro y matcha` | `Bases para frappé, chai, taro y matcha. Marcas Sahu y Samlet.` |
| `Jarabes y salsas` | `Proveedor autorizado Yalini` | `Jarabes y salsas para bebidas frías y calientes. Proveedor autorizado Yalini.` |
| `Tisanas` | `Proveedor autorizado Soy Té` | `Infusiones de origen para tu carta. Proveedor autorizado Soy Té.` |

Seed images: `Polvos y bases` → `assets/ejemplo/frappe-taro.jpg` (1024 × 1536,
portrait, matches the card's 4:5 box with a light crop top/bottom); the other three
→ placeholders (§3.4). `samlet-moca.jpg` (1536 × 1024, landscape) is **not** seeded
into a 4:5 card — it would crop the bag and the cup; it is kept in `assets/ejemplo/`
only as upload material for the Portada strip (4:3) during testing.
`frappe-capuchino.jpg` is not seeded anywhere: its poster reads "Saju" instead of
"Sahu" (an AI artefact) and must not ship as a real product image without the
client's OK — the test plan tells testers not to upload it to a visible row.
Tapioca y boba does not exist in the seed.

### 1.8 Por qué Baristop `#porque`

Same layout as the live "values" section. `.seal-label` `Por qué Baristop`, H2
`El proveedor que entiende la barra.`, intro unchanged. Four cards (editable
`site.why1Title/Text … why4`):

| Title | Text |
|---|---|
| `Todo en un lugar` | `Equipo y consumibles con un solo pedido y una sola factura.` |
| `Asesoría real` | `Te ayudamos a elegir el equipo y la receta según tu volumen.` |
| `Envíos a toda la República` | `Te lo enviamos a tu negocio, en Aguascalientes, Durango o cualquier estado, sin que pares la barra.` |
| `Dos sucursales` | `Atención cercana desde Aguascalientes y Durango.` |

**Flagged changes:** `Entrega a domicilio / …en la ciudad` → nationwide wording;
`Precios de mayoreo / Cotización por volumen…` card removed and replaced by `Dos sucursales`.

### 1.9 Cómo trabajamos `#proceso`

H2 `De la cotización a tu barra en tres pasos.` Steps (editable `site.step1Title/Text …`):

| # | Title | Text |
|---|---|---|
| 01 | `Cuéntanos tu barra` | `Qué preparas, tu volumen y qué equipo o insumos buscas. Por WhatsApp o aquí mismo.` |
| 02 | `Te asesoramos y cotizamos` | `Elegimos contigo el equipo y los consumibles correctos.` |
| 03 | `Te lo enviamos` | `Recibes tu pedido en tu negocio, en cualquier parte de la República, listo para operar. Reabasteces cuando lo necesites.` |

**Flagged changes:** step 02 lost `, con precio de mayoreo claro`; step 03 title was
`Entregamos a domicilio`.

The live testimonial block that followed this section (`"Dejamos de pelear con tres
proveedores…" — testimonio de muestra`) is **removed**: it is invented copy.

### 1.10 Recetas `#recetas`

`--cream-card` background. `.seal-label` `Recetas`, H2 (editable `site.recipesTitle`)
`Lo que puedes preparar con nuestros productos.`, intro (`site.recipesIntro`)
`Ideas de bebidas con las bases, jarabes y tisanas que distribuimos. Fotos y videos para inspirar tu carta.`

Grid of cards (1 → 2 → 3 columns): photo (4:5, cover), title (Fraunces), short
description. If the recipe has `videoUrl`, a play badge (gold circle, triangle) sits on
the photo and the whole card is an `<a target="_blank" rel="noopener">` to the video,
with a visible `Ver video ↗` line; otherwise the card is static. A recipe may have
only a video: the card then shows the placeholder image with the play badge.

Empty state (no visible recipe): the section still renders (the nav links to it) with
one centered line, editable `site.recipesEmpty`:
`Muy pronto: recetas con nuestros productos.`

### 1.11 Baristop en tu ciudad `#franquicias`

Wine panel (`--wine` → `--wine-deep` gradient), centered. `.seal-label`
`Baristop en tu ciudad`, H2 (`site.franchiseTitle`) `Franquicias abiertas.`,
text (`site.franchiseText`)
`¿Te interesa tener Baristop en tu ciudad? Contáctanos y te contamos cómo funciona.`
Buttons: `btn-gold` (`site.franchiseCta`) `Quiero más información` → `#cotiza`, sets the
select to `Franquicia / Baristop en mi ciudad`; `btn-ghost` `WhatsApp` →
`https://wa.me/<site.franchiseWhatsapp>` (seed: the Aguascalientes number).

### 1.12 Cotiza / Contacto `#cotiza`

Wine panel as today. `.seal-label` `Cotiza para tu negocio`, H2 `Surtamos tu barra.`,
intro (`site.quoteIntro`): `Cuéntanos qué necesitas — equipo, insumos o ambos.`
(**flagged:** `y te cotizamos con precio de mayoreo` removed, img 13).

**Two branch columns** (img 10: the green divider), stacked on phones, each a card
on `rgba(81,21,24,.35)`:

- Big branch title (Fraunces 600, 2 rem, `--cream-text`): `Aguascalientes` / `Durango`.
- Branch photo (3:2, cover, 10 px radius; placeholder until the client sends one).
- `btn-gold` full width: `WhatsApp Aguascalientes` / `WhatsApp Durango` →
  `https://wa.me/52<digits>` (`site`-independent, from the branch).
- Rows with gold icons: phone (`tel:` link built from the digits, shown grouped
  `449 178 4526`), address (plain text; link to `mapUrl` when present,
  `Ver en el mapa ↗`), each e-mail as `mailto:`, hours (one line per entry).

Seed data (§2.4, from the brief's confirmed data): Aguascalientes = phone and
WhatsApp **`449 178 4526`** (the old `449 465 9347` is obsolete and appears nowhere),
`Cordillera de los Alpes 199, esq. Monte Blanco, Jardines de la Concepción II Sección, C.P. 20120, Aguascalientes, Ags.`,
`ventas.baristop@gmail.com`, `Lunes a Viernes · 9:00 am – 4:00 pm`. Durango =
phone and WhatsApp `618 181 2019`,
`Prolongación Gómez Palacio 448 Ote., Local 5, Zona Centro, C.P. 34000, Durango, Dgo.`,
`karime.baristop@gmail.com`, `Lunes a Viernes · 9:00 am – 5:00 pm` and
`Sábado · 10:00 am – 2:00 pm`. The only placeholders left in this section are the two
branch photos. Generic rule (kept for future rows): a value that is empty or exactly
`Por definir` renders in `--muted-cream` italics (`Dirección por confirmar`) rather
than being hidden, so the client sees what is missing on the preview.

**Shared row** between/below the two cards (`Síguenos`): Instagram
`@baristop_distribuidora` → `https://www.instagram.com/baristop_distribuidora/`,
Facebook → `https://www.facebook.com/p/Baristop-Distribuidora-100095085646432/`
(the brief's confirmed URL; the live page's `profile.php?id=…` form points at the
same page but the confirmed one is the vanity URL the client shares, so it wins).

**Quote form** (right column above 880 px, below the branches on phones):

- Branch selector, label `¿Con qué sucursal quieres cotizar?`: a two-button
  segmented control (`role="radiogroup"`, keyboard arrows) listing the visible
  branches; default = first visible. Selecting a branch also retargets the WhatsApp
  fallback button.
- Fields: `Nombre` (`Tu nombre`), `Negocio` (`Nombre de tu cafetería / restaurante`),
  `Teléfono o correo` (`Para responderte`, required), `¿Qué buscas?` select:
  `Maquinaria / equipo`, `Insumos / consumibles`, `Equipo + insumos para barra nueva`,
  `Reabastecimiento`, `Franquicia / Baristop en mi ciudad`, `Asesoría / aún no estoy seguro`;
  `Mensaje` (`Cuéntanos qué preparas y qué necesitas`). Hidden honeypot `sitio_web`
  and a hidden `ts` (form-open timestamp).
- Buttons: `btn-gold` `Enviar cotización` (submits to the API, §5.6) and a text link
  `o envíalo por WhatsApp` (opens `wa.me/<selected branch>` with the composed text,
  same as the live page).
- States: sending (`Enviando…`, button disabled); success replaces the form with
  `¡Listo! Recibimos tu solicitud. Te respondemos en horario de atención.`
  (`site.quoteSuccess`); error keeps the form and shows
  `No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.`
- Demo mode (no API URL): the primary button is replaced by the note
  `Vista previa: el envío por correo se activa al conectar el panel.`; WhatsApp still works.

### 1.13 Alianzas estratégicas `#alianzas`

`--cream` background. `.seal-label` `Alianzas estratégicas`, H2 (`site.alliancesTitle`)
`Trabajamos con los mejores.`, one-line intro (`site.alliancesIntro`)
`Marcas y proveedores con los que surtimos tu barra.` Logo row: flex-wrap, each logo
in a 180 × 90 box (`object-fit: contain`), grayscale at 70 % opacity, full colour on
hover/focus; wrapped in `<a target="_blank" rel="noopener">` when `url` is set.
Seed: Coffee Solutions, Soy Té, Yalini, Sahu, Samlet — all with placeholder logos.
Hidden entirely when no alliance is visible.

### 1.14 Footer

Four columns (2 on phones): brand + tagline (`site.footerTagline`)
`Insumos y maquinaria para cafeterías, restaurantes y barras de bebidas. Aguascalientes · Durango · Envíos a toda la República.`;
`Catálogo`: `Maquinaria`, `Insumos`, `Recetas`, `Cómo trabajamos`, `Franquicias`
(→ `#franquicias`; the footer uses the brief's short label, the section heading keeps
`Baristop en tu ciudad`); one column per visible branch (title, `WhatsApp <Sucursal>`
link — the footer repeats the same label convention as §1.12, e.g.
`WhatsApp Aguascalientes` — tel, e-mail(s), address, hours); social links row under them. Legal line: `© <año> Baristop Distribuidora. Todos los derechos reservados.` ·
`Todo para tu cafetería y barra de bebidas.` Year is computed.

### 1.15 Accessibility and behaviour notes

- All interactive data-driven DOM is built with `createElement`/`textContent`. The
  only `innerHTML` allowed is for static inline SVG icons defined in the JS source.
- **URL safety.** Every URL that comes from content (`branches.mapUrl`, `social.url`,
  `recipes.videoUrl`, `alliances.url`, `announcements.url`, `promos.ctaUrl`) passes
  `isSafeHttpsUrl()` in the renderer (`^https://[^\s/$.?#].[^\s]*$` and
  `new URL()` parses with `protocol === "https:"`) before it is assigned to `href`;
  anything else (including `javascript:`, `data:`, `http://`, relative paths) is
  treated as empty — the element renders without a link. The same rule lives in
  `Shared.validateSection` (§5.4) so the admin and the Apps Script reject it too, but
  the Sheet is hand-editable (§2.13), so the renderer never trusts it. `tel:`,
  `mailto:` and `https://wa.me/<digits>` links are **built by the renderer** from the
  digit/e-mail fields (digits stripped with `normalizeDigits`, e-mails checked with
  `isEmail`); no data field ever becomes one of those `href`s verbatim.
- Images from the Sheet get `loading="lazy"` (except the hero strip) and `alt` from
  the item's name/alt field; a failed load swaps to the matching placeholder.
- Reduced motion: reveal animations and the button sheen are disabled under
  `prefers-reduced-motion`.
- The site has no dark theme (the live page has none either); `color-scheme: light`.

---

## 2. Content model

### 2.1 `content.json` — the single document

Everything editable lives in one JSON document. The API returns it whole, the admin
edits it per section, the site renders it. Shape (TypeScript-ish, for reading only):

```ts
type Content = {
  version: 1;
  updatedAt: string;                 // ISO 8601, set by the backend on every save
  site: Record<SiteKey, string>;     // §2.2 — flat key/value texts
  social: Social[];                  // §2.3
  branches: Branch[];                // §2.4
  heroImages: HeroImage[];           // §2.5
  machineryCategories: Category[];   // §2.6
  machines: Machine[];               // §2.7
  insumos: Insumo[];                 // §2.8
  recipes: Recipe[];                 // §2.9
  alliances: Alliance[];             // §2.10
  announcements: Announcement[];     // §2.11
  promos: Promo[];                   // §2.12
};

// every list item shares:
type Base = { id: string; order: number; visible: boolean };
```

Rules:

- `id`: stable slug `^[a-z0-9][a-z0-9-]{1,39}$`. Seeds use readable ids (`ags`,
  `durango`, `cafeteras`); admin generates `<section>-<base36 timestamp>` for new rows.
  Ids never change after creation (machines reference categories by id).
- `order`: integer; lists are sorted ascending by `order`, then by id. Admin rewrites
  `order` as 10, 20, 30… on every save.
- `visible`: `false` hides the item from the site but keeps it in the Sheet.
- Image fields hold either an absolute `https://` URL (Drive) or a path relative to
  the site root (`assets/…`). Empty string = show the section's placeholder.
- Multi-line text fields (descriptions, specs, hours) keep `\n`; the renderer turns
  lines into `<br>` or `<li>` as documented per field.

### 2.2 `site` keys (tab `Ajustes`)

Key/value. Seed values are the copy in §1. Column `Descripción` in the Sheet is the
help text shown in admin.

| Key | Where | Seed |
|---|---|---|
| `navCta` | nav + hero primary button | `Cotiza tu equipo e insumos` |
| `heroEyebrow` | 1.3 | `Insumos y Maquinaria para Cafetería` |
| `heroTitle` | 1.3 (before the accent) | `Todo para tu cafetería y` |
| `heroTitleAccent` | 1.3 (`<em>`) | `barra de bebidas` |
| `heroSubtitle` | 1.3 | `Maquinaria profesional y consumibles para cafeterías, restaurantes y barras. Contamos con presencia en Aguascalientes y Durango. Enviamos a toda la República.` |
| `heroStandout` | 1.3 | `Un solo proveedor, una sola entrega.` |
| `heroSecondaryCta` | 1.3 | `Ver catálogo` |
| `heroTrustHours` | 1.3 | `Lun a Vie desde 9:00 am · Sáb en Durango` |
| `strip1Title` … `strip4Title`, `strip1Text` … `strip4Text` | 1.4 | table in §1.4 |
| `offerTitle` | 1.6 | `Dos cosas que tu barra no puede improvisar.` |
| `offerIntro` | 1.6 | see §1.6 |
| `offerMachineryTitle` / `offerMachineryText` | 1.6 | `Maquinaria profesional` / see §1.6 |
| `offerSuppliesTitle` / `offerSuppliesText` | 1.6 | `Insumos para bebidas` / see §1.6 |
| `catalogTitle` / `catalogIntro` | 1.7 | see §1.7 |
| `whyTitle` / `whyIntro` | 1.8 | `El proveedor que entiende la barra.` / `Trabajamos con quienes viven la operación todos los días. Menos proveedores, menos pendientes y más tiempo para atender a tu cliente.` |
| `why1Title` … `why4Title`, `why1Text` … `why4Text` | 1.8 | table in §1.8 |
| `processTitle` | 1.9 | `De la cotización a tu barra en tres pasos.` |
| `step1Title` … `step3Title`, `step1Text` … `step3Text` | 1.9 | table in §1.9 |
| `recipesTitle` / `recipesIntro` / `recipesEmpty` | 1.10 | see §1.10 |
| `franchiseTitle` / `franchiseText` / `franchiseCta` | 1.11 | see §1.11 |
| `franchiseWhatsapp` | 1.11 | `524491784526` |
| `quoteTitle` / `quoteIntro` / `quoteSuccess` | 1.12 | see §1.12 |
| `quoteAlwaysTo` | backend 5.6 — comma-separated e-mails that receive **every** request, both branches (Silvia, owner). **Required: at least one valid e-mail** — admin refuses to save `Textos` otherwise (`Silvia debe recibir todas las solicitudes: escribe al menos un correo válido.`) and `Shared.validateSection('site')` enforces the same rule server-side. Private: stripped from the public `getContent` (§5.2). | `roseta.cafeteria@gmail.com` |
| `quoteFallbackTo` | backend 5.6 — used when a branch resolves to no valid address. Private. | `ventas.baristop@gmail.com` |

There is **no global subject prefix**: the subject tag is per branch
(`branches[].subjectTag`, §2.4), as the brief requires.
| `alliancesTitle` / `alliancesIntro` | 1.13 | see §1.13 |
| `footerTagline` | 1.14 | see §1.14 |
| `legalName` | 1.14 | `Baristop Distribuidora` |

Unknown keys in the Sheet are passed through untouched; missing keys fall back to
the default content.

### 2.3 `social` (tab `Redes`)

```ts
type Social = Base & { name: string; handle: string; url: string };
```
Seed: `{id:"instagram", name:"Instagram", handle:"@baristop_distribuidora", url:"https://www.instagram.com/baristop_distribuidora/"}`,
`{id:"facebook", name:"Facebook", handle:"Baristop Distribuidora", url:"https://www.facebook.com/p/Baristop-Distribuidora-100095085646432/"}`
(the brief's confirmed URL, not the live page's `profile.php?id=` form — see §1.12).
Social networks are shared by both branches for now (brief); only WhatsApp and
e-mail differ per branch.
The icon is chosen by `id` (`instagram`, `facebook`, `tiktok`, `whatsapp`; anything else
gets a generic link icon).

### 2.4 `branches` (tab `Sucursales`)

```ts
type Branch = Base & {
  name: string;            // "Aguascalientes"
  whatsapp: string;        // digits with country code: "524491784526"
  phone: string;           // digits: "4491784526" (displayed as 449 178 4526); same line as WhatsApp for both seeds
  address: string;         // may be "Por definir"
  mapUrl: string;          // optional Google Maps link (https:// only)
  emails: string[];        // public e-mails shown on the site
  hours: string[];         // one entry per line
  photo: string;           // image URL
  quoteRecipients: string[]; // e-mails that receive this branch's quote requests (NOT shown on the site; private)
  subjectTag: string;      // prefix of every quote e-mail subject: "[BARISTOP AGS]" (editable per branch)
};
```

Seed (brief, "Confirmed data" 2026-10-15):

```json
[
  {"id":"ags","order":10,"visible":true,"name":"Aguascalientes",
   "whatsapp":"524491784526","phone":"4491784526",
   "address":"Cordillera de los Alpes 199, esq. Monte Blanco, Jardines de la Concepción II Sección, C.P. 20120, Aguascalientes, Ags.",
   "mapUrl":"","emails":["ventas.baristop@gmail.com"],
   "hours":["Lunes a Viernes · 9:00 am – 4:00 pm"],"photo":"",
   "quoteRecipients":["ventas.baristop@gmail.com"],
   "subjectTag":"[BARISTOP AGS]"},
  {"id":"durango","order":20,"visible":true,"name":"Durango",
   "whatsapp":"526181812019","phone":"6181812019",
   "address":"Prolongación Gómez Palacio 448 Ote., Local 5, Zona Centro, C.P. 34000, Durango, Dgo.",
   "mapUrl":"","emails":["karime.baristop@gmail.com"],
   "hours":["Lunes a Viernes · 9:00 am – 5:00 pm","Sábado · 10:00 am – 2:00 pm"],"photo":"",
   "quoteRecipients":["karime.baristop@gmail.com"],
   "subjectTag":"[BARISTOP DGO]"}
]
```

Who receives what (all editable): Aguascalientes → Karla (Ventas,
`ventas.baristop@gmail.com`) + Silvia; Durango → Karime (`karime.baristop@gmail.com`)
+ Silvia. **No Fernando recipient is seeded** (he has no e-mail until further
notice — brief). Silvia is never a branch recipient: she is `site.quoteAlwaysTo`
(`roseta.cafeteria@gmail.com`) and is added to every request by `resolveRecipients`.
The `449 465 9347` number from the Instagram bio is obsolete and is not seeded.
`subjectTag` is required, 1–24 chars; admin shows it as `Etiqueta asunto` with help
`Va al inicio del asunto de cada correo de cotización de esta sucursal, por ejemplo [BARISTOP AGS].`

### 2.5 `heroImages` (tab `Portada`)

```ts
type HeroImage = Base & { title: string; image: string; alt: string };
```
Seed (4 rows, placeholders): `maquinaria / Maquinaria`, `salsas / Salsas`,
`jarabes / Jarabes`, `polvos / Polvos`. The strip shows the first four visible rows
(§1.3). **Admin caps this tab at 4 rows**: `+ Agregar` is disabled with the note
`La portada tiene exactamente 4 imágenes. Edita o reemplaza una de las existentes.`
once four rows exist, and `Shared.validateSection('heroImages')` rejects more than
four rows (`La portada admite máximo 4 imágenes.`). Fewer than four visible rows is
allowed (e.g. one hidden while a photo is pending); the site fills the empty cells
with the placeholder (§1.3).

### 2.6 `machineryCategories` (tab `CategoriasMaquinaria`)

```ts
type Category = Base & { name: string; tagline: string; description: string; image: string };
```
Seed: `cafeteras / Cafeteras espresso / Semi y automáticas / Equipos semiautomáticos y automáticos para barra, con asesoría según tu volumen.`,
`molinos / Molinos / Molienda constante / Molinos para espresso y filtrado, de uso continuo.`,
`licuadoras / Licuadoras / Para frappés y smoothies / Licuadoras de alto rendimiento para bebidas frías.`
Images: placeholders.

### 2.7 `machines` (tab `Maquinas`)

```ts
type Machine = Base & { categoryId: string; name: string; description: string; specs: string; image: string };
```
`specs`: free text, one spec per line (rendered as a list). Seed: one hidden
placeholder per category (`visible:false`, name `Modelo por definir`, description
`Por definir`) so the admin shows the structure. Machines whose `categoryId` matches
no visible category are ignored by the site (admin shows them as `Sin categoría`).

### 2.8 `insumos` (tab `Insumos`)

```ts
type Insumo = Base & { name: string; tagline: string; description: string; image: string };
```
Seed: §1.7 table; ids `cafe`, `polvos`, `jarabes`, `tisanas`.

### 2.9 `recipes` (tab `Recetas`)

```ts
type Recipe = Base & { title: string; description: string; photo: string; videoUrl: string };
```
At least one of `photo`/`videoUrl` must be set (admin validation). Seed: two hidden
examples using `assets/ejemplo/frappe-capuchino.jpg` and `frappe-taro.jpg` with titles
`Frappé capuchino` / `Frappé de taro` and description `Receta por definir` — visible
`false` so the public page shows the empty state until the client sends real ones.

### 2.10 `alliances` (tab `Alianzas`)

```ts
type Alliance = Base & { name: string; logo: string; url: string };
```
Seed ids/names: `coffee-solutions / Coffee Solutions`, `soy-te / Soy Té`,
`yalini / Yalini`, `sahu / Sahu`, `samlet / Samlet`; `logo` and `url` empty.

### 2.11 `announcements` (tab `Anuncios`)

```ts
type Announcement = Base & { text: string; url: string; startsAt: string; endsAt: string };
```
`startsAt`/`endsAt`: `YYYY-MM-DD` or empty. Shown when visible and
`startsAt <= today <= endsAt` (empty bound = open). Seed: empty list.

### 2.12 `promos` (tab `Promos`)

```ts
type Promo = Base & { title: string; text: string; image: string; ctaLabel: string; ctaUrl: string; startsAt: string; endsAt: string };
```
Same date rule. Seed: empty list.

### 2.13 Google Sheet mapping

One spreadsheet, tabs created by `setup()` (§5.8). Row 1 = headers (Spanish, frozen,
bold); data from row 2. Columns are matched **by header text, not position**, so the
client may reorder columns but must not rename them. Booleans are the checkbox
`TRUE/FALSE` (setup inserts a checkbox data-validation on `Visible`). Arrays:
`Correos` and `Correos cotización` are comma-separated; `Horario` is one entry per
line inside the cell (Alt+Enter). The admin never asks the client to type these
formats — it edits them as lists — but the Sheet remains hand-editable. Because of
that, nothing read from a cell is trusted by the site: URL cells that are not
`https://` are ignored by the renderer (§1.15), digits are re-normalised, and
e-mails are re-validated before mailing (§5.6).

| Tab | Headers (in order) | JSON |
|---|---|---|
| `Ajustes` | Clave · Valor · Descripción | `site` |
| `Redes` | ID · Orden · Visible · Nombre · Usuario · URL | `social` |
| `Sucursales` | ID · Orden · Visible · Nombre · WhatsApp · Teléfono · Dirección · Mapa URL · Correos · Horario · Foto · Correos cotización · Etiqueta asunto | `branches` |
| `Portada` | ID · Orden · Visible · Título · Imagen · Alt | `heroImages` |
| `CategoriasMaquinaria` | ID · Orden · Visible · Nombre · Subtítulo · Descripción · Imagen | `machineryCategories` |
| `Maquinas` | ID · Orden · Visible · Categoría · Nombre · Descripción · Especificaciones · Imagen | `machines` |
| `Insumos` | ID · Orden · Visible · Nombre · Subtítulo · Descripción · Imagen | `insumos` |
| `Recetas` | ID · Orden · Visible · Título · Descripción · Foto · Video URL | `recipes` |
| `Alianzas` | ID · Orden · Visible · Nombre · Logo · URL | `alliances` |
| `Anuncios` | ID · Orden · Visible · Texto · URL · Desde · Hasta | `announcements` |
| `Promos` | ID · Orden · Visible · Título · Texto · Imagen · Botón texto · Botón URL · Desde · Hasta | `promos` |
| `Cotizaciones` | Fecha · Sucursal · Nombre · Negocio · Contacto · Qué busca · Mensaje · Destinatarios · Estatus envío | write-only log (§5.6) |

The header ↔ key mapping is the `SCHEMA` object (§2.15) and exists in exactly two
files that a test keeps identical: `apps-script/Shared.js` and
`baristop-v2/js/schema.js`.

### 2.14 Drive folder

`setup()` creates `Baristop web — imágenes` in the owner's My Drive and stores its id
in Script Properties (`DRIVE_FOLDER_ID`). Uploads are named
`<section>-<itemId>-<yyyymmdd-hhmmss>.<ext>`, shared **anyone with the link · viewer**,
and referenced as `https://lh3.googleusercontent.com/d/<fileId>` (direct image bytes,
CORS-safe, cacheable). `fileId` is also returned so the site can fall back to
`https://drive.google.com/thumbnail?id=<fileId>&sz=w1600` if Google ever changes the
first host (the renderer tries the fallback on `onerror`). Replaced images are not
deleted (the client may want to restore); the README explains how to empty the folder.

### 2.15 Image specification table (the `SCHEMA.images` block)

Shown verbatim in admin next to every image field ("Cómo llenar esta sección").
`w × h` is the **box** the admin resizes into (aspect preserved, no crop); the site
uses `object-fit: cover` to the stated aspect, so the admin warns when the file's
aspect differs by more than 15 % (`La imagen se verá recortada en el sitio`).

| Field | Box (px) | Aspect | Format | Max weight | Admin help (Spanish) |
|---|---|---|---|---|---|
| `heroImages.image` | 1200 × 900 | 4:3 | JPG/WebP | 300 KB | `Foto horizontal, 1200 × 900 px, JPG o WebP, máx. 300 KB. Se muestra en la franja bajo el menú.` |
| `branches.photo` | 1200 × 800 | 3:2 | JPG/WebP | 400 KB | `Foto de la sucursal, 1200 × 800 px, JPG o WebP, máx. 400 KB.` |
| `machineryCategories.image` | 1200 × 800 | 3:2 | JPG/WebP | 400 KB | `Foto representativa de la categoría, 1200 × 800 px, JPG o WebP, máx. 400 KB.` |
| `machines.image` | 1200 × 900 | 4:3 | JPG/WebP/PNG | 400 KB | `Foto del equipo sobre fondo claro, 1200 × 900 px, JPG, WebP o PNG, máx. 400 KB.` |
| `insumos.image` | 1200 × 1500 | 4:5 | JPG/WebP | 500 KB | `Imagen vertical del producto, 1200 × 1500 px, JPG o WebP, máx. 500 KB.` |
| `recipes.photo` | 1080 × 1350 | 4:5 | JPG/WebP | 500 KB | `Foto vertical de la bebida, 1080 × 1350 px (formato de Instagram), JPG o WebP, máx. 500 KB.` |
| `alliances.logo` | 600 × 300 | 2:1 | PNG (transparent) or SVG | 150 KB | `Logo con fondo transparente, 600 × 300 px, PNG o SVG, máx. 150 KB.` |
| `promos.image` | 1200 × 675 | 16:9 | JPG/WebP | 350 KB | `Imagen horizontal, 1200 × 675 px, JPG o WebP, máx. 350 KB.` |

`keepAlpha: true` only for `alliances.logo` and `machines.image` (PNG stays PNG,
SVG passes through untouched after a size/type check). Everything else is re-encoded
to WebP (quality 0.82; JPEG 0.85 when the browser cannot encode WebP).

---

## 3. File layout under `baristop-v2/`

```
baristop-v2/
  index.html                 the page (inline default copy; data-* hooks for the renderer)
  config.js                  window.BARISTOP_CONFIG = { apiUrl: "" }   ← the ONLY host-specific file
  css/site.css               tokens + components (self-contained; no /styles/base.css)
  js/schema.js               SCHEMA (sections, headers↔keys, image specs) — UMD-ish, loads in node too
  js/content.js              load order, cache, demo-mode read, normalisation (window.BaristopContent)
  js/render.js               section renderers (createElement/textContent only)
  js/site.js                 boot: nav menu, reveal, dialog, form, wiring
  data/default-content.json  seed (§2) — first-paint source and offline fallback
  assets/
    baristop-logo.png, baristop-lockup.png, favicon.ico, favicon-32.png, favicon-192.png, apple-touch-icon.png  (copied from baristop/)
    ejemplo/frappe-capuchino.jpg, frappe-taro.jpg, samlet-moca.jpg
    placeholders/
      hero-4x3.svg  branch-3x2.svg  category-3x2.svg  machine-4x3.svg
      insumo-4x5.svg  recipe-4x5.svg  logo-2x1.svg  promo-16x9.svg
  admin/
    index.html  css/admin.css  js/admin.js  js/api.js  js/images.js  js/ui.js
```

Everything references siblings with relative paths (`css/site.css`, `../config.js`
from admin). No `/styles/base.css`, no `/scripts/shared.js`, no `api/`. Copying the
folder to any static host works unchanged — **provided the base URL is right**,
which §3.0 guarantees.

### 3.0 Base-URL bootstrap (why relative paths need help on Vercel)

`vercel.json` has `cleanUrls: true` and `trailingSlash: false`, so on acaciaco the
page is served at `/baristop-v2` (no slash; `/baristop-v2/` is 308-redirected to it)
and the admin at `/baristop-v2/admin`. From a document whose URL has no trailing
slash, the browser resolves `css/site.css` against the parent folder: `/css/site.css`
(404). From `/baristop-v2/admin`, `../config.js` becomes `/config.js` and
`css/admin.css` becomes `/baristop-v2/css/admin.css`. This is exactly why every other
page in the repo uses absolute `/baristop/...` paths — which we cannot, because the
folder has to move. A middleware rewrite does not help either: the browser URL still
has no slash.

The fix is a `<base>` element computed at parse time. **Both** `index.html` and
`admin/index.html` start their `<head>` (before any `<link>`, `<script src>` or
`<img>`) with this inline script, identical in both files:

```html
<script>
(function () {
  // Folder that contains this document, always with a trailing slash.
  // "/baristop-v2"            -> "/baristop-v2/"
  // "/baristop-v2/"           -> "/baristop-v2/"
  // "/baristop-v2/index.html" -> "/baristop-v2/"
  // "/baristop-v2/admin"      -> "/baristop-v2/admin/"
  // "/"                       -> "/"
  var p = location.pathname;
  var last = p.slice(p.lastIndexOf("/") + 1);
  if (last.indexOf(".") !== -1) p = p.slice(0, p.lastIndexOf("/") + 1); // a file: strip it
  else if (p.charAt(p.length - 1) !== "/") p += "/";                      // clean URL: add the slash
  var b = document.createElement("base");
  b.href = location.origin + p;
  document.head.appendChild(b);
})();
</script>
```

Rules that make this safe:

- The only rule the script needs is "a segment with a dot is a file"; the folder
  names (`baristop-v2`, `admin`) have no dots, so `/baristop-v2` and `/baristop-v2/admin`
  are folders and `/baristop-v2/index.html` is a file. No folder name under
  `baristop-v2/` may contain a dot (the schema-sync test checks `assets/placeholders`
  etc. do not break this).
- Every relative reference in the HTML, CSS (`url(../assets/…)` is relative to the
  CSS file, unaffected) and JS (`fetch("data/default-content.json")`,
  `new URL("../?nocache=1", document.baseURI)`) resolves against `document.baseURI`,
  which the `<base>` sets. JS must never build paths from `location.pathname`.
- The site's CSP has `base-uri 'self'`, which permits a same-origin `<base>`.
- On a host that serves the folder at a trailing-slash URL (python `http.server`,
  Netlify, cPanel, GitHub Pages) the script is a no-op.
- The admin's `Vista previa ↗` link is `new URL("../?nocache=1", document.baseURI)`
  → `/baristop-v2/?nocache=1`; Vercel's trailing-slash 308 preserves the query string,
  so it lands on `/baristop-v2?nocache=1`. The §8 test M2 verifies this and the
  `?demo=1` variants on `vercel dev`.
- Without JavaScript the clean-URL host would serve the inline default copy unstyled.
  Accepted: the page needs JS for its content anyway, and the gate (§6) already
  requires a modern browser. No `<noscript>` fallback.
- The preview-gate login page (§6) is served by the middleware with an absolute
  `action="/baristop-v2/__preview/login"`: it is host-specific by nature and is
  deleted at the switch (§7), so it does not use the bootstrap.

### 3.1 `config.js`

```js
// The only value that changes per host. Empty string = demo mode (no Google backend).
window.BARISTOP_CONFIG = { apiUrl: "" };
```

### 3.2 Load order (`js/content.js`)

1. **Inline defaults** are already in the HTML (no JS needed to read the page).
2. **Demo mode** (`apiUrl === ""`): if `localStorage['baristop-v2:demo-content']`
   exists (written by the admin in demo mode) render it; else fetch
   `data/default-content.json` and render. Stop.
3. **Live mode**: read `localStorage['baristop-v2:cache']` (`{savedAt, content}`);
   if present render it immediately. Otherwise fetch `data/default-content.json`
   and render it (keeps the page consistent while the API answers).
4. `POST apiUrl` `{action:"getContent"}` with a 6 s timeout. On success, if
   `content.updatedAt` is newer than what is on screen, re-render and write the
   cache. On failure keep whatever is on screen; never show an error to visitors.
   6 s is deliberately below a cold Apps Script start (often 5–10 s): the public page
   keeps the cached/seed render and the visitor never waits; the next visit usually
   hits a warm script. The admin uses its own, longer timeout (§4.6).
5. `?nocache=1` in the URL skips step 3's cache read (the admin "Vista previa" link
   uses it). `?demo=1` forces demo mode on any host, **intentionally also after
   migration**: it is a tester convenience, it reveals nothing that is not already
   public (`default-content.json` is a static file, and demo content lives only in
   that browser's `localStorage`), and it never sends a request to the API. The same
   applies to `admin/?demo=1` (§4.1): the admin UI itself is not secret — only the
   API is, and demo mode holds no token and cannot call it.

Normalisation before render: sort lists by `order`, drop `visible:false`, drop
date-expired announcements/promos, drop machines without a visible category, fill
missing `site` keys from the defaults, resolve relative image paths against the
document base.

### 3.3 Renderer contract (`js/render.js`)

`render(content)` is idempotent: it clears and rebuilds every data-driven container
(`[data-list="…"]`) and sets every `[data-text="site.key"]` with `textContent`. Static
markup (section wrappers, headings, SVG icons) stays in `index.html`.

### 3.4 Placeholders

Neutral SVGs: `--cream-card` fill, `--line` hairline frame, a centered coffee-cup
outline in `--muted` and the label text `1200 × 900 px · JPG o WebP` in Inter 500
(the SVG embeds no font; it falls back to the system sans). Each one's `viewBox`
matches its aspect so `object-fit: cover` never crops the label.

---

## 4. Admin (`baristop-v2/admin/`)

Same tokens and fonts; a light cream UI with wine accents, 15 px body, no paper grain.
Works on a phone (single column) and on an iPad (sidebar + content) — the client
reviews on an iPad (screenshots).

### 4.1 Login

Card centered: logo, `Panel de Baristop`, password field (`Contraseña`), button
`Entrar`, inline error `Contraseña incorrecta.` / `El panel no está configurado todavía.`
(`NOT_CONFIGURED`) / `Demasiados intentos. Espera unos minutos.` (`RATE_LIMITED`).
On success the token goes to `sessionStorage['baristop-v2:token']`; any later
`UNAUTHORIZED` clears it and returns to login with `Tu sesión terminó. Vuelve a entrar.`
Demo mode: no login; a yellow badge in the header reads
`Modo demo (sin conexión a Google): los cambios se guardan solo en este navegador.`
Demo mode is entered when `apiUrl === ""` **or** `?demo=1` is in the URL (on any
host — intended, see §3.2: the admin UI without a token can neither read private
fields nor write anything to Google).

### 4.2 Shell

Header: logo + `Panel de Baristop` · `Vista previa ↗` (opens
`new URL("../?nocache=1", document.baseURI)` in a new tab — resolved against the
`<base>` from §3.0, never against `location.pathname`) · `Salir`. Left sidebar (≥ 820 px) or a `<select>` (phones) with one entry
per section, in this order:

`Textos` (Ajustes) · `Portada` · `Anuncios` · `Promos` · `Maquinaria` · `Insumos` ·
`Recetas` · `Sucursales` · `Redes` · `Alianzas`

Each section view has, at the top, a collapsible help box titled
**`Cómo llenar esta sección`** (open by default the first time, state in
`localStorage`) with 2–5 plain-Spanish sentences and the image spec line from §2.15.

### 4.3 Editing

- **Textos:** a form of labelled fields grouped by page section (Portada, Qué
  ofrecemos, …). Label = Spanish description from the schema; long texts get a
  `<textarea>`. `quoteAlwaysTo` / `quoteFallbackTo` sit under a group
  `Correos de cotización` with help:
  `Silvia (roseta.cafeteria@gmail.com) recibe una copia de todas las solicitudes, de las dos sucursales. Este campo no puede quedar vacío. Separa varios correos con comas. Los correos de cada sucursal (Karla / Ventas en Aguascalientes, Karime en Durango) se editan en Sucursales.`
  Saving `Textos` with an empty or invalid `quoteAlwaysTo` is refused client-side
  (`Silvia debe recibir todas las solicitudes: escribe al menos un correo válido.`)
  and server-side (§5.4).
- **List sections:** rows rendered as cards (not a table) with: drag-free reorder
  buttons `▲ ▼`, a `Visible` toggle, `Editar`, `Eliminar` (confirm dialog
  `¿Eliminar "<nombre>"? Esta acción no se puede deshacer.`). `+ Agregar` opens an
  empty edit form. Edit form fields follow the schema; `emails`/`quoteRecipients`
  are a list editor (one input per address, `+ otro correo`); `hours` is a textarea
  with `Una línea por horario`; `subjectTag` is a short text field `Etiqueta asunto`
  (required) with the help text from §2.4. `Portada` hides `+ Agregar` at four rows
  (§2.5).
- **Maquinaria:** a two-level view. Category cards; opening one shows its machine
  list with the same card UI (`+ Agregar equipo`). Deleting a category with machines
  asks `Esta categoría tiene N equipos. ¿Eliminar la categoría y sus equipos?`
- **Image fields:** thumbnail (or placeholder), `Subir imagen`, `Quitar`. The upload
  flow (§4.4) runs before the row is saved; the resulting URL is stored in the row.
- **Validation (client):** required fields marked; e-mails `^[^\s@]+@[^\s@]+\.[^\s@]+$`;
  WhatsApp/phone digits only (the form strips spaces and shows the `52…` format
  needed); URLs must be `https://` (same `isSafeHttpsUrl` rule as §1.15 — `http://`,
  `javascript:` and bare domains are rejected with `Escribe la dirección completa, empezando con https://`);
  recipe needs photo or video; dates `YYYY-MM-DD` via `<input type=date>`;
  `quoteAlwaysTo` non-empty; `subjectTag` non-empty; `Portada` ≤ 4 rows. Errors
  inline, in Spanish. The same rules run in `Shared.validateSection` on the server,
  so a bypassed client cannot save what the admin would refuse.
- **Saving:** every section view has a sticky `Guardar cambios` bar that appears once
  something changed (`Tienes cambios sin guardar`). Save posts the **whole section**
  (§5.4). Feedback: `Guardando…` → `Cambios guardados · <hora>` (green) or the error
  text (red) with the server message. Leaving a tab with unsaved changes prompts.
  After a save, admin refreshes its copy from the response and clears the public
  cache hint by bumping `localStorage['baristop-v2:cache']` to the new content.
- **Demo mode:** reads `../data/default-content.json` once, then reads/writes
  `localStorage['baristop-v2:demo-content']`. Uploads become `data:` URLs (the
  resized blob, base64) stored inline — fine for testing, and the help box says
  `En modo demo las imágenes se guardan en este navegador.` A `Restablecer demo`
  button in the footer clears the key.

### 4.4 Image upload flow (`js/images.js`)

1. `<input type="file" accept="image/*">`; reject non-image MIME, reject sources over
   12 MB (`La imagen es demasiado grande para procesarla aquí. Intenta con una de menos de 12 MB.`).
2. SVG (logos only): check `<svg` prefix, size ≤ 150 KB, no `<script`, then upload
   as-is (`image/svg+xml`).
3. Otherwise decode with `createImageBitmap` (fallback `Image`), apply EXIF
   orientation (`imageOrientation: "from-image"`), draw into a canvas scaled to fit
   the field's box (never upscale). Aspect warning per §2.15.
4. Encode: `keepAlpha` → PNG; else WebP 0.82 (test `canvas.toDataURL('image/webp')`
   support; fallback JPEG 0.85). If above the max weight, retry at 0.72 then 0.6,
   then reject (`No pudimos reducir la imagen por debajo de N KB. Usa una imagen más sencilla.`).
5. Show a preview with the final `W × H · NN KB`, then upload (§5.5) with a progress
   state `Subiendo…`. On success store the returned `url` in the row.

### 4.5 Help texts per section (seed; Spanish, shown verbatim)

- Textos: `Aquí cambias los textos del sitio. Escribe en español, sin mayúsculas sostenidas. Los cambios se ven al guardar y recargar el sitio (puede tardar hasta 5 minutos por la caché).`
- Portada: `Son las 4 fotos que aparecen debajo del menú: maquinaria, salsas, jarabes y polvos. Se muestran en ese orden. <spec>`
- Anuncios: `Una barra delgada arriba del menú. Se muestra el primero visible dentro de sus fechas. Déjalo sin anuncios para que no aparezca nada.`
- Promos: `Tarjetas con imagen, texto y botón. Usa "Desde" y "Hasta" para que se oculten solas. Sin promos visibles, la sección no aparece. <spec>`
- Maquinaria: `Primero las categorías (Cafeteras espresso, Molinos, Licuadoras). Dentro de cada una agrega los equipos con su foto, descripción y especificaciones (una por línea). <spec>`
- Insumos: `Una tarjeta por línea de insumos. El texto corto va debajo del nombre; la descripción se muestra completa. <spec>`
- Recetas: `Sube una foto y/o pega el enlace del video (YouTube, Instagram o TikTok). Las recetas se abren en una pestaña nueva al tocar la tarjeta. <spec>`
- Sucursales: `Datos de contacto de cada sucursal. WhatsApp y teléfono sin espacios, con 52 al inicio para WhatsApp. "Correos cotización" son los correos internos que reciben las solicitudes de esa sucursal (Aguascalientes: Karla / Ventas, ventas.baristop@gmail.com · Durango: Karime, karime.baristop@gmail.com); no se publican. Silvia recibe copia de todo desde Textos → Correos de cotización. "Etiqueta asunto" va al inicio del asunto de cada correo, por ejemplo [BARISTOP AGS]. <spec>`
- Portada (addition): `Son exactamente 4 imágenes; para cambiar una, edítala o reemplaza su foto.`

### 4.6 `js/api.js` — timeouts and retries

The admin talks to the same endpoint as the site but with **its own timeout of 25 s**
(a cold Apps Script start takes 5–10 s; `uploadImage` of a 500 KB base64 body and a
full `saveSection` rebuild can take longer). On timeout or network failure the
action button shows `El servidor tardó en responder. Revisa tu conexión e intenta de nuevo.`
with a `Reintentar` button that repeats the same request (idempotent: `saveSection`
rewrites the whole section, `uploadImage` creates another file — harmless, the row
only keeps the last URL). Login uses the same 25 s. `getContent` with `fresh:true`
is called once after login; while it runs the UI shows a skeleton with
`Cargando contenido… (la primera carga puede tardar unos segundos)`.
- Redes: `Enlaces a tus redes. El icono se elige por el nombre (Instagram, Facebook, TikTok).`
- Alianzas: `Logos de las marcas aliadas, en el orden en que aparecen. <spec>`

---

## 5. Backend — Google Apps Script Web App (`apps-script/`)

```
apps-script/
  Code.gs            doGet/doPost router, actions, Sheets/Drive/Mail/Cache glue (Apps Script only)
  Shared.js          pure helpers + SCHEMA + DEFAULT_CONTENT reference — loads in Apps Script AND node
  DefaultContent.js  var DEFAULT_CONTENT = {...}  (identical to baristop-v2/data/default-content.json)
  appsscript.json    manifest (V8, timeZone America/Mexico_City, webapp executeAs USER_DEPLOYING / access ANYONE_ANONYMOUS, oauthScopes)
  README-deploy.md   Spanish, click-by-click
```

`Shared.js` and `DefaultContent.js` use the UMD-ish tail
`if (typeof module === "object" && module.exports) module.exports = …;` so
`tests/*.test.ts` can `import shared from "../apps-script/Shared.js"` (default import —
CJS). No `require`, no `import` inside them. In the Apps Script editor they are pasted
as two extra files (the editor renames `.js` → `.gs`; both are fine).

### 5.1 Transport

- Every request: `POST <apiUrl>` with `Content-Type: text/plain;charset=utf-8` and a
  JSON string body. Plain-text POST is a CORS "simple request", so the browser sends
  no preflight (Apps Script cannot answer `OPTIONS`). The client never sets custom
  headers and uses `redirect: "follow"` (Apps Script answers with a 302 to
  `script.googleusercontent.com`; `fetch` follows it transparently).
- `GET <apiUrl>?action=getContent` is also accepted (handy for debugging in a browser
  tab). No other action is allowed on GET.
- Response: always HTTP 200 (Apps Script cannot set status codes) with JSON
  `{ ok: true, data: … }` or `{ ok: false, error: { code, message } }`. `message` is
  Spanish and safe to show. Codes: `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_CONFIGURED`,
  `RATE_LIMITED`, `VALIDATION`, `SERVER_ERROR`.
- Request envelope: `{ action: string, token?: string, ...params }`.

### 5.2 `getContent` (public)

Request `{action:"getContent", fresh?: boolean, token?: string}`. Response
`data = Content` (§2.1). Cached in `CacheService.getScriptCache()` under `content:v1`
for 300 s; `fresh:true` (requires a valid token) bypasses and refills the cache.
`saveSection` and `uploadImage` do not need to invalidate separately: `saveSection`
rewrites the key.

**Private fields are stripped from the public response.** Without a valid token the
response passes through `Shared.stripPrivate(content)`, which removes
`site.quoteAlwaysTo`, `site.quoteFallbackTo` and every `branches[].quoteRecipients`
(replaced by `[]`). Those are the personal Gmail addresses of Silvia and Karime;
anyone can call the endpoint, so they must not be enumerable. With a valid token
(the admin) the full document is returned. The cache stores the full document; the
strip happens on the way out. The site never needs these fields (the quote is sent
server-side), so nothing on the public page changes. `Cotizaciones` rows are never
returned by any action.

`CacheService` is best-effort: Google may evict entries before their TTL. The 300 s
content cache is therefore an upper bound (a miss just re-reads the Sheet), and the
rate-limit counters in §5.3 and §5.6 are advisory — they stop accidental floods and
cheap abuse, not a determined attacker. Stated in the README.

### 5.3 `login`

Request `{action:"login", password, clientId}`. Reads `ADMIN_PASSWORD_SHA256` (hex,
lowercase) from Script Properties; **missing/empty → `NOT_CONFIGURED`** (fail closed).
Computes `Utilities.computeDigest(SHA_256, password, UTF_8)` → hex; compares with the
constant-time helper `Shared.safeEqual`.

Failed attempts are counted in CacheService at two scopes, because Apps Script does
not expose the caller's IP:

- `login:fail:<clientId>` — `clientId` is a random UUID the admin generates once and
  keeps in `localStorage['baristop-v2:client-id']` (`^[0-9a-f-]{36}$`, else
  `BAD_REQUEST`). 6 failures / 15 min → `RATE_LIMITED` for that client. This is what
  protects the client from locking *herself* out by typo and from a stranger locking
  her out: an attacker can rotate ids, so it is not the brute-force defence.
- `login:fail:all` — global, 60 failures / 15 min → `RATE_LIMITED` for everyone.
  This is the brute-force backstop. **A visitor who hammers the endpoint can
  therefore lock the admin out for up to 15 minutes**; accepted (the panel is not
  time-critical, the password is long, and the README says so and tells the client
  to wait 15 min rather than change anything). Both counters are best-effort (§5.2).

Success returns
`data = { token, expiresAt }` where `token = "v1." + exp + "." + nonce + "." + sig`,
`exp` = unix seconds now + 12 h, `nonce` = `Utilities.getUuid()`, `sig` =
base64url(HMAC-SHA256(`ADMIN_TOKEN_SECRET`, `"v1." + exp + "." + nonce`)).
`ADMIN_TOKEN_SECRET` is generated by `setup()` (two UUIDs concatenated). Token
parsing/verification (`Shared.parseToken`, `Shared.isTokenValid(token, now, sigFn)`) is
pure and unit-tested; the HMAC itself is injected.

### 5.4 `saveSection` (token)

Request `{action:"saveSection", token, section, rows}` where `section` is one of
`site | social | branches | heroImages | machineryCategories | machines | insumos |
recipes | alliances | announcements | promos`, and `rows` is the full array for that
section (for `site`, an object `{key: value}`). Steps:

1. Verify token → `UNAUTHORIZED`.
2. `Shared.validateSection(section, rows)` → `{ ok, errors[] }`; errors are
   `{ row, field, message }` in Spanish → `VALIDATION` with the first 10. Rules
   (mirrored in the admin, §4.3): ids match `^[a-z0-9][a-z0-9-]{1,39}$` and are unique;
   required names/titles non-empty; **every URL field (`mapUrl`, `url`, `videoUrl`,
   `ctaUrl`) is empty or passes `isSafeHttpsUrl`** (`https://` only — never `http:`,
   `javascript:`, `data:`); e-mail lists contain only `isEmail` values (placeholders
   like `Por definir` are allowed in `emails` for display, never in
   `quoteRecipients`); `whatsapp`/`phone` are 10–15 digits; `subjectTag` 1–24 chars
   non-empty; `heroImages` ≤ 4 rows; dates `YYYY-MM-DD` or empty with
   `startsAt <= endsAt`; recipes have `photo` or `videoUrl`; `machines.categoryId`
   exists; for `site`, `quoteAlwaysTo` holds ≥ 1 valid e-mail.
3. `Shared.itemsToRows(section, rows)` → 2-D array under the tab's headers.
4. `LockService.getScriptLock().waitLock(10000)`; clear the tab below the header;
   write the rows; set `Ajustes.Valor` for `_updatedAt` = ISO now; release.
5. Rebuild `Content` from all tabs (`Shared.rowsToContent`), refill the cache, return
   `data = Content`.

Column order is taken from the live header row (`Shared.headerIndex`), so a
reordered Sheet still writes correctly; a missing header → `SERVER_ERROR`
`Falta la columna "X" en la pestaña Y`.

### 5.5 `uploadImage` (token)

Request `{action:"uploadImage", token, section, itemId, field, name, mime, dataBase64}`.
Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml` (SVG only when
`SCHEMA.images[section.field].keepAlpha` and the content starts with `<svg`). Max
decoded size = the field's max weight × 1.2 (admin already compressed; the server is
a backstop). Creates the file in `DRIVE_FOLDER_ID`, sets
`setSharing(ANYONE_WITH_LINK, VIEW)`, returns
`data = { url: "https://lh3.googleusercontent.com/d/<id>", fileId, bytes }`.
The row itself is not updated here — the admin saves the section afterwards.

### 5.6 `submitQuote` (public)

Request:

```json
{ "action":"submitQuote", "branchId":"ags", "name":"…", "business":"…",
  "contact":"…", "need":"Maquinaria / equipo", "message":"…",
  "website":"", "ts": 1760000000000 }
```

1. `Shared.validateQuote(body)`: `name` 2–80 chars, `contact` 5–120 chars and must
   look like a phone (≥ 10 digits) or an e-mail, `business` ≤ 120, `message` ≤ 2000,
   `need` within the fixed option list, `branchId` matches a branch; honeypot
   `website` must be empty; `ts` must be ≥ 3 s old and ≤ 24 h old. Failure →
   `VALIDATION` (generic message `Revisa los datos del formulario.`; honeypot/ts
   failures return `ok:true` silently so bots learn nothing).
2. Rate limit via CacheService: global `quote:minute` ≤ 10/min, `quote:hour` ≤ 60/h,
   and `quote:contact:<sha256(contact)>` ≤ 3/h → `RATE_LIMITED`
   (`Recibimos varias solicitudes seguidas. Intenta en unos minutos o escríbenos por WhatsApp.`).
3. `Shared.resolveRecipients(branch, site)` → lowercased, deduped, validated list of
   `branch.quoteRecipients` ∪ `site.quoteAlwaysTo`; placeholders (`Por definir`,
   non-e-mails) dropped. If the result does not contain every valid address from
   `quoteAlwaysTo`, that is impossible by construction (they are added
   unconditionally) — the test asserts it. If the list is empty → `site.quoteFallbackTo`;
   if still empty → `NOT_CONFIGURED` (`El formulario aún no tiene destinatarios. Escríbenos por WhatsApp.`).
4. `MailApp.sendEmail({ to, replyTo: contactIfEmail, subject, htmlBody, body, name:"Baristop web" })`.
   Subject: **`<branch.subjectTag> <Nombre> (<Negocio>)`**, e.g.
   `[BARISTOP AGS] María López (Café Central)`; `(<Negocio>)` is omitted when empty.
   `subjectTag` is read from the Sheet row of the selected branch (falls back to
   `[BARISTOP]` if somehow empty — validation makes that unreachable). Body: a plain
   table of the fields plus `Responder a: <contact>` and the send time
   (America/Mexico_City). `replyTo` is set only when `contact` is an e-mail; otherwise
   the phone is the first line of the body.
5. Append a row to `Cotizaciones` (`Estatus envío` = `Enviado` or the error text).
   Mail first, log second; a log failure does not fail the request.
6. Response `data = { sent: true, recipientsCount }`.

**Mail quota.** `MailApp` on a consumer Gmail account allows 100 *recipients* per
day. Every quote goes to 2 addresses with the seed (branch + Silvia; 3 if the client
adds one), so the practical ceiling is **about 50 quotes/day (≈ 33 with three
recipients)** — the README quotes it in quotes, not recipients, and explains that
the 101st recipient of the day fails with `SERVER_ERROR` (the row is still logged
with the error text, so nothing is lost; the client can also check
`MailApp.getRemainingDailyQuota()` from the editor). A Google Workspace account
raises the limit to 1,500/day if it is ever needed.

### 5.7 Error handling

Every action runs inside `try/catch`; unexpected errors return `SERVER_ERROR` with
`Algo salió mal. Intenta de nuevo.` and `console.error` the stack (visible in the
Apps Script executions log).

### 5.8 `setup()` and other editor-run functions

- `setup()`: idempotent. Creates missing tabs with headers (frozen, bold, checkbox
  validation on `Visible`), seeds every empty tab from `DEFAULT_CONTENT`, creates the
  Drive folder if `DRIVE_FOLDER_ID` is unset, generates `ADMIN_TOKEN_SECRET` if unset,
  and — if a Script Property `ADMIN_PASSWORD_PLAIN` exists — stores its SHA-256 hex
  in `ADMIN_PASSWORD_SHA256` and **deletes** `ADMIN_PASSWORD_PLAIN`. Logs a summary.
- `setAdminPasswordFromProperty()`: same password step alone (to change the password later).
- `clearCache()`: drops `content:v1`.
- `testQuote()`: sends a test request to the resolved Aguascalientes recipients.

### 5.9 `appsscript.json`

```json
{ "timeZone": "America/Mexico_City", "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets.currentonly",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/script.external_request" ],
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" } }
```

(`drive` instead of `drive.file` because the folder is created by the script but the
owner may also drop files in by hand; the README says why the consent screen asks for it.)

### 5.10 `README-deploy.md` (Spanish) must cover, click by click

1. Crear la hoja de cálculo en Google Sheets → Extensiones → Apps Script.
2. Pegar `Code.gs`, crear archivos `Shared` y `DefaultContent`, pegar `appsscript.json`
   (mostrar el manifiesto: Configuración del proyecto → "Mostrar appsscript.json").
3. Configuración del proyecto → Propiedades del script → agregar `ADMIN_PASSWORD_PLAIN`.
4. Ejecutar `setup` → autorizar (pantalla "Google no ha verificado esta app" →
   Avanzado → Ir a…). Verificar que aparecieron las pestañas y la carpeta en Drive.
5. Implementar → Nueva implementación → Aplicación web → Ejecutar como *yo*, Acceso
   *Cualquier usuario* → copiar la URL que termina en `/exec`.
6. Pegar la URL en `baristop-v2/config.js`.
7. Probar: abrir `<URL>?action=getContent` en el navegador; entrar al panel; enviar
   una cotización de prueba.
8. Cambiar contraseña, volver a implementar tras cambios de código (*Administrar
   implementaciones → editar → Nueva versión*; la URL no cambia), cómo hacer "Crear
   una copia" de la hoja para migrar (§7).
9. Límites y avisos, en lenguaje llano: **unas 50 cotizaciones al día** (Gmail
   permite 100 destinatarios y cada cotización va a 2 correos); la caché de contenido
   es de hasta 5 minutos (puede ser menos); si alguien intenta muchas contraseñas
   seguidas el panel se bloquea para todos **15 minutos** — esperar, no cambiar nada;
   la primera carga del panel puede tardar unos segundos (arranque del script).

### 5.11 `Shared.js` — exported pure API (tested)

```
SCHEMA                      sections, tab names, headers↔keys, types, images spec (§2.13, §2.15)
SECTION_NAMES               ordered list of section keys
safeEqual(a, b)             constant-time string compare; false on non-strings/empty
sha256HexIsValid(s)         64 lowercase hex chars
parseToken(token)           {exp, nonce, sig} | null
isTokenValid(token, nowSec, sigFn)   sigFn(payload) → expected sig
headerIndex(headerRow, section)      {key: colIndex} or throws Error('Falta la columna …')
rowsToItems(section, headerRow, rows)   → typed items (booleans, numbers, arrays, trimmed)
itemsToRows(section, headerRow, items)  → 2-D array aligned to headerRow
settingsToObject(rows) / objectToSettings(obj, descriptions)
rowsToContent(tabs)         {tabName: {header, rows}} → Content (sorted, with updatedAt)
validateSection(section, rows)  {ok, errors:[{row, field, message}]}  (rules in §5.4)
validateQuote(body)         {ok, errors, silent}  (silent = honeypot/ts, answer ok:true)
isEmail(s) / normalizeDigits(s) / isSafeHttpsUrl(s)
stripPrivate(content)       deep copy without quoteAlwaysTo, quoteFallbackTo, branches[].quoteRecipients
resolveRecipients(branch, site) → string[]  (always includes valid quoteAlwaysTo; dedup; lowercase)
buildQuoteEmail(body, branch, site, nowIso) → {subject, text, html, replyTo}
                            subject = branch.subjectTag + " " + name + (business ? " (" + business + ")" : "")
isWithinDates(item, todayYmd)
```

`baristop-v2/js/schema.js` (site workstream) re-exports `isSafeHttpsUrl`, `isEmail`
and `normalizeDigits` with byte-identical bodies; `tests/baristopSchemaSync.test.ts`
compares the three function sources between the two files, so the renderer and the
server can never disagree on what a safe URL is.

---

## 6. Preview gate — Vercel Routing Middleware

### 6.1 What the docs say (checked 2026-10-15 with the Vercel docs search)

- Routing Middleware is a file `middleware.ts`/`middleware.js` **at the project root,
  next to `package.json`**, exporting a default `function middleware(request: Request)`
  that returns a `Response`; "Place middleware.ts at the project root level … to skip
  vercel.json configuration" (vercel.com/docs/routing-middleware, /getting-started).
  Nothing in those pages requires a framework; the examples use the standard
  `Request`/`Response` and `new URL(request.url)` — no `next/server`.
- The runtime **defaults to Node.js** ("The runtime defaults to nodejs"); it can be
  stated explicitly with `export const config = { runtime: 'nodejs' }`. Node runtime
  means `process.env` and Web Crypto (`crypto.subtle`) are available.
- Path scoping: `export const config = { matcher: '/about/:path*' }` (string or array,
  path-to-regexp syntax) "to limit Routing Middleware execution and bypass static
  files" (/routing-middleware/getting-started, /routing-middleware/api).
- Continuing to the normal response: `import { next } from '@vercel/functions'`
  → `return next({ headers: {...} })` adds response headers while letting the static
  file be served (/routing-middleware/api "next([options])"). The alternative
  `vercel.json` form `"proxy": { "entrypoint": "proxy.ts", "matcher": "/api/:func*" }`
  exists too; we use the file convention and keep `vercel.json` untouched.
- Pricing: the docs search did not return the plan table; the brief already accepts
  Hobby-tier Routing Middleware. The backend workstream confirms on the project's
  Usage page after the first deploy and notes the included invocations in the README.

**Decision: use `@vercel/functions` and add it to `dependencies` (not
`devDependencies`)** in the root `package.json`. The middleware is bundled at build
time from the installed modules, and Vercel installs production dependencies, so a
dev-only entry would not reliably reach the bundle. It is a repo-level dependency for
the gate only — `baristop-v2/` stays dependency-free and the entry is removed with
the middleware at the switch (§7.1). The bare `x-middleware-next: 1` header form (what
`next()` emits internally) is **not** used: it is undocumented and could change.
The first Preview deployment verifies that a correct cookie serves the static page
(test G1).

### 6.2 Behaviour

```js
// middleware.js (repo root)
import { next } from '@vercel/functions';
import { sha256Hex, hmacHex, safeEqual, parseCookies, loginPage, isPublicAsset } from './lib/preview-gate.mjs';

export const config = { matcher: ['/baristop-v2', '/baristop-v2/:path*'] };

export default async function middleware(request) { … }
```

- `BARISTOP_PREVIEW_HASH` (env, Production + Preview) = lowercase hex SHA-256 of the
  temporary password (`printf '%s' 'la-contraseña' | shasum -a 256`). **Unset or
  malformed → every matched request gets `503` with the Spanish page
  `Vista previa no disponible.`** (fail closed), never the site.
- `POST /baristop-v2/__preview/login` (`application/x-www-form-urlencoded`,
  field `password`): compare `sha256Hex(password)` with the env hash via `safeEqual`.
  Match → `303` to `/baristop-v2` (or the `next` field if it starts with `/baristop-v2`)
  with `Set-Cookie: bv2_preview=<hmacHex(envHash, "baristop-v2|v1")>; Path=/baristop-v2; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600`.
  Mismatch → `401` login page with `Contraseña incorrecta.` No lockout (the hash is
  the secret; brute force over the network against a 303/401 is throttled by Vercel's
  own limits and the password is temporary), but a 400 ms `await` delay on failure.
- `GET /baristop-v2/__preview/logout`: clears the cookie, `303` to the login page.
- Any other matched request: cookie present and `safeEqual(cookie, expected)` →
  `next({ headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Cache-Control': 'private, no-store' } })`.
  Otherwise `401` + login page (HTML, Spanish, inline CSS in the site's palette, the
  Baristop name, one password field, `Entrar`, hidden `next` = current path), with
  `X-Robots-Tag: noindex` and `Cache-Control: no-store`.
- Assets are gated too (simplest, and the matcher cannot cheaply distinguish); the
  cookie rides along on every request so this costs nothing but middleware
  invocations.
- **CSP on the middleware-served pages.** The `vercel.json` `headers` entry for
  `/(.*)` applies to every response on the path, including the 401 login page and
  the 503 page the middleware returns. That CSP allows `style-src 'unsafe-inline'`
  (so the pages' inline `<style>` works), `form-action 'self'` (so the login
  `POST` to `/baristop-v2/__preview/login` is allowed) and `img-src 'self'` (the
  login page shows `/baristop-v2/assets/baristop-logo.png`, same origin). The pages
  use **no inline script** and no external resource other than Google Fonts
  (allowed), so nothing in them trips the CSP. `base-uri 'self'` also permits the
  site's own `<base>` bootstrap (§3.0).
- The login redirect target is the clean URL `/baristop-v2` (no slash), matching
  `trailingSlash: false`, so no extra 308 happens after login.
- No other route of the site is matched: the matcher is the only coupling, and a
  test asserts `config.matcher` equals the two-entry list. `/baristop` (live) is not
  `/baristop-v2` under path-to-regexp.
- `vercel.json` is not changed for the gate. One optional change (backend workstream)
  is an `X-Robots-Tag` header entry for `/baristop-v2/(.*)` as belt-and-braces; the
  middleware already sets it on every response.

### 6.3 `lib/preview-gate.mjs` (pure, tested)

`sha256Hex(str)`, `hmacHex(keyHex, msg)` (Web Crypto, async), `safeEqual(a, b)`
(constant-time, false when lengths differ or inputs empty), `parseCookies(header)`,
`loginPage({ error, next })` → HTML string with all dynamic values escaped,
`isSafeNext(path)` → only `/baristop-v2…` paths. `tests/baristopPreviewGate.test.ts`
covers: fail-closed on empty hash, wrong vs right password, cookie value derivation
changes when the hash changes, `isSafeNext` rejects `//evil` and `/roseta`.

### 6.4 Local

`npx vercel dev` runs middleware locally (set `BARISTOP_PREVIEW_HASH` in `.env`).
`python3 -m http.server 8899` serves `/baristop-v2/` ungated for pure front-end work.

---

## 7. Switch & migration plan

### 7.1 Promote v2 to `/baristop` (same host)

1. Client sign-off on the preview; real images uploaded (branch photos, machines,
   recipes, partner logos); recipient lists reviewed by the client in the admin
   (seeded: Silvia `roseta.cafeteria@gmail.com` on everything, Karla/Ventas for
   Aguascalientes, Karime for Durango — add Fernando only when he has an address).
2. On a branch: `git mv baristop baristop-old` (keeps favicons history), then copy
   `baristop-v2/` → `baristop/` (`index.html`, `config.js`, `css/`, `js/`, `data/`,
   `assets/`, `admin/`). `config.js` keeps the same Apps Script URL — nothing in
   `baristop-v2/` depends on its folder name because every path is relative.
3. Update `<link rel="canonical">`, Open Graph URLs and `sitemap.xml` entries from
   `/baristop-v2` to `/baristop`.
4. Delete `middleware.js`, `lib/preview-gate.mjs`, their test, the
   `@vercel/functions` dependency and the `BARISTOP_PREVIEW_HASH` env var (or keep
   the middleware with an empty matcher — no, delete: less surface). The `<base>`
   bootstrap (§3.0) stays: `/baristop` is also a clean URL.
5. Add to `vercel.json`: redirect `/baristop-v2(/.*)?` → `/baristop$1` (permanent) and
   an `X-Robots-Tag: noindex` header for `/baristop/admin(.*)`.
6. Change the admin password: set `ADMIN_PASSWORD_PLAIN` in Script Properties, run
   `setAdminPasswordFromProperty()`.
7. Deploy to Preview, run the §8 checklist against `/baristop`, merge, verify
   Production, delete `baristop-old/` in a follow-up commit once the live page is confirmed.

### 7.2 Move to the client's own domain

The folder is the product: upload `baristop/` (contents at the web root, or in a
subfolder — paths are relative) to any static host (Vercel, Netlify, cPanel, GitHub
Pages). Then either:

- **Keep ACACIA's Sheet/Script:** nothing else changes; the client keeps editing in
  the same panel (`https://su-dominio/admin`).
- **Hand everything over:** in Google Sheets `Archivo → Crear una copia` with the
  client's account (the bound script is copied along), open `Extensiones → Apps
  Script`, add `ADMIN_PASSWORD_PLAIN`, run `setup()` (it creates the client's own Drive
  folder and token secret; image URLs still point to ACACIA's Drive files until the
  client re-uploads — the README lists this), deploy as Web App, paste the new `/exec`
  URL into `config.js`. Done; ACACIA's copy can be left read-only or deleted.

Fonts load from Google Fonts on any host; there is no CSP outside acaciaco.com.mx
unless the new host adds one.

### 7.3 Optional after migration

Recipe video embeds (`<iframe>` YouTube-nocookie / `<video>` MP4) can be enabled by a
renderer flag once the page is off the acaciaco CSP, or on acaciaco by adding
`frame-src https://www.youtube-nocookie.com` and `media-src https:` to `vercel.json`
(that CSP is site-wide; decide then).

---

## 8. Test plan (manual checklist, maps every brief item → where to see it)

Testers: José Pablo on desktop Chrome/Safari + iPhone; the client on iPad Safari.
Preview URL: `https://acaciaco.com.mx/baristop-v2` (password from José Pablo).
Demo mode for the admin without Google: `…/baristop-v2/?demo=1` and `…/baristop-v2/admin/?demo=1`.

| # | Brief item | Where / how to verify |
|---|---|---|
| G1 | Preview gate | Open `/baristop-v2` in a private window → Spanish login page, no site content, `X-Robots-Tag` in response headers. Wrong password → `Contraseña incorrecta.` Right → site. `/baristop` (live) unaffected and still public. Any other page (`/`, `/roseta/factura`) unaffected. With `BARISTOP_PREVIEW_HASH` removed on a Preview deployment → 503 page, never the site. |
| N1 | Nav has `Recetas` after `Contacto` and CTA `Cotiza tu equipo e insumos` | Desktop nav. |
| N2 | Nav works on phones | iPhone/iPad portrait: hamburger opens the menu, links scroll to sections and close it, `Escape` closes. |
| H1 | 4-image strip under the nav: maquinaria, salsas, jarabes, polvos | Top of page; placeholders show their size text until replaced. Replace one from admin → Portada and confirm it changes (allow 5 min cache; use `Vista previa` link). Admin → Portada shows no `+ Agregar` at 4 rows; hide one row → the site keeps 4 cells, the hidden one as a captionless placeholder. Do **not** upload `frappe-capuchino.jpg` to a visible row (its poster reads "Saju"). |
| H2 | Round seal readable on the white hero, eyebrow in tinto, white hero background, `Todo para tu cafetería` in tinto, `barra de bebidas` italic gold | Hero: the wine disc `baristop-logo.png` is shown (not the transparent lockup); the nav/footer still use the lockup on wine. |
| H3 | New subtitle + `Un solo proveedor, una sola entrega.` standout | Hero. |
| H4 | Trust row: Aguascalientes · Durango · Envíos a toda la República · `Lun a Vie desde 9:00 am · Sáb en Durango` | Hero bottom. |
| N3 | `Contacto` scrolls to the contact/quote section; Franquicias is reachable from the footer | Click `Contacto` → `#cotiza`; footer `Franquicias` → `#franquicias`. |
| O1 | "Lo dice nuestro nombre…" gone | Qué ofrecemos intro. |
| O2 | Maquinaria chips: no Refrigeración/Vitrinas; text without them | Qué ofrecemos → card 01. |
| O3 | Insumos chips: no Tapioca / Vasos y desechables; `Tisanas` | Qué ofrecemos → card 02. |
| C1 | Maquinaria catalog = Cafeteras espresso, Molinos, Licuadoras, each with an image on the card | Catálogo. |
| C2 | Click a category → detail with every machine + description; `Cotizar este equipo` prefills the form | Add a visible machine in admin → Maquinaria first; then check the dialog; `Escape`/`Cerrar`/backdrop close it. Empty category shows the "Estamos actualizando…" line. |
| C3 | Insumos = Café (Coatepec), Polvos y bases (Sahu, Samlet), Jarabes y salsas (Yalini), Tisanas (Soy Té), each with an image; no Tapioca | Catálogo → Insumos. |
| W1 | No "mayoreo" anywhere | Browser find `mayoreo` → 0 results on the page. Strip item, values card, step 02, quote intro. |
| W2 | Nationwide shipping wording replaces "a domicilio en la ciudad" | Strip, Por qué Baristop card 3, step 03. |
| Q1 | Two branch columns with big titles; per branch: WhatsApp button labelled `WhatsApp Aguascalientes` / `WhatsApp Durango` (opens `wa.me` with the right number), phone, address, e-mail(s), hours, photo | Cotiza. Aguascalientes shows `449 178 4526` for both phone and WhatsApp (search the page for `465 9347` → 0 results). Durango shows the Gómez Palacio address and `karime.baristop@gmail.com`. Only the two branch photos are placeholders. |
| Q2 | Instagram + Facebook shared in the middle | Cotiza → Síguenos; Facebook opens `facebook.com/p/Baristop-Distribuidora-100095085646432/`. |
| Q3 | Form with branch selector; e-mail goes to Aguascalientes → Karla/Ventas + Silvia; Durango → Karime + Silvia (no Fernando); Silvia always; subject tagged per branch | Submit one request per branch (real addresses are seeded; for a dry run point the lists at test addresses in admin and restore them after). Check inboxes: sender `Baristop web`, reply-to = the contact e-mail, subject `[BARISTOP AGS] <Nombre> (<Negocio>)` / `[BARISTOP DGO] …`; change `Etiqueta asunto` in admin → Sucursales and resend → new tag. Row appears in the `Cotizaciones` tab. Honeypot filled → `ok` but no mail. 4 quick submissions from the same contact → `RATE_LIMITED` text. Admin → Textos: empty `quoteAlwaysTo` → save refused with the Silvia message. |
| Q5 | Private e-mails are not public | `curl -d '{"action":"getContent"}' -H 'Content-Type: text/plain' <apiUrl>` → no `quoteRecipients` addresses, no `quoteAlwaysTo`; the same call with a valid `token` returns them. |
| Q6 | Unsafe URLs never become links | In the Sheet, set an alliance `URL` to `javascript:alert(1)` and a recipe `Video URL` to `http://…` → the site renders both without a link; admin refuses to save either value. |
| Q4 | WhatsApp shortcut per branch still exists | `o envíalo por WhatsApp` under the form follows the selected branch. |
| R1 | Recetas section with photos and/or video links; admin add/edit/remove/reorder | Make the two seed recipes visible in admin → Recetas; add one with only a video URL → play badge + opens in a new tab. Hide all → empty-state line. |
| F1 | `Baristop en tu ciudad` with the franchise text and CTA | Section before Cotiza; CTA presets the select to `Franquicia / Baristop en mi ciudad`. |
| A1 | Alianzas estratégicas: Coffee Solutions, Soy Té, Yalini, Sahu, Samlet; logos editable | Near the bottom; upload a PNG logo in admin → Alianzas; grayscale → colour on hover. Hide all → section disappears. |
| P1 | Promos and Anuncios show nothing when empty | Fresh seed: no bar, no promos section. Add an announcement → bar above the nav, `×` hides it for the session. Add a promo with `Hasta` = yesterday → not shown; today → shown. |
| FT1 | Footer reflects both branches (with `WhatsApp <Sucursal>` links) and links Recetas / Franquicias | Footer. |
| AD1 | Admin login: password, fail closed, lockout | Wrong password error; with `ADMIN_PASSWORD_SHA256` deleted in Script Properties → `El panel no está configurado todavía.` 6 wrong passwords → `Demasiados intentos…` for that browser; a second browser still logs in. |
| AD6 | Slow backend | Throttle the network (DevTools "Slow 3G") and save a section → the admin waits up to 25 s and, on timeout, shows `El servidor tardó en responder…` with `Reintentar`; the public page under the same throttle still paints from cache/seed within a second. |
| AD2 | Every section lists/edits/adds/deletes/reorders; `Cómo llenar esta sección` with image sizes on every tab | Walk all ten tabs. |
| AD3 | Image upload validates and resizes | Upload a 4000 × 3000 JPG to Portada → preview reports ≤ 1200 px wide and ≤ 300 KB; upload a PDF → rejected; upload a square image → aspect warning. |
| AD4 | Save feedback and preview link | `Guardar cambios` → `Cambios guardados · hh:mm`; `Vista previa ↗` opens the site with the change. |
| AD5 | Demo mode | `admin/?demo=1`: no login, badge visible, edits persist after reload in the same browser, `Restablecer demo` resets. Site `?demo=1` reflects them. |
| M1 | Self-contained folder (trailing-slash host) | `python3 -m http.server 8899` from the **repo root** → `http://localhost:8899/baristop-v2/` and `/baristop-v2/admin/` render fully, no 404s in the console except the API in demo mode. Also from inside the folder at `http://localhost:8899/`. |
| M2 | Clean-URL host (the real case) | `npx vercel dev` → `http://localhost:3000/baristop-v2` (**no** trailing slash) and `/baristop-v2/admin` load CSS, JS, `config.js`, `default-content.json` and placeholder SVGs (Network tab: zero 404s). `Vista previa ↗` from the admin lands on `/baristop-v2?nocache=1` with the query intact; `/baristop-v2?demo=1` and `/baristop-v2/admin?demo=1` work. `grep -r '"/baristop-v2' baristop-v2/` → 0 results (no absolute paths). |
| T1 | Unit tests | `npm test` green: `tests/baristopShared.test.ts` (incl. `stripPrivate`, `resolveRecipients` always includes `quoteAlwaysTo`, `buildQuoteEmail` subject uses the branch tag, `isSafeHttpsUrl` rejects `javascript:`/`http:`/`data:`), `tests/baristopPreviewGate.test.ts`, `tests/baristopSchemaSync.test.ts` (Shared SCHEMA === site schema; DefaultContent === default-content.json; the three shared helper bodies identical; no dotted folder names under `baristop-v2/`). |

---

## 9. Workstreams (disjoint owned paths)

All three start from this spec. Shared contracts: §2 (content JSON + schema + image
table), §3.1–3.2 (config + load order), §5.1–5.6 (API shapes). If a workstream needs
to change a contract, it edits this spec first and tells the others.

### `site` — public page

Owns: `baristop-v2/index.html`, `baristop-v2/config.js`, `baristop-v2/css/**`,
`baristop-v2/js/**` (including `js/schema.js`), `baristop-v2/data/default-content.json`,
`baristop-v2/assets/**` (copies favicons from `baristop/`, writes the placeholder SVGs).
Does not touch `baristop-v2/admin/**`, `apps-script/**`, `middleware.js`, `vercel.json`, `tests/**`.

Deliverables: §1 page, mobile nav, catalog dialog, quote form + WhatsApp fallback,
§3.2 loader with cache/demo mode, `default-content.json` exactly per §2 seeds,
`js/schema.js` exactly per §2.13/2.15 (UMD-ish so node can load it), placeholders.

### `admin` — panel

Owns: `baristop-v2/admin/**` only. Reads `../config.js`, `../js/schema.js`,
`../data/default-content.json` at runtime (relative). Deliverables: §4 in full,
including the image pipeline, demo mode via `localStorage`, Spanish help texts,
`api.js` implementing the §5 client (text/plain POST, token in `sessionStorage`,
error-code mapping).

### `backend` — Apps Script, gate, tests

Owns: `apps-script/**` (`Code.gs`, `Shared.js`, `DefaultContent.js`,
`appsscript.json`, `README-deploy.md`), `middleware.js`, `lib/preview-gate.mjs`,
`vercel.json` (only if an edit is needed; none is required for the gate),
`.env.example` (add `BARISTOP_PREVIEW_HASH` with a comment), `package.json` (only to
add `@vercel/functions` under `dependencies`, §6.1), `tests/baristop*.test.ts`.
`tests/baristopSchemaSync.test.ts` reads `baristop-v2/js/schema.js` and
`baristop-v2/data/default-content.json` (read-only; it does not own them) and fails
when they drift from `apps-script/Shared.js` / `DefaultContent.js`.

Integration order: backend deploys the Script and gives the `/exec` URL → site puts
it in `config.js` → admin tests live saves → the preview password hash is set in
Vercel → everyone runs §8.

---

## 10. Open questions (placeholders used until answered)

Resolved by the brief's confirmed data (2026-10-15) and no longer open: Silvia's,
Karime's and Karla's addresses, the Durango address and WhatsApp line, the
Aguascalientes phone (one number, `449 178 4526`), the per-branch subject tags.

1. Branch photos, machine list + specs + photos, recipe photos/videos, partner logos
   and URLs, Coffee Solutions details (what they supply — the seed shows the logo only).
2. Fernando's e-mail, when he has one (then add it to Durango's `Correos cotización`
   in admin — nothing in the code changes).
3. Nav order: the client circled the slot after `Contacto` for `Recetas`; the page
   order puts Recetas before Contacto. Spec follows the circle; easy to swap.
4. Temporary preview password (José Pablo chooses; same value goes to
   `BARISTOP_PREVIEW_HASH` and `ADMIN_PASSWORD_PLAIN`).
5. Confirm Routing Middleware invocations on the Hobby plan after the first deploy
   (§6.1) — expected to be within the free allowance for a password-gated preview.
6. Whether the client wants the "Saju"-labelled example poster replaced by a real
   Sahu image before any `Polvos` photo goes live (seed uses `frappe-taro.jpg`, which
   is clean).
