/* ACACIA · Card grid ranking + interaction.
 *
 * Ranks cards by the signals asked for: free apps, live status, and real
 * visit counts (Mission Control's public /api/apps-visits, backed by the
 * analytics.js pixel every apps/*.html and freeware/*.html page already
 * fires on load). Nothing is ever hidden — every card stays visible, only
 * reordered and resized:
 *   - homepage (#apps .apps-grid): a free-or-live app gets the larger "hero"
 *     card, everything else gets a smaller "compact" one; within each tier,
 *     real visit counts (once they exist) decide the order.
 *   - apps/index.html's status groups (data-apps-group="live"/"demo"/"dev"):
 *     reorder-only, same visits signal, no resizing — that page is a spec
 *     sheet, not a discovery grid, so tiering there would fight its own
 *     layout.
 *   - freeware/index.html's catalog (data-apps-group="freeware"): every tool
 *     is equally free and equally live, so there's no free/status tiebreak
 *     to lean on — the top 5 by real visits get the hero card, the rest
 *     compact. Falls back to the page's own declared order (a stable sort
 *     of an all-zero score changes nothing) until real numbers arrive.
 *   - homepage's #gratis teaser (data-apps-group="gratis"): the one place
 *     this file changes SELECTION, not just order/size — it's a 6-tool
 *     curated teaser out of freeware/index.html's 21, so "rank by visits"
 *     here means swapping which tools appear. The 6 already in the markup
 *     stay untouched until real freeware visit numbers exist (see
 *     rankGratisTeaser's own comment for the fallback/fill rules). Also
 *     reads window.ACACIA_MX_ONLY_SUBSTITUTES (set synchronously by
 *     scripts/home-tools-region.js, which loads first and runs before this
 *     one's async visits fetch resolves) so a real-visits rebuild never
 *     reintroduces a Mexico-only tool to a visitor that script already
 *     determined isn't in Mexico.
 * Runs the same ranking twice: once immediately from each card's own
 * data-free/data-status (a real, sensible order with zero network wait —
 * see each page's own markup, which is already written in that order), then
 * again once /api/apps-visits resolves. A failed or slow fetch (2.5s cap)
 * just means the second pass never happens — the page never blocks or
 * breaks on it, matching every other best-effort beacon on this site.
 */
