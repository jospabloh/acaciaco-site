/* ACACIA · Analítica ligera (Vercel Web Analytics).
 * Mide vistas por herramienta automáticamente (cada app es su propia URL)
 * y expone window.acaciaTrack(nombre, datos) para eventos personalizados.
 * Requiere activar "Web Analytics" en el panel de Vercel del proyecto.
 */
(function () {
  if (window.__acaciaAnalytics) return;
  window.__acaciaAnalytics = true;
  // Cola de eventos de Vercel + carga del script de insights
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  var s = document.createElement("script");
  s.defer = true;
  s.src = "/_vercel/insights/script.js";
  document.head.appendChild(s);
  // Helper para eventos personalizados (clic en promo, uso de herramienta, etc.)
  window.acaciaTrack = function (name, data) {
    try { window.va("event", { name: name, data: data || {} }); } catch (e) {}
  };

  // Analítica propia (first-party) → ACACIA Mission Control. Un pixel por vista,
  // sin cookies ni datos personales; el servidor sólo guarda la ruta + un hash
  // diario anónimo. Llena los KPIs de Freeware/Sitios en el panel de control.
  try {
    var img = new Image(1, 1);
    img.src = "https://control.acaciaco.com.mx/api/track?p=" +
      encodeURIComponent(location.pathname) +
      "&h=" + encodeURIComponent(location.host) +
      "&r=" + encodeURIComponent(document.referrer || "") +
      "&t=" + Date.now();
  } catch (e) {}
})();
