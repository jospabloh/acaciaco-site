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
  });
})();
