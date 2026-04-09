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
