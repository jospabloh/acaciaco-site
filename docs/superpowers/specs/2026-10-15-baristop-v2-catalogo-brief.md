# Baristop v2 — real product catalog (brief, round 2)

Feedback from José Pablo (2026-10-15) after reviewing the live preview at
`/baristop-v2`:

> "El menú de arriba no hace nada… si lo diseñas bien debería llevarte a ver el tipo
> de producto en sus diferentes tipos, precios, disponibilidades, especificaciones,
> fotos, guía o sugerencia de uso. Lo que haría un humano experto en ventas, UX y UI."

Today the nav links only scroll to thin sections of the one-page site (Catálogo is
seven category tiles; machines open a near-empty dialog). The ask is a real catalog
that sells: browse by type, then see each product with its variants, prices,
availability, specs, photos and usage guidance — and turn interest into a quote.

## Must keep (from round 1 — see `2026-10-15-baristop-v2-brief.md` and
`2026-10-15-baristop-v2-design.md`)

- Everything editable from the no-code admin, with Spanish help and exact image
  size/format/weight per field; placeholders that state their size.
- Google Sheet + Drive + Apps Script backend (already deployed — any schema change
  must be additive: new tabs/columns, `setup()` adds them without touching data;
  existing sections keep working). Re-deploy = new version of the same deployment.
- `baristop-v2/` self-contained, relative paths, `<base>` bootstrap for clean URLs,
  works when copied to another host; demo mode when `config.js` has no API URL.
- Client decisions: white hero, 4-image strip, two branches side by side, Saju (not
  Sahu), no "mayoreo", Silvia always copied on quotes, `[BARISTOP AGS]/[BARISTOP DGO]`.
- Vanilla JS, `createElement`/`textContent` for data, Spanish UI, English code.

## What to design

1. **Navigation that leads to products.** Desktop: Maquinaria ▾ (Cafeteras espresso,
   Molinos, Licuadoras) and Insumos ▾ (Café, Polvos y bases, Jarabes y salsas,
   Tisanas) open a menu/mega-menu straight into each category; plus Recetas,
   Sucursales/Contacto, CTA. Mobile: same tree in the drawer. Categories and their
   order come from the Sheet. A search box is welcome if it stays simple.
2. **Category view**: product grid with photo, brand, name, short benefit, price
   ("Desde $X" when variants differ, "Precio a cotizar" when empty), availability
   badge, quick filters (brand, availability, branch) and sort. Breadcrumbs.
3. **Product detail**: photo gallery, brand, name, summary; **variant selector**
   (flavour / presentation / model — e.g. Saju Taro 1 kg), price per variant with
   unit and IVA note, **availability per branch** (Aguascalientes / Durango:
   Disponible · Pocas piezas · Bajo pedido · Agotado), **specs table**, **guía de
   uso / sugerencia** (dosage, recipe hint, who it is for), related recipes and
   related products, and clear CTAs: "Agregar a mi cotización", WhatsApp to the
   chosen branch with the product+variant pre-filled.
4. **Lista de cotización** (quote list, like a cart without checkout): add several
   products/variants with quantities, review, then send through the existing quote
   form/e-mail flow (branch selector, Silvia always copied); persists in the browser.
5. **Routing** that works on static hosting and survives migration (no server
   rewrites required) and gives shareable URLs per category/product. Choose between
   hash routes and separate pages; justify. Back button must work; deep links must
   load directly; nav "does nothing" must never happen again (test clean-URL hosts:
   `/baristop-v2` without trailing slash).
6. **Content model + Sheet**: categories (with parent group Maquinaria/Insumos),
   products (category, brand, name, slug, summary, description, photos[], specs,
   usage guide, featured, related recipes, visible/order), variants (product, name,
   SKU optional, price, unit, availability per branch, visible/order). Migrate the
   current machineryCategories/machines/insumos data. Seed 1–2 clearly marked example
   products per category with placeholder photos and "Precio por definir"; never
   invent real prices or specs.
7. **Admin**: product editor with nested variants (add/duplicate/reorder), multiple
   photos with size guidance, specs as label/value rows, availability per branch,
   bulk price edit if cheap to do. Keep it learnable for a non-technical owner.
8. **Home page**: keep its structure but make the category tiles/pillars link into
   the new catalog, and add "Productos destacados".

Quality bar: what a senior e-commerce UX/UI designer and an expert B2B salesperson
would ship for a coffee-shop supplier — scannable, trustworthy, fast on a phone,
accessible (WCAG 2.2 AA), every empty/loading/error state designed.
