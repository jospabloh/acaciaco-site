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

  setupDateAndYear();
  applyWhatsAppLink();
  setupThemePicker();
  setupCurrencyPicker();
  setupLanguagePicker();
  setupTestimonials();
})();