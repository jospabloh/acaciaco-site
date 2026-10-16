# Baristop v2 — catálogo real (design spec, round 2)

Status: design, 2026-10-15. Input: `2026-10-15-baristop-v2-catalogo-brief.md`.
Supersedes the parts of `2026-10-15-baristop-v2-design.md` (round 1) named in §0.2;
everything else in round 1 stays binding. Section numbers here start at 10 so a
reference like "§12.3" is unambiguous between the two documents.

This document is the contract between the three workstreams of §20. Any shape
another workstream needs — JSON, Sheet headers, API bodies, URL grammar, Spanish
strings, image boxes — is written here, not negotiated later. A workstream that
must change a contract edits this file first and tells the others.

The user's ask, verbatim, is the quality bar:

> "El menú de arriba no hace nada… si lo diseñas bien debería llevarte a ver el tipo
> de producto en sus diferentes tipos, precios, disponibilidades, especificaciones,
> fotos, guía o sugerencia de uso. Lo que haría un humano experto en ventas, UX y UI."

---

## 10. Decisions at a glance

| Topic | Decision |
|---|---|
| What the catalog is | Three levels driven by the Sheet: **group** (Maquinaria / Insumos, fixed) → **category** (`categories`, editable, ordered) → **product** (`products`) with **variants** (`variants`: flavour / presentation / model, each with its own price, unit, SKU and per-branch availability). |
| Where it lives | One new static shell `baristop-v2/catalogo/index.html` renders the catalog index, a category, a product, a search result and the group pages from `location.search` (§12). The home page keeps its one-page structure and links into the shell. |
| Routing | **Query-string routes on a static shell** (`catalogo?c=molinos`, `catalogo?p=saju-taro`). Not hash routes, not one page per product. Justification in §12.1. Works on Vercel clean URLs (`/baristop-v2/catalogo`), on trailing-slash hosts (`/baristop-v2/catalogo/`), after the move to `/baristop`, and on any cPanel-style host — no rewrites, no server. Deep links load directly; Back/Forward work through `popstate`; links are real `<a href>` so middle-click, "copy link" and crawlers work. |
| Site root on sub-pages | Every shell sets `window.BARISTOP_ROOT` right after the round-1 `<base>` bootstrap (`"./"` on `index.html`, `"../"` on `catalogo/index.html`). Content-relative image paths (`assets/…`) and `data/default-content.json` resolve against it, never against `document.baseURI` (§12.4). |
| Navigation | Desktop: `Maquinaria ▾` and `Insumos ▾` are **disclosure menus** (click to open, not hover-only) listing that group's categories with thumbnail + tagline, plus `Ver todo`; then `Recetas`, `Contacto`, the quote-list button and the CTA. Phone: the drawer shows the same tree as two accordions. Items and order come from `categories` (§11). |
| Quote list | `Mi cotización`: a slide-over drawer available on every page, persisted in `localStorage` as ids + quantities only (`baristop-v2:quote-list`). Sending uses the existing `submitQuote` action with a new optional `items[]`; the server re-resolves every line from the Sheet, never trusts client labels or prices (§15). |
| Prices | Per variant, number in MXN or empty. Card label: `$1,250` (single price), `Desde $890` (variants differ), `Precio a cotizar` (no variant has a price). Under every price: `site.priceNote` (seed: `Precios en MXN. Confirma IVA y vigencia al cotizar.`). **No price, spec or brand is invented**: every seed product is named `… (ejemplo)` and priced empty. |
| Availability | Per variant, per branch, four states `disponible · pocas · pedido · agotado` + unknown (empty). Stored in one `Disponibilidad` cell as `ags=disponible; durango=pedido` so new branches never need new columns (§16.4). |
| Content model | **Additive.** Three new tabs `Categorias`, `Productos`, `Variantes`; one new column `Productos` at the end of `Cotizaciones`; new `site` keys. `CategoriasMaquinaria`, `Maquinas`, `Insumos` stay in the Sheet untouched and `setup()` migrates them once into the new tabs **before** any seeding (§16.7). The public `getContent` returns the legacy arrays only while `categories` is empty (§16.1). |
| Legacy fallback | If a content document has no `categories` (old cache, old script version), the site derives the catalog from `machineryCategories` + `insumos` + `machines` with the pure `legacyToCatalog()` — byte-identical in `Shared.js` and `js/schema.js`, enforced by the sync test. The nav therefore never "does nothing" even against an un-migrated backend. |
| Cache budget | `CacheService` values cap at 100 KB; a real catalog can exceed that. `Code.gs` stores the content gzip+base64 in ≤ 90 KB chunks (`content:v2:n`) with an index key (§16.8). Field maxima keep a 150-product catalog under ~250 KB raw / ~45 KB gzipped on the wire. |
| Admin | New `Catálogo` section (replaces `Maquinaria` and `Insumos` in the sidebar): Categorías → Productos → product editor with nested Variantes (add / duplicate / reorder), multi-photo field, specs as label/value rows, availability selects per visible branch; plus a `Lista de precios` table for bulk price/availability edits (§17). |
| Images | New boxes: `categories.image` 1200 × 800 (3:2), `products.photos` 1200 × 1200 (1:1, up to 6), `variants.image` 1200 × 1200 (1:1, optional). Drive URLs get a size suffix on cards (`=w600`) and in the gallery (`=w1200`) (§18.3). |
| Signature element | The **etiqueta de anaquel** (shelf tag): the price + availability block on the product page is drawn as a cream price tag with a gold hairline, a punched hole and the variant name in Fraunces — the one memorable thing on the page; everything else stays quiet (§13.2). |

### 10.1 Reading order for implementers

`site` → §11, §12, §13, §14, §15, §18, §19. `admin` → §16.1–16.6 (shapes), §17. `backend` → §16, §15.3–15.5, §19.1.

### 10.2 What this round supersedes in round 1

- §1.2 Nav links and the phone panel (replaced by §11).
- §1.7 Catálogo section's category **dialog** (`#cat-dialog`, `renderCategoryDialog`, `#maquinaria-<id>` hash) is **removed**; category and insumo cards become links into the shell (§14.2).
- §2.6–2.8 remain as legacy sections (still read, still validated, no longer edited in the admin).
- §4.2 sidebar: `Maquinaria` and `Insumos` are replaced by `Catálogo` (§17.1).
- §5.6 `submitQuote` is extended, not replaced (§15.3). `QUOTE_NEEDS` gains one option.
- §8 test plan is extended by §19.

Everything else in round 1 — hero, strip, pillars, values, process, recipes, franchise,
quote panel, alliances, footer, preview gate, admin login/upload, transport — is unchanged.

---

## 11. Navigation

### 11.1 Desktop (≥ 820 px)

```
[seal] Baristop     Maquinaria ▾   Insumos ▾   Recetas   Contacto      [🔍] [🧾 Mi cotización ·3] [ Cotiza tu equipo e insumos ]
```

- `Maquinaria ▾` / `Insumos ▾`: `<button class="nav-group" aria-expanded="false" aria-controls="menu-maquinaria">`.
  Click toggles the panel; `Escape` closes and returns focus; clicking outside closes;
  `ArrowDown` from the button moves into the panel; `Tab` leaves the panel and closes it.
  Hover opens after 120 ms and closes after 250 ms of leaving (pointer users), but the
  click path is the primary one so touch laptops and keyboards work. Only one panel open.
- Panel (`.mega`): full-width under the bar, `--wine-900` background, `--cream-text`,
  one column per category (max 4 per row, wraps), each an `<a href="catalogo?c=<id>">`
  with the category image (3:2, 120 px wide, placeholder if empty), name (Fraunces 20),
  tagline (13 px, `--muted-cream`) and `N productos` (muted; hidden when 0). A last
  link `Ver todo <Grupo> →` to `catalogo?g=<group>`. Categories with no visible product
  still appear (the client may be loading them) — their count reads `Próximamente`.
- `Recetas` → `#recetas` on the home page, `../#recetas` from the shell (§12.4 helper).
  `Contacto` → `#cotiza` / `../#cotiza`.
- **Sucursales** (brief item 1 names `Sucursales/Contacto`): the bar keeps a single
  `Contacto` link to save width, and `#sucursales` is reachable from **both** panels'
  footer row (`.mega-foot`): `Sucursales: Aguascalientes · Durango` as two links to
  `rootLink("#sucursales")` plus the branch WhatsApp link each (`wa.me`), and
  `¿Dudas? Escríbenos →` to `#cotiza`. The phone drawer (§11.2) lists `Sucursales`
  as its own row under `Contacto`. So the branches section is one click away from
  every page, not only by scrolling the home page.
- Search icon button (`aria-label="Buscar en el catálogo"`) → `catalogo?q=` with the
  search box focused (`#buscar`); on the shell it only focuses the box.
- Quote-list button: receipt icon + `Mi cotización` + count badge (`aria-label="Mi cotización, 3 productos"`;
  the badge is `aria-hidden`). Count 0 hides the badge, not the button. Opens the drawer (§15.1).
  Under 1100 px the label collapses to the icon + badge.
- CTA unchanged (`site.navCta`). It still targets the quote form (`#cotiza`), not the drawer.
- Group labels are `site.navGroupMachinery` (`Maquinaria`) / `site.navGroupSupplies` (`Insumos`).
  A group with zero visible categories is not rendered.

### 11.2 Phone (< 820 px)

Hamburger opens the drawer (round 1 behaviour kept) with this tree:

```
Maquinaria                    ▾   (accordion, aria-expanded; open by default)
   Cafeteras espresso · Semi y automáticas
   Molinos · Molienda constante
   Licuadoras · Para frappés y smoothies
   Ver toda la maquinaria →
Insumos                       ▾   (collapsed by default)
   …
Recetas
Contacto
Sucursales                        (→ rootLink("#sucursales"))
[ 🔍 Buscar producto ______ ]      (type="search", submits to catalogo?q=)
[ Mi cotización (3) ]
[ Cotiza tu equipo e insumos ]
```

Accordion rows are `<button aria-expanded>` controlling a `<ul>`; the category rows are
plain links (name + tagline on one line, ellipsis). The list button is also pinned in
the bar next to the hamburger (icon + badge) so it is one tap away without opening the menu.

### 11.3 Rendering

Both shells carry the same inline default nav (seed categories) so the page is usable
before JS. The renderer rebuilds `[data-list="navGroups"]` (desktop panels) and
`[data-list="drawerGroups"]` (phone accordions) from `content.categories` on every
render. Product counts come from `content.products` grouped by `categoryId`.
Everything is `createElement`/`textContent`.

### 11.4 Footer `Explora`

`Maquinaria` → `catalogo?g=maquinaria`, `Insumos` → `catalogo?g=insumos`, plus the
existing `Recetas`, `Cómo trabajamos`, `Franquicias`, and new `Qué ofrecemos`
(`#oferta`) since it left the nav.

---

## 12. Routing — the catalog shell

### 12.1 Choice and justification

Options considered:

1. **One HTML file per category/product.** Impossible: categories and products come from
   the Sheet; a static host cannot mint pages per row without a build step, which this
   project does not have.
2. **Hash routes on the home page** (`/#/catalogo/molinos`). Works everywhere, but (a)
   collides with the existing section anchors (`#cotiza`, `#recetas`) and the recipe/quote
   scroll logic; (b) search engines and WhatsApp/Facebook link previews ignore the
   fragment, so a shared product link previews the home page; (c) one giant page keeps
   growing — every product render competes with the hero.
3. **Query-string routes on a dedicated static shell** (`catalogo?c=…`, `catalogo?p=…`).
   The shell is one `index.html` in a folder; the host serves it at `/baristop-v2/catalogo`
   (Vercel, `cleanUrls`) or `/baristop-v2/catalogo/` (python, cPanel, Netlify, GitHub
   Pages). Query strings survive every redirect both hosts emit, need no rewrite rule,
   and are what `<a href>` already does. Deep links load directly (the shell reads
   `location.search` on boot). Back/Forward are native. The shell can later be copied
   to `/baristop/catalogo` unchanged.

**Decision: option 3.** Hash fragments stay reserved for in-page anchors (`#especificaciones`,
`#lista` for the drawer state).

### 12.2 URL grammar

