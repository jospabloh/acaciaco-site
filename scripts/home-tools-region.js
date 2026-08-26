/* ACACIA · Home — Top 6 herramientas por región.
 * Por defecto el HTML muestra el set para México (incluye finiquito y sueldo/ISR,
 * que solo aplican a la LFT mexicana). Si detectamos que el visitante NO está en
 * México, cambiamos esas 2 tarjetas por 2 universales (contraseñas y OCR).
 * Detección por zona horaria (sin backend, sin pedir permisos). SEO intacto:
 * Googlebot y quien no tenga JS ven el set por defecto.
 */
(function () {
  var MX_TZ = [
    "America/Mexico_City", "America/Monterrey", "America/Merida", "America/Cancun",
    "America/Tijuana", "America/Hermosillo", "America/Mazatlan", "America/Chihuahua",
    "America/Matamoros", "America/Ojinaga", "America/Bahia_Banderas"
  ];
  var tz = "";
  try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || ""; } catch (e) {}
  var langMX = (navigator.language || "").toLowerCase() === "es-mx";
  // Solo afirmamos "no es México" cuando la zona horaria lo dice con certeza;
  // sin zona horaria conocida, tratamos al visitante como México (el set por
  // defecto) — misma condición que antes, sólo nombrada.
  var isNonMX = !!tz && !langMX && MX_TZ.indexOf(tz) === -1;

  var MX_ONLY_SUBSTITUTES = {
    "calculadora-finiquito": "generador-contrasenas",
    "sueldo-neto": "extraer-texto-imagen"
  };
  // Expuesto para scripts/apps-grid.js's intercambio de #gratis por visitas
  // reales (ver el comentario en ese archivo): necesita saber qué slugs no
  // aplican fuera de México (finiquito/ISR son LFT/SAT), para que un rebuild
  // posterior por visitas nunca los reintroduzca a quien ya se determinó que
  // no es de México. Siempre queda definido; vacío si es México o desconocido.
  window.ACACIA_NON_MX_VISITOR = isNonMX;
  window.ACACIA_MX_ONLY_SUBSTITUTES = isNonMX ? MX_ONLY_SUBSTITUTES : {};

  if (!isNonMX) return; // es México o desconocido → dejamos el set por defecto

  function card(slug, alt, title, desc) {
    return '<a href="/freeware/' + slug + '" class="app-card">' +
      '<div class="head"><div class="logo"><img src="/freeware/' + slug + '/favicon.svg" alt="' + alt + '" width="40" height="40" /></div>' +
      '<span class="badge available">Gratis</span></div>' +
      '<h3>' + title + '</h3><p>' + desc + '</p>' +
      '<span class="more">Abrir gratis →</span></a>';
  }
  var replacements = {
    "/freeware/calculadora-finiquito": card("generador-contrasenas", "Generador de contraseñas", "Generador de contraseñas", "Crea contraseñas seguras o frases fáciles de recordar, con medidor de fortaleza. Nada se guarda."),
    "/freeware/sueldo-neto": card("extraer-texto-imagen", "Extraer texto de imagen", "Extraer texto de imagen (OCR)", "Convierte una foto, captura o escaneo en texto editable. El OCR corre en tu navegador.")
  };

  function run() {
    var grid = document.querySelector("#gratis .apps-grid");
    if (!grid) return;
    var cards = grid.querySelectorAll("a.app-card");
    for (var i = 0; i < cards.length; i++) {
      var href = cards[i].getAttribute("href");
      if (replacements[href]) cards[i].outerHTML = replacements[href];
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
