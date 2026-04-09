(function () {
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
})();