| URL (relative to the site root) | View | Notes |
|---|---|---|
| `catalogo` | Catálogo index | both groups, every visible category, `Productos destacados` |
| `catalogo?g=maquinaria` · `?g=insumos` | Group page | categories of the group as big cards + the group's featured products |
| `catalogo?c=<categoryId>` | Category page | product grid with filters, sort, breadcrumb |
| `catalogo?c=<id>&marca=<brand>&disp=1&suc=<branchId>&orden=<precio-asc\|precio-desc\|nombre>` | Category with filters | every filter is reflected in the URL (`history.replaceState`), so a filtered view is shareable and Back restores it |
| `catalogo?p=<slug-or-id>` | Product detail | default variant = first visible |
| `catalogo?p=<slug>&v=<variantId>` | Product with a variant pre-selected | the variant selector updates `v` with `replaceState` |
| `catalogo?q=<texto>` | Search results | name, brand, summary, category name, variant names; ≥ 2 characters |
| any of the above `#lista` | Same view with the quote-list drawer open | the drawer pushes `#lista` on open; closing goes back **only** when the drawer itself pushed that entry (§15.1 history guard), otherwise it strips the hash with `replaceState` |
| `?demo=1`, `?nocache=1` | Round-1 modes | preserved by the router on every in-shell navigation |

Unknown `c`, `p`, `g` → the not-found state (§18.1). Param validation before use:

- `c`, `p`, `g`, `v`, `suc`, `orden` (ids / enums): `^[a-z0-9][a-z0-9-]{1,39}$` (`orden`
  additionally must be one of the three sort values; `g` one of the two groups).
- `q`, `marca` (free text): **not** a character allowlist — accented capitals (`Ñ`,
  `É`, `Ü`), `/`, `&`, `+` and `.` are legitimate in brand names and searches
  (`SOY TÉ`, `Ñame`, `Café & Té`). Rule: `decodeURIComponent` (catch → absent) →
  strip control characters (`[\u0000-\u001F\u007F]`) → `trim()` → keep when
  `length ≤ 60`, else truncate to 60. Matching is then done on
  `fold(s) = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()`, so
  the URL value never needs to match a pattern to be understood. The value is only
  ever set with `textContent` / `value`, never interpolated into HTML.
- `disp`: `"1"` or absent.

### 12.3 Router behaviour (`js/catalog.js`)

- Boot: parse `location.search` → `route = { view, id, filters }` → `render(content, route)`.
  Set `<title>`: `Molinos · Catálogo Baristop`, `Saju Taro (ejemplo) · Baristop`,
  `Resultados para "taro" · Baristop`, `Catálogo · Baristop`. Set `meta[name=description]`
  from the summary/tagline and `link[rel=canonical]` to the absolute clean URL.
- Click interception: a click on an `<a>` whose resolved URL has the shell's own path
  (same `pathname` as `location.pathname`, ignoring the trailing slash) and no modifier
  key/middle button → `preventDefault`, `history.pushState({route}, "", href)`,
  `render`, scroll to top (or to `#` target), move focus to the view's `<h1>`
  (`tabindex="-1"`). Every other link is a normal navigation.
- `popstate` → re-parse and render without scrolling to top (browser restores scroll).
- Filters/sort/variant changes use `replaceState` (no history spam).
- Content arrives in layers (round 1 §3.2): the shell renders the current route with
  whatever layer is on screen and re-renders when a newer layer lands; a selected
  variant or an open drawer survives the re-render (state lives in the route, not the DOM).
- JS-off: the shell shows the inline index (seed categories) and a `<noscript>` line
  `Activa JavaScript para ver el catálogo completo.` Accepted, same as round 1.

### 12.4 Paths from a sub-folder

`catalogo/index.html` opens with the **identical** round-1 `<base>` bootstrap, followed
by one line:

```html
<script>window.BARISTOP_ROOT = new URL("../", document.baseURI).href;</script>
```

`index.html` sets `window.BARISTOP_ROOT = new URL("./", document.baseURI).href;`.
Rules:

- Static references in `catalogo/index.html` are written relative to the file
  (`../css/site.css`, `../js/schema.js`, `../config.js`, `../assets/…`).
- `content.js` fetches `BARISTOP_ROOT + "data/default-content.json"`.
- `render.js` resolves a content-relative image (`assets/ejemplo/x.jpg`) as
  `BARISTOP_ROOT + path`. `https://` and `data:` images are unchanged.
- Links between pages use `BaristopSchema.rootLink(path, location, root)`. **It lives
  in `js/schema.js`** (backend-owned, pure: takes `location` and the root as
  arguments, touches no DOM) so the admin — which loads `../js/schema.js` but never
  `render.js` — can build `Ver en el sitio ↗` (§17.2) with the same function. `render.js`
  exposes the bound convenience `R.rootLink(path) = BaristopSchema.rootLink(path, location, window.BARISTOP_ROOT)`.
  Its unit test lives in `tests/baristopShared.test.ts` (backend) with the four cases below.

```js
// "catalogo?c=molinos" -> "/baristop-v2/catalogo?c=molinos" on a clean-URL host,
// "/baristop-v2/catalogo/?c=molinos" on a trailing-slash host,
// "/baristop-v2/catalogo/index.html?c=molinos" when the current page was opened by
// file name (cPanel: /baristop-v2/catalogo/index.html?p=…). "" -> the home page.
function rootLink(path, loc, root) {
  var file = /\/[^\/]+\.[a-z0-9]+$/i.test(loc.pathname);            // opened as .../index.html
  var clean = !file && !/\/$/.test(loc.pathname);                   // served without a slash
  var u = new URL(path || "", root);
  var s = u.pathname;
  if (clean) s = s.replace(/\/$/, "") || "/";
  else if (path && path.indexOf("?") !== 0 && path.indexOf("#") !== 0 && !/\/($|\?|#)/.test(path) && u.pathname.indexOf(".") === -1) s += "/";
  if (file && !/\.[a-z0-9]+$/i.test(s)) s = s.replace(/\/$/, "") + "/index.html";
  return s + u.search + u.hash;
}
```

  Contract outputs (asserted by the unit test, `root = "https://x/baristop-v2/"`):
  `rootLink("catalogo?c=molinos", {pathname:"/baristop-v2/catalogo"})` → `/baristop-v2/catalogo?c=molinos`;
  `{pathname:"/baristop-v2/catalogo/"}` → `/baristop-v2/catalogo/?c=molinos`;
  `{pathname:"/baristop-v2/catalogo/index.html"}` → `/baristop-v2/catalogo/index.html?c=molinos`;
  `rootLink("#cotiza", {pathname:"/baristop-v2/catalogo"})` → `/baristop-v2#cotiza`
  (and `/baristop-v2/#cotiza`, `/baristop-v2/index.html#cotiza` on the other two).
  No absolute `/baristop-v2/…` string appears in source — `grep -r '"/baristop-v2' baristop-v2/`
  stays at 0.
- No folder under `baristop-v2/` has a dot in its name (`catalogo` is fine); the
  round-1 test still enforces it.

### 12.5 Hosting checks (must pass before merge)

Clean-URL server (`cleanurl-server.mjs`, port 8898) and `python3 -m http.server 8899`:
`/baristop-v2/catalogo`, `/baristop-v2/catalogo?c=molinos`, `/baristop-v2/catalogo?p=saju-taro-ejemplo`
load with zero 404s in the Network tab; refresh on each keeps the view; Back from a
product returns to the filtered category; `?demo=1` survives three in-shell clicks.

Three URL forms must work, because they are what the three hosting setups produce:

| Form | Host | Exercises |
|---|---|---|
| `/baristop-v2/catalogo?p=x` | Vercel (`cleanUrls`, `trailingSlash:false`) | `clean` branch of `rootLink` |
| `/baristop-v2/catalogo/?p=x` | python, cPanel folder, Netlify, GitHub Pages | slash branch |
| `/baristop-v2/catalogo/index.html?p=x` | cPanel direct file open, `file://` previews | `file` branch (dot in the pathname) |

