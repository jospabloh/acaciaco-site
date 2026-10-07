/* ACACIA · Customer testimonials (inert until Mission Control publishes any).
 *
 * Fills every <div data-testimonials="<slug>"> (an app page) or
 * <div data-testimonials="*"> (the homepage, newest across apps) with cards
 * from Mission Control's public endpoint:
 *
 *   GET https://control.acaciaco.com.mx/api/testimonials[?app=<slug>]
 *   -> { ok, items: [{ app, rating, body, author_name, author_role, month }],
 *        summary: { <slug>: { count, average } } }
 *
 * Only reviewed, consented testimonials come back from that endpoint. Until it
 * exists, or while it has nothing, or on ANY failure (offline, 404, timeout of
 * 2.5 s, malformed JSON) this script renders NOTHING: no heading, no
 * placeholder, no invented content. Entries that do not look like a real
 * testimonial (no text, no author, rating outside 1-5) are skipped one by one.
 *
 * Everything is written with textContent. No review markup (JSON-LD) is
 * emitted on purpose. The cards use their own tiny entrance animation instead
 * of .reveal because that observer ran before these nodes existed.
 */
(function () {
  'use strict';

  var URL_BASE = 'https://control.acaciaco.com.mx/api/testimonials';
  var FETCH_TIMEOUT_MS = 2500;
  var HOME_MAX = 6;
  var BODY_MAX = 600;

  // Display names. Keep in sync with scripts/app-spotlight.js (a test checks it).
  var APP_NAMES = {
    'stockflow': 'StockFlow', 'flowfin': 'FlowFin', 'cateqhub': 'CateqHub',
    'puntos-plus': 'Puntos+', 'liuma': 'LIUMA', 'rumbo': 'Rumbo',
    'artiskids': 'ArtisKids', 'sommel': 'Sommel', 'kitchops': 'KitchOps',
    'ctrlhq': 'CtrlHQ', 'radar': 'RADAR'
  };
  if (typeof window !== 'undefined') window.ACACIA_APP_NAMES = APP_NAMES;
  if (typeof module !== 'undefined' && module.exports) module.exports = { APP_NAMES: APP_NAMES };
  if (typeof document === 'undefined') return;

  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function monthLabel(month) {
    var m = /^(\d{4})-(0[1-9]|1[0-2])/.exec(typeof month === 'string' ? month : '');
    return m ? MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1] : '';
  }

  function fetchJSON(url) {
    if (!window.fetch) return Promise.resolve(null);
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS) : null;
    return fetch(url, { signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && d.ok && Array.isArray(d.items)) ? d : null; })
      .catch(function () { return null; })
      .then(function (d) { if (timer) clearTimeout(timer); return d; });
  }

  function clean(item) {
    if (!item || typeof item !== 'object') return null;
    var rating = Math.round(Number(item.rating));
    var body = typeof item.body === 'string' ? item.body.trim() : '';
    var name = typeof item.author_name === 'string' ? item.author_name.trim() : '';
    if (!(rating >= 1 && rating <= 5) || !body || !name) return null;
    return {
      app: typeof item.app === 'string' ? item.app : '',
      rating: rating,
      body: body.length > BODY_MAX ? body.slice(0, BODY_MAX).replace(/\s+\S*$/, '') + '…' : body,
      name: name,
      role: typeof item.author_role === 'string' ? item.author_role.trim() : '',
      month: typeof item.month === 'string' ? item.month : ''
    };
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function stars(rating) {
    var wrap = el('div', 'tm-stars');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', rating + ' de 5 estrellas');
    for (var i = 1; i <= 5; i++) {
      wrap.appendChild(el('span', i <= rating ? 'tm-star is-on' : 'tm-star', '★'));
    }
    // The glyphs are decoration; the label above carries the meaning.
    Array.prototype.forEach.call(wrap.children, function (c) { c.setAttribute('aria-hidden', 'true'); });
    return wrap;
  }

  function card(t, showApp, index) {
    var c = el('figure', 'tm-card');
    c.style.setProperty('--tm-i', index);
    var head = el('div', 'tm-head');
    head.appendChild(stars(t.rating));
    if (showApp && APP_NAMES[t.app]) head.appendChild(el('span', 'tm-app', APP_NAMES[t.app]));
    c.appendChild(head);
    c.appendChild(el('blockquote', 'tm-body', t.body));
    var cap = el('figcaption', 'tm-cap');
    cap.appendChild(el('strong', 'tm-name', t.name));
    if (t.role) cap.appendChild(el('span', 'tm-role', t.role));
    var when = monthLabel(t.month);
    if (when) cap.appendChild(el('span', 'tm-when', when));
    c.appendChild(cap);
    return c;
  }

  function render(mount, items, slug) {
    var home = slug === '*';
    var list = items.map(clean).filter(Boolean);
    if (!home) list = list.filter(function (t) { return !t.app || t.app === slug; });
    if (home) {
      list = list.filter(function (t) { return !!APP_NAMES[t.app]; });
      list.sort(function (a, b) { return a.month < b.month ? 1 : a.month > b.month ? -1 : 0; });
      list = list.slice(0, HOME_MAX);
    }
    if (!list.length) return; // nothing real to show -> nothing in the page

    var id = 'tm-h-' + (home ? 'home' : slug);
    var section = el('section', 'section tm-section');
    section.setAttribute('aria-labelledby', id);
    var wrap = el('div', 'container');
    var head = el('div', 'section-head');
    var eb = el('span', 'eyebrow');
    eb.appendChild(el('span', 'dot'));
    eb.firstChild.setAttribute('aria-hidden', 'true');
    eb.appendChild(document.createTextNode(' Opiniones'));
    head.appendChild(eb);
    var h2 = el('h2', null, home ? 'Lo que dicen quienes ya usan nuestras apps.' : 'Lo que dicen quienes usan ' + (APP_NAMES[slug] || 'esta app') + '.');
    h2.id = id;
    head.appendChild(h2);
    wrap.appendChild(head);
    var grid = el('div', 'tm-grid');
    list.forEach(function (t, i) { grid.appendChild(card(t, home, i)); });
    wrap.appendChild(grid);
    section.appendChild(wrap);
    mount.appendChild(section);
  }

  function init() {
    var mounts = document.querySelectorAll('[data-testimonials]');
    Array.prototype.forEach.call(mounts, function (mount) {
      var slug = mount.getAttribute('data-testimonials');
      if (slug !== '*' && !APP_NAMES[slug]) return;
      var url = slug === '*' ? URL_BASE : URL_BASE + '?app=' + encodeURIComponent(slug);
      fetchJSON(url).then(function (data) { if (data) render(mount, data.items, slug); });
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
