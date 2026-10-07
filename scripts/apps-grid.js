/* ACACIA · Card grid ranking + interaction.
 *
 * Ranks cards by REAL visits to each app's own page (Mission Control's public
 * /api/apps-visits, backed by the analytics.js pixel every apps/*.html and
 * freeware/*.html page already fires on load). Nothing is ever hidden — every
 * card stays visible, only reordered (and, on the homepage, resized).
 *
 * THE METRIC — decided in one place, metricFor(payload):
 *   - payload has `month` ("YYYY-MM", added by Mission Control): rank by
 *     `visitsMonth`, the pageviews of the PREVIOUS calendar month. That number
 *     is frozen until the month rolls over, so the order changes once a month
 *     and never reshuffles under a returning visitor.
 *   - payload without `month` (older Mission Control): rank by `visits30`
 *     (rolling 30 days), the original behaviour.
 *   - no response at all (2.5 s cap, offline, blocked): nothing happens; the
 *     static HTML order stands.
 * Ties — including the all-zero case — keep the static HTML order (stable
 * sort on each card's original index). `data-free` no longer affects ranking
 * (no app is free); the attribute is left in the markup, harmless.
 *
 * WHAT EACH GRID DOES:
 *   - homepage (#apps .apps-grid): tier 1 = data-status="live" cards (the
 *     larger "hero" card), tier 2 = data-status="dev" (the "compact" card);
 *     inside each tier, ordered by the metric.
 *   - apps/index.html's status groups (data-apps-group="live"/"dev"):
 *     reorder-only by the same metric, no resizing.
 *   - freeware/index.html's catalog (data-apps-group="freeware"): every tool
 *     is equally free and live, so only the metric orders them; the top 5 get
 *     the hero card, the rest compact.
 *   - homepage's #gratis teaser (data-apps-group="gratis"): the one place this
 *     file changes SELECTION, not just order — a 6-tool teaser out of
 *     freeware/index.html's 21, so "rank" means swapping which tools appear.
 *     The 6 already in the markup stay until real freeware numbers exist (see
 *     rankGratisTeaser). Also honours window.ACACIA_MX_ONLY_SUBSTITUTES
 *     (set synchronously by scripts/home-tools-region.js).
 *
 * THE LEADER'S TAG ("La más visitada de septiembre" / "La más visitada") is
 * only drawn when someone actually leads (value > 0) — never on a zero tie.
 * With the month payload the server's own `topApp` / `topFreeware` wins.
 *
 * THE "APP DEL MES" BOX (index.html #app-del-mes, filled by
 * scripts/app-spotlight.js) features the leader, labelled honestly by chooseSpotlight():
 *   - `month` + `topApp`        -> "App del mes · la más visitada de <mes> <año>"
 *   - old payload, visits30 > 0 -> "App más visitada · últimos 30 días"
 *   - otherwise                 -> the static "App destacada" default stays.
 *
 * MOVEMENT: when data arrives and cards really change position they glide to
 * the new place (FLIP, ~450 ms, transform only). Users whose order did not
 * change see nothing; prefers-reduced-motion skips it.
 *
 * Runs twice: once immediately (static order, zero network wait), then again
 * once /api/apps-visits resolves. A failed or slow fetch just means the second
 * pass never happens — the page never blocks or breaks on it.
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

  /* ---------- The metric: the one place that decides it ---------- */
  var MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function parseMonth(month) {
    var m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(typeof month === 'string' ? month : '');
    return m ? { year: m[1], name: MONTHS_ES[parseInt(m[2], 10) - 1] } : null;
  }

  function metricFor(payload) {
    return payload && parseMonth(payload.month) ? 'visitsMonth' : 'visits30';
  }

  // Server-provided keys (slugs) are only ever looked up as OWN properties:
  // "constructor" / "__proto__" must never resolve to something inherited.
  function has(obj, key) {
    return obj != null && typeof obj === 'object' && typeof key === 'string' &&
      Object.prototype.hasOwnProperty.call(obj, key);
  }

  function valueOf(bucket, slug, metric) {
    if (!has(bucket, slug)) return 0;
    var v = bucket[slug];
    var n = (v && typeof v === 'object') ? Number(v[metric]) : 0;
    return n > 0 && isFinite(n) ? n : 0;
  }

  // THE one decision of "who leads", used by the grids' tag AND the box so they
  // can never name different apps. The server's own pick (topApp/topFreeware)
  // counts only if it is one of `slugs` AND has a real value for the active
  // metric; otherwise the real maximum wins; a zero maximum means no leader.
  function pickLeader(bucket, slugs, metric, serverSlug) {
    if (typeof serverSlug === 'string' && slugs.indexOf(serverSlug) !== -1 &&
        valueOf(bucket, serverSlug, metric) > 0) {
      return serverSlug;
    }
    var best = null, bestV = 0;
    slugs.forEach(function (k) {
      var v = valueOf(bucket, k, metric);
      if (v > bestV) { best = k; bestV = v; }
    });
    return best;
  }

  // `idx` is the card's position in the static HTML, captured the first time
  // it is seen, so ties always fall back to the authored order.
  function scoreOf(el, bucket, metric, tieIdx) {
    var slug = el.getAttribute('data-app');
    if (el.__acaciaIdx == null) el.__acaciaIdx = tieIdx;
    return {
      el: el, slug: slug, idx: el.__acaciaIdx,
      status: el.getAttribute('data-status'), // 'live' | 'dev'
      value: valueOf(bucket, slug, metric),
    };
  }

  function byRank(a, b) { return (b.value - a.value) || (a.idx - b.idx); }

  // appendChild on an already-attached node MOVES it — reorders in place
  // without cloning, so event listeners and any live state survive.
  function reorder(container, items) {
    items.forEach(function (it) { container.appendChild(it.el); });
  }

  /* FLIP: record where every card is, run the DOM change, then play each moved
     card from its old spot to its new one. Transform only; skipped for
     reduced-motion, for cards that stay put and for cards far off-screen. */
  function withFlip(cards, mutate) {
    var animate = !prefersReducedMotion() && cards.length && cards[0].animate;
    var before = null;
    if (animate) {
      before = cards.map(function (c) { return c.getBoundingClientRect(); });
    }
    mutate();
    if (!animate) return;
    var vh = window.innerHeight || 800;
    cards.forEach(function (c, i) {
      var a = before[i];
      var b = c.getBoundingClientRect();
      var dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      var offscreen = (a.bottom < -300 || a.top > vh + 300) && (b.bottom < -300 || b.top > vh + 300);
      if (offscreen) return;
      c.animate(
        [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'translate(0,0)' }],
        { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    });
  }

  function clearPopularTag(cards) {
    cards.forEach(function (el) {
      el.classList.remove('is-top');
      var tag = el.querySelector('.app-card__popular-tag');
      if (tag) tag.remove();
    });
  }

  // Draws the leader's tag on the card `leaderSlug` (from pickLeader), if any.
  function tagLeader(scored, leaderSlug, label) {
    if (!leaderSlug) return null;
    var top = scored.filter(function (s) { return s.slug === leaderSlug; })[0];
    if (!top) return null;
    top.el.classList.add('is-top');
    var tag = document.createElement('span');
    tag.className = 'app-card__popular-tag';
    tag.textContent = label;
    top.el.appendChild(tag);
    return top;
  }

  function leaderLabel(payload, base) {
    var m = payload && parseMonth(payload.month);
    return m ? base + ' de ' + m.name : base;
  }

  /* ---------- Homepage: hero/compact tiers ---------- */
  function rankHomepage(payload) {
    var grid = document.querySelector('#apps .apps-grid');
    if (!grid) return null;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.app-card[data-app]'));
    if (!cards.length) return null;

    var metric = metricFor(payload);
    var bucket = payload && payload.visits;
    var scored = cards.map(function (el, i) { return scoreOf(el, bucket, metric, i); });
    var hero = scored.filter(function (s) { return s.status === 'live'; });
    var compact = scored.filter(function (s) { return s.status !== 'live'; });
    hero.sort(byRank);
    compact.sort(byRank);

    withFlip(cards, function () {
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

      // The pulse is a signature moment for one card, not a status indicator.
      var month = payload && parseMonth(payload.month);
      var leader = pickLeader(bucket, scored.map(function (x) { return x.slug; }), metric,
        month ? payload.topApp : null);
      tagLeader(scored, leader, leaderLabel(payload, 'La más visitada'));
    });

    return cards;
  }

  // Which app the "app del mes" box features, and how to label it honestly.
  // Returns null when the data names no real leader (box keeps its default).
  // Uses the same pickLeader as the homepage tag, over the same 11 slugs.
  function chooseSpotlight(payload, knownMap) {
    if (!payload || typeof payload !== 'object' || !payload.visits || typeof payload.visits !== 'object') return null;
    var known = knownMap || (window.ACACIA_APP_SPOTLIGHT && window.ACACIA_APP_SPOTLIGHT.data) || {};
    var month = parseMonth(payload.month);
    var slug = pickLeader(payload.visits, Object.keys(known), metricFor(payload), month ? payload.topApp : null);
    if (!slug) return null;
    return {
      slug: slug,
      eyebrow: month
        ? 'App del mes · la más visitada de ' + month.name + ' ' + month.year
        : 'App más visitada · últimos 30 días'
    };
  }

  // Pure decision logic, exposed for tests/rankingLogic.test.ts (no DOM needed).
  if (typeof window !== 'undefined') {
    window.ACACIA_RANKING = { metricFor: metricFor, valueOf: valueOf, pickLeader: pickLeader,
      chooseSpotlight: chooseSpotlight, parseMonth: parseMonth, has: has };
  }
  if (typeof document === 'undefined') return;

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
  function rankCatalogGroups(payload) {
    var metric = metricFor(payload);
    var bucket = payload && payload.visits;
    var groups = document.querySelectorAll('[data-apps-group="live"], [data-apps-group="dev"]');
    groups.forEach(function (group) {
      var els = Array.prototype.slice.call(group.querySelectorAll('[data-app]'));
      var items = els.map(function (el, i) { return scoreOf(el, bucket, metric, i); });
      items.sort(byRank);
      withFlip(els, function () { reorder(group, items); });
    });
  }

  /* ---------- freeware/index.html: hero/compact by visits alone ---------- */
  var FREEWARE_HERO_COUNT = 5;

  function rankFreeware(payload) {
    var grid = document.querySelector('[data-apps-group="freeware"]');
    if (!grid) return null;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.app-card[data-app]'));
    if (!cards.length) return null;

    // No card carries data-status here, so the score reduces to the metric.
    var metric = metricFor(payload);
    var bucket = payload && payload.freeware;
    var scored = cards.map(function (el, i) { return scoreOf(el, bucket, metric, i); });
    scored.sort(byRank);

    withFlip(cards, function () {
      reorder(grid, scored);
      clearPopularTag(cards);

      scored.forEach(function (s, i) {
        var hero = i < FREEWARE_HERO_COUNT;
        s.el.classList.toggle('app-card--hero', hero);
        s.el.classList.toggle('app-card--compact', !hero);
        s.el.style.setProperty('--max-grow', hero ? (i === 0 ? '0.09' : '0.06') : '0.035');
      });

      var month = payload && parseMonth(payload.month);
      var leader = pickLeader(bucket, scored.map(function (x) { return x.slug; }), metric,
        month ? payload.topFreeware : null);
      tagLeader(scored, leader, leaderLabel(payload, 'La más usada'));
    });

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

  function rankGratisTeaser(payload) {
    var freewareVisits = payload && payload.freeware;
    var metric = metricFor(payload);
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
      return { slug: t.slug, value: valueOf(freewareVisits, t.slug, metric) };
    }).sort(function (a, b) { return b.value - a.value; });

    var picked = ranked.filter(function (r) { return r.value > 0; })
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
      if (data.visits && typeof data.visits === 'object') {
        rankHomepage(data);
        rankCatalogGroups(data);
        var pick = chooseSpotlight(data);
        if (pick && window.ACACIA_APP_SPOTLIGHT) {
          window.ACACIA_APP_SPOTLIGHT.show(pick.slug, pick.eyebrow);
        }
      }
      if (data.freeware && typeof data.freeware === 'object') {
        rankFreeware(data);
        rankGratisTeaser(data);
      }
    });
  });
})();
