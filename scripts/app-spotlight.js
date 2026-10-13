/* ACACIA · "App del mes" spotlight box (homepage #apps).
 *
 * Two jobs:
 *   1. SPOTLIGHT_DATA — the one data map behind the box: for each of the 11
 *      apps, its name, logo, status, one-sentence tagline and 4-5 feature
 *      bullets. The text is a SHORT FORM of what apps/<slug>.html says (hero
 *      lead + the features/capabilities grid). It is duplicated on purpose,
 *      so the box needs no network call. KEEP IT IN SYNC with the app pages:
 *      when a page's claims change, change the bullet here too.
 *      tests/appSpotlight.test.ts guards the structure (all 11 slugs, 4-5
 *      bullets of <= 60 chars, an apps/<slug>.html for each, status equal to
 *      the page's hero eyebrow, banned words).
 *   2. ACACIA_APP_SPOTLIGHT.show(slug, eyebrow) — swaps the box's content
 *      (called by scripts/apps-grid.js once it knows which app leads) and
 *      replays the bullets' staggered entrance. It never moves focus and
 *      announces nothing (no aria-live): the swap is a visual refresh only.
 *
 * The static HTML in index.html already holds the StockFlow default, so the
 * page is complete without JS. This script only ARMS the entrance animation
 * (class "is-armed") once it is running, so a script that fails to load can
 * never leave bullets hidden.
 *
 * Layout shift: every app's tagline and bullets, and the longest eyebrow, are rendered, invisibly and
 * stacked in the same grid cell as the real ones ("ghosts"), so the box is
 * always as tall as the tallest app at the current width and a swap cannot
 * change its height.
 *
 * Only transform/opacity are animated (see styles/home-motion.css) and
 * everything is switched off under prefers-reduced-motion.
 */
