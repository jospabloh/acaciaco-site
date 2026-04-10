(function () {
  const STORAGE = {
    theme: 'acacia_theme',
    currency: 'acacia_currency',
    usdRateCache: 'acacia_usd_rate_cache'
  };

  const DEFAULTS = {
    theme: 'system',
    currency: 'MXN',
    fallbackUsdRate: 17,
    waNumber: '524498958291',
    waMessage: 'Hola, me interesa conocer más sobre ACACIA y sus soluciones digitales.'
  };

  const root = document.documentElement;
  const body = document.body;
  const pathName = window.location.pathname.replace(/\/+$/, '') || '/';

  const getHomeAnchor = (id) => ((pathName === '/' || pathName === '/bienvenida') ? `#${id}` : `/#${id}`);
  const getAppsAnchor = (id) => (pathName === '/apps' ? `#${id}` : `/apps#${id}`);

  const renderSiteHeader = () => {
    const headerMount = document.getElementById('site-header');
    if (!headerMount) return;

    headerMount.className = 'topnav topnav-premium';
    headerMount.innerHTML = `
    <div class="topnav-inner">
      <a class="topnav-brand" id="brand-trigger" href="/" title="ACACIA | Tecnología, consultoría y soluciones digitales" aria-label="ACACIA">
        <img src="/assets/Logo_ACACIA_HighRes.jpg" alt="ACACIA" />
        <div class="topnav-brand-copy">
          <b>ACACIA</b>
          <span id="brand-whisper" aria-label="Digital systems crafted by ACACIA">Systems crafted with intent</span>
        </div>
      </a>

      <nav class="topnav-links topnav-links-premium" aria-label="Principal">
        <a href="${getHomeAnchor('inicio')}">Inicio</a>
        <a href="${getHomeAnchor('soluciones')}">Capacidades</a>
        <a href="${getAppsAnchor('apps-destacadas')}">Apps</a>
        <a href="/servicios">Servicios</a>
        <a href="/pricing">Pricing</a>
        <a href="${getHomeAnchor('contacto')}">Contacto</a>
      </nav>

      <div class="topnav-actions topnav-actions-global" aria-label="Controles globales del sitio">
        <div class="global-pref-shell" aria-label="Moneda">
          <label class="picker picker-compact" for="currency-picker-top">
            <span class="picker-icon" aria-hidden="true">💱</span>
            <select id="currency-picker-top" name="currency">
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <a class="btn btn-primary btn-nav-cta" href="${getHomeAnchor('contacto')}">Iniciar proyecto</a>
      </div>

      <details class="mobile-nav">
        <summary>Menú</summary>
        <div class="mobile-nav-menu">
          <a href="${getHomeAnchor('inicio')}">Inicio</a>
          <a href="${getHomeAnchor('soluciones')}">Capacidades</a>
          <a href="${getAppsAnchor('apps-destacadas')}">Apps</a>
          <a href="/servicios">Servicios</a>
          <a href="/pricing">Pricing</a>
          <a href="${getHomeAnchor('contacto')}">Contacto</a>
        </div>
      </details>
    </div>`;
  };

  renderSiteHeader();

  const yearEl = document.getElementById('year');
  const dateEl = document.getElementById('date');
  const waEl = document.getElementById('wa-link');
  const themePicker = document.getElementById('theme-picker');
  let currencyPicker = document.getElementById('currency-picker') || document.getElementById('currency-picker-top');
  let activeUsdRate = DEFAULTS.fallbackUsdRate;

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
    const rawRate = body?.dataset?.usdRate || root?.dataset?.usdRate || String(activeUsdRate);

    const parsed = Number(rawRate);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULTS.fallbackUsdRate;
  };

  const getStoredUsdRate = () => {
    const cache = getStored(STORAGE.usdRateCache, '');
    if (!cache) return null;

    try {
      const parsed = JSON.parse(cache);
      if (!parsed || !Number.isFinite(parsed.rate) || parsed.rate <= 0) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  const setStoredUsdRate = (ratePayload) => {
    if (!ratePayload || !Number.isFinite(ratePayload.rate) || ratePayload.rate <= 0) return;
    setStored(STORAGE.usdRateCache, JSON.stringify(ratePayload));
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

  const setupLanguage = () => {
    root.lang = 'es';
  };

  const refreshExchangeRate = async () => {
    try {
      const response = await fetch('/api/exchange-rate', {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) throw new Error(`exchange-rate-http-${response.status}`);
      const payload = await response.json();
      if (!payload || !Number.isFinite(payload.rate) || payload.rate <= 0) throw new Error('exchange-rate-invalid');

      activeUsdRate = payload.rate;
      setStoredUsdRate(payload);
      applyCurrency(getStored(STORAGE.currency, DEFAULTS.currency));
    } catch (_) {
      const cachedRate = getStoredUsdRate();
      if (!cachedRate) return;
      activeUsdRate = cachedRate.rate;
      applyCurrency(getStored(STORAGE.currency, DEFAULTS.currency));
    }
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
    currencyPicker = document.getElementById('currency-picker') || document.getElementById('currency-picker-top');
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

  const setupDateAndYear = () => {
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }

    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('es-MX', {
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



  const setupRevealMotion = () => {
    const revealNodes = Array.from(document.querySelectorAll('.reveal-up'));
    if (!revealNodes.length || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

    revealNodes.forEach((node) => observer.observe(node));
  };



  const setupHeroParallax = () => {
    const node = document.querySelector('[data-parallax]');
    if (!node) return;

    const factor = Number(node.getAttribute('data-parallax') || 6);
    window.addEventListener('pointermove', (event) => {
      const nx = (event.clientX / window.innerWidth) - 0.5;
      const ny = (event.clientY / window.innerHeight) - 0.5;
      node.style.transform = `translate3d(${(nx * factor).toFixed(2)}px, ${(ny * factor).toFixed(2)}px, 0)`;
    }, { passive: true });
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

  const setupFooterSocials = () => {
    const footerInner = document.querySelector('.site-footer .footer-inner');
    if (!footerInner || footerInner.querySelector('.footer-socials')) return;

    const separator = document.createElement('span');
    separator.textContent = '•';
    const socials = document.createElement('span');
    socials.className = 'footer-socials';
    socials.innerHTML = `
      <a href="https://www.facebook.com/acaciaconsultoriaic/?locale=es_LA" target="_blank" rel="noopener noreferrer" aria-label="Facebook ACACIA">
        <span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="img"><path d="M13.5 8.5h2V5.2c-.35-.05-1.55-.2-2.95-.2-2.92 0-4.92 1.78-4.92 5.05v2.95H4.5v3.7h3.13V24h3.84v-7.28h3.02l.48-3.7h-3.5v-2.58c0-1.07.3-1.8 2.03-1.8z"/></svg></span><span>Facebook</span>
      </a>
      <a href="https://www.instagram.com/acacia_consultoria/" target="_blank" rel="noopener noreferrer" aria-label="Instagram ACACIA">
        <span class="social-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="img"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.9A3.85 3.85 0 0 0 3.9 7.75v8.5a3.85 3.85 0 0 0 3.85 3.85h8.5a3.85 3.85 0 0 0 3.85-3.85v-8.5a3.85 3.85 0 0 0-3.85-3.85zm8.95 1.45a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2z"/></svg></span><span>Instagram</span>
      </a>
    `;
    footerInner.append(separator, socials);
  };

  const setupFloatingEgg = () => {
    const isHomepage = pathName === '/' || pathName === '/bienvenida';
    if (!isHomepage) return;

    const egg = document.querySelector('[data-floating-egg]');
    const shell = document.querySelector('.secret-game');
    if (!egg || !shell) return;

    let consumed = false;
    let visible = false;
    let x = 0.8;
    let y = 0.68;
    let timerId = null;

    const applyPosition = () => {
      egg.style.left = `${Math.round(x * 100)}vw`;
      egg.style.top = `${Math.round(y * 100)}vh`;
    };

    const nextPosition = () => {
      x = 0.12 + (Math.random() * 0.74);
      y = 0.16 + (Math.random() * 0.6);
      if (window.innerWidth < 640) y = Math.min(y, 0.74);
      applyPosition();
    };

    const pulse = () => {
      if (consumed) return;
      visible = !visible;
      if (visible) nextPosition();
      egg.classList.toggle('is-visible', visible);
      timerId = window.setTimeout(pulse, visible ? 2600 + (Math.random() * 2200) : 1500 + (Math.random() * 2000));
    };

    const consumeEgg = () => {
      consumed = true;
      visible = false;
      egg.classList.remove('is-visible');
      egg.setAttribute('aria-hidden', 'true');
      egg.disabled = true;
      if (timerId) window.clearTimeout(timerId);
    };

    egg.addEventListener('click', () => {
      if (consumed) return;
      window.dispatchEvent(new CustomEvent('acacia:open-secret-game'));
      egg.classList.remove('is-visible');
    });

    const observer = new MutationObserver(() => {
      if (!shell.classList.contains('is-open') && !consumed) consumeEgg();
    });
    observer.observe(shell, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', applyPosition, { passive: true });
    pulse();
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

    window.addEventListener('acacia:open-secret-game', open);

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
      if (window.location.pathname === '/apps' || window.location.pathname === '/apps/' || window.location.pathname === '/bienvenida' || window.location.pathname === '/bienvenida/') {
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
  setupLanguage();
  const cachedRate = getStoredUsdRate();
  if (cachedRate) {
    activeUsdRate = cachedRate.rate;
    applyCurrency(getStored(STORAGE.currency, DEFAULTS.currency));
  }
  refreshExchangeRate();
  setupTestimonials();
  setupMobileNav();
  setupRevealMotion();
  setupHeroParallax();
  setupSecretGame();
  setupFloatingEgg();
  setupFooterSocials();
})();