On the clean-URL server, requesting `/baristop-v2/catalogo/?c=x` must answer a
**308 to `/baristop-v2/catalogo?c=x`** — the query string survives the redirect (this is
Vercel's `trailingSlash:false` behaviour, mirrored by `cleanurl-server.mjs`); the smoke
test asserts the final URL still carries `?c=x` and the category renders.

---

## 13. Pages in the shell

Shared frame: the round-1 nav and footer (§11), then a sticky **sub-header**
(`.cat-bar`, `--cream-card`, 1 px `--line` bottom) with the breadcrumb on the left and
the search box on the right (`<form role="search">`, `<input type="search" id="buscar"
placeholder="Buscar producto, marca o sabor" aria-label="Buscar en el catálogo">`).
On phones the sub-header stacks: breadcrumb line, then the search field full width.

Breadcrumb: `<nav aria-label="Ruta"><ol>`: `Inicio › Catálogo › Insumos › Polvos y bases › Saju Taro`.
The last item is `aria-current="page"` and not a link. Group crumbs link to `?g=`,
category crumbs to `?c=`.

### 13.1 Catálogo index (`catalogo`)

H1 `Catálogo` (`site.catalogIndexTitle`), intro `site.catalogIndexIntro`
(`Equipo y consumibles para tu barra. Elige una línea o busca un producto.`).
Then, per group: `.seal-label` with the group name, a category grid (same `.mcard`
look as the home, now `<a>`), each card: image 3:2, name, tagline, `N productos` /
`Próximamente`. Then `Productos destacados` (§14.3 component, up to 8). Then the
`¿No encuentras algo?` band: `Cotiza por WhatsApp y te enviamos opciones.` with the two
branch WhatsApp buttons.

### 13.2 Product detail (`catalogo?p=…`)

Desktop layout (≥ 880 px): two columns `1.05fr 0.95fr`, gap 48 px. Phone: stacked,
gallery first, sticky bottom action bar.

```
┌─ gallery ─────────────────┐  ┌─ buy column ───────────────────────────┐
│ main image 1:1 (zoomable) │  │ MARCA (eyebrow, gold)                   │
│ ○ ○ ● ○  thumbs (scroll)  │  │ H1 Nombre del producto                  │
│                           │  │ summary (18px, --muted)                 │
│                           │  │ Presentación / Sabor / Modelo            │
│                           │  │ [1 kg] [500 g] [Caja 6 kg]   (radiogroup)│
│                           │  │ ┌ etiqueta de anaquel ─────────────────┐│
│                           │  │ │ ◦  $ 1,250   / kg       Saju Taro 1 kg││
│                           │  │ │    SKU SJ-TARO-1K                     ││
│                           │  │ │    Precios en MXN. Confirma IVA…      ││
│                           │  │ │  ● Aguascalientes  Disponible          ││
│                           │  │ │  ◐ Durango         Pocas piezas        ││
│                           │  │ └───────────────────────────────────────┘│
│                           │  │ [ − 1 + ]  [ Agregar a mi cotización ]   │
│                           │  │ WhatsApp: [Aguascalientes] [Durango]     │
└───────────────────────────┘  └──────────────────────────────────────────┘
  Especificaciones (table)  |  Guía de uso  |  Recetas con este producto  |  También te puede interesar
```

- **Gallery**: `photos[]` (then the selected variant's `image` first when set). Main
  `<img>` 1:1, `object-fit: cover`, `--cream` background, 16 px radius. Thumbnails: a
  horizontally scrollable strip (`scroll-snap-type: x mandatory`), each a
  `<button aria-label="Foto 2 de 4" aria-pressed>`; on phones the main image itself
  swipes (strip of all photos with scroll-snap, dots underneath). One photo → no
  thumbs. Zero photos → the 1:1 placeholder. Tap on desktop opens a `<dialog>` lightbox
  (same close rules as round 1's dialog; `Escape`, backdrop, `Cerrar`).
- **Brand eyebrow** (`.seal-label` in gold): `brand`; hidden when empty.
- **H1** `name` (Fraunces, clamp 30–44 px). Products named `… (ejemplo)` additionally
  get a small `Ejemplo` tag next to the H1 (`.tag`, gold tint) so the client sees what
  is seed data on the preview. The tag is derived from the name suffix only.
- **Variant selector**: label `Presentación` (`site.variantLabel`, editable: the
  client may prefer `Sabor` or `Modelo`); chips in a `role="radiogroup"` with roving
  tabindex (reuse the branch `seg` keyboard handler). Variants that are `agotado` in
  every branch render with a strikethrough dot and remain selectable (the client can
  still ask). A product with exactly one visible variant shows no selector; the
  variant name still appears on the tag. Zero visible variants → the tag shows
  `Precio a cotizar` and availability `Consulta disponibilidad`, and the add button
  still works (line without variant).
- **Etiqueta de anaquel** (`.shelf-tag`): cream card (`--paper` on the cream page),
  1 px `--line` border, 12 px radius, a 14 px punched circle top-left drawn with
  CSS (radial-gradient cut-out) and a 2 px gold rule under the price row; a slight
  −1.5° rotation on the price figure only is **not** used (keep it legible). Rows:
  price (Fraunces 600, 34 px) + `/ unidad` (`unit`, 15 px muted); variant name right-
  aligned (Fraunces italic); `SKU …` (12 px, letter-spaced, hidden when empty);
  `site.priceNote` (13 px, muted); availability list (§13.3). Empty price → `Precio a cotizar`
  in Fraunces italic 26 px, and the note changes to `site.priceToQuoteNote`
  (`Te lo cotizamos por WhatsApp o desde tu lista.`).
- **Quantity stepper**: `<div role="group" aria-label="Cantidad">` with `−` / `+`
  buttons (`aria-label="Quitar uno"/"Agregar uno"`) and a numeric `<input inputmode="numeric" min="1" max="999" value="1" aria-label="Cantidad">`.
- **Primary CTA** `Agregar a mi cotización` (`btn-gold`, full width on phones). On
  click: add/merge into the list, button text becomes `Agregado ✓` for 1.6 s, a
  polite live region announces `Saju Taro · 1 kg agregado a tu cotización`, the nav
  badge increments, and a small inline link `Ver mi cotización` appears under the
  button. The drawer does **not** auto-open (B2B buyers add several items; a drawer
  interrupting every add is the classic mistake).
- **WhatsApp CTAs**: one `btn-ghost` per visible branch (`WhatsApp Aguascalientes`),
  `wa.me/<digits>?text=` with
  `Hola Baristop <Sucursal>, me interesa: <Nombre> · <Variante> · <qty> pza(s). ¿Me pueden cotizar?`
  (variant part omitted when none; qty from the stepper).
- **Phone sticky bar** (`.buy-bar`, bottom, `--cream-card`, shadow): price or
  `Precio a cotizar` + `Agregar a mi cotización`. Hidden while the drawer or lightbox is open.
- **Below the fold** (full width, in this order, each with an `h2` and an `id` for
  anchors): `Especificaciones` (`#especificaciones`) as a real `<table>` (`<th scope="row">`
  label, `<td>` value) built from `specs` lines `Etiqueta: Valor` (a line without `:`
  renders as a single full-width cell); `Guía de uso` (`#uso`) renders `usage` with
  paragraphs split on blank lines and lines starting with `- ` as a list; `Recetas con
  este producto` (`#recetas`) — recipe cards from `relatedRecipes` (ids that match a
  visible recipe), round-1 card component; `También te puede interesar` (`#relacionados`)
  — product cards from `relatedProducts`, and when fewer than 3 resolve, filled with
  other visible products of the same category (never the product itself), max 4.
  A section with nothing to show is not rendered. `description` sits under the summary
  on desktop (collapsible `Leer más` after 6 lines) and before the specs on phones.
- Related recipe cards keep linking out to the video (round 1).

### 13.3 Availability component (`.avail`)

`<ul class="avail">`, one `<li>` per visible branch, in branch order:

| State | Dot | Text |
|---|---|---|
| `disponible` | solid green `#2E7D4F` | `Disponible` |
| `pocas` | half gold `--gold` | `Pocas piezas` |
| `pedido` | outlined wine `--wine` | `Bajo pedido` |
| `agotado` | gray `#9A8B80`, strikethrough text | `Agotado` |
| empty | gray outline | `Consulta disponibilidad` |

Text is always present (colour is never the only cue). Dots are `aria-hidden`.
A `<span class="sr-only">` prefixes the branch name: `Aguascalientes: Disponible`.
Below the list, `site.availabilityNote` (`Existencias actualizadas por sucursal. Confirma al cotizar.`).

### 13.4 Category page (`catalogo?c=…`)

- Header: category image as a 3:2 banner on desktop (max 220 px tall, cover) with the
  name overlaid? **No** — placeholders would dominate. Instead: breadcrumb, H1 `name`,
  tagline as subtitle, `description` paragraph (muted, ≤ 60 ch), count `12 productos`.
- **Toolbar** (`.filters`, sticky under the sub-header on desktop, a `Filtrar y ordenar`
  button opening a bottom sheet on phones): chip groups
  `Marca` (one chip per distinct `brand` among the category's visible products; hidden
  when < 2 brands), `Disponibilidad` (`Disponible ahora` toggle = at least one variant
  `disponible` or `pocas` in the selected branch, or in any branch when no branch is
  chosen), `Sucursal` (`Aguascalientes` / `Durango` toggles, from `branches`), and a
  `<select aria-label="Ordenar">`: `Recomendado` (Sheet order) · `Precio: menor a mayor`
  · `Precio: mayor a menor` · `Nombre A–Z`. Products without a price sort last in both
  price orders. Active filters show as removable chips + `Quitar filtros`.
- **Grid** (`.pgrid`): 2 columns from 0, 3 at 760 px, 4 at 1100 px. Product card
  (`.pcard`, an `<a href="?p=…">` wrapping everything):
  photo 1:1 (lazy, `=w600`), brand (11 px, letter-spaced, gold-brown `#8A6320`),
  name (Fraunces 18–20, 2-line clamp), summary (14 px muted, 2-line clamp), price line
  (`$1,250 / kg`, `Desde $890`, or `Precio a cotizar` in italic), availability
  mini-row: up to two small dots with the branch initials (`AGS`, `DGO`) and the
  state's colour, text in a `title`/`sr-only` — on the card the full text would not fit;
  the detail page carries it. `Ejemplo` tag on seed products.
  No add-to-list on the card: the variant must be chosen first (B2B rule: never add an
  ambiguous line).
- Empty category → §18.1. No match after filters → `Ningún producto coincide con esos filtros.` + `Quitar filtros`.

### 13.5 Group page (`catalogo?g=…`)

H1 group name, intro (`site.groupMachineryIntro` / `site.groupSuppliesIntro`, seeds
in §16.6), category cards (big, 3:2 image, name, tagline, count), then that group's
featured products, then the WhatsApp band.

### 13.6 Search (`catalogo?q=…`)

H1 `Resultados para "taro"` and `N productos`. Matching: case- and accent-insensitive
substring over `name`, `brand`, `summary`, category name and variant names, done
client-side on the loaded content (no API call). Result cards as in §13.4, each with
its category as a small crumb — **plain text** (`<span class="pcard-crumb">Polvos y bases</span>`),
never a nested `<a>`: the whole card is already an `<a>`, and an anchor inside an
anchor is invalid HTML and breaks screen-reader link lists. Fewer than 2 characters → the index with the box
focused and hint `Escribe al menos 2 letras.` Zero results → §18.1.

### 13.7 Mobile ergonomics

Cards ≥ 44 px tap targets, 16 px gutters, no horizontal scroll (verified at 360 px).
The sticky buy bar leaves 12 px above the home indicator (`env(safe-area-inset-bottom)`).
Filters bottom sheet traps focus and closes on `Escape`/backdrop/`Listo`.

---

## 14. Home page changes (`index.html`)

### 14.1 Nav

Replaced per §11. The round-1 `Qué ofrecemos` and `Cómo trabajamos` nav links move to
the footer only.

### 14.2 Catálogo section `#catalogo`

Same heading and intro. The **Maquinaria** cards become `<a href="catalogo?c=<id>">`
(no `aria-haspopup`, no dialog; `#cat-dialog` and `#dlg-backdrop` markup, CSS and JS are
deleted). The **Insumos** cards also become links to their category. Each card gains the
product count line. Both grids are rendered from `content.categories` filtered by
`group` (chips in `#oferta` too). Pillar links: `Ver maquinaria →` → `catalogo?g=maquinaria`,
`Ver insumos →` → `catalogo?g=insumos`. Hero `Ver catálogo` → `catalogo`.
Hero strip tiles: each tile links to `site.heroStrip<N>Link`? **No** — keep the strip
as images; instead each tile becomes a link by **accent-insensitive word containment**:
fold both strings (§12.2 `fold`), split the tile title into words of ≥ 4 letters, and
link to the first visible category whose folded name contains any of those words
(`Maquinaria` and `Insumos` first match a group name → `?g=`). With the seed:
`Maquinaria` → `?g=maquinaria`, `Polvos` → `polvos` (name `Polvos y bases`),
`Salsas` → `jarabes` (name `Jarabes y salsas` contains `salsas`), `Café` → `cafe`.
A tile whose title matches nothing stays a plain image, exactly as today — no dead
link, no 404. The rule is implemented once in `render.js` (`tileTarget(title, content)`).

### 14.3 `Productos destacados` `#destacados`

New section between `#catalogo` and `#porque`, `--cream-card` background.
`.seal-label` `Destacados`, H2 `site.featuredTitle` (`Lo que más piden las barras.`),
intro `site.featuredIntro` (`Una selección de equipo e insumos para empezar.`).
Grid of product cards (§13.4) for `products` with `featured: true`, Sheet order, max 8,
then `Ver todo el catálogo →` (`btn-wine`). Hidden entirely when no featured product is
visible — the seed marks 4 examples as featured so the section shows on the preview.

### 14.4 Quote form

The `#cotiza` form gains a line-items block when the list is non-empty:
`Incluye mi cotización (3 productos)` checkbox (checked) with a compact list under it
(name · variant · qty) and `Editar lista` opening the drawer. The `¿Qué buscas?` select
gains the option `Lista de productos` (last), auto-selected when the box is checked.
On submit the payload carries `items` (§15.3).

---

## 15. Lista de cotización (quote list)

### 15.1 Drawer

`<aside class="qlist" role="dialog" aria-modal="true" aria-labelledby="qlist-title">`,
slides from the right (full width < 680 px, 440 px otherwise), backdrop, focus trapped,
`Escape`/backdrop/`Cerrar` close, focus returns to the opener. History contract:

- **Open**: `history.pushState({ qlist: true }, "", loc.pathname + loc.search + "#lista")`.
- **Close**: if `history.state && history.state.qlist === true` → `history.back()`
  (the `popstate` handler sees the hash gone and closes the drawer). Otherwise — the
  page was opened directly on `#lista` (shared link, reload, bookmark) and there is no
  entry of ours to pop — `history.replaceState(null, "", loc.pathname + loc.search)`
  and close in place. **Never** call `back()` on a bare hash: on a direct open it would
  navigate off the site.
- **Boot with `#lista`**: render the route, then open the drawer with `replaceState`
  (same state object, no push) so Back from there still leaves the shell normally.
- `popstate` with hash `#lista` and state `qlist` → open; without → close (no history calls).

```
Mi cotización                                   [Cerrar]
3 productos · se cotizan sin compromiso
┌────────────────────────────────────────────────────┐
│ [img] Saju Taro (ejemplo)        $1,250 / kg       │   (prices/SKU here are mock-up only)
│       1 kg · SKU SJ-TARO-1K      [ − 2 + ] [Quitar]│
│ [img] Cafetera de ejemplo        Precio a cotizar  │
│       2 grupos                   [ − 1 + ] [Quitar]│
└────────────────────────────────────────────────────┘
Subtotal estimado: $2,500 · 1 producto a cotizar
Precios en MXN. Confirma IVA y vigencia al cotizar.
──────────────────────────────────────────────────────
¿Con qué sucursal quieres cotizar?  [Aguascalientes] [Durango]
Nombre ______   Negocio (opcional) ______
Teléfono o correo ______
Mensaje (opcional) ______
[ Enviar mi cotización ]      o envíala por WhatsApp
Vaciar lista
```

- Lines are rehydrated from content on every render: name, brand, variant name, unit,
  price, photo. A line whose product/variant is no longer visible shows
  `Ya no está disponible` and a `Quitar` button; it is excluded from the payload.
- Subtotal: sum of `price × qty` over priced lines; shown only when ≥ 1 priced line;
  the unpriced count is spelled out. Label is `Subtotal estimado` — never `Total`.
- The form is the round-1 form component, mounted a second time inside the drawer
  (`BaristopQuoteForm.mount(container, { withItems: true })`); same validation, same
  states, same demo note. Success replaces the drawer body with
  `¡Listo! Recibimos tu lista. Te respondemos en horario de atención.` and empties the
  list. WhatsApp fallback text:
  `Hola Baristop <Sucursal>, soy <Nombre>[ de <Negocio>]. Quiero cotizar:\n- 2 × Saju Taro (ejemplo) · 1 kg\n- 1 × Cafetera de ejemplo\n<Mensaje>. Contacto: <contacto>`.
- `Vaciar lista` asks `¿Vaciar tu cotización? Se quitarán 3 productos.` → `Vaciar` / `Conservar`.

### 15.2 Storage

`localStorage['baristop-v2:quote-list']` = `{"v":1,"items":[{"p":"saju-taro-ejemplo","v":"saju-taro-p1","q":2,"t":1760000000000}]}`.
Only ids and quantities; max 40 lines; `q` 1–999 integer. Add = merge on `(p, v)`.
Reads/writes are guarded (`try/catch`); without storage the list lives in memory for
the page. A `storage` event re-renders the badge in other tabs.

### 15.3 API — `submitQuote` extended

Request (new optional field `items`; everything else as round 1 §5.6):

```json
{ "action":"submitQuote", "branchId":"ags", "name":"María López", "business":"Café Central",
  "contact":"4491234567", "need":"Lista de productos", "message":"…", "website":"", "ts":1760000000000,
  "items":[ { "productId":"saju-taro-ejemplo", "variantId":"saju-taro-p1", "qty":2 },
            { "productId":"cafetera-ejemplo", "variantId":"", "qty":1 } ] }
```

Server (`Shared.validateQuote` + `Code.gs`):

1. `items` absent or `[]` → round-1 path unchanged. Present → must be an array of ≤ 40
   plain objects; `productId` matches `ID_PATTERN`; `variantId` is `""` or `ID_PATTERN`;
   `qty` an integer 1–999. Otherwise `VALIDATION` (`Revisa los productos de tu lista.`).
2. `Shared.resolveQuoteLines(items, content)` → `[{ productId, variantId, qty, name, brand, variant, sku, unit, price, found }]`
   using the **Sheet content** (visible products/variants only). Unknown ids keep
   `found:false`, `name = productId`, `variant = "(no encontrado)"` — the line is still
   mailed so sales can follow up; nothing is silently dropped.
3. `QUOTE_NEEDS` gains `"Lista de productos"` (appended; the old six stay valid).
4. `Shared.buildQuoteEmail(body, branch, site, nowIso, timeLabel, lines)`: subject
   `<tag> <Nombre> (<Negocio>) · 3 productos` (suffix only with lines; `1 producto`
   singular). Body (text and HTML) adds, after the field table, a `Productos` table:
   `Cant. · Producto · Presentación · SKU · Precio unit. · Unidad` with `Por cotizar`
   when price is empty, and a last row `Subtotal estimado (solo productos con precio): $2,500 MXN`
   when ≥ 1 priced line. Prices are formatted `$1,250.00` with `Shared.formatMoney`.
5. `Cotizaciones` log gains the column `Productos` (header appended by `setup()` /
   `ensureSheet_`): `2 × Saju Taro (ejemplo) · 1 kg [SJ-TARO-1K]; 1 × Cafetera de ejemplo` (≤ 2000 chars, truncated with `…`).
   **`logQuote_` changes signature** from a positional array to an object keyed by
   header name — today (`Code.gs:488`) it writes `cells` from column 1, which would
   break the moment a column is missing or reordered:

   ```js
   // Code.gs — new
   logQuote_({
     "Fecha": when, "Sucursal": branch.name, "Nombre": body.name, "Negocio": body.business || "",
     "Contacto": body.contact, "Qué busca": body.need, "Mensaje": body.message || "",
     "Destinatarios": to.join(", "), "Estatus envío": status, "Productos": productsCell   // "" without lines
   });
   function logQuote_(byHeader) {
     var sheet = spreadsheet_().getSheetByName(Shared.SCHEMA.logs.quotes.tab); if (!sheet) return;
     var head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
       .map(function (h) { return String(h == null ? "" : h).trim(); });
     var row = head.map(function (h) { return h in byHeader ? String(byHeader[h] == null ? "" : byHeader[h]) : ""; });
     // …same lock + "@" format + setValues(row) as today, width = head.length
   }
   ```

   Rules: the row is as wide as the **live header row**, not as the schema; a header
   the Sheet does not have (old Sheet, no `Productos` yet) is simply not written; a
   value for a header not in the schema is ignored; headers are matched by trimmed
   exact text. `Shared.SCHEMA.logs.quotes.headers` appends `"Productos"` (so
   `ensureSheet_` adds it at the end on the next `setup()`); because cells are placed
   by header, appending never shifts existing columns, and an owner-inserted column
   in the middle is left blank instead of corrupting the row. A unit test
   (`Shared.logRowFromHeaders(head, byHeader)`, pure, used by `logQuote_`) covers:
   old 9-column header, new 10-column header, reordered header, unknown extra column.
6. Response unchanged: `{ sent:true, recipientsCount, lines: 3 }` (`lines` added).

Rate limits and honeypot rules unchanged. Mail quota note: a list is still one mail.

### 15.4 Client (`js/quote-list.js`, site workstream)

Exposes `window.BaristopQuoteList = { get, add(productId, variantId, qty), setQty, remove, clear, count, lines(content), open, close }`
and dispatches `baristop:list` on change. `render.js` listens to update the badges.

### 15.5 Demo mode

Adding/removing works; `Enviar mi cotización` is replaced by the round-1 demo note;
WhatsApp works with the composed list.

---

## 16. Content model (additive)

### 16.1 `Content` document (round 1 §2.1 + new keys)

```ts
type Content = {
  version: 1;                       // unchanged: additive fields do not bump it
  updatedAt: string;
  site: Record<SiteKey, string>;     // round 1 keys + §16.6
  social; branches; heroImages; recipes; alliances; announcements; promos;   // unchanged
  machineryCategories: Category1[];  // LEGACY — read from the Sheet; returned by getContent ONLY while categories is empty
  machines: Machine1[];              // LEGACY — idem
  insumos: Insumo1[];                // LEGACY — idem
  categories: Category[];            // NEW §16.2
  products: Product[];               // NEW §16.3
  variants: Variant[];               // NEW §16.4
};
```

`SECTION_NAMES` becomes the round-1 list + `"categories", "products", "variants"`
(appended, in that order). `LIST_KEYS` in `content.js` likewise.

**Legacy arrays on the wire.** `getContent` (public, cached) returns
`machineryCategories`/`machines`/`insumos` **only when `categories` has zero visible
rows** (un-migrated Sheet); once the catalog exists they are returned as `[]` — the
machine photos and specs would otherwise travel twice on every public fetch. This is
additive and backwards compatible: an old client reading `machineryCategories` from a
migrated backend gets `[]`, which it already handles as "section empty"; a new client
reading an un-migrated backend gets the full legacy arrays and derives the catalog
(§16.7 `legacyToCatalog`). The admin's `getSection` for the three legacy sections
is unchanged (still readable, still validated). `DEFAULT_CONTENT` and
`default-content.json` keep the legacy arrays populated (the inline-HTML and JSON
first paint do not go through `getContent`); the size budget in §16.8 counts them.

Normalisation (`content.js`), in addition to round 1: sort and drop invisible for the
three new lists; drop products whose `categoryId` is not a visible category; drop
variants whose `productId` is not a visible product; **if `categories` is empty and
`machineryCategories`/`insumos` are not, replace the three new lists with
`legacyToCatalog(raw)`** (§16.7); then derive `offerMachineryChips`/`offerSuppliesChips`
and the home catalog grids from `categories` by `group`.

### 16.2 `categories` (tab `Categorias`)

```ts
type Category = Base & {
  group: "maquinaria" | "insumos";   // fixed vocabulary; the nav groups
  name: string;                      // "Molinos"
  tagline: string;                   // "Molienda constante"
  description: string;               // multi-line
  image: string;                     // 3:2
};
```

Headers: `ID · Orden · Visible · Grupo · Nombre · Subtítulo · Descripción · Imagen`.
`Grupo` cell holds `maquinaria` or `insumos` (admin shows a select `Maquinaria / Insumos`;
`setup()` adds a list data-validation on the column). Validation: `group` in the
vocabulary; `name` required.

### 16.3 `products` (tab `Productos`)

```ts
type Product = Base & {
  categoryId: string;        // must exist in categories
  brand: string;             // "Saju" — may be empty
  name: string;              // required
  slug: string;              // ^[a-z0-9][a-z0-9-]{1,59}$ — empty = use id; must be unique among products
  summary: string;           // ≤ 160 chars, one line: the "short benefit" on cards
  description: string;       // multi-line, ≤ 2000
  photos: string[];          // 0–6 image refs (https:// Drive URL or site-relative path), one per line in the cell
  specs: string[];           // 0–20 lines "Etiqueta: Valor", ≤ 160 chars each
  usage: string;             // multi-line, ≤ 2000: guía de uso / sugerencia (dosis, receta, para quién)
  relatedRecipes: string[];  // 0–10 recipe ids (comma-separated in the cell)
  relatedProducts: string[]; // 0–10 product ids
  featured: boolean;         // home "Productos destacados"
};
```

Headers: `ID · Orden · Visible · Categoría · Marca · Nombre · Slug · Resumen · Descripción · Fotos · Especificaciones · Guía de uso · Recetas relacionadas · Productos relacionados · Destacado`
(exact spelling; `SCHEMA` in `schema.js`/`Shared.js` is the single source and the sync test guards it).

New field types in `SCHEMA` (and therefore in `rowsToItems`/`itemsToRows`/`validateField`):

| type | cell | JSON | rules |
|---|---|---|---|
| `images` | one ref per line | `string[]` | each passes `isSafeImageRef`; ≤ 6 |
| `ids` | comma-separated | `string[]` | each matches `ID_PATTERN`; ≤ 10; duplicates dropped |
| `enum` | text | `string` | value in `field.values`; empty allowed unless required |
| `money` | number or empty | `number \| null` | `>= 0`, ≤ 2 decimals, ≤ 9,999,999 |
| `map` | `k=v; k=v` | `Record<string,string>` | keys `ID_PATTERN`, values in `field.values` |

`specs` keeps type `lines` **as an array** (unlike the legacy `machines.specs`, which
stays plain text — `isArrayField` special-cases only `machines.specs`; do this by
section+key, not by key alone). `Destacado` is a checkbox like `Visible`.

Validation extras: `slug` unique and pattern; `categoryId` must exist (ctx from the
Sheet, like machines today); `relatedProducts`/`relatedRecipes` only pattern-checked
(dangling ids are ignored by the renderer, so the owner can link before publishing).

### 16.4 `variants` (tab `Variantes`)

```ts
type Variant = Base & {
  productId: string;                       // must exist in products
  name: string;                            // "1 kg", "Vainilla 750 ml", "2 grupos" — required
  sku: string;                             // optional, ≤ 40
  price: number | null;                    // MXN; null = "Precio a cotizar"
  unit: string;                            // "kg", "pieza", "bolsa 1 kg", "botella 750 ml" — shown as "/ unit"; may be empty
  availability: Record<string, Availability>;   // branchId -> state
  image: string;                           // optional 1:1; shown first in the gallery when selected
};
type Availability = "disponible" | "pocas" | "pedido" | "agotado";
```

Headers: `ID · Orden · Visible · Producto · Nombre · SKU · Precio · Unidad · Disponibilidad · Imagen`.
`Disponibilidad` cell: `ags=disponible; durango=pedido` (unknown branch ids are kept
and ignored by the renderer; unknown states are dropped). `Precio` column gets number
format `#,##0.00` from `setup()`. Validation: `productId` exists; `name` required;
`price` per `money`; `availability` per `map` with `values = AVAILABILITY_STATES`.

### 16.5 Derived helpers (pure, in **both** `Shared.js` and `js/schema.js`, byte-identical, sync-tested)

```
legacyToCatalog(content)          -> { categories, products, variants } from machineryCategories/insumos/machines (§16.7)
priceSummary(variants)            -> { kind: "none" | "single" | "from", min: number|null }
formatMoney(n)                    -> "$1,250" | "$1,250.50"  (es-MX grouping, decimals only when needed; no Intl in Apps Script, so hand-rolled)
slugify(name)                     -> "saju-taro-1-kg"  (lowercase, accents stripped, non [a-z0-9] -> "-", trimmed, ≤ 60)
AVAILABILITY_STATES               = ["disponible","pocas","pedido","agotado"]
AVAILABILITY_LABELS               = { disponible:"Disponible", pocas:"Pocas piezas", pedido:"Bajo pedido", agotado:"Agotado" }
```

Plus `rootLink(path, loc, root)` (§12.4) — pure, in both files, sync-tested, because the admin needs it without `render.js`.

`resolveQuoteLines` lives only in `Shared.js` (server) — the client has its own
rehydration that includes photos.

### 16.6 New `site` keys (tab `Ajustes`, appended to `siteKeys`)

| Key | Group | Seed |
|---|---|---|
| `navGroupMachinery` | Menú y portada | `Maquinaria` |
| `navGroupSupplies` | Menú y portada | `Insumos` |
| `navCtaShort` | Menú y portada | `Cotiza` (CTA label between 820 and 1000 px, §21.7) |
| `catalogIndexTitle` | Catálogo | `Catálogo` |
| `catalogIndexIntro` | Catálogo | `Equipo y consumibles para tu barra. Elige una línea o busca un producto.` |
| `groupMachineryIntro` | Catálogo | `Cafeteras, molinos y licuadoras con asesoría para elegir según tu volumen.` |
| `groupSuppliesIntro` | Catálogo | `Café, bases, jarabes, salsas y tisanas para que tu carta salga igual en cada turno.` |
| `featuredTitle` | Catálogo | `Lo que más piden las barras.` |
| `featuredIntro` | Catálogo | `Una selección de equipo e insumos para empezar.` |
| `variantLabel` | Catálogo | `Presentación` |
| `priceNote` | Catálogo | `Precios en MXN. Confirma IVA y vigencia al cotizar.` |
| `priceToQuoteNote` | Catálogo | `Te lo cotizamos por WhatsApp o desde tu lista.` |
| `availabilityNote` | Catálogo | `Existencias actualizadas por sucursal. Confirma al cotizar.` |
| `catalogEmptyCategory` | Catálogo | `Estamos cargando los productos de esta línea. Cotiza por WhatsApp y te enviamos opciones.` |
| `quoteListTitle` | Cotiza | `Mi cotización` |
| `quoteListIntro` | Cotiza | `Agrega lo que necesites y envíanos la lista. Te respondemos con precios y disponibilidad.` |
| `quoteListSuccess` | Cotiza | `¡Listo! Recibimos tu lista. Te respondemos en horario de atención.` |

`OPTIONAL_SITE_KEYS` adds `catalogIndexIntro`, `groupMachineryIntro`, `groupSuppliesIntro`,
`featuredIntro`, `availabilityNote`, `quoteListIntro` (empty hides the element).

### 16.7 Migration from round 1 (`setup()` on the already-populated Sheet)

`setup()` stays idempotent and additive. **The ordering below is load-bearing:** today's
loop (`Code.gs:513`) calls `seedTab_` for every section whose tab has no data, so if
the three new tabs went through that loop first they would be filled with the
`DEFAULT_CONTENT` examples, `migrateCatalog_`'s "no data rows" precondition would be
false, and the owner's live machines would silently never reach the new catalog.
Therefore:

```js
var CATALOG_SECTIONS = ["categories", "products", "variants"];   // Code.gs
Shared.SECTION_NAMES.forEach(function (name) {
  var def = Shared.SCHEMA.sections[name];
  var sheet = ensureSheet_(ss, def.tab, sectionHeaders_(def), report);
  if (CATALOG_SECTIONS.indexOf(name) === -1) seedTab_(sheet, name, def, report); // catalog tabs are NOT seeded here
  formatTab_(sheet, def);
});
migrateCatalog_(ss, report);        // runs after the loop: migrate first, then append missing examples
```

New behaviour, in order:

1. `ensureSheet_` creates `Categorias`, `Productos`, `Variantes` with headers, frozen
   row, checkbox validation on `Visible`/`Destacado`, list validation on `Grupo`
   (`maquinaria,insumos`), `@` format on id/ref columns, `#,##0.00` on `Precio`.
   Appends the `Productos` header to `Cotizaciones` if missing. Existing tabs: only
   missing headers are appended (round-1 rule), nothing else is touched.
   **`seedTab_` is skipped for the three catalog tabs** (see above); on a brand-new,
   empty Sheet the legacy tabs are seeded by the loop as today and step 2 then
   migrates that seed, so a fresh Sheet ends up with the same catalog as the
   `default-content.json` seed plus nothing else.
2. **If `Categorias` has no data rows** → `migrateCatalog_()`:
   - reads live `CategoriasMaquinaria`, `Insumos`, `Maquinas` (the owner may have edited them);
   - `Shared.legacyToCatalog({ machineryCategories, insumos, machines })` →
     categories: every machinery category with `group:"maquinaria"` (id, order, visible,
     name, tagline, description, image kept), then every insumo with `group:"insumos"`
     (order offset +1000 so insumos follow machinery; renumbered 10, 20… on the next admin save);
     products: one per machine (`id`, `order`, `visible`, `categoryId`, `name`,
     `description`, `photos:[image]` when set, `specs` = the machine's spec lines,
     `brand:""`, `slug:""`, `summary:""`, `usage:""`, `featured:false`), each with one
     variant `{ id: <machineId>-std, name: "Modelo estándar", price: null, availability: {} }`;
   - writes them to the three tabs;
   - then appends every `DEFAULT_CONTENT.products`/`variants` example whose
     `categoryId` exists and whose id is not already present (so the seed examples
     show up for the insumo categories, which had no products), and every
     `DEFAULT_CONTENT.categories` row whose id is missing (none, with the round-1 seed);
   - report lines: `Catálogo migrado: 7 categorías, 3 productos, 3 variantes` and
     `Ejemplos agregados: 7 productos`.
   - Migrated products are **not** renamed `(ejemplo)` — they are the owner's real
     machines (names and specs copied verbatim from `Maquinas`); only their one
     generated variant is a placeholder (`Modelo estándar`, price `null`). The admin
     shows them exactly like any product.
3. If `Categorias` already has rows → the migration step is skipped; the "append missing
   example ids" step **also** skips (the owner may have deleted an example on purpose,
   and `setup()` must not resurrect it). Re-running `setup()` therefore changes nothing.
4. New `site` keys missing from `Ajustes` are appended with their seed value
   (`seedMissingSettings_`), without touching existing rows. The `_updatedAt` row is
   bumped so caches refresh.
5. `clearCache` drops both the old key and the new chunked keys.

Editor function `migrateCatalog()` is also exposed on its own (`Ejecutar → migrateCatalog`)
for the case where the owner emptied `Categorias` on purpose. `README-deploy.md`
gets a section `Actualizar a la versión con catálogo` (paste the 4 files → new
version of the same deployment → `Ejecutar setup` → check the three tabs → the
legacy tabs may be left as they are or deleted later; the site no longer reads them
once `Categorias` has rows).

### 16.8 `getContent` size budget and cache

- Field maxima (above) bound a product at ≈ 6 KB worst case, ≈ 1.2 KB typical; a
  variant ≈ 0.3 KB. Targets: **≤ 150 products / ≤ 400 variants** ≈ 250 KB raw JSON,
  ≈ 45 KB gzipped on the wire (Apps Script responses are gzip-encoded by Google).
  **Row caps become per-section**: `SCHEMA.sections[name].maxRows` — `variants: 500`,
  every other section keeps the current `MAX_ROWS` default of 300 (`validateSection`
  reads `def.maxRows || MAX_ROWS`; the message says the section's own number). A unit
  test builds a synthetic 150-product / 500-variant document and asserts it validates,
  serialises under 400 KB raw, and round-trips through the chunked cache helpers.
  The README states the same numbers the code enforces:
  `Hasta 300 productos y 500 presentaciones; con más de 150 productos la página tarda
  un poco más en cargar en celulares, avísanos antes de llegar ahí.`
- The budget counts the whole public document: on an **un-migrated** Sheet the
  response carries the legacy arrays instead of the catalog (never both, §16.1), so
  the worst case is `max(legacy, catalog)` + the round-1 sections, not their sum.
- `CacheService` limit is 100 KB per value: `putCache_` now stores
  `Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(json)))` split into 90 KB
  chunks under `content:v2:<i>` plus `content:v2:index` = `{ n, bytes, savedAt }`;
  `loadContent_` reads `getAll`, re-joins, un-gzips; any missing chunk → rebuild from
  the Sheet. TTL unchanged (300 s). The old `content:v1` key is removed by `clearCache()`.
- A unit test asserts the seed serialises under 64 KB and that the synthetic
  150-product / 500-variant document above round-trips through the chunk helpers
  (`Shared.chunkString`/`joinChunks`, pure) in ≤ 5 chunks of ≤ 90 KB.
- Public first paint is unaffected: the home page still paints from the inline HTML →
  `default-content.json` → cache before the API answers.

### 16.9 Sheet mapping additions

| Tab | Headers (in order) | JSON |
|---|---|---|
| `Categorias` | ID · Orden · Visible · Grupo · Nombre · Subtítulo · Descripción · Imagen | `categories` |
| `Productos` | ID · Orden · Visible · Categoría · Marca · Nombre · Slug · Resumen · Descripción · Fotos · Especificaciones · Guía de uso · Recetas relacionadas · Productos relacionados · Destacado | `products` |
| `Variantes` | ID · Orden · Visible · Producto · Nombre · SKU · Precio · Unidad · Disponibilidad · Imagen | `variants` |
| `Cotizaciones` | round 1 headers + `Productos` | log |

### 16.10 Image specification additions (`SCHEMA.images`)

| Field | Box | Aspect | Format | Max | Admin help |
|---|---|---|---|---|---|
| `categories.image` | 1200 × 800 | 3:2 | JPG/WebP | 400 KB | `Foto representativa de la línea, 1200 × 800 px, JPG o WebP, máx. 400 KB. Se ve en el menú y en las tarjetas.` |
| `products.photos` | 1200 × 1200 | 1:1 | JPG/WebP/PNG | 400 KB each | `Fotos cuadradas del producto sobre fondo claro, 1200 × 1200 px, JPG, WebP o PNG, máx. 400 KB cada una. La primera es la principal; hasta 6.` |
| `variants.image` | 1200 × 1200 | 1:1 | JPG/WebP/PNG | 400 KB | `Opcional: foto de esta presentación o sabor, 1200 × 1200 px. Si la dejas vacía se usan las fotos del producto.` |

`keepAlpha: true` for the two product boxes (PNG cut-outs are common for machines).
`uploadImage` accepts `field: "photos"` with `section: "products"`; the file name gains
the photo index (`products-<id>-<n>-<stamp>.webp`). New placeholder
`assets/placeholders/product-1x1.svg` (label `1200 × 1200 px · JPG, WebP o PNG`).
`machineryCategories.image`, `machines.image`, `insumos.image` specs stay for the legacy sections.

### 16.11 Seed (`data/default-content.json` ≡ `DefaultContent.js`)

Legacy arrays unchanged. New arrays (every product is an example: name ends in
`(ejemplo)`, prices `null`, photos empty unless noted, availability empty):

```json
"categories": [
  {"id":"cafeteras","order":10,"visible":true,"group":"maquinaria","name":"Cafeteras espresso","tagline":"Semi y automáticas","description":"Equipos semiautomáticos y automáticos para barra, con asesoría según tu volumen.","image":""},
  {"id":"molinos","order":20,"visible":true,"group":"maquinaria","name":"Molinos","tagline":"Molienda constante","description":"Molinos para espresso y filtrado, de uso continuo.","image":""},
  {"id":"licuadoras","order":30,"visible":true,"group":"maquinaria","name":"Licuadoras","tagline":"Para frappés y smoothies","description":"Licuadoras de alto rendimiento para bebidas frías.","image":""},
  {"id":"cafe","order":40,"visible":true,"group":"insumos","name":"Café","tagline":"Finca en Coatepec, Veracruz","description":"Trabajamos con una finca en Coatepec, Veracruz. Sin intermediarios.","image":""},
  {"id":"polvos","order":50,"visible":true,"group":"insumos","name":"Polvos y bases","tagline":"Frappé, chai, taro y matcha","description":"Bases para frappé, chai, taro y matcha. Marcas Saju y Samlet.","image":"assets/ejemplo/frappe-capuchino.jpg"},
  {"id":"jarabes","order":60,"visible":true,"group":"insumos","name":"Jarabes y salsas","tagline":"Proveedor autorizado Yalini","description":"Jarabes y salsas para bebidas frías y calientes. Proveedor autorizado Yalini.","image":""},
  {"id":"tisanas","order":70,"visible":true,"group":"insumos","name":"Tisanas","tagline":"Proveedor autorizado Soy Té","description":"Infusiones de origen para tu carta. Proveedor autorizado Soy Té.","image":""}
],
"products": [
  {"id":"cafetera-ejemplo","order":10,"visible":true,"categoryId":"cafeteras","brand":"","name":"Cafetera espresso de 2 grupos (ejemplo)","slug":"cafetera-espresso-2-grupos-ejemplo","summary":"Producto de ejemplo: edítalo o bórralo desde el panel.","description":"Este es un producto de ejemplo para mostrar cómo se ve una ficha. Sustituye el nombre, la marca, las fotos, las especificaciones y la guía de uso por los datos reales del equipo.","photos":[],"specs":["Grupos: Por definir","Caldera: Por definir","Voltaje: Por definir","Dimensiones: Por definir"],"usage":"Para quién: barras con volumen medio y alto.\n- Dosis sugerida: por definir según el molino y el café.\n- Incluye asesoría de instalación y puesta en marcha.","relatedRecipes":[],"relatedProducts":["molino-ejemplo"],"featured":true},
  {"id":"molino-ejemplo","order":10,"visible":true,"categoryId":"molinos","brand":"","name":"Molino para espresso (ejemplo)","slug":"molino-espresso-ejemplo","summary":"Producto de ejemplo: edítalo o bórralo desde el panel.","description":"Producto de ejemplo. Describe aquí el tipo de molienda, el uso recomendado y qué lo distingue.","photos":[],"specs":["Tipo de muela: Por definir","Capacidad de tolva: Por definir","Voltaje: Por definir"],"usage":"Para quién: cafeterías que preparan espresso todo el día.\n- Calibra la molienda cada vez que cambies de café.","relatedRecipes":[],"relatedProducts":["cafetera-ejemplo"],"featured":false},
  {"id":"licuadora-ejemplo","order":10,"visible":true,"categoryId":"licuadoras","brand":"","name":"Licuadora para frappés (ejemplo)","slug":"licuadora-frappes-ejemplo","summary":"Producto de ejemplo: edítalo o bórralo desde el panel.","description":"Producto de ejemplo. Describe la potencia, el vaso y los programas.","photos":[],"specs":["Potencia: Por definir","Vaso: Por definir","Programas: Por definir"],"usage":"Para quién: barras con carta de bebidas frías.\n- Usa hielo en cubo pequeño para proteger las aspas.","relatedRecipes":["frappe-taro"],"relatedProducts":["saju-taro-ejemplo"],"featured":false},
  {"id":"cafe-coatepec-ejemplo","order":10,"visible":true,"categoryId":"cafe","brand":"Por definir","name":"Café de Coatepec (ejemplo)","slug":"cafe-coatepec-ejemplo","summary":"Producto de ejemplo: edítalo o bórralo desde el panel.","description":"Producto de ejemplo. Describe el origen, el tueste y las notas.","photos":[],"specs":["Origen: Coatepec, Veracruz","Tueste: Por definir","Presentaciones: Por definir"],"usage":"Para quién: espresso y métodos de filtrado.\n- Dosis sugerida: por definir según tu receta.","relatedRecipes":[],"relatedProducts":["molino-ejemplo"],"featured":true},
  {"id":"saju-taro-ejemplo","order":10,"visible":true,"categoryId":"polvos","brand":"Saju","name":"Base para frappé sabor taro (ejemplo)","slug":"saju-taro-ejemplo","summary":"Producto de ejemplo: edítalo o bórralo desde el panel.","description":"Producto de ejemplo. Describe el sabor, el rendimiento por bolsa y con qué se combina.","photos":["assets/ejemplo/frappe-taro.jpg"],"specs":["Marca: Saju","Presentación: Por definir","Rendimiento: Por definir"],"usage":"Sugerencia de uso: por definir (gramos por bebida, leche o agua, hielo).\n- Combina con un jarabe de la línea Yalini (sabor por definir).","relatedRecipes":["frappe-taro"],"relatedProducts":["samlet-moca-ejemplo","licuadora-ejemplo"],"featured":true},
  {"id":"samlet-moca-ejemplo","order":20,"visible":true,"categoryId":"polvos","brand":"Samlet","name":"Base para frappé sabor moca (ejemplo)","slug":"samlet-moca-ejemplo","summary":"Producto de ejemplo: edítalo o bórralo desde el panel.","description":"Producto de ejemplo. Describe el sabor y el rendimiento por bolsa.","photos":[],"specs":["Marca: Samlet","Presentación: Por definir","Rendimiento: Por definir"],"usage":"Sugerencia de uso: por definir.","relatedRecipes":["frappe-capuchino"],"relatedProducts":["saju-taro-ejemplo"],"featured":false},
  {"id":"yalini-jarabe-ejemplo","order":10,"visible":true,"categoryId":"jarabes","brand":"Yalini","name":"Jarabe para bebidas (ejemplo)","slug":"yalini-jarabe-ejemplo","summary":"Producto de ejemplo: edítalo o bórralo desde el panel.","description":"Producto de ejemplo. Cada sabor va como una presentación distinta.","photos":[],"specs":["Marca: Yalini","Presentación: Por definir","Sabores: Por definir"],"usage":"Sugerencia de uso: por definir (ml por bebida).","relatedRecipes":[],"relatedProducts":["saju-taro-ejemplo"],"featured":true},
  {"id":"soyte-tisana-ejemplo","order":10,"visible":true,"categoryId":"tisanas","brand":"Soy Té","name":"Tisana de origen (ejemplo)","slug":"soyte-tisana-ejemplo","summary":"Producto de ejemplo: edítalo o bórralo desde el panel.","description":"Producto de ejemplo. Describe la mezcla y el tiempo de infusión.","photos":[],"specs":["Marca: Soy Té","Presentación: Por definir","Infusión: Por definir"],"usage":"Sugerencia de uso: por definir (gramos, temperatura y tiempo).","relatedRecipes":[],"relatedProducts":[],"featured":false}
],
"variants": [
  {"id":"cafetera-ejemplo-2g","order":10,"visible":true,"productId":"cafetera-ejemplo","name":"2 grupos","sku":"","price":null,"unit":"pieza","availability":{},"image":""},
  {"id":"molino-ejemplo-std","order":10,"visible":true,"productId":"molino-ejemplo","name":"Modelo estándar","sku":"","price":null,"unit":"pieza","availability":{},"image":""},
  {"id":"licuadora-ejemplo-std","order":10,"visible":true,"productId":"licuadora-ejemplo","name":"Modelo estándar","sku":"","price":null,"unit":"pieza","availability":{},"image":""},
  {"id":"cafe-coatepec-p1","order":10,"visible":true,"productId":"cafe-coatepec-ejemplo","name":"Presentación 1 (ejemplo)","sku":"","price":null,"unit":"","availability":{},"image":""},
  {"id":"cafe-coatepec-p2","order":20,"visible":true,"productId":"cafe-coatepec-ejemplo","name":"Presentación 2 (ejemplo)","sku":"","price":null,"unit":"","availability":{},"image":""},
  {"id":"saju-taro-p1","order":10,"visible":true,"productId":"saju-taro-ejemplo","name":"Presentación 1 (ejemplo)","sku":"","price":null,"unit":"","availability":{},"image":""},
  {"id":"samlet-moca-p1","order":10,"visible":true,"productId":"samlet-moca-ejemplo","name":"Presentación 1 (ejemplo)","sku":"","price":null,"unit":"","availability":{},"image":""},
  {"id":"yalini-sabor-1","order":10,"visible":true,"productId":"yalini-jarabe-ejemplo","name":"Sabor 1 (ejemplo)","sku":"","price":null,"unit":"","availability":{},"image":""},
  {"id":"yalini-sabor-2","order":20,"visible":true,"productId":"yalini-jarabe-ejemplo","name":"Sabor 2 (ejemplo)","sku":"","price":null,"unit":"","availability":{},"image":""},
  {"id":"soyte-tisana-p1","order":10,"visible":true,"productId":"soyte-tisana-ejemplo","name":"Presentación 1 (ejemplo)","sku":"","price":null,"unit":"","availability":{},"image":""}
]
```

Notes: `frappe-taro.jpg` is portrait and crops to the square box — acceptable for an
example. `frappe-capuchino.jpg` reads "Saju", which is now the correct brand, so it is
reused as the `polvos` category image (it was already on that insumo card).
The seed must pass `validateSection` for every section (sync test).

**No invented specs rule, enforced.** Sizes, flavours and units in the seed are not
client-confirmed, so no seed spec, variant name or unit states one: every spec line
whose label is not in the carried-over allowlist reads `Por definir`, every insumo
variant is named `Presentación N (ejemplo)` / `Sabor N (ejemplo)` with an empty
`unit`, and the two machinery placeholders are `2 grupos` (the round-1 machine's own
name) and `Modelo estándar`. The sync test asserts, over every seed product:

- each `specs` line matches `^([^:]+): (.+)$`; the value must be exactly `Por definir`
  **unless** the label is in `SEED_FACT_LABELS = ["Marca", "Origen"]` (brand and origin
  are facts carried over from round 1: Saju, Samlet, Yalini, Soy Té, Coatepec);
- each variant `name` ends with `(ejemplo)` or is one of `["2 grupos", "Modelo estándar"]`,
  `price` is `null`, `sku` is `""`, `unit` is `""` or `"pieza"`, `availability` is `{}`;
- every product `name` ends with `(ejemplo)`; `usage` and `description` contain no
  digit followed by `g`, `kg`, `ml`, `l`, `V`, `W` or `%` (`/\d\s?(g|kg|ml|l|v|w|%)\b/i`),
  the cheap tripwire for a smuggled measurement.

The admin copy tells the client what to replace: variant placeholder `1 kg, Vainilla 750 ml, 2 grupos`
in §17.2 is a **placeholder attribute** (never saved), which is the right place for examples.

---

## 17. Admin — `Catálogo`

### 17.1 Sidebar

`Textos · Correos de cotización · Portada · Anuncios · Promos · **Catálogo** · Recetas · Sucursales · Redes · Alianzas`.
`Maquinaria` and `Insumos` entries are removed. Help box for Catálogo:

> `Primero las líneas (categorías), luego los productos de cada línea y, dentro de cada producto, sus presentaciones (sabor, tamaño o modelo) con precio y existencias por sucursal. Los productos que dicen "(ejemplo)" son de muestra: edítalos o bórralos. Deja el precio vacío para mostrar "Precio a cotizar".` + the three image spec lines.

The legacy tabs are mentioned once: `Las pestañas antiguas Maquinaria e Insumos de la hoja ya no se usan; el catálogo se edita aquí.`

### 17.2 Three levels (`kind: "catalog"`, state `catalogCat`, `catalogProduct`)

1. **Líneas** — card list of `categories` (round-1 list UI: ▲▼, Visible, Editar,
   Eliminar, `+ Agregar línea`). Card shows group badge (`Maquinaria`/`Insumos`), name,
   tagline, `N productos`, thumbnail. `Abrir productos →`. Edit form: `Grupo` (select),
   `Nombre`*, `Subtítulo`, `Descripción`, `Imagen`. Delete with products:
   `Esta línea tiene N productos. ¿Eliminar la línea, sus productos y presentaciones?`
   A filter row at the top: `Todas · Maquinaria · Insumos`.
2. **Productos de <línea>** — `← Líneas`, card list of that category's products
   (thumbnail = first photo, brand · name, `N presentaciones`, price summary, `Destacado`
   star, `Ejemplo` tag). `+ Agregar producto`, `Duplicar` (copies product **and** its
   variants with new ids and ` (copia)`), `Mover a otra línea` (select).
   Products whose `categoryId` matches no category show under `Sin línea` (like `Sin categoría` today).
3. **Editor de producto** — one scrolling form with sticky save bar, grouped:
   - *Datos*: `Nombre`*, `Marca`, `Slug` (auto from the name while untouched; help
     `Es la parte final del enlace del producto. Solo minúsculas, números y guiones.`),
     `Resumen` (max 160, counter), `Descripción` (textarea), `Destacado en la portada` (toggle).
   - *Fotos*: multi-image field: up to 6 thumbnails with `▲▼` (first = main), `Quitar`,
     `+ Agregar foto` (round-1 pipeline per photo, spec `products.photos`); demo mode
     stores `data:` URLs.
   - *Especificaciones*: rows `Etiqueta | Valor` (two inputs), `▲▼`, `Quitar`,
     `+ Agregar especificación`; stored as `Etiqueta: Valor` lines. Help:
     `Ejemplo: Voltaje → 220 V. Escribe "Por definir" si aún no lo sabes.`
   - *Guía de uso / sugerencia*: textarea; help
     `Para quién es, dosis o gramos por bebida, con qué se combina. Una idea por línea; empieza con "- " para viñetas.`
   - *Presentaciones*: nested list — each row: `Nombre`* (placeholder `1 kg, Vainilla 750 ml, 2 grupos`),
     `SKU`, `Precio` (`<input inputmode="decimal">`, prefix `$`, help
     `Déjalo vacío para mostrar "Precio a cotizar".`), `Unidad` (placeholder `kg, pieza, botella`),
     per visible branch a `<select>` `Aguascalientes: — / Disponible / Pocas piezas / Bajo pedido / Agotado`,
     `Foto (opcional)`, row actions `▲ ▼ Duplicar Quitar`. `+ Agregar presentación`.
     At least one presentation is **recommended, not required** (a product with none
     shows `Precio a cotizar`); the save bar warns `Este producto no tiene presentaciones: se mostrará "Precio a cotizar".`
   - *Relacionados*: `Recetas relacionadas` (checkbox list of recipes by title) and
     `Productos relacionados` (search-as-you-type over products, chips).
   - `Visible` toggle in the header, `Ver en el sitio ↗` →
     `BaristopSchema.rootLink("catalogo?p=<slug>&nocache=1", siteLocation, siteRoot)` where
     `siteRoot = new URL("../", document.baseURI).href` and `siteLocation` is a
     `{ pathname }` derived from the admin's own URL with `/admin/…` stripped (so the
     admin opened as `/baristop-v2/admin` links to `/baristop-v2/catalogo?p=…`, and
     opened as `/baristop-v2/admin/index.html` links to `/baristop-v2/catalogo/index.html?p=…`).
     The admin does **not** load `render.js`; `rootLink` comes from `../js/schema.js` (§12.4).

### 17.3 `Lista de precios` (bulk edit)

A tab inside Catálogo (`Líneas · Lista de precios`): one table per line, rows = every
variant (`Producto · Presentación · SKU · Precio · Unidad · AGS · DGO`) with inline
inputs/selects, keyboard-navigable (`Tab`/`Enter` move down a column). Edits mark
`variants` dirty; one `Guardar cambios` writes the whole section. Cheap because it
reuses the field renderers and the section save. No CSV import this round.

### 17.4 Saving and validation

- Dirty tracking per content key (`categories`, `products`, `variants`). `saveLive`
  posts one `saveSection` per dirty key, **in an order that depends on what changed**,
  because the server rejects a `products` section whose `categoryId` is missing from
  the Sheet and a `variants` section whose `productId` is missing (§16.3–16.4):
  - **Adds / edits / reorders only** (no removed category or product): post
    `categories → products → variants`. A new product can then reference a category
    saved a moment earlier. This is the round-1 machinery "add before remove" order.
  - **Any removal** (deleting a line with products — §17.2 step 1 — or a product with
    presentations, or moving a product so its old variants are orphaned): post
    `variants → products → categories`, i.e. children first, so the parent is still
    in the Sheet while its children are being deleted and the existence check never
    fires mid-save.
  - **Both in one save** (e.g. a line deleted and another added): split into two
    passes — the children-first pass sends the *current* lists minus the removed
    rows while **keeping the removed parents** (categories without the deleted line
    are not posted yet), then the parent-first pass posts the final lists. Simpler
    rule for the implementer: `if (anyRemoved) { variants, products, categories } then if (anyAdded) { categories, products, variants }`,
    posting only keys whose content changed since the previous call.
  - **A failed step aborts the rest.** The save bar shows the round-1 error with the
    section name (`No se guardó Productos: <mensaje del servidor>. Las líneas sí se guardaron.`),
    the remaining keys stay dirty, and `Guardar cambios` retries from the failed key —
    never from the start, so an already-saved section is not re-posted. Because
    children go first on removals, a failure leaves the Sheet with at worst an orphan
    parent (harmless: the renderer ignores a category with no products), never an
    orphan child.
- Client validation mirrors `Shared.validateSection` for the new types (`money`,
  `enum`, `map`, `ids`, `images`, slug uniqueness, `categoryId`/`productId` existence).
  Messages: `Escribe un precio válido, por ejemplo 1250 o 1250.50.`,
  `El slug ya lo usa otro producto.`, `Elige una línea.`, `Máximo 6 fotos.`
- Reorder rewrites `order` 10, 20… on save (round 1).
- Demo mode: everything works against `localStorage`.

### 17.5 Spanish admin strings (new)

`Catálogo`, `Líneas`, `+ Agregar línea`, `Abrir productos →`, `← Líneas`, `Productos de <línea>`,
`+ Agregar producto`, `Duplicar`, `Mover a otra línea`, `Sin línea`, `Presentaciones`,
`+ Agregar presentación`, `Lista de precios`, `Destacado en la portada`, `Guía de uso / sugerencia`,
`Especificaciones`, `+ Agregar especificación`, `Etiqueta`, `Valor`, `Fotos`, `+ Agregar foto`,
`Primera = principal`, `Recetas relacionadas`, `Productos relacionados`, `Buscar producto…`,
`¿Eliminar "<nombre>" y sus N presentaciones? Esta acción no se puede deshacer.`,
`Guardado · hh:mm · Ya está en el sitio (puede tardar hasta 5 min en verse).`

---

## 18. States, accessibility, performance

### 18.1 Empty / loading / error states (site)

| Where | State | Copy / behaviour |
|---|---|---|
| Any shell view, first paint without cache | loading | Skeleton cards (6, shimmering `--cream-card` blocks, `aria-busy="true"` on the grid, `aria-hidden` skeletons) until the first content layer; never longer than the default JSON fetch. With cache: no skeleton. |
| Category with 0 visible products | empty | Illustration-free band: `site.catalogEmptyCategory` + the two WhatsApp buttons + `Ver otras líneas`. |
| Filters match nothing | empty | `Ningún producto coincide con esos filtros.` + `Quitar filtros`. |
| Search < 2 chars | hint | `Escribe al menos 2 letras.` |
| Search 0 results | empty | `No encontramos "<q>". Prueba con otra palabra o escríbenos y te lo conseguimos.` + WhatsApp buttons. |
| Unknown `c` / `p` / `g` | not found | H1 `No encontramos esa página del catálogo.` text `Puede que el producto ya no esté publicado.` + `Ir al catálogo` (`btn-wine`) + `Ir al inicio`. `<title>` `No encontrado · Baristop`. |
| Product with 0 variants | — | Tag shows `Precio a cotizar`; availability `Consulta disponibilidad`; add button active. |
| `?p=<ok>&v=<hidden or unknown variant>` | fallback | The product renders with its **first visible variant** selected and `v` is dropped from the URL with `replaceState` (no history entry, no error). A polite live-region line: `Esa presentación ya no está disponible; te mostramos otra.` — only when `v` was present and did not resolve. |
| `?c=<category>` whose group is hidden / unknown | not found | A category only exists inside a group; `group` outside the vocabulary or the category itself `visible:false` → the §18.1 not-found state (same as unknown `c`). Mega-menu and drawer never list it, so this only happens on a stale shared link. |
| `?g=<group>` with zero visible categories | empty | H1 group name + `site.catalogEmptyCategory` + WhatsApp band + `Ver todo el catálogo` (the group is still a valid route; the nav simply does not render its button). |
| Variant price empty | — | `Precio a cotizar` + `site.priceToQuoteNote`. |
| Photo missing / fails | — | 1:1 placeholder (round-1 `onImgError` chain). |
| Quote list empty | empty | Drawer body: `Tu cotización está vacía.` `Agrega productos desde el catálogo y envíanos la lista en un solo paso.` + `Ver catálogo`. The form is hidden while empty. |
| Line no longer visible | stale | `Ya no está disponible` + `Quitar`; excluded from the payload. |
| Storage blocked | degraded | List kept in memory; a one-line note in the drawer: `Tu navegador no guarda la lista entre visitas.` |
| API down / slow | silent | Round 1: cached/default content stays; no visitor-facing error. Submitting the list: round-1 error copy. |
| Content without `categories` | fallback | `legacyToCatalog` builds the catalog; the nav still works. |

### 18.2 Accessibility (WCAG 2.2 AA)

- Disclosure menus: `button[aria-expanded][aria-controls]`, `Escape`, outside click,
  arrow navigation inside the panel; no hover-only content.
- Drawer, lightbox and filter sheet: `role="dialog" aria-modal`, focus trap, focus
  restore, `Escape`.
- Variant chips: `role="radiogroup"` + `role="radio" aria-checked`, roving tabindex,
  arrow keys (reuse round-1 handler).
- Stepper: labelled buttons + numeric input; `aria-live="polite"` region for
  `agregado a tu cotización`, `Lista vacía`, result counts (`12 productos`).
- Breadcrumb `nav[aria-label="Ruta"]` + `aria-current="page"`. One `h1` per view;
  focus moves to it after in-shell navigation.
- Specs as a real table with row headers. Availability text never colour-only.
- Contrast: all new colours checked ≥ 4.5:1 on their backgrounds (`#2E7D4F` on
  `--paper` 4.9:1; `#8A6320` on `--cream-card` 4.6:1; `--muted` on `--cream` 4.6:1).
- Target size ≥ 24 × 24 CSS px everywhere, ≥ 44 px for primary controls; the sticky
  buy bar does not cover focused inputs (`scroll-padding-bottom`).
- Reduced motion: no slide/shimmer animations; drawer appears instantly.
- Every image from the Sheet has `alt` = product name (gallery: `<name> — foto 2 de 4`);
  decorative placeholders `alt=""`.

### 18.3 Performance on phones

- The shell loads the same five scripts as the home page plus `catalog.js` and
  `quote-list.js` (vanilla, no deps; target ≤ 40 KB total un-minified for the two new files).
- Grid images: Drive URLs get `=w600` (cards) / `=w1200` (gallery); the `onerror`
  fallback strips the suffix first, then the round-1 chain. `loading="lazy"`,
  `decoding="async"`, explicit `width`/`height`.
- Rendering 150 products stays under 50 ms on a mid-range phone: build with a
  `DocumentFragment`, no per-card listeners (one delegated click handler).
- No layout shift: card image boxes have `aspect-ratio: 1`; the skeleton matches card height.
- `content.js` cache logic unchanged; the shell never waits for the API to paint.
- Fonts: same Google Fonts link; the shell uses `font-display: swap` (already in the URL).

---

## 19. Test plan

### 19.1 Unit (`npm test`, backend workstream)

| Test | Asserts |
|---|---|
| `baristopSchemaSync` (extended) | `SCHEMA`/`SECTION_NAMES` identical in both files; `DefaultContent.js` ≡ `default-content.json`; the **eight** shared bodies identical (`isSafeHttpsUrl`, `isEmail`, `normalizeDigits`, `legacyToCatalog`, `priceSummary`, `formatMoney`, `slugify`, `rootLink`); seed passes `validateSection` for all 14 sections (ctx includes `categoryIds`, `productIds`); the **no-invented-specs assertions of §16.11** (product names `(ejemplo)`, spec values `Por definir` except `Marca`/`Origen`, variant names/prices/units/availability placeholders, measurement tripwire); seed JSON < 64 KB; no dotted folders. |
| `baristopShared` (extended) | `rowsToItems`/`itemsToRows` round-trip for `images`, `ids`, `enum`, `money`, `map`; `validateQuote` accepts/rejects `items` (41 lines, qty 0, qty "2", bad ids); `resolveQuoteLines` marks unknown ids `found:false` and keeps them; `buildQuoteEmail` with lines: subject suffix `· 2 productos`, table rows, `Por cotizar`, subtotal only with priced lines, no HTML injection from names; `QUOTE_NEEDS` contains `Lista de productos`; `logRowFromHeaders` with the 9-column, 10-column, reordered and extra-column headers (§15.3 step 5); `priceSummary` → none/single/from; `formatMoney(1250)` = `$1,250`, `formatMoney(1250.5)` = `$1,250.50`; `slugify("Café Coatepec 1 kg")` = `cafe-coatepec-1-kg`; `rootLink` four cases of §12.4; `legacyToCatalog` on the round-1 seed yields 7 categories (3 maquinaria + 4 insumos, insumos after) and one product+variant per machine, names copied verbatim; `validateSection("variants")` accepts 500 rows and rejects 501, `validateSection("products")` rejects 301 (§16.8 per-section caps); chunk helpers round-trip the 150-product / 500-variant synthetic document in ≤ 5 chunks. |

### 19.2 Headless smoke (`tests/smoke/baristop-catalogo.mjs`, site workstream, run by hand with Playwright against port 8898 and 8899)

Clean-URL and trailing-slash hosts: index, `?g=`, `?c=`, `?p=`, `?q=` load with zero
4xx in all **three URL forms of §12.5** (`/catalogo?p=`, `/catalogo/?p=`,
`/catalogo/index.html?p=` — the last on port 8899 only); on 8898,
`/baristop-v2/catalogo/?c=molinos` ends on `/baristop-v2/catalogo?c=molinos` after a
308 and renders the category; desktop `Maquinaria ▾` opens and its first link lands on
a category page; the mega-menu footer `Sucursales` link lands on `#sucursales`; phone
drawer accordion → category; Back from product → category with filters intact;
`?p=x&v=nope` renders the first variant and the URL loses `v`; open `…?p=x#lista`
directly → close the drawer → still on the product page (no navigation away); add to
list → badge `1`, drawer lists the line, reload keeps it; `?q=SOY%20T%C3%89` finds the
Soy Té example; `?demo=1` preserved after 3 clicks; `grep -r '"/baristop-v2' baristop-v2/` empty.

### 19.3 Manual checklist (maps every brief item)

| # | Brief item | Where / how to verify |
|---|---|---|
| B1 | Navigation that leads to products | Desktop: `Maquinaria ▾` / `Insumos ▾` list the Sheet's categories in Sheet order with image, tagline, count; click → category page. Phone: drawer accordions do the same. Hide a category in admin → it leaves both menus. Nothing in the nav scrolls to an empty section. `Sucursales` reachable from the mega-menu footer and the drawer row (§11.1). |
| B7a | Admin cascading delete | Delete a line with 2 products / 3 presentations → save posts `variants → products → categories`, each `saveSection` returns ok, Sheet ends with none of the five rows; simulate a server rejection on `products` → the save bar names the section, `categories` was not posted, retry resumes from `products`. |
| B1s | Search | Type `taro` → results; `t` → hint; `zzz` → empty state with WhatsApp. |
| B2 | Category view | Grid with photo, brand, name, summary, price label (`Desde $…` once two variants have different prices set in admin; `Precio a cotizar` on the seed), availability dots, filters (brand, available now, branch), sort, breadcrumb. Filters show in the URL; share it in a new tab → same view. |
| B3 | Product detail | Gallery with thumbs/swipe, brand, name, summary; variant chips change price, SKU, availability and `v=` in the URL; shelf tag with price + unit + IVA note; availability per branch in the 4 states (set them in admin → text and dot change); specs table; usage guide with bullets; related recipes and products; `Agregar a mi cotización` and the two WhatsApp buttons with the prefilled text. |
| B4 | Lista de cotización | Add 3 lines across products/variants, change qty, remove, reload (persists), send through the drawer form → e-mail to the branch recipients + Silvia with the line-items table and subject `· 3 productos`; `Cotizaciones` row has the `Productos` column; the home form shows `Incluye mi cotización (3 productos)` and sends the same payload. Demo mode: WhatsApp fallback contains the lines. |
| B5 | Routing | Deep links load directly on `localhost:8898/baristop-v2/catalogo?p=…` (no slash) and `:8899/baristop-v2/catalogo/?p=…`; Back/Forward work; unknown id → not-found page; `?demo=1` and `?nocache=1` survive navigation; after copying the folder to another path it still works (M1/M2 from round 1 re-run). |
| B6 | Content model + Sheet | After `setup()` on the **populated** Sheet: tabs `Categorias` (7 rows: the live `CategoriasMaquinaria` rows first, then one per `Insumos` row), `Productos`, `Variantes` exist; **every row of the live `Maquinas` tab appears in `Productos` with its name and specs verbatim and one `Modelo estándar` variant** — open `catalogo?c=<first machinery category>` and the owner's machines are the cards; the seed examples are appended only under the insumo lines (no example sits next to a real machine); legacy tabs untouched; `Cotizaciones` has `Productos` as its last header and an old quote row is not shifted; re-running `setup()` changes nothing (row counts identical, report shows no `Catálogo migrado` line); `curl` `getContent` returns `categories/products/variants` and empty legacy arrays; delete the three tabs' rows → `getContent` returns the legacy arrays again and the site falls back to the legacy catalog (nav still works); run `migrateCatalog` → migrated again. Seed products all read `(ejemplo)` and `Precio a cotizar`. |
| B7 | Admin | Catálogo: add/edit/reorder/hide/delete a line, a product (6 photos, specs rows, usage, featured), nested presentations (add/duplicate/reorder, price, unit, availability per branch); Lista de precios edits 5 prices in one save; `Ver en el sitio ↗` opens the product; validation messages on bad price/slug; demo mode works. |
| B8 | Home page | Tiles and pillars link into the catalog (no dialog anywhere); `Productos destacados` shows the 4 featured examples and disappears when none is featured; chips in `Qué ofrecemos` follow `categories`. |
| Q | Quality bar | Lighthouse mobile on `?p=` ≥ 90 performance / 100 accessibility on the clean-URL server; keyboard-only walk through menu → category → product → add → drawer → send; VoiceOver reads availability as text; 360 px width has no horizontal scroll. |

---

## 20. Workstreams (disjoint owned paths)

Shared contracts: §11 (nav DOM hooks), §12 (URL grammar, `BARISTOP_ROOT`, `rootLink`),
§15.3 (API), §16 (JSON shapes, Sheet headers, field types, seed, image boxes, site keys),
§16.5 (helper names and signatures). Integration order: backend lands `schema.js` +
seed + `Shared.js` first (the other two code against the shapes in this spec meanwhile,
using the seed in §16.11 copied locally if needed) → site wires the shell and nav →
admin tests saves against the deployed script → §19 runs end to end.

### `site` — public pages

Owns: `baristop-v2/index.html`, `baristop-v2/catalogo/**` (new), `baristop-v2/css/**`,
`baristop-v2/js/content.js`, `js/render.js`, `js/site.js`, `js/catalog.js` (new),
`js/quote-list.js` (new), `js/quote-form.js` (new, extracted from `site.js`),
`baristop-v2/assets/**` (adds `placeholders/product-1x1.svg`), and **`tests/smoke/**`**
(the Playwright script `tests/smoke/baristop-catalogo.mjs`; `.mjs`, so the
`tests/**/*.test.ts` glob of `npm test` never picks it up).
Does **not** touch `baristop-v2/js/schema.js` (where `rootLink` lives — site only calls it),
`baristop-v2/data/**`, `baristop-v2/admin/**`, `apps-script/**`, or any `tests/**/*.test.ts`.

Deliverables: §11 nav on both shells; §12 router and path helpers; §13 views and the
shelf tag; §14 home changes (dialog removed); §15.1–15.2, 15.4–15.5 list drawer and
form module; §18 states, a11y, performance; inline default HTML for the seed
categories/featured products (copied from §16.11).

### `admin` — panel

Owns: `baristop-v2/admin/**` only. Reads `../js/schema.js` (including `rootLink`,
§12.4/§17.2), `../config.js`, `../data/default-content.json` at runtime (relative, as today).
Never loads `../js/render.js`.

Deliverables: §17 in full — sidebar change, three-level Catálogo, product editor with
nested presentations, multi-photo field (`products.photos`), specs rows, availability
selects per visible branch, Lista de precios, client validation for the new types,
dependency-ordered saves, demo mode, Spanish help and strings.

### `backend` — Apps Script, schema, seed, tests

Owns: `apps-script/**` (`Code.gs`, `Shared.js`, `DefaultContent.js`, `appsscript.json`,
`README-deploy.md`), `baristop-v2/js/schema.js`, `baristop-v2/data/default-content.json`,
and `tests/**` **except `tests/smoke/**`** (i.e. `tests/*.test.ts` and any new
`tests/**/*.test.ts`: `baristopShared.test.ts`, `baristopSchemaSync.test.ts`, new files).

Deliverables: §16 schema (sections, field types, site keys, image boxes, per-section
`maxRows`), the pure helpers of §16.5 plus `rootLink` (§12.4) in both files, the seed
of §16.11 in both files (byte-identical content, no-invented-specs assertions),
`setup()` migration of §16.7 (catalog tabs skipped by `seedTab_`, `migrateCatalog_`
after the loop), chunked cache of §16.8, legacy arrays emptied in `getContent` once
`categories` has rows (§16.1), `submitQuote` extension of §15.3 (validation,
`resolveQuoteLines`, e-mail lines, header-keyed `logQuote_`),
`uploadImage` for `products.photos`/`variants.image`/`categories.image`, README
upgrade section, §19.1 tests. Keeps every round-1 action and section working
unchanged; redeploys as a new version of the same deployment.

---

## 21. Open questions (placeholders used until answered)

1. **IVA wording.** Are the client's prices with or without IVA? Seed note is neutral
   (`Confirma IVA y vigencia al cotizar.`); the client edits `priceNote` in Textos.
2. **Variant label.** `Presentación` is the seed; the client may prefer `Sabor` for
   insumos and `Modelo` for machines — one global key this round (`site.variantLabel`);
   a per-category label is a one-column addition later if asked.
3. **Real products.** Names, brands, SKUs, prices, specs, usage texts and photos for
   every line — none are invented; every seed row says `(ejemplo)` / `Por definir`.
4. **Minimum order / packaging.** The brief bans "mayoreo" wording; if the client sells
   by case only, `unit` (`caja 6 kg`) carries it. No minimum-quantity field this round.
5. **Search engine indexing** of `catalogo?p=` pages once the site is public: the
   shell sets canonical/title/description per product; a `sitemap.xml` entry per
   product would need a generated file (post-migration option, like video embeds).
6. **Drive thumbnails.** The `=w600` size suffix on `lh3.googleusercontent.com/d/<id>`
   is widely used but undocumented; the fallback chain covers it if Google stops honouring it.
7. **Nav crowding at 820–1000 px**: two disclosure buttons + Recetas + Contacto + search
   + list + CTA. The CTA label collapses to `Cotiza` under 1000 px (`site.navCtaShort`,
   seed `Cotiza`) — confirm the client accepts the short label.
