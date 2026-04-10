(function () {
  const STORAGE = {
    theme: 'acacia_theme',
    currency: 'acacia_currency',
    language: 'acacia_language',
    region: 'acacia_region'
  };

  const DEFAULTS = {
    theme: 'system',
    currency: 'MXN',
    language: 'es',
    region: 'mx',
    waNumber: '524498958291',
    waMessage: 'Hola, me interesa conocer más sobre ACACIA y sus soluciones digitales.'
  };

  const root = document.documentElement;
  const body = document.body;

  const yearEl = document.getElementById('year');
  const dateEl = document.getElementById('date');
  const waEl = document.getElementById('wa-link');
  const themePicker = document.getElementById('theme-picker');
  const currencyPicker = document.getElementById('currency-picker') || document.getElementById('currency-picker-top');
  const langPicker = document.getElementById('lang-picker') || document.getElementById('lang-picker-top');
  const regionPicker = document.getElementById('region-picker-top');

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

  const applyRegion = (regionValue) => {
    const region = ['mx', 'latam', 'us'].includes(regionValue) ? regionValue : DEFAULTS.region;
    root.setAttribute('data-region', region);

    document.querySelectorAll('[data-region-copy]').forEach((node) => {
      const copy = node.getAttribute(`data-region-${region}`);
      if (copy) node.textContent = copy;
    });

    setStored(STORAGE.region, region);
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
    if (!themePicker) {
      applyTheme(getStored(STORAGE.theme, DEFAULTS.theme));
      return;
    }

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

  const setupRegionPicker = () => {
    const preferredRegion = getStored(STORAGE.region, DEFAULTS.region);
    applyRegion(preferredRegion);

    if (!regionPicker) return;
    regionPicker.value = preferredRegion;
    regionPicker.addEventListener('change', () => {
      applyRegion(regionPicker.value);
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
    const trigger = document.getElementById('brand-trigger');
    const shell = document.querySelector('.secret-game');
    const backdrop = document.getElementById('secret-game-backdrop');
    const closeBtn = document.getElementById('secret-game-close');
    const restartBtn = document.getElementById('secret-restart');
    const scoreEl = document.getElementById('secret-score');
    const bestEl = document.getElementById('secret-best');
    const linesEl = document.getElementById('secret-lines');
    const levelEl = document.getElementById('secret-level');
    const leftBtn = document.getElementById('secret-left');
    const rightBtn = document.getElementById('secret-right');
    const softDropBtn = document.getElementById('secret-soft-drop');
    const hardDropBtn = document.getElementById('secret-hard-drop');
    const rotateBtn = document.getElementById('secret-rotate');
    const canvas = document.getElementById('secret-game-canvas');
    if (!trigger || !shell || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = 10;
    const rows = 20;
    const cell = Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
    const boardPixelWidth = cols * cell;
    const boardPixelHeight = rows * cell;
    const boardOffsetX = Math.floor((canvas.width - boardPixelWidth) / 2);
    const boardOffsetY = Math.floor((canvas.height - boardPixelHeight) / 2);
    const board = Array.from({ length: rows }, () => Array(cols).fill(0));
    const pieces = {
      I: { color: '#38bdf8', matrix: [[1, 1, 1, 1]] },
      O: { color: '#fbbf24', matrix: [[1, 1], [1, 1]] },
      T: { color: '#a78bfa', matrix: [[0, 1, 0], [1, 1, 1]] },
      L: { color: '#fb923c', matrix: [[0, 0, 1], [1, 1, 1]] },
      J: { color: '#60a5fa', matrix: [[1, 0, 0], [1, 1, 1]] },
      S: { color: '#34d399', matrix: [[0, 1, 1], [1, 1, 0]] },
      Z: { color: '#f87171', matrix: [[1, 1, 0], [0, 1, 1]] }
    };
    const bagTypes = Object.keys(pieces);
    const baseInterval = 720;
    const minInterval = 170;
    const triggerWindowMs = 3000;
    const triggerCount = 5;
    let pointerQueue = [];
    let suppressNextBrandClick = false;
    let keyBuffer = '';
    let gameTimer = null;
    let lastTick = 0;
    let score = 0;
    let lines = 0;
    let level = 1;
    let best = Number(getStored('acacia_secret_best', '0')) || 0;
    let bag = [];
    let piece = null;
    let isGameOver = false;

    const updateMeta = () => {
      scoreEl.textContent = String(score);
      bestEl.textContent = String(best);
      if (linesEl) linesEl.textContent = String(lines);
      if (levelEl) levelEl.textContent = String(level);
    };

    const cloneMatrix = (matrix) => matrix.map((row) => [...row]);

    const shuffleBag = () => {
      const copy = [...bagTypes];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      bag = copy;
    };

    const spawnPiece = () => {
      if (!bag.length) shuffleBag();
      const type = bag.pop();
      const source = pieces[type];
      const matrix = cloneMatrix(source.matrix);
      const pieceWidth = matrix[0].length;
      return {
        type,
        matrix,
        color: source.color,
        x: Math.floor((cols - pieceWidth) / 2),
        y: 0
      };
    };

    const drawCell = (x, y, fill) => {
      ctx.fillStyle = fill;
      ctx.fillRect(boardOffsetX + (x * cell), boardOffsetY + (y * cell), cell - 1, cell - 1);
    };

    const canPlace = (matrix, offsetX, offsetY) => matrix.every((row, y) =>
      row.every((value, x) => {
        if (!value) return true;
        const boardX = offsetX + x;
        const boardY = offsetY + y;
        return boardX >= 0 &&
          boardX < cols &&
          boardY >= 0 &&
          boardY < rows &&
          !board[boardY][boardX];
      })
    );

    const drawPiece = (targetPiece) => {
      targetPiece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) drawCell(targetPiece.x + x, targetPiece.y + y, targetPiece.color);
        });
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (board[y][x]) drawCell(x, y, board[y][x]);
          else {
            ctx.fillStyle = 'rgba(148,163,184,.08)';
            ctx.fillRect(boardOffsetX + (x * cell), boardOffsetY + (y * cell), cell - 1, cell - 1);
          }
        }
      }
      if (piece) drawPiece(piece);
      if (isGameOver) {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Signal Lost', canvas.width / 2, canvas.height / 2 - 6);
        ctx.font = '13px system-ui';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Tap restart to reconnect', canvas.width / 2, canvas.height / 2 + 18);
      }
    };

    const mergePiece = () => {
      if (!piece) return;
      piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) board[piece.y + y][piece.x + x] = piece.color;
        });
      });
    };

    const lineClearRewards = [0, 120, 320, 540, 860];

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
        lines += cleared;
        score += (lineClearRewards[cleared] || (cleared * 260)) * level;
        level = Math.min(18, 1 + Math.floor(lines / 8));
        if (score > best) {
          best = score;
          setStored('acacia_secret_best', String(best));
        }
        updateMeta();
      }
      return cleared;
    };

    const reset = () => {
      for (let y = 0; y < rows; y += 1) board[y].fill(0);
      score = 0;
      lines = 0;
      level = 1;
      bag = [];
      isGameOver = false;
      piece = spawnPiece();
      lastTick = performance.now();
      updateMeta();
      draw();
    };

    const lockPiece = () => {
      mergePiece();
      clearRows();
      piece = spawnPiece();
      if (!canPlace(piece.matrix, piece.x, piece.y)) {
        isGameOver = true;
        piece = null;
      }
    };

    const stepDown = () => {
      if (!piece) return;
      if (canPlace(piece.matrix, piece.x, piece.y + 1)) {
        piece.y += 1;
      } else {
        lockPiece();
      }
      draw();
    };

    const move = (delta) => {
      if (!piece || isGameOver) return;
      const nextX = piece.x + delta;
      if (canPlace(piece.matrix, nextX, piece.y)) {
        piece.x = nextX;
        draw();
      }
    };

    const rotateMatrix = (matrix) => matrix[0].map((_, index) =>
      matrix.map((row) => row[index]).reverse()
    );

    const rotate = () => {
      if (!piece || isGameOver || piece.type === 'O') return;
      const rotated = rotateMatrix(piece.matrix);
      const kicks = [0, -1, 1, -2, 2];
      for (let i = 0; i < kicks.length; i += 1) {
        const offsetX = piece.x + kicks[i];
        if (canPlace(rotated, offsetX, piece.y)) {
          piece.matrix = rotated;
          piece.x = offsetX;
          draw();
          return;
        }
      }
    };

    const softDrop = () => {
      if (!piece || isGameOver) return;
      if (canPlace(piece.matrix, piece.x, piece.y + 1)) {
        piece.y += 1;
      } else {
        lockPiece();
      }
      draw();
    };

    const hardDrop = () => {
      if (!piece || isGameOver) return;
      while (canPlace(piece.matrix, piece.x, piece.y + 1)) {
        piece.y += 1;
      }
      lockPiece();
      draw();
    };

    const getDropInterval = () => {
      const pace = baseInterval - ((level - 1) * 45);
      return Math.max(minInterval, pace);
    };

    const gameFrame = (time) => {
      if (!shell.classList.contains('is-open')) return;
      if (!lastTick) lastTick = time;
      const delta = time - lastTick;
      if (!isGameOver && delta >= getDropInterval()) {
        stepDown();
        lastTick = time;
      }
      gameTimer = window.requestAnimationFrame(gameFrame);
    };

    const close = () => {
      shell.classList.remove('is-open');
      document.body.style.overflow = '';
      if (gameTimer) window.cancelAnimationFrame(gameTimer);
      gameTimer = null;
    };

    const open = () => {
      shell.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      reset();
      if (gameTimer) window.cancelAnimationFrame(gameTimer);
      gameTimer = window.requestAnimationFrame(gameFrame);
    };

    const isTypingField = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.isContentEditable) return true;
      const tag = node.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const queueTriggerTap = () => {
      const now = Date.now();
      pointerQueue = pointerQueue.filter((t) => now - t < triggerWindowMs);
      pointerQueue.push(now);
      if (pointerQueue.length >= triggerCount) {
        pointerQueue = [];
        suppressNextBrandClick = true;
        open();
      }
    };

    trigger.addEventListener('pointerup', (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      queueTriggerTap();
    });

    trigger.addEventListener('click', (event) => {
      if (suppressNextBrandClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressNextBrandClick = false;
        return;
      }
      if (window.location.pathname === '/apps' || window.location.pathname === '/apps/') {
        event.preventDefault();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (shell.classList.contains('is-open')) {
        if (event.key === 'Escape') {
          close();
          return;
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          move(-1);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          move(1);
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          softDrop();
        }
        if (event.key === 'ArrowUp' || event.key === ' ') {
          event.preventDefault();
          rotate();
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          hardDrop();
        }
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingField(event.target)) return;
      if (event.key.length !== 1 || !/[a-z]/i.test(event.key)) return;

      keyBuffer = (keyBuffer + event.key.toUpperCase()).slice(-6);
      if (keyBuffer.endsWith('ACACIA')) {
        keyBuffer = '';
        open();
      }
    });

    leftBtn?.addEventListener('click', () => move(-1));
    rightBtn?.addEventListener('click', () => move(1));
    softDropBtn?.addEventListener('click', softDrop);
    hardDropBtn?.addEventListener('click', hardDrop);
    rotateBtn?.addEventListener('click', rotate);
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
  setupRegionPicker();
  setupTestimonials();
  setupMobileNav();
  setupSecretGame();
})();