(function () {
  'use strict';

  var SPOTLIGHT_DATA = {
    'stockflow': {
      name: 'StockFlow', logo: '/assets/stockflow-logo.png', status: 'live',
      tagline: 'Control de inventario y cotizaciones con trazabilidad de cada movimiento.',
      features: [
        'Inventario en tiempo real con mínimos por producto',
        'Cotizaciones en PDF que se convierten en venta',
        'Historial de entradas, salidas, devoluciones y ajustes',
        'Alertas cuando un producto llega a su mínimo',
        'Caja chica y utilidad real junto al inventario'
      ]
    },
    'flowfin': {
      name: 'FlowFin', logo: '/assets/flowfin-logo.png', status: 'live',
      tagline: 'Finanzas personales y familiares: registra por chat, voz o foto del recibo y tú confirmas.',
      features: [
        'Finia, tu asistente: registra por chat y tú confirmas',
        'Escaneo de recibos y gastos dictados por voz',
        'Presupuestos mensuales por categoría',
        'Metas de ahorro con monto y fecha límite',
        'Cuenta compartida de 1 a 20 miembros, con roles'
      ]
    },
    'cateqhub': {
      name: 'CateqHub', logo: '/assets/cateqhub-logo.png', status: 'live',
      tagline: 'Pase de lista de catequesis: cada niño con su tarjeta QR y la asistencia al instante.',
      features: [
        'Tarjeta QR única por niño, lista para imprimir',
        'Escaneo en segundos desde el teléfono del catequista',
        'Grupos y catequistas con permisos por rol',
        'Directorio de tutores y quién puede recogerlo',
        'Reportes de asistencia por fecha, grupo o parroquia'
      ]
    },
    'puntos-plus': {
      name: 'Puntos+', logo: '/assets/puntosplus-logo.png', status: 'live',
      tagline: 'Programa de lealtad con tarjeta digital: tus clientes suman y canjean, tú ves la actividad en un panel.',
      features: [
        'Puntos y recompensas que tú configuras',
        'Tarjeta digital con código QR, saldo e historial',
        'Pantalla de caja para abonar puntos y procesar canjes',
        'Panel con clientes activos y tasa de canje',
        'Varias tiendas, cada una con sus propias reglas'
      ]
    },
    'liuma': {
      name: 'LIUMA', logo: '/assets/liuma-logo.png', status: 'live',
      tagline: 'Plataforma escolar: avisos, bitácora diaria, asistencia y colegiaturas para el colegio y las familias.',
      features: [
        'Bitácora diaria de cada alumno para su familia',
        'Asistencia diaria y solicitudes de ausencia',
        'Avisos por escuela, salón o alumno, con prioridad',
        'Colegiaturas, cargos, descuentos y saldos vencidos',
        'Lumi, asistente de IA con los datos de tu escuela'
      ]
    },
    'rumbo': {
      name: 'Rumbo', logo: '/assets/rumbo_logo.png', status: 'live',
      tagline: 'Control de flotillas: vehículos, conductores, mantenimiento, combustible y costo por kilómetro.',
      features: [
        'Expediente de cada unidad y conductor con vencimientos',
        'Mantenimiento preventivo y correctivo con próxima fecha',
        'Combustible por carga y costo por kilómetro',
        'Multas, seguros y siniestros en un solo lugar',
        'Ubicación bajo solicitud, sin GPS continuo'
      ]
    },
    'artiskids': {
      name: 'ArtisKids', logo: '/assets/artiskids-logo.jpg', status: 'live',
      tagline: 'La cápsula del tiempo de los dibujos de tus hijos: sube la foto y tu familia comenta y reacciona.',
      features: [
        'Línea de tiempo por fecha y por álbum',
        'Comentarios y reacciones de toda la familia',
        'Los niños no necesitan cuenta ni iniciar sesión',
        '«Un día como hoy»: lo que dibujaron años atrás',
        'Descarga los datos de tu familia cuando quieras'
      ]
    },
    'sommel': {
      name: 'Sommel', logo: '/assets/sommel-logo.jpg', status: 'dev',
      tagline: 'POS para wine bars y cafeterías de especialidad: comandas, cocina y barra, cobro y corte de turno.',
      features: [
        'Comandas desde una tablet o el celular, en la mesa',
        'Cocina y barra ven solo lo suyo, con tiempos de espera',
        'Cobro con varias formas de pago y cuenta dividida',
        'Corte de turno que llega a tu correo',
        'Inventario de botellas e insumos con mermas y conteos'
      ]
    },
    'kitchops': {
      name: 'KitchOps', logo: '/assets/kitchops-logo.png', status: 'dev',
      tagline: 'Gastos de restaurante, cortes de delivery e inventario, con captura por WhatsApp.',
      features: [
        'Gastos con proveedor, categoría y método de pago',
        'Cortes de Rappi, Uber Eats y Didi Food conciliados',
        'Inventario de insumos con alerta de stock bajo',
        'Tu personal manda la foto del ticket por WhatsApp',
        'Dueño y personal, con los permisos que tú defines'
      ]
    },
    'ctrlhq': {
      name: 'CtrlHQ', logo: '/assets/ctrlhq-logo.png', status: 'dev',
      tagline: 'Ingresos, egresos, nómina y consumos de equipo por negocio, con roles para administrador y personal.',
      features: [
        'Ventas con método de pago y total del mes',
        'Egresos con proveedor y estatus de factura',
        'Nómina por colaborador, visible solo al administrador',
        'Consumos del equipo: colaborador, platillo y monto',
        'Descarga los datos de tu negocio en JSON cuando quieras'
      ]
    },
    'radar': {
      name: 'RADAR', logo: null, status: 'dev',
      tagline: 'Checador de asistencia desde el navegador, con aprobaciones, turnos y analítica por empleado.',
      features: [
        'Entrada y salida con un botón, sin instalar nada',
        'Vacaciones y permisos aprobados desde un mismo panel',
        'Turnos y horarios semanales por empleado',
        'Ausencias marcadas y jornadas cerradas automáticamente',
        'Analítica de tardanzas y ausencias por empleado'
      ]
    }
  };

  var api = { data: SPOTLIGHT_DATA, show: function () {} };
  if (typeof window !== 'undefined') window.ACACIA_APP_SPOTLIGHT = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var box = null;
  var seen = false;       // the box has scrolled into view at least once
  var current = null;     // slug currently shown

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // RADAR has no raster logo; this is the same inline mark its homepage card uses.
  function radarMark() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '56');
    svg.setAttribute('height', '56');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    function add(name, attrs) {
      var n = document.createElementNS(SVG_NS, name);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      svg.appendChild(n);
    }
    add('circle', { cx: 24, cy: 24, r: 20, stroke: 'currentColor', 'stroke-width': 1.5, opacity: 0.25 });
    add('circle', { cx: 24, cy: 24, r: 13, stroke: 'currentColor', 'stroke-width': 1.5, opacity: 0.4 });
    add('circle', { cx: 24, cy: 24, r: 6, stroke: 'currentColor', 'stroke-width': 1.5, opacity: 0.6 });
    add('path', { d: 'M24 24 L24 4 A20 20 0 0 1 41.3 14 Z', fill: 'currentColor', opacity: 0.35 });
    add('circle', { cx: 24, cy: 24, r: 2.2, fill: 'currentColor' });
    add('circle', { cx: 33, cy: 16, r: 2, fill: 'currentColor' });
    return svg;
  }

  function q(sel) { return box.querySelector(sel); }

  function fillList(ul, features) {
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    features.forEach(function (text, i) {
      var li = el('li', 'spot-feat', text);
      li.style.setProperty('--i', i);
      ul.appendChild(li);
    });
  }

  // Replays the entrance: drop .is-in, force a reflow so the animation
  // restarts, then add it back. Only when the box is already in view; if it
  // has not been seen yet the IntersectionObserver plays it on arrival.
  function replay() {
    box.classList.remove('is-in');
    void box.offsetWidth;
    if (seen) box.classList.add('is-in');
  }

  function show(slug, eyebrow) {
    // Own keys only: a server-provided "constructor" must not resolve.
    if (typeof slug !== 'string' || !Object.prototype.hasOwnProperty.call(SPOTLIGHT_DATA, slug)) return;
    var d = SPOTLIGHT_DATA[slug];
    if (!box || !d) return;
    var eb = q('[data-spot="eyebrow"]');
    if (eb && typeof eyebrow === 'string' && eyebrow) eb.textContent = eyebrow;
    if (slug === current) return;
    current = slug;

    box.setAttribute('data-spot-slug', slug);
    q('[data-spot="name"]').textContent = d.name;
    q('[data-spot="tagline"]').textContent = d.tagline;

    var badge = q('[data-spot="badge"]');
    badge.className = 'badge ' + (d.status === 'live' ? 'available' : 'dev');
    badge.textContent = d.status === 'live' ? 'Disponible' : 'En desarrollo';

    var logo = q('[data-spot="logo"]');
    while (logo.firstChild) logo.removeChild(logo.firstChild);
    if (d.logo) {
      var img = el('img');
      img.src = d.logo;
      img.alt = d.name;
      img.width = 56;
      img.height = 56;
      logo.appendChild(img);
    } else {
      logo.appendChild(radarMark());
    }

    q('[data-spot="trial"]').setAttribute('href', '/trial#' + slug);
    q('[data-spot="more"]').setAttribute('href', '/apps/' + slug);
    q('[data-spot="more"]').setAttribute('aria-label', 'Conocer más sobre ' + d.name);
    fillList(q('[data-spot="features"]'), d.features);
    replay();
  }
  api.show = show;

  // Invisible copies of every app's text, stacked in the same grid cell as the
  // real text, so the box always has the height of the tallest one.
  function buildGhosts() {
    // The longest eyebrow either label can produce ("septiembre" is the longest
    // month), so a late swap of the eyebrow never adds a line on narrow screens.
    var ebCell = q('.spot-eyebrow-cell');
    if (ebCell) {
      var g = el('span', 'spot-ghost', 'App del mes · la más visitada de septiembre 2026');
      g.setAttribute('aria-hidden', 'true');
      ebCell.appendChild(g);
    }
    var tagCell = q('.spot-tagline-cell');
    var listCell = q('.spot-list-cell');
    if (!tagCell || !listCell) return;
    Object.keys(SPOTLIGHT_DATA).forEach(function (slug) {
      var d = SPOTLIGHT_DATA[slug];
      var p = el('p', 'spot-tagline spot-ghost', d.tagline);
      p.setAttribute('aria-hidden', 'true');
      tagCell.appendChild(p);
      var ul = el('ul', 'spot-list spot-ghost');
      ul.setAttribute('aria-hidden', 'true');
      d.features.forEach(function (f) { ul.appendChild(el('li', 'spot-feat', f)); });
      listCell.appendChild(ul);
    });
  }

  function init() {
    box = document.getElementById('app-del-mes');
    if (!box) return;
    current = box.getAttribute('data-spot-slug');
    buildGhosts();
    box.classList.add('is-armed');
    if (!('IntersectionObserver' in window)) { seen = true; box.classList.add('is-in'); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        seen = true;
        box.classList.add('is-in');
        io.disconnect();
      });
    }, { threshold: 0.3 });
    io.observe(box);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
