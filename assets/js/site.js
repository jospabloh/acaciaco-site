(function () {
  const STORAGE = {
    theme: 'acacia_theme',
    currency: 'acacia_currency',
    language: 'acacia_language'
  };

  const DEFAULTS = {
    theme: 'system',
    currency: 'MXN',
    language: 'es',
    waNumber: '524498958291',
    waMessage: 'Hola, me interesa conocer más sobre ACACIA y sus soluciones digitales.'
  };

  const root = document.documentElement;
  const body = document.body;

  const yearEl = document.getElementById('year');
  const dateEl = document.getElementById('date');
  const waEl = document.getElementById('wa-link');
  const themePicker = document.getElementById('theme-picker');
  const currencyPicker = document.getElementById('currency-picker');
  const langPicker = document.getElementById('lang-picker');

  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const getStored = (key, fallback) => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (_) {
      return fallback;
    }
  };

  const setStored = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      // ignore storage errors
    }
  };

  const getUsdRate = () => {
    const rawRate =
      body?.dataset?.usdRate ||
      root?.dataset?.usdRate ||
      '17';

    const parsed = Number(rawRate);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 17;
  };

  const formatCurrency = (amount, currency) => {
    const locale = currency === 'USD' ? 'en-US' : 'es-MX';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const applyTheme = (value) => {
    const theme = value || DEFAULTS.theme;

    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }

    setStored(STORAGE.theme, theme);
  };

  const applyCurrency = (currencyValue) => {
    const currency = currencyValue || DEFAULTS.currency;
    const usdRate = getUsdRate();

    document.querySelectorAll('[data-price-mxn]').forEach((node) => {
      const mxn = Number(node.getAttribute('data-price-mxn') || 0);
      if (!Number.isFinite(mxn) || mxn <= 0) return;

      if (currency === 'USD') {
        node.textContent = `${formatCurrency(mxn / usdRate, 'USD')} approx.`;
      } else {
        node.textContent = `${formatCurrency(mxn, 'MXN')} MXN`;
      }
    });

    setStored(STORAGE.currency, currency);
  };

  const translations = {
    es: {
      'currency.mxn_suffix': 'MXN',
      'currency.usd_approx': 'aprox.',
      'jobs.cta.whatsapp': 'Enviar por WhatsApp',
      'contact.cta.whatsapp': 'Hablar por WhatsApp',
      'contact.cta.email': 'Escribir por correo'
    },
    en: {
      'currency.mxn_suffix': 'MXN',
      'currency.usd_approx': 'approx.',
      'jobs.cta.whatsapp': 'Send via WhatsApp',
      'contact.cta.whatsapp': 'Chat on WhatsApp',
      'contact.cta.email': 'Send an email'
    }
  };

  const translateNode = (node, lang) => {
    const key = node.getAttribute('data-i18n');
    if (!key) return;

    const dictionary = translations[lang] || translations[DEFAULTS.language];
    const value = dictionary[key];
    if (!value) return;

    const attr = node.getAttribute('data-i18n-attr');
    if (attr) {
      node.setAttribute(attr, value);
    } else {
      node.textContent = value;
    }
  };

  const applyLanguage = (langValue) => {
    const lang = langValue === 'en' ? 'en' : 'es';

    root.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((node) => translateNode(node, lang));

    setStored(STORAGE.language, lang);

    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    applyCurrency(getStored(STORAGE.currency, DEFAULTS.currency));
  };

  const applyWhatsAppLink = () => {
    if (!waEl) return;

    const waNumber = body?.dataset?.waNumber || DEFAULTS.waNumber;
    const waMessage = body?.dataset?.waMessage || DEFAULTS.waMessage;

    waEl.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;
  };

  const setupThemePicker = () => {
    if (!themePicker) return;

    const preferredTheme = getStored(STORAGE.theme, DEFAULTS.theme);
    themePicker.value = preferredTheme;
    applyTheme(preferredTheme);

    themePicker.addEventListener('change', () => {
      applyTheme(themePicker.value);
    });

    const syncSystemTheme = () => {
      const currentTheme = getStored(STORAGE.theme, DEFAULTS.theme);
      if (currentTheme === 'system') {
        root.removeAttribute('data-theme');
      }
    };

    if (typeof systemThemeQuery.addEventListener === 'function') {
      systemThemeQuery.addEventListener('change', syncSystemTheme);
    } else if (typeof systemThemeQuery.addListener === 'function') {
      systemThemeQuery.addListener(syncSystemTheme);
    }
  };

  const setupCurrencyPicker = () => {
    if (!currencyPicker) {
      applyCurrency(getStored(STORAGE.currency, DEFAULTS.currency));
      return;
    }

    const preferredCurrency = getStored(STORAGE.currency, DEFAULTS.currency);
    currencyPicker.value = preferredCurrency;
    applyCurrency(preferredCurrency);

    currencyPicker.addEventListener('change', () => {
      applyCurrency(currencyPicker.value);
    });
  };

  const setupLanguagePicker = () => {
    if (!langPicker) {
      applyLanguage(getStored(STORAGE.language, DEFAULTS.language));
      return;
    }

    const preferredLanguage = getStored(STORAGE.language, DEFAULTS.language);
    langPicker.value = preferredLanguage;
    applyLanguage(preferredLanguage);

    langPicker.addEventListener('change', () => {
      applyLanguage(langPicker.value);
    });
  };

  const setupDateAndYear = () => {
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }

    if (dateEl) {
      const preferredLanguage = getStored(STORAGE.language, DEFAULTS.language);
      dateEl.textContent = new Date().toLocaleDateString(preferredLanguage === 'en' ? 'en-US' : 'es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const setupTestimonials = () => {
    document.querySelectorAll('.testimonials-carousel').forEach((carousel) => {
      const slides = Array.from(carousel.querySelectorAll('.testimonial-slide'));
      if (!slides.length) return;

      let index = 0;
      slides.forEach((slide, i) => slide.classList.toggle('active', i === 0));

      window.setInterval(() => {
        slides[index].classList.remove('active');
        index = (index + 1) % slides.length;
        slides[index].classList.add('active');
      }, 4500);
    });
  };

  const setupMobileNav = () => {
    const mobileNav = document.querySelector('.mobile-nav');
    if (!mobileNav) return;

    mobileNav.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.removeAttribute('open');
      });
    });
  };



  const setupSecretGame = () => {
    const whisper = document.getElementById('brand-whisper');
    const shell = document.querySelector('.secret-game');
    const backdrop = document.getElementById('secret-game-backdrop');
    const closeBtn = document.getElementById('secret-game-close');
    const restartBtn = document.getElementById('secret-restart');
    const scoreEl = document.getElementById('secret-score');
    const bestEl = document.getElementById('secret-best');
    const leftBtn = document.getElementById('secret-left');
    const rightBtn = document.getElementById('secret-right');
    const dropBtn = document.getElementById('secret-drop');
    const canvas = document.getElementById('secret-game-canvas');
    if (!whisper || !shell || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = 10;
    const rows = 15;
    const cell = Math.floor(canvas.width / cols);
    const board = Array.from({ length: rows }, () => Array(cols).fill(0));
    const colors = ['#38bdf8', '#22d3ee', '#818cf8', '#34d399', '#f59e0b'];
    let clickQueue = [];
    let gameLoop = null;
    let score = 0;
    let best = Number(getStored('acacia_secret_best', '0')) || 0;
    let piece = null;

    const updateMeta = () => {
      scoreEl.textContent = String(score);
      bestEl.textContent = String(best);
    };

    const randomPiece = () => ({
      x: Math.floor(cols / 2),
      y: 0,
      color: colors[Math.floor(Math.random() * colors.length)]
    });

    const drawCell = (x, y, fill) => {
      ctx.fillStyle = fill;
      ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (board[y][x]) drawCell(x, y, board[y][x]);
          else {
            ctx.fillStyle = 'rgba(148,163,184,.08)';
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          }
        }
      }
      if (piece) drawCell(piece.x, piece.y, piece.color);
    };

    const collides = (x, y) => y >= rows || x < 0 || x >= cols || board[y]?.[x];

    const clearRows = () => {
      let cleared = 0;
      for (let y = rows - 1; y >= 0; y -= 1) {
        if (board[y].every(Boolean)) {
          board.splice(y, 1);
          board.unshift(Array(cols).fill(0));
          cleared += 1;
          y += 1;
        }
      }
      if (cleared > 0) {
        score += cleared * 15;
        if (score > best) {
          best = score;
          setStored('acacia_secret_best', String(best));
        }
        updateMeta();
      }
    };

    const reset = () => {
      for (let y = 0; y < rows; y += 1) board[y].fill(0);
      score = 0;
      piece = randomPiece();
      updateMeta();
      draw();
    };

    const tick = () => {
      if (!piece) return;
      if (!collides(piece.x, piece.y + 1)) {
        piece.y += 1;
      } else {
        if (piece.y === 0) {
          reset();
          return;
        }
        board[piece.y][piece.x] = piece.color;
        clearRows();
        piece = randomPiece();
      }
      draw();
    };

    const move = (delta) => {
      if (!piece) return;
      const nextX = piece.x + delta;
      if (!collides(nextX, piece.y)) {
        piece.x = nextX;
        draw();
      }
    };

    const hardDrop = () => {
      if (!piece) return;
      while (!collides(piece.x, piece.y + 1)) piece.y += 1;
      tick();
    };

    const close = () => {
      shell.classList.remove('is-open');
      document.body.style.overflow = '';
      if (gameLoop) window.clearInterval(gameLoop);
      gameLoop = null;
    };

    const open = () => {
      shell.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      reset();
      if (gameLoop) window.clearInterval(gameLoop);
      gameLoop = window.setInterval(tick, 430);
    };

    whisper.addEventListener('click', () => {
      const now = Date.now();
      clickQueue = clickQueue.filter((t) => now - t < 2100);
      clickQueue.push(now);
      if (clickQueue.length >= 5) {
        clickQueue = [];
        open();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!shell.classList.contains('is-open')) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowDown') hardDrop();
    });

    leftBtn?.addEventListener('click', () => move(-1));
    rightBtn?.addEventListener('click', () => move(1));
    dropBtn?.addEventListener('click', hardDrop);
    closeBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    restartBtn?.addEventListener('click', reset);

    updateMeta();
  };

  setupDateAndYear();
  applyWhatsAppLink();
  setupThemePicker();
  setupCurrencyPicker();
  setupLanguagePicker();
  setupTestimonials();
  setupMobileNav();
  setupSecretGame();
})();
