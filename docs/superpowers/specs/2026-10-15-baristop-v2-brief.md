# Baristop v2 — client brief (input for design)

Source: voice notes + annotated screenshots from Silvia Macías (Baristop owner),
2026-10-14. Screenshots are kept locally in `baristop-v2-cliente/` (git-ignored: they contain private chats; 1.jpg … 19.jpg; green marks
= "change/remove this"). Current site: `baristop/index.html` (stays live, untouched,
until we switch).

## Delivery constraints (from José Pablo, ACACIA)

- **No paid services.** Vercel only for what is free (static hosting; Hobby-tier
  Routing Middleware is acceptable). Content store = Google Sheet, images = Google
  Drive folder, backend = Google Apps Script Web App (runs as the account owner, so
  Drive uploads use the owner's quota; MailApp sends the quote e-mails).
- **Migration-ready.** The client will likely move the site to their own domain.
  `baristop-v2/` must be fully self-contained: own CSS/JS/assets, relative paths, no
  dependency on `/styles/base.css`, `/scripts/shared.js` or `api/`. The only
  host-specific value is the Apps Script URL in `baristop-v2/config.js`. Migration =
  copy the folder + (optionally) "Make a copy" of the Sheet and redeploy the script.
- **Preview first.** New site lives at `/baristop-v2` behind a temporary password
  (only José Pablo / the client see it). The live `/baristop` is not touched. Switch
  later = move files into `baristop/`, remove gate.
- **Admin** at `/baristop-v2/admin`, password-protected (same temporary password as
  the preview for now; changeable later). Non-technical user. Every section must
  explain in Spanish how to fill it and the exact image size/format needed
  (e.g. "1200 × 800 px, JPG o WebP, máx. 1 MB").
- **Everything that is a variable is editable from admin**: phones, WhatsApp links,
  e-mails, addresses, hours, social URLs, recipient e-mails for the quote form,
  catalog items, machine details, recipes, alliances/logos, promos, announcements,
  hero images, texts that are likely to change. Use real data where we have it,
  clear placeholders where we don't.
- **Placeholder images** where we lack real ones: neutral placeholders that state
  the required dimensions, replaceable from admin. Example product images available:
  `baristop-v2/assets/ejemplo/frappe-capuchino.jpg` (1024×1536),
  `frappe-taro.jpg` (1024×1536), `samlet-moca.jpg` (1536×1024).
- Spanish UI strings, English code/comments; vanilla JS (IIFE, `var`), DOM via
  `createElement`/`textContent` for any data from the Sheet; keep the current visual
  language (Fraunces + Inter, wine/gold/cream palette, tokens in current page).

## Client changes, section by section

### Nav (img 1, 2)
- Add **"Recetas"** link (circled slot between "Contacto" and the CTA button).
- CTA button text: **"Cotiza tu equipo e insumos"**.

### Hero (img 11, 12)
- At the very top (under the nav), a row of **4 images: maquinaria, salsas,
  jarabes, polvos** (editable).
- Then the Baristop lockup + "Insumos y maquinaria para cafetería" in **tinto**
  (wine) — client likes that.
- Hero background **white** (was wine). "Todo para tu cafetería" in **tinto**;
  "barra de bebidas" stays as it is (italic, gold accent).
- Subtitle becomes: "Maquinaria profesional y consumibles para cafeterías,
  restaurantes y barras. Contamos con presencia en Aguascalientes y Durango.
  Enviamos a toda la República." — keep **"Un solo proveedor, una sola entrega."**
  as a standout phrase (client loves it).
- Trust row: Aguascalientes · Durango · envíos a toda la República · horarios.

### Qué ofrecemos (img 4, 5, 6)
- Remove the sentence "Lo dice nuestro nombre: insumos y maquinaria." (rest of the
  paragraph may stay, reworded).
- Maquinaria pillar: remove chips **Refrigeración** and **Vitrinas** (and from the
  description).
- Insumos pillar: remove **Tapioca** and **Vasos y desechables**; "Tés y tisanas" →
  **"Tisanas"**.

### Catálogo (img 7, 8)
- Maquinaria: remove **Refrigeración** and **Vitrinas** cards. Remaining:
  **Cafeteras espresso, Molinos, Licuadoras**. Each card shows an **image outside**;
  clicking opens a detail view listing **every machine with its description**
  (client will send images + specs). Admin manages machines per category.
- Insumos: remove **Tapioca y boba**. Remaining and their copy:
  - **Café** — "Trabajamos con una finca en Coatepec, Veracruz. Sin intermediarios."
  - **Polvos y bases** — frappé, chai, taro, matcha (brands Saju, Samlet).
  - **Jarabes y salsas** — "Proveedor autorizado Yalini".
  - **Tisanas** (not "Tés y tisanas") — "Proveedor autorizado Soy Té".
  - Each with an image (editable).

### Cómo trabajamos (img 9) and contact copy (img 13)
- Drop "precio de mayoreo" wording: step 02 "…los consumibles correctos." and CTA
  text "Cuéntanos qué necesitas — equipo, insumos o ambos." Apply consistently
  (strip "Mayoreo" item, values card) — flag in the spec what was changed.
- "Entrega a domicilio en la ciudad" → nationwide shipping wording.

### Cotiza / contacto — "Surtamos tu barra." (img 10, 14, 15)
- Split in **two columns: Aguascalientes | Durango**, big branch titles.
  Per branch: WhatsApp (direct wa.me link, labelled "WhatsApp Aguascalientes" /
  "WhatsApp Durango"), phone, address, e-mail(s), hours, branch photo (client will
  send). Shared in the middle: Instagram and Facebook.
  - Aguascalientes: WhatsApp 449 178 4526 (current), tel. 449 465 9347 (Instagram
    bio), Cordillera de los Alpes 199, esq. Monte Blanco, Jardines de la Concepción
    II Sección, C.P. 20120, Aguascalientes. E-mail ventas.baristop@gmail.com.
    Lun–Vie 9:00 am – 4:00 pm.
  - Durango: tel./WhatsApp 618 181 2019 (Karime), address TBD (placeholder).
    E-mails: Karime and Fernando (TBD, placeholders). Lun–Vie 9:00 am – 5:00 pm,
    Sáb 10:00 am – 2:00 pm.
  - Instagram @baristop_distribuidora; Facebook (current URL).
- **Quote form** (nombre, negocio, qué buscas, mensaje, + contact field so they can
  reply) with a **branch selector: Aguascalientes / Durango** (buttons). Submitting
  **e-mails** the request:
  - Aguascalientes → Silvia + ventas (Carlita, ventas.baristop@gmail.com)
  - Durango → Karime + Fernando + Silvia
  - **Silvia always receives every request.** All recipient addresses editable in
    admin. Keep the WhatsApp shortcut per branch as well.

### New sections
- **Recetas** — recipes as photos and/or videos (client will send) so customers see
  what they can make with the products. Admin: add/edit/remove/reorder recipes.
- **"Baristop en tu ciudad"** — franchise invitation ("Franquicias abiertas. ¿Te
  interesa tener Baristop en tu ciudad? Contáctanos.") with CTA.
- **Alianzas estratégicas** ("con los mejores") near the bottom — logos: Coffee
  Solutions, Soy Té, Yalini, Saju, Samlet (Samlet = Julieta y Samuel's brand).
  Logos editable in admin.
- Admin also manages **Promos** and **Anuncios** (announcement bar / promo cards)
  — requested by José Pablo; show nothing when empty.

### Footer (img 3)
- Reflect both branches (Aguascalientes and Durango) and new links (Recetas,
  Franquicias); same editable data source.

## Confirmed data (2026-10-15, supersedes anything above)

All of these are seed values in default content — editable from admin.

- **Silvia (owner) = roseta.cafeteria@gmail.com.** Receives a copy of every quote,
  both branches.
- **Aguascalientes:** phone + WhatsApp **449 178 4526** (the 449 465 9347 number is
  obsolete — drop it). E-mail **ventas.baristop@gmail.com**. Quote recipients:
  ventas.baristop@gmail.com + roseta.cafeteria@gmail.com.
- **Durango:** phone + WhatsApp **618 181 2019**. E-mail
  **karime.baristop@gmail.com** (confirmed; ignore any "karime.baristo" spelling). Fernando has no e-mail until further notice — do NOT seed a Fernando recipient; Durango quotes go to Karime + Silvia only.
  Quote recipients: Karime + roseta.cafeteria@gmail.com.
- **Karla = Ventas** (Aguascalientes, ventas.baristop@gmail.com). The brief's
  "Carlita" is Karla.
- The recipients list per branch is a free list in admin (add/remove addresses);
  Silvia's address is a separate "always copy" field.
- **Quote e-mail subject carries a branch tag:** `[BARISTOP AGS] …` or
  `[BARISTOP DGO] …` (tag editable per branch in admin).
- **Social networks are shared by both branches for now** (only WhatsApp and e-mail
  differ per branch): Instagram https://www.instagram.com/baristop_distribuidora/ ·
  Facebook https://www.facebook.com/p/Baristop-Distribuidora-100095085646432/
- Addresses: Aguascalientes as above. **Durango: Prolongación Gómez Palacio 448
  Ote., Local 5, Zona Centro, C.P. 34000, Durango, Dgo.**
- Apply strong UI/UX craft (frontend-design / UX-copy / accessibility skills).

## Open data (placeholders until the client sends them)
Branch photos ·
machine list + specs + photos · recipes · partner logos · Coffee Solutions details.