(function () {
  'use strict';

  var VISITS_URL = 'https://control.acaciaco.com.mx/api/apps-visits';
  var FETCH_TIMEOUT_MS = 2500;

  function prefersReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }
  function hoverCapable() {
    try { return window.matchMedia('(hover: hover)').matches; }
    catch (e) { return true; }
  }

  // Returns the whole parsed { visits, freeware } payload (or null) — each
  // caller picks the slice it needs, so one fetch feeds every grid on the
  // page instead of each grid re-requesting the same response.
  function fetchVisits() {
    if (!window.fetch) return Promise.resolve(null);
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS) : null;
    return fetch(VISITS_URL, { cache: 'no-store', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { return (data && data.ok) ? data : null; })
      .catch(function () { return null; })
      .then(function (v) { if (timer) clearTimeout(timer); return v; });
  }

  // Free and real visits dominate; status is only a tiebreaker for the (very
  // likely, early on) case where every app's visits30 is still zero — it
  // keeps the fallback order sensible (live products before demos, demos
  // before in-development ones) instead of an arbitrary tie.
  function scoreOf(el, visits) {
    var slug = el.getAttribute('data-app');
    var v = (visits && visits[slug]) || null;
    var visits30 = v ? (v.visits30 || 0) : 0;
    var free = el.getAttribute('data-free') === 'true';
    var status = el.getAttribute('data-status'); // 'live' | 'demo' | 'dev'
    var statusWeight = status === 'live' ? 2 : status === 'demo' ? 1 : 0;
    return {
      el: el, slug: slug, visits30: visits30, free: free, status: status,
      score: visits30 * 1000 + (free ? 2 : 0) + statusWeight,
    };
  }

  // appendChild on an already-attached node MOVES it — reorders in place
  // without cloning, so event listeners and any live state survive.
  function reorder(container, items) {
    items.forEach(function (it) { container.appendChild(it.el); });
  }

  function clearPopularTag(cards) {
    cards.forEach(function (el) {
      el.classList.remove('is-top');
      var tag = el.querySelector('.app-card__popular-tag');
      if (tag) tag.remove();
    });
  }

  /* ---------- Homepage: hero/compact tiers ---------- */
  function rankHomepage(visits) {
    var grid = document.querySelector('#apps .apps-grid');
    if (!grid) return null;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.app-card[data-app]'));
    if (!cards.length) return null;

    var scored = cards.map(function (el) { return scoreOf(el, visits); });
    var hero = scored.filter(function (s) { return s.free || s.status === 'live'; });
    var compact = scored.filter(function (s) { return !(s.free || s.status === 'live'); });
    hero.sort(function (a, b) { return b.score - a.score; });
    compact.sort(function (a, b) { return b.score - a.score; });

    reorder(grid, hero.concat(compact));
    clearPopularTag(cards);

    hero.forEach(function (s, i) {
      s.el.classList.add('app-card--hero');
      s.el.classList.remove('app-card--compact');
      s.el.style.setProperty('--max-grow', i === 0 ? '0.09' : '0.06');
    });
    compact.forEach(function (s) {
      s.el.classList.add('app-card--compact');
      s.el.classList.remove('app-card--hero');
      s.el.style.setProperty('--max-grow', '0.035');
    });

    // The pulse is a signature moment for one card, not a status indicator —
    // only light it up once a card has an actual visit lead, never on a
    // zero-visits tie (which would just be pulsing an arbitrary card).
    var top = scored.reduce(function (a, b) { return b.visits30 > a.visits30 ? b : a; }, scored[0]);
    if (top.visits30 > 0) {
      top.el.classList.add('is-top');
      var tag = document.createElement('span');
      tag.className = 'app-card__popular-tag';
      tag.textContent = 'La más visitada';
      top.el.appendChild(tag);
    }

    return cards;
  }

  // Binds once per grid element (guarded by __acaciaMagnifyBound) and re-reads
  // its cards from the DOM on every move/leave rather than closing over the
  // array passed in — rankGratisTeaser() replaces its grid's children after
  // this already ran once for the pre-data fallback cards, and a closed-over
  // array would keep pointing at those now-detached nodes instead of the
  // swapped-in ones.
  function initMagnify(grid) {
    if (!grid || grid.__acaciaMagnifyBound) return;
    grid.__acaciaMagnifyBound = true;
    if (prefersReducedMotion() || !hoverCapable()) return;
    var RADIUS = 240;
    var raf = null;
    function apply(x, y) {
      var cards = grid.querySelectorAll('.app-card');
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var r = card.getBoundingClientRect();
        var dx = x - (r.left + r.width / 2);
        var dy = y - (r.top + r.height / 2);
        var dist = Math.sqrt(dx * dx + dy * dy);
        var proximity = Math.max(0, 1 - dist / RADIUS);
        card.style.setProperty('--proximity', proximity.toFixed(3));
      }
    }
    grid.addEventListener('pointermove', function (e) {
      if (raf) return;
      var x = e.clientX, y = e.clientY;
      raf = window.requestAnimationFrame(function () { apply(x, y); raf = null; });
    });
    grid.addEventListener('pointerleave', function () {
      var cards = grid.querySelectorAll('.app-card');
      for (var i = 0; i < cards.length; i++) cards[i].style.setProperty('--proximity', 0);
    });
  }

  /* ---------- apps/index.html's status groups: reorder only ---------- */
  function rankCatalogGroups(visits) {
    var groups = document.querySelectorAll('[data-apps-group="live"], [data-apps-group="demo"], [data-apps-group="dev"]');
    groups.forEach(function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll('[data-app]'))
        .map(function (el) { return scoreOf(el, visits); });
      items.sort(function (a, b) { return b.score - a.score; });
      reorder(group, items);
    });
  }

  /* ---------- freeware/index.html: hero/compact by visits alone ---------- */
  var FREEWARE_HERO_COUNT = 5;

  function rankFreeware(freewareVisits) {
    var grid = document.querySelector('[data-apps-group="freeware"]');
    if (!grid) return null;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.app-card[data-app]'));
    if (!cards.length) return null;

    // scoreOf's free/status terms are moot here (no card carries those
    // attributes, so both default to falsy/zero) — score reduces to plain
    // visits30, which is exactly the ranking this catalog needs.
    var scored = cards.map(function (el) { return scoreOf(el, freewareVisits); });
    scored.sort(function (a, b) { return b.score - a.score; });
    reorder(grid, scored);
    clearPopularTag(cards);

    scored.forEach(function (s, i) {
      var hero = i < FREEWARE_HERO_COUNT;
      s.el.classList.toggle('app-card--hero', hero);
      s.el.classList.toggle('app-card--compact', !hero);
      s.el.style.setProperty('--max-grow', hero ? (i === 0 ? '0.09' : '0.06') : '0.035');
    });

    var top = scored[0];
    if (top && top.visits30 > 0) {
      top.el.classList.add('is-top');
      var tag = document.createElement('span');
      tag.className = 'app-card__popular-tag';
      tag.textContent = 'La más usada';
      top.el.appendChild(tag);
    }

    return { grid: grid, cards: cards };
  }

  /* ---------- Homepage #gratis teaser: swap WHICH 6 tools show, by visits ---------
   * Unlike every ranking above, this one changes selection, not just order/size
   * — the section is a 6-tool curated teaser out of freeware/index.html's 21,
   * so "rank by visits" here means deciding which tools get swapped in and out.
   * The 6 cards already in index.html's markup are the pre-data fallback (a
   * real, sensible curated set, not a placeholder) and stay untouched until
   * /api/apps-visits actually resolves with freeware numbers.
   *
   * FREEWARE_CATALOG mirrors freeware/index.html's title/description copy for
   * all 21 tools verbatim, because the teaser can end up showing any of them,
   * not just the 6 in the static markup — this is the one place that content
   * is duplicated on purpose. Keep it in sync with freeware/index.html by hand
   * if a tool's copy changes there.
   */
  var FREEWARE_CATALOG = [
    { slug: 'calculadora-finiquito', title: 'Calculadora de finiquito y liquidación', desc: 'Calcula finiquito, liquidación por despido, aguinaldo, vacaciones y prima vacacional 2026 conforme a la Ley Federal del Trabajo. Tus datos nunca salen del navegador.', alt: 'Calculadora de finiquito' },
    { slug: 'sueldo-neto', title: 'Calculadora de sueldo neto e ISR', desc: 'Calcula tu sueldo neto, el ISR y el subsidio 2026 con la tarifa oficial del SAT. Aplica a México. Todo en tu navegador.', alt: 'Calculadora de sueldo neto' },
    { slug: 'calculadora-iva', title: 'Calculadora de IVA', desc: 'Agrega o desglosa el IVA de un precio al instante. Tasas 16%, 8% o personalizada.', alt: 'Calculadora de IVA' },
    { slug: 'contador-palabras', title: 'Contador de palabras', desc: 'Cuenta palabras, caracteres, oraciones y tiempo de lectura en tiempo real. Nada se sube.', alt: 'Contador de palabras' },
    { slug: 'generador-qr', title: 'Generador de QR y códigos de barras', desc: 'Crea códigos QR (URL, Wi-Fi, contacto y más) y de barras, con tu logo al centro. Descarga en PNG, SVG o PDF, sin marcas de agua.', alt: 'Generador de QR' },
    { slug: 'comprimir-imagenes', title: 'Comprimir y convertir imágenes', desc: 'Reduce el peso y cambia el formato de tus imágenes (JPG, PNG, WebP) sin perder calidad. Nada se sube: todo en tu navegador.', alt: 'Comprimir imágenes' },
    { slug: 'unir-pdf', title: 'Unir PDF', desc: 'Combina, ordena y junta varios archivos PDF en uno solo. Sin marcas de agua y sin subir tus documentos.', alt: 'Unir PDF' },
    { slug: 'comprimir-pdf', title: 'Comprimir PDF', desc: 'Reduce el tamaño de tus PDF para enviarlos por correo, manteniendo buena calidad. Sin registro ni marcas de agua.', alt: 'Comprimir PDF' },
    { slug: 'dividir-pdf', title: 'Dividir PDF', desc: 'Extrae un rango de páginas o separa cada página de un PDF en archivos independientes.', alt: 'Dividir PDF' },
    { slug: 'pdf-a-jpg', title: 'PDF a JPG', desc: 'Convierte cada página de un PDF en imágenes JPG. Descarga una o todas en ZIP.', alt: 'PDF a JPG' },
    { slug: 'jpg-a-pdf', title: 'JPG a PDF', desc: 'Convierte y une varias imágenes JPG o PNG en un solo archivo PDF, en el orden que quieras.', alt: 'JPG a PDF' },
    { slug: 'generador-contrasenas', title: 'Generador de contraseñas', desc: 'Crea contraseñas seguras o frases fáciles de recordar, con medidor de fortaleza. Nada se guarda ni se envía.', alt: 'Generador de contraseñas' },
    { slug: 'generador-facturas', title: 'Generador de facturas y recibos', desc: 'Crea recibos, cotizaciones y notas de venta en PDF con tu logo e IVA. Sin registro (documento no fiscal).', alt: 'Generador de facturas y recibos' },
    { slug: 'csv-a-json', title: 'CSV a JSON y SQL', desc: 'Convierte CSV o Excel a JSON o sentencias SQL (INSERT) al instante. Nada se sube.', alt: 'CSV a JSON y SQL' },
    { slug: 'comparar-textos', title: 'Comparar textos (diff)', desc: 'Compara dos versiones de un texto o documento y resalta qué cambió, línea por línea.', alt: 'Comparar textos' },
    { slug: 'optimizador-prompts', title: 'Optimizador de prompts IA', desc: 'Convierte una idea en un prompt profesional para ChatGPT, Gemini o Claude. Copia al instante.', alt: 'Optimizador de prompts IA' },
    { slug: 'presupuesto-50-30-20', title: 'Presupuesto 50/30/20', desc: 'Reparte tu ingreso en necesidades, gustos y ahorro. Visual y ajustable a tu medida.', alt: 'Presupuesto 50/30/20' },
    { slug: 'metodo-cubetas', title: 'Método de cubetas', desc: 'Divide tu ingreso con metodologías probadas: 50/30/20, 6 Jarras, Barefoot, Profit First y Págate primero. Con teoría y citas.', alt: 'Método de cubetas' },
    { slug: 'gastos-viaje', title: 'Gastos de viaje', desc: 'Arma tu reporte de viáticos con comprobantes, varias monedas y anticipo. Descarga el PDF listo para entregar.', alt: 'Gastos de viaje' },
    { slug: 'extraer-texto-imagen', title: 'Extraer texto de imagen (OCR)', desc: 'Convierte una foto, captura o escaneo en texto editable. El OCR corre en tu navegador.', alt: 'Extraer texto de imagen OCR' },
    { slug: 'plink-fx', title: 'Plink FX', desc: 'Conversor de divisas rápido para viajes, con registro de gastos opcional. Ideal para llevar tus cuentas en otra moneda.', alt: 'Plink FX' },
  ];
  var FREEWARE_BY_SLUG = {};
  FREEWARE_CATALOG.forEach(function (t) { FREEWARE_BY_SLUG[t.slug] = t; });

  var GRATIS_COUNT = 6;
  // The teaser's current, hand-picked default — also the fill source when
  // fewer than GRATIS_COUNT tools have any recorded visits yet, so an early,
  // mostly-zero dataset can't thin the teaser down to 1-2 real cards.
  var CURATED_FALLBACK_SLUGS = [
    'comprimir-pdf', 'comprimir-imagenes', 'unir-pdf',
    'generador-qr', 'calculadora-finiquito', 'sueldo-neto',
  ];

  function buildGratisCard(tool) {
    var a = document.createElement('a');
    a.href = '/freeware/' + tool.slug;
    a.className = 'app-card';
    a.setAttribute('data-app', tool.slug);

    var head = document.createElement('div');
    head.className = 'head';
    var logo = document.createElement('div');
    logo.className = 'logo';
    var img = document.createElement('img');
    img.src = '/freeware/' + tool.slug + '/favicon.svg';
    img.alt = tool.alt;
    img.width = 40;
    img.height = 40;
    logo.appendChild(img);
    var badge = document.createElement('span');
    badge.className = 'badge available';
    badge.textContent = 'Gratis';
    head.appendChild(logo);
    head.appendChild(badge);

    var h3 = document.createElement('h3');
    h3.textContent = tool.title;
    var p = document.createElement('p');
    p.textContent = tool.desc;
    var more = document.createElement('span');
    more.className = 'more';
    more.textContent = 'Abrir gratis →';

    a.appendChild(head);
    a.appendChild(h3);
    a.appendChild(p);
    a.appendChild(more);
    return a;
  }

  function rankGratisTeaser(freewareVisits) {
    // No real data yet — the static markup already IS the sensible fallback
    // here (unlike the other grids, there's no data-free/data-status to fall
    // back to for a selection decision), so there is nothing to do.
    if (!freewareVisits) return null;
    var grid = document.querySelector('[data-apps-group="gratis"]');
    if (!grid) return null;

    // scripts/home-tools-region.js already decided, by timezone, whether this
    // visitor is outside Mexico and swapped out calculadora-finiquito/
    // sueldo-neto (LFT/SAT-specific, irrelevant outside Mexico) for universal
    // substitutes. It always sets this global (empty object for a Mexican or
    // unknown-region visitor) before this function's first real call — that
    // script runs synchronously on page load, this one only runs once the
    // async visits fetch resolves. Respecting it here means a real-visits
    // rebuild can never reintroduce a Mexico-only tool to a visitor that
    // script already excluded, no matter how popular it is overall.
    var substitutes = window.ACACIA_MX_ONLY_SUBSTITUTES || {};
    var excludedSlugs = Object.keys(substitutes);

    var eligible = FREEWARE_CATALOG.filter(function (t) { return excludedSlugs.indexOf(t.slug) === -1; });
    var ranked = eligible.map(function (t) {
      var v = freewareVisits[t.slug];
      return { slug: t.slug, visits30: v ? (v.visits30 || 0) : 0 };
    }).sort(function (a, b) { return b.visits30 - a.visits30; });

    var picked = ranked.filter(function (r) { return r.visits30 > 0; })
      .slice(0, GRATIS_COUNT)
      .map(function (r) { return r.slug; });
    if (picked.length < GRATIS_COUNT) {
      // Curated defaults first (each excluded slug swapped for its own
      // regional substitute, so a sparse-data non-Mexican visitor still gets
      // exactly the pair home-tools-region.js would have shown), then the
      // full catalog's own declared order as a last resort so there's always
      // enough left to fill after exclusions.
      CURATED_FALLBACK_SLUGS.map(function (slug) { return substitutes[slug] || slug; })
        .concat(FREEWARE_CATALOG.map(function (t) { return t.slug; }))
        .forEach(function (slug) {
          if (picked.length < GRATIS_COUNT && picked.indexOf(slug) === -1 && excludedSlugs.indexOf(slug) === -1) {
            picked.push(slug);
          }
        });
    }

    var current = Array.prototype.slice.call(grid.querySelectorAll('.app-card[data-app]'))
      .map(function (el) { return el.getAttribute('data-app'); });
    var same = current.length === picked.length &&
      current.every(function (slug, i) { return slug === picked[i]; });
    if (same) return { grid: grid, cards: Array.prototype.slice.call(grid.querySelectorAll('.app-card[data-app]')) };

    while (grid.firstChild) grid.removeChild(grid.firstChild);
    picked.forEach(function (slug) {
      var tool = FREEWARE_BY_SLUG[slug];
      if (tool) grid.appendChild(buildGratisCard(tool));
    });
    return { grid: grid, cards: Array.prototype.slice.call(grid.querySelectorAll('.app-card[data-app]')) };
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var grid = document.querySelector('#apps .apps-grid');
    var cards = rankHomepage(null);
    if (grid && cards) initMagnify(grid);
    rankCatalogGroups(null);

    var fw = rankFreeware(null);
    if (fw) initMagnify(fw.grid);

    var gratisGrid = document.querySelector('[data-apps-group="gratis"]');
    if (gratisGrid) initMagnify(gratisGrid);

    fetchVisits().then(function (data) {
      if (!data) return;
      if (data.visits) {
        rankHomepage(data.visits);
        rankCatalogGroups(data.visits);
      }
      if (data.freeware) {
        rankFreeware(data.freeware);
        rankGratisTeaser(data.freeware);
      }
    });
  });
})();
