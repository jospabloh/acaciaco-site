(function () {
  'use strict';

  var STORAGE = {
    theme: 'acacia-theme',
    currency: 'acacia-currency',
    cookies: 'acacia-cookies-consent',
    rate: 'acacia-fx-rate'
  };

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE.theme, theme); } catch (e) {}
  }

  function initTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(current === 'light' ? 'dark' : 'light');
    });
  }

  /* ---------- Currency ---------- */
  var fxRate = null;
  var currentCurrency = 'MXN';

  function readSavedCurrency() {
    try { return localStorage.getItem(STORAGE.currency) || 'MXN'; } catch (e) { return 'MXN'; }
  }

  function saveCurrency(c) {
    try { localStorage.setItem(STORAGE.currency, c); } catch (e) {}
  }

  function readCachedRate() {
    try {
      var raw = sessionStorage.getItem(STORAGE.rate);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (typeof parsed.rate === 'number' && parsed.rate > 0) return parsed.rate;
    } catch (e) {}
    return null;
  }

  function cacheRate(rate) {
    try { sessionStorage.setItem(STORAGE.rate, JSON.stringify({ rate: rate, ts: Date.now() })); } catch (e) {}
  }

  function fetchRate() {
    var cached = readCachedRate();
    if (cached) { fxRate = cached; renderPrices(); return; }
    fetch('/api/exchange-rate')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && typeof data.rate === 'number' && data.rate > 0) {
          fxRate = data.rate;
          cacheRate(fxRate);
          renderPrices();
        }
      })
      .catch(function () {});
  }

  function formatMXN(amount) {
    var n = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(amount);
    return '$' + n + ' MXN';
  }

  function formatUSD(mxnAmount) {
    if (!fxRate) return formatMXN(mxnAmount);
    var usd = mxnAmount / fxRate;
    var decimals = usd > 20 ? 0 : 2;
    var n = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(usd);
    return '$' + n + ' USD';
  }

  function renderPrices() {
    var nodes = document.querySelectorAll('[data-price]');
    for (var i = 0; i < nodes.length; i++) {
      var raw = parseFloat(nodes[i].getAttribute('data-price'));
      if (isNaN(raw)) continue;
      nodes[i].textContent = currentCurrency === 'USD' ? formatUSD(raw) : formatMXN(raw);
    }
  }

  function setCurrency(c) {
    currentCurrency = c;
    saveCurrency(c);
    var btns = document.querySelectorAll('[data-currency]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-currency') === c);
      btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-currency') === c ? 'true' : 'false');
    }
    renderPrices();
  }

  function initCurrency() {
    currentCurrency = readSavedCurrency();
    var btns = document.querySelectorAll('[data-currency]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        setCurrency(e.currentTarget.getAttribute('data-currency'));
      });
    }
    setCurrency(currentCurrency);
    fetchRate();
  }

  /* ---------- Mobile menu ---------- */
  function initMenu() {
    var toggle = document.getElementById('menu-toggle');
    var links = document.querySelector('.nav-links');
    if (!toggle || !links) return;
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var anchors = links.querySelectorAll('a');
    for (var i = 0; i < anchors.length; i++) {
      anchors[i].addEventListener('click', function () {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    }
  }

  /* ---------- Sticky nav ---------- */
  function initStickyNav() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    var setScrolled = function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    };
    setScrolled();
    window.addEventListener('scroll', setScrolled, { passive: true });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var nodes = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || !nodes.length) {
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    for (var j = 0; j < nodes.length; j++) io.observe(nodes[j]);
  }

  /* ---------- Cookie banner ---------- */
  function persistCookieChoice(level) {
    try {
      localStorage.setItem(STORAGE.cookies, JSON.stringify({ level: level, ts: Date.now() }));
    } catch (e) {}
  }

  function alreadyConsented() {
    try { return !!localStorage.getItem(STORAGE.cookies); } catch (e) { return false; }
  }

  function dismissBanner(banner) {
    banner.classList.add('dismiss');
    banner.classList.remove('show');
    setTimeout(function () { banner.remove(); }, 350);
  }

  function initCookies() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    if (alreadyConsented()) { banner.remove(); return; }
    setTimeout(function () { banner.classList.add('show'); }, 1000);
    var accept = banner.querySelector('[data-cookies="all"]');
    var essential = banner.querySelector('[data-cookies="essential"]');
    if (accept) accept.addEventListener('click', function () { persistCookieChoice('all'); dismissBanner(banner); });
    if (essential) essential.addEventListener('click', function () { persistCookieChoice('essential'); dismissBanner(banner); });
  }

  /* ---------- Motion preference ---------- */
  function prefersReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ---------- Scroll progress bar ---------- */
  function initScrollProgress() {
    if (prefersReducedMotion()) return;
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      var doc = document.documentElement;
      var max = (doc.scrollHeight - doc.clientHeight) || 1;
      var ratio = Math.min(1, Math.max(0, window.scrollY / max));
      bar.style.setProperty('--scroll', ratio.toFixed(4));
      bar.classList.toggle('on', window.scrollY > 60);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- Count-up numbers ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count-to'));
    if (isNaN(target)) return;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = (el.getAttribute('data-decimals') | 0);
    if (prefersReducedMotion()) {
      el.textContent = prefix + target.toFixed(decimals) + suffix;
      return;
    }
    var dur = 1100, start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
      var val = target * eased;
      el.textContent = prefix + val.toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = prefix + target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(frame);
  }

  function initCountUp() {
    var nodes = document.querySelectorAll('[data-count-to]');
    if (!nodes.length) return;
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < nodes.length; i++) animateCount(nodes[i]);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { animateCount(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    for (var j = 0; j < nodes.length; j++) io.observe(nodes[j]);
  }

  /* ---------- Pointer-reactive card spotlight ---------- */
  function initSpotlight() {
    if (prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return;
    var cards = document.querySelectorAll('.app-card, .card');
    cards.forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });
  }

  /* ---------- Subtle pointer tilt on hero preview / mockups ---------- */
  function initTilt() {
    if (prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return;
    var targets = document.querySelectorAll('.preview, .mock');
    targets.forEach(function (el) {
      var parent = el.parentElement || el;
      parent.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        var ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        el.style.setProperty('--tx', Math.max(-1, Math.min(1, tx)).toFixed(3));
        el.style.setProperty('--ty', Math.max(-1, Math.min(1, ty)).toFixed(3));
        el.classList.add('tilt');
      });
      parent.addEventListener('pointerleave', function () {
        el.classList.remove('tilt');
        el.style.removeProperty('--tx');
        el.style.removeProperty('--ty');
      });
    });
  }

  /* ---------- Init ---------- */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    initTheme();
    initCurrency();
    initMenu();
    initStickyNav();
    initReveal();
    initCookies();
    initScrollProgress();
    initCountUp();
    initSpotlight();
    initTilt();
  });
})();
