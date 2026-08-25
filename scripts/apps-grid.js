/* ACACIA · Apps grid ranking + interaction.
 *
 * Ranks app cards by the two signals asked for: free apps and real visit
 * counts (Mission Control's public /api/apps-visits, backed by the
 * analytics.js pixel every apps/*.html page already fires on load). Nothing
 * is ever hidden — every card stays visible, only reordered and resized:
 *   - homepage (#apps .apps-grid): a free-or-live app gets the larger "hero"
 *     card, everything else gets a smaller "compact" one; within each tier,
 *     real visit counts (once they exist) decide the order.
 *   - apps/index.html's status groups (data-apps-group): reorder-only, same
 *     visits signal, no resizing — that page is a spec sheet, not a
 *     discovery grid, so tiering there would fight its own layout.
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

  function fetchVisits() {
    if (!window.fetch) return Promise.resolve(null);
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS) : null;
    return fetch(VISITS_URL, { cache: 'no-store', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { return (data && data.ok && data.visits) ? data.visits : null; })
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

  function initMagnify(grid, cards) {
    if (!grid || grid.__acaciaMagnifyBound) return;
    grid.__acaciaMagnifyBound = true;
    if (prefersReducedMotion() || !hoverCapable()) return;
    var RADIUS = 240;
    var raf = null;
    function apply(x, y) {
      cards.forEach(function (card) {
        var r = card.getBoundingClientRect();
        var dx = x - (r.left + r.width / 2);
        var dy = y - (r.top + r.height / 2);
        var dist = Math.sqrt(dx * dx + dy * dy);
        var proximity = Math.max(0, 1 - dist / RADIUS);
        card.style.setProperty('--proximity', proximity.toFixed(3));
      });
    }
    grid.addEventListener('pointermove', function (e) {
      if (raf) return;
      var x = e.clientX, y = e.clientY;
      raf = window.requestAnimationFrame(function () { apply(x, y); raf = null; });
    });
    grid.addEventListener('pointerleave', function () {
      cards.forEach(function (card) { card.style.setProperty('--proximity', 0); });
    });
  }

  /* ---------- Catalog page (apps/index.html): reorder only ---------- */
  function rankCatalogGroups(visits) {
    var groups = document.querySelectorAll('[data-apps-group]');
    groups.forEach(function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll('[data-app]'))
        .map(function (el) { return scoreOf(el, visits); });
      items.sort(function (a, b) { return b.score - a.score; });
      reorder(group, items);
    });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var grid = document.querySelector('#apps .apps-grid');
    var cards = rankHomepage(null);
    if (grid && cards) initMagnify(grid, cards);
    rankCatalogGroups(null);

    fetchVisits().then(function (visits) {
      if (!visits) return;
      rankHomepage(visits);
      rankCatalogGroups(visits);
    });
  });
})();
