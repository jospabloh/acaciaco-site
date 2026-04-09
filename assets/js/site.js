(function () {
  const STORAGE = {
    theme: 'acacia_theme',
    currency: 'acacia_currency',
    language: 'acacia_language'
  };

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const dateEl = document.getElementById('date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  const waEl = document.getElementById('wa-link');
  if (waEl) {
    const waNumber = document.body.dataset.waNumber || '524498958291';
    const waMessage = document.body.dataset.waMessage || 'Hola, me interesa conocer más sobre sus apps.';
    waEl.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;
  }

  const themePicker = document.getElementById('theme-picker');
  const currencyPicker = document.getElementById('currency-picker');
  const langPicker = document.getElementById('lang-picker');

  const setTheme = (value) => {
    if (value === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', value);
    }
    localStorage.setItem(STORAGE.theme, value);
  };

  const formatCurrency = (amount, currency) => {
    const locale = currency === 'USD' ? 'en-US' : 'es-MX';
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  };

  const applyCurrency = (currency) => {
    const rate = 17; // base visual reference only
    document.querySelectorAll('.price-value[data-price-mxn]').forEach((node) => {
      const mxn = Number(node.getAttribute('data-price-mxn') || 0);
      if (!mxn) return;
      if (currency === 'USD') {
        node.textContent = `${formatCurrency(mxn / rate, 'USD')} aprox.`;
      } else {
        node.textContent = `${formatCurrency(mxn, 'MXN')} MXN`;
      }
    });
    localStorage.setItem(STORAGE.currency, currency);
  };

  const applyLanguage = (lang) => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'es';
    localStorage.setItem(STORAGE.language, lang);
  };

  if (themePicker) {
    const preferred = localStorage.getItem(STORAGE.theme) || 'system';
    themePicker.value = preferred;
    setTheme(preferred);
    themePicker.addEventListener('change', () => setTheme(themePicker.value));
  }

  if (currencyPicker) {
    const preferred = localStorage.getItem(STORAGE.currency) || 'MXN';
    currencyPicker.value = preferred;
    applyCurrency(preferred);
    currencyPicker.addEventListener('change', () => applyCurrency(currencyPicker.value));
  }

  if (langPicker) {
    const preferred = localStorage.getItem(STORAGE.language) || 'es';
    langPicker.value = preferred;
    applyLanguage(preferred);
    langPicker.addEventListener('change', () => applyLanguage(langPicker.value));
  }

  document.querySelectorAll('.testimonials-carousel').forEach((carousel) => {
    const slides = carousel.querySelectorAll('.testimonial-slide');
    if (!slides.length) return;
    let idx = 0;
    slides[0].classList.add('active');
    setInterval(() => {
      slides[idx].classList.remove('active');
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add('active');
    }, 4500);
  });
})();
