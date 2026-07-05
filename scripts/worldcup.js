/* =========================================================================
   ACACIA · Módulo Mundial 2026
   Marcador en vivo + calendario (hoy / semana / completo / eliminatorias)
   que aparece SOLO durante el torneo y celebra al campeón 3 días al final.
   Datos: openfootball (dominio público) vía /api/worldcup, con respaldo
   directo al archivo público si el proxy falla. Sin dependencias.
   ========================================================================= */
(function () {
  'use strict';

  // ---- Configuración del torneo -----------------------------------------
  var CFG = {
    start: Date.UTC(2026, 5, 11, 0, 0),        // 11 jun 2026 (apertura)
    finalDate: Date.UTC(2026, 6, 19, 0, 0),    // 19 jul 2026 (final)
    celebrateDays: 3,                          // días de festejo al campeón
    liveWindowMin: 150,                        // ventana "en vivo" por partido (cubre tiempos extra/penales)
    cdmxOffset: -6,                            // CDMX = UTC-6 todo el año
    apiUrl: '/api/worldcup',
    fallbackUrl: 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
    dismissKey: 'acacia-mundial-dismissed'
  };

  // ---- País → código de bandera (flagcdn) + nombre en español -----------
  var TEAM = {
    'Algeria': ['dz', 'Argelia'], 'Argentina': ['ar', 'Argentina'], 'Australia': ['au', 'Australia'],
    'Austria': ['at', 'Austria'], 'Belgium': ['be', 'Bélgica'], 'Bosnia & Herzegovina': ['ba', 'Bosnia y Herzegovina'],
    'Brazil': ['br', 'Brasil'], 'Canada': ['ca', 'Canadá'], 'Cape Verde': ['cv', 'Cabo Verde'],
    'Colombia': ['co', 'Colombia'], 'Croatia': ['hr', 'Croacia'], 'Curaçao': ['cw', 'Curazao'],
    'Czech Republic': ['cz', 'Chequia'], 'DR Congo': ['cd', 'RD Congo'], 'Ecuador': ['ec', 'Ecuador'],
    'Egypt': ['eg', 'Egipto'], 'England': ['gb-eng', 'Inglaterra'], 'France': ['fr', 'Francia'],
    'Germany': ['de', 'Alemania'], 'Ghana': ['gh', 'Ghana'], 'Haiti': ['ht', 'Haití'],
    'Iran': ['ir', 'Irán'], 'Iraq': ['iq', 'Irak'], 'Ivory Coast': ['ci', 'Costa de Marfil'],
    'Japan': ['jp', 'Japón'], 'Jordan': ['jo', 'Jordania'], 'Mexico': ['mx', 'México'],
    'Morocco': ['ma', 'Marruecos'], 'Netherlands': ['nl', 'Países Bajos'], 'New Zealand': ['nz', 'Nueva Zelanda'],
    'Norway': ['no', 'Noruega'], 'Panama': ['pa', 'Panamá'], 'Paraguay': ['py', 'Paraguay'],
    'Portugal': ['pt', 'Portugal'], 'Qatar': ['qa', 'Catar'], 'Saudi Arabia': ['sa', 'Arabia Saudita'],
    'Scotland': ['gb-sct', 'Escocia'], 'Senegal': ['sn', 'Senegal'], 'South Africa': ['za', 'Sudáfrica'],
    'South Korea': ['kr', 'Corea del Sur'], 'Spain': ['es', 'España'], 'Sweden': ['se', 'Suecia'],
    'Switzerland': ['ch', 'Suiza'], 'Tunisia': ['tn', 'Túnez'], 'Turkey': ['tr', 'Turquía'],
    'USA': ['us', 'Estados Unidos'], 'Uruguay': ['uy', 'Uruguay'], 'Uzbekistan': ['uz', 'Uzbekistán']
  };

  // ---- Sedes: ciudad en español + país ----------------------------------
  var GROUND = {
    'Mexico City': ['Ciudad de México', 'mx'], 'Monterrey (Guadalupe)': ['Monterrey', 'mx'],
    'Guadalajara (Zapopan)': ['Guadalajara', 'mx'], 'Toronto': ['Toronto', 'ca'], 'Vancouver': ['Vancouver', 'ca'],
    'Atlanta': ['Atlanta', 'us'], 'Boston (Foxborough)': ['Boston', 'us'], 'Dallas (Arlington)': ['Dallas', 'us'],
    'Houston': ['Houston', 'us'], 'Kansas City': ['Kansas City', 'us'], 'Los Angeles (Inglewood)': ['Los Ángeles', 'us'],
    'Miami (Miami Gardens)': ['Miami', 'us'], 'New York/New Jersey (East Rutherford)': ['Nueva York', 'us'],
    'Philadelphia': ['Filadelfia', 'us'], 'San Francisco Bay Area (Santa Clara)': ['San Francisco', 'us'],
    'Seattle': ['Seattle', 'us']
  };

  var ROUND_ES = {
    'Round of 32': 'Dieciseisavos', 'Round of 16': 'Octavos', 'Quarter-final': 'Cuartos',
    'Semi-final': 'Semifinal', 'Match for third place': 'Tercer lugar', 'Final': 'Final'
  };
  var KO_ORDER = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Match for third place', 'Final'];

  // ---- Color de playera (kit local) por selección -----------------------
  var JERSEY = {
    'Mexico': '#0a7d4b', 'Argentina': '#75aadb', 'Brazil': '#f7d716', 'USA': '#2a3f73',
    'Canada': '#e01b2e', 'France': '#27406e', 'England': '#dfe5ee', 'Spain': '#d3242b',
    'Germany': '#e9e9e9', 'Portugal': '#c8102e', 'Netherlands': '#ff6a13', 'Belgium': '#d4202a',
    'Croatia': '#e7252f', 'Uruguay': '#5fa3e0', 'Colombia': '#fcd116', 'Japan': '#2540a8',
    'South Korea': '#d4202a', 'Morocco': '#c1272d', 'Senegal': '#1aa04b', 'Switzerland': '#df2b2b',
    'Saudi Arabia': '#1f9c52', 'Egypt': '#d4202a', 'Norway': '#cf2741', 'Australia': '#f6c500',
    'Austria': '#ef3b3b', 'Ecuador': '#ffd100', 'Scotland': '#2a4a9c', 'Iran': '#dd2b1c',
    'Paraguay': '#d4202a', 'Sweden': '#ffce32', 'Tunisia': '#e10f2a', 'Ghana': '#0c8a4b',
    'Panama': '#d72437', 'Curaçao': '#1f6fd1', 'Czech Republic': '#dd2533', 'Cape Verde': '#1f56b5',
    'DR Congo': '#2ea0ff', 'Ivory Coast': '#ff8a1e', 'New Zealand': '#e8e8e8', 'Qatar': '#9c2150',
    'Iraq': '#2fae6a', 'Jordan': '#d4202a', 'Algeria': '#1aa04b', 'Haiti': '#1f48c4',
    'Bosnia & Herzegovina': '#2a52b0', 'Turkey': '#e30a17', 'Uzbekistan': '#27b657'
  };
  // paleta de respaldo si dos favoritos comparten color o no hay kit definido
  var FALLBACK_COLORS = ['#e8c468', '#36d07e', '#ff6a3d', '#7aa2ff', '#ff5d8f', '#c792ea'];

  // ---- Estadios (nombre · ciudad · aforo · dato curioso) ----------------
  var STADIUM = {
    'Mexico City': ['Estadio Azteca', 'Ciudad de México', '87,000', 'Único estadio en albergar partidos de tres Copas del Mundo (1970, 1986 y 2026) y dos finales en su mismo césped.'],
    'Guadalajara (Zapopan)': ['Estadio Akron', 'Guadalajara', '48,000', 'Casa de las Chivas e inaugurado en 2010, es uno de los estadios más modernos de México.'],
    'Monterrey (Guadalupe)': ['Estadio BBVA', 'Monterrey', '53,500', 'Apodado “El Gigante de Acero”, tiene una postal única del Cerro de la Silla detrás de una portería.'],
    'Toronto': ['BMO Field', 'Toronto', '45,000', 'Ampliado especialmente para el Mundial; una de las dos sedes de Canadá.'],
    'Vancouver': ['BC Place', 'Vancouver', '54,500', 'Presume uno de los techos retráctiles de tela más grandes del mundo.'],
    'Atlanta': ['Mercedes-Benz Stadium', 'Atlanta', '71,000', 'Su techo retráctil tiene ocho “pétalos” que se abren como el obturador de una cámara.'],
    'Boston (Foxborough)': ['Gillette Stadium', 'Foxborough', '65,000', 'Casa de los New England Patriots de la NFL.'],
    'Dallas (Arlington)': ['AT&T Stadium', 'Arlington', '80,000', 'Tiene una de las pantallas colgantes más grandes del mundo y techo retráctil.'],
    'Houston': ['NRG Stadium', 'Houston', '72,000', 'Fue el primer estadio de la NFL con techo retráctil.'],
    'Kansas City': ['Arrowhead Stadium', 'Kansas City', '73,000', 'Récord Guinness al estadio más ruidoso del mundo: 142.2 decibeles.'],
    'Los Angeles (Inglewood)': ['SoFi Stadium', 'Inglewood', '69,650', 'El estadio más caro jamás construido (~5,500 mdd), con su pantalla “Infinity” de doble cara.'],
    'Miami (Miami Gardens)': ['Hard Rock Stadium', 'Miami Gardens', '65,000', 'Sede del Gran Premio de Miami de Fórmula 1 y del Miami Open.'],
    'New York/New Jersey (East Rutherford)': ['MetLife Stadium', 'East Rutherford', '82,500', 'El estadio más grande del torneo: aquí se juega la GRAN FINAL el 19 de julio.'],
    'Philadelphia': ['Lincoln Financial Field', 'Filadelfia', '69,000', 'Casa de los Philadelphia Eagles, conocido como “The Linc”.'],
    'San Francisco Bay Area (Santa Clara)': ['Levi’s Stadium', 'Santa Clara', '68,500', 'Uno de los estadios más sustentables de EE. UU., con paneles solares y techo verde.'],
    'Seattle': ['Lumen Field', 'Seattle', '69,000', 'Diseñado para atrapar el ruido: de los ambientes más intensos del fútbol en EE. UU.']
  };

  // ---- Estado de favoritos (persistente) --------------------------------
  var FAVKEY = 'acacia-mundial-favs';
  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAVKEY) || '[]').slice(0, 2); } catch (e) { return []; }
  }
  function setFavs(arr) { try { localStorage.setItem(FAVKEY, JSON.stringify(arr.slice(0, 2))); } catch (e) {} }
  var favColor = {}; // teamName(EN) -> color asignado (recalculado en cada render)
  var byIndex = {};  // i original -> partido normalizado (para el modal)
  var lastData = null, lastHost = null, lastOpts = null; // para re-render al cambiar favoritos
  var LIVE_NOW = false; // ¿hay algún partido en vivo? → sondeo más rápido

  // asigna color de playera a cada favorito; evita choque de colores iguales
  function computeFavColors(favs) {
    favColor = {};
    var used = {};
    favs.filter(Boolean).forEach(function (en, idx) {
      var c = JERSEY[en];
      if (!c || used[c.toLowerCase()]) c = FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
      used[c.toLowerCase()] = 1;
      favColor[en] = c;
    });
  }

  // ---- Promos de apps ACACIA (guiño futbolero, rotan) -------------------
  var APP_PROMOS = [
    { id: 'stockflow', href: '/apps/stockflow', tag: 'StockFlow', color: 'oklch(0.70 0.13 205)',
      h: 'Controla tu inventario como una defensa sólida: nada se te escapa.', cta: 'Ordena tu operación' },
    { id: 'flowfin', href: '/apps/flowfin', tag: 'FlowFin', color: 'oklch(0.72 0.14 152)',
      h: 'Que tus finanzas lleguen a la final sin penales en contra.', cta: 'Toma el control' },
    { id: 'puntos', href: '/apps/puntos-plus', tag: 'Puntos+', color: 'oklch(0.76 0.14 75)',
      h: 'Premia a tu afición: haz que tus clientes regresen cada jornada.', cta: 'Fideliza más' },
    { id: 'liuma', href: '/apps/liuma', tag: 'LIUMA', color: 'oklch(0.70 0.16 292)',
      h: 'El colegio que juega en equipo: familias, maestros y dirección en sintonía.', cta: 'Conoce LIUMA' },
    { id: 'rumbo', href: '/apps/rumbo', tag: 'Rumbo', color: 'oklch(0.70 0.14 255)',
      h: 'Dirige tu flotilla como un capitán: cada vehículo, con rumbo fijo.', cta: 'Mueve tu flota' }
  ];
  var promoOrder = APP_PROMOS.slice().sort(function () { return Math.random() - 0.5; });
  var bannerIdx = 0, bannerTimer = null;

  function promoCard(p, variant) {
    return '<a class="wc-promo' + (variant ? ' ' + variant : '') + '" style="--app:' + p.color + '"' +
      ' href="' + p.href + '" data-wc-promo="' + p.id + '">' +
      '<span class="wc-promo-spon"><span class="wc-ball">⚽</span> Patrocinado por ACACIA</span>' +
      '<span class="wc-promo-main"><span class="wc-promo-tag">' + esc(p.tag) + '</span>' +
        '<span class="wc-promo-h">' + esc(p.h) + '</span></span>' +
      '<span class="wc-promo-cta">' + esc(p.cta) + ' →</span></a>';
  }

  function startBannerRotation(host) {
    if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    bannerTimer = setInterval(function () {
      if (host.hidden) return;
      var slot = host.querySelector('[data-wc-sponsor]');
      if (!slot) { clearInterval(bannerTimer); bannerTimer = null; return; }
      bannerIdx = (bannerIdx + 1) % promoOrder.length;
      slot.classList.add('swap');
      setTimeout(function () { slot.innerHTML = promoCard(promoOrder[bannerIdx], 'is-banner'); slot.classList.remove('swap'); }, 220);
    }, 9000);
  }

  // ---- Utilidades -------------------------------------------------------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // "2026-06-24" + "19:00 UTC-6"  →  Date (UTC real)
  function parseStart(dateStr, timeStr) {
    var d = dateStr.split('-');
    var m = /(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/.exec(timeStr || '00:00 UTC+0');
    if (!m) return null;
    var hh = +m[1], mm = +m[2], off = +m[3];
    var baseUTC = Date.UTC(+d[0], +d[1] - 1, +d[2], hh, mm);
    return new Date(baseUTC - off * 3600000); // UTC real = pared − offset
  }

  // clave de día calendario en CDMX (offset fijo −6)
  function cdmxKey(date) {
    var t = new Date(date.getTime() + CFG.cdmxOffset * 3600000);
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }
  function fmtTime(date) {
    var t = new Date(date.getTime() + CFG.cdmxOffset * 3600000);
    var h = t.getUTCHours(), m = t.getUTCMinutes();
    var ap = h >= 12 ? 'p.m.' : 'a.m.', h12 = h % 12 || 12;
    return h12 + ':' + pad(m) + ' ' + ap;
  }
  var DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fmtDayLabel(key) {
    var p = key.split('-'); var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return DOW[dt.getUTCDay()] + ' ' + (+p[2]) + ' ' + MON[+p[1] - 1];
  }
  // versión compacta de una sola línea para el cuadro: "19 jul"
  function fmtShort(key) { var p = key.split('-'); return (+p[2]) + ' ' + MON[+p[1] - 1]; }
  function flagURL(code, w) { return 'https://flagcdn.com/' + (w || 'w40') + '/' + code + '.png'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Emojis del texto que se comparte (WhatsApp, calendario, .ics), escritos con
  // escapes Unicode: así son ASCII en el archivo y llegan intactos aunque el
  // servidor entregue el .js con otra codificación. Se evitan banderas de país
  // (🇲🇽), que Windows/WhatsApp Web y varios Android no dibujan y muestran como
  // cajitas o «�»; usamos emojis con soporte universal.
  var EMO = {
    ball: '\u26BD',        // ⚽
    cal: '\u{1F4C5}',      // 📅
    pin: '\u{1F4CD}',      // 📍
    point: '\u{1F449}',    // 👉
    pop: '\u{1F37F}',      // 🍿
    tv: '\u{1F4FA}',       // 📺
    party: '\u{1F389}',    // 🎉
    hands: '\u{1F91D}',    // 🤝
    trophy: '\u{1F3C6}'    // 🏆
  };

  // ¿El dispositivo abrirá WhatsApp MÓVIL? Solo ahí ponemos emojis en el texto
  // que se comparte: WhatsApp de ESCRITORIO corrompe los emojis que llegan por
  // un enlace wa.me (los muestra como «□»), mientras que la app móvil los
  // muestra bien. En escritorio compartimos texto limpio para no romper nada.
  var IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(
    (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  );

  // ---- Normalización ----------------------------------------------------
  function norm(raw, now) {
    var out = [];
    (raw.matches || []).forEach(function (m, i) {
      var start = parseStart(m.date, m.time);
      if (!start) return;
      var ft = m.score && m.score.ft ? m.score.ft : null;
      var et = m.score && m.score.et ? m.score.et : null; // tiempo extra
      var pen = m.score && m.score.p ? m.score.p : null;
      // Marcador EN JUEGO inyectado por el proxy (capa en vivo).
      var liveInfo = (m.live && m.live.state === 'in' && m.live.score) ? m.live : null;
      var status = ft ? 'ft'
        : liveInfo ? 'live'
        : (now >= start.getTime() && now < start.getTime() + CFG.liveWindowMin * 60000 ? 'live' : 'soon');
      var winner = 0; // 0 empate/sin definir, 1 ó 2
      if (ft) {
        // El ganador se decide, en orden: 90', tiempo extra y penales. En
        // eliminatoria un empate en ft puede resolverse en et (sin penales),
        // así que hay que mirar et antes de declarar empate.
        if (ft[0] > ft[1]) winner = 1; else if (ft[1] > ft[0]) winner = 2;
        else if (et && et[0] !== et[1]) winner = et[0] > et[1] ? 1 : 2;
        else if (pen) winner = pen[0] > pen[1] ? 1 : (pen[1] > pen[0] ? 2 : 0);
      }
      out.push({
        i: i, num: m.num, round: m.round, group: m.group || '', stage: ROUND_ES[m.round] || m.group || m.round,
        isKO: KO_ORDER.indexOf(m.round) >= 0,
        t1: m.team1, t2: m.team2, start: start, key: cdmxKey(start),
        ft: ft, et: et, pen: pen, status: status, winner: winner, ground: m.ground || '',
        live: liveInfo, g1: m.goals1 || [], g2: m.goals2 || []
      });
    });
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }

  function teamMeta(name) {
    var info = TEAM[name];
    return info ? { name: info[1], code: info[0], ph: false } : { name: name, code: null, ph: true };
  }

  // Describe cómo se ganó un partido ya finalizado: en los 90', en tiempo extra
  // o en penales. Así un cruce definido en et/penales conserva su historia real
  // en vez de mostrarse como empate.
  function winLine(mm) {
    if (!mm.ft) return '';
    var hi = Math.max(mm.ft[0], mm.ft[1]), lo = Math.min(mm.ft[0], mm.ft[1]);
    if (mm.pen) return 'Victoria en penales ' + Math.max(mm.pen[0], mm.pen[1]) + '–' + Math.min(mm.pen[0], mm.pen[1]) +
      ' (' + mm.ft[0] + '–' + mm.ft[1] + ' en el tiempo reglamentario)';
    if (mm.et && mm.et[0] !== mm.et[1]) return 'Victoria ' + Math.max(mm.et[0], mm.et[1]) + '–' + Math.min(mm.et[0], mm.et[1]) + ' en tiempo extra';
    return 'Victoria ' + hi + '–' + lo;
  }

  // ---- Plantillas HTML --------------------------------------------------
  function flagCell(meta, big) {
    if (meta.ph) return '<span class="wc-flag ph">' + esc(meta.name.length > 4 ? '·' : meta.name) + '</span>';
    return '<img class="wc-flag" loading="lazy" width="' + (big ? 30 : 26) + '" height="' + (big ? 20 : 18) +
      '" src="' + flagURL(meta.code, big ? 'w80' : 'w40') + '" alt="Bandera de ' + esc(meta.name) + '">';
  }

  // Bandera del país sede como imagen (flagcdn), no como emoji: las banderas de
  // país en emoji no se dibujan en Windows/escritorio y salían como cajitas.
  function venueFlag(code) {
    return code ? '<img class="wc-venue-flag" loading="lazy" width="16" height="11" src="' +
      flagURL(code, 'w40') + '" alt="">' : '';
  }

  function starFor(enName) {
    var c = favColor[enName];
    return c ? ' <span class="wc-star" style="--star:' + c + '" title="Tu favorito">★</span>' : '';
  }

  function matchCard(mm) {
    var a = teamMeta(mm.t1), b = teamMeta(mm.t2);
    var fav = favColor[mm.t1] || favColor[mm.t2] || '';
    var favCls = fav ? ' has-fav' : '';
    var favStyle = fav ? ' style="--fav:' + fav + '"' : '';
    var g = GROUND[mm.ground] || [mm.ground, ''];
    var liveDetail = mm.live && mm.live.detail ? ' ' + esc(mm.live.detail) : '';
    var badge = mm.status === 'live' ? '<span class="wc-badge live">EN VIVO' + liveDetail + '</span>'
      : mm.status === 'ft' ? '<span class="wc-badge ft">Final</span>'
      : '<span class="wc-badge soon">' + fmtTime(mm.start) + '</span>';
    var s1, s2, cls1 = '', cls2 = '', note = '';
    if (mm.status === 'ft') {
      s1 = '<span class="wc-score">' + mm.ft[0] + '</span>';
      s2 = '<span class="wc-score">' + mm.ft[1] + '</span>';
      if (mm.winner === 1) cls1 = ' win'; else if (mm.winner === 2) cls2 = ' win';
      if (mm.winner === 0) note = '<p class="wc-result-note draw">Empate ' + mm.ft[0] + '–' + mm.ft[1] + '. ¡Bien jugado por ambos!</p>';
      else {
        var w = mm.winner === 1 ? a : b;
        note = '<p class="wc-result-note">🏆 ¡Felicidades, ' + esc(w.name) + '! ' + winLine(mm) + '.</p>';
      }
    } else if (mm.live) {
      // marcador en juego (no decide ganador hasta el final)
      s1 = '<span class="wc-score live">' + mm.live.score[0] + '</span>';
      s2 = '<span class="wc-score live">' + mm.live.score[1] + '</span>';
      if (mm.live.score[0] > mm.live.score[1]) cls1 = ' lead'; else if (mm.live.score[1] > mm.live.score[0]) cls2 = ' lead';
    } else {
      s1 = '<span class="wc-score tbd">' + (mm.status === 'live' ? '·' : '') + '</span>';
      s2 = '<span class="wc-score tbd">' + (mm.status === 'live' ? '·' : '') + '</span>';
    }
    return '<article class="wc-match' + (mm.status === 'live' ? ' is-live' : '') + favCls + '"' + favStyle +
      ' data-wc-open="' + mm.i + '" role="button" tabindex="0" aria-label="Ver detalle del partido ' + esc(a.name) + ' contra ' + esc(b.name) + '">' +
      '<div class="wc-match-top"><span class="wc-tag">' + esc(mm.group || mm.stage) + '</span>' + badge + '</div>' +
      '<div>' +
        '<div class="wc-row' + cls1 + '">' + flagCell(a) + '<span class="wc-team' + (a.ph ? ' ph' : '') + '">' + esc(a.name) + starFor(mm.t1) + '</span>' + s1 + '</div>' +
        '<div class="wc-row' + cls2 + '">' + flagCell(b) + '<span class="wc-team' + (b.ph ? ' ph' : '') + '">' + esc(b.name) + starFor(mm.t2) + '</span>' + s2 + '</div>' +
        note +
      '</div>' +
      '<div class="wc-match-foot"><span class="wc-when">' + (mm.status === 'ft' ? 'Finalizado · toca para ver' : fmtTime(mm.start) + ' h · centro de México') + '</span>' +
        '<span class="wc-venue">' + esc(g[0]) + venueFlag(g[1]) + '</span></div>' +
      '</article>';
  }

  function listByDay(matches, emptyMsg, withPromos) {
    if (!matches.length) return '<div class="wc-empty"><span class="wc-ball">⚽</span>' + emptyMsg + '</div>';
    var days = {}, order = [];
    matches.forEach(function (m) { if (!days[m.key]) { days[m.key] = []; order.push(m.key); } days[m.key].push(m); });
    var blocks = order.map(function (k) {
      return '<div class="wc-daygroup"><div class="wc-dayhead">' + fmtDayLabel(k) +
        ' <small>' + days[k].length + (days[k].length === 1 ? ' partido' : ' partidos') + '</small></div>' +
        '<div class="wc-grid">' + days[k].map(matchCard).join('') + '</div></div>';
    });
    if (!withPromos) return blocks.join('');
    // intercala una promo de app cada dos días (nunca después del último bloque)
    var out = [], pc = 0;
    blocks.forEach(function (b, idx) {
      out.push(b);
      if ((idx + 1) % 2 === 0 && idx < blocks.length - 1) {
        out.push(promoCard(promoOrder[pc % promoOrder.length], 'is-feed'));
        pc++;
      }
    });
    return out.join('');
  }

  // ---- Eliminatorias: cuadro simétrico "camino a la final" --------------
  // Los partidos de eliminación traen team1/team2 como "W99"/"L101" hasta
  // que se definen (ganador/perdedor del partido 99/101). Los mostramos
  // legibles y rotulamos cada cruce con su código FIFA: W73, W74, … W104.
  var bracketEdges = []; // [ [numOrigen, numDestino], … ] para las líneas SVG
  // Camino del favorito: del cruce donde entra (dieciseisavos) hasta la final.
  var favPathNum = {};   // nº de cruce  -> color del camino del favorito
  var favPathEdge = {};  // "origen>destino" -> color (para pintar esa llave)
  var favPaths = [];     // [{ en, name, color, path:[nums] }] para la leyenda

  var koMap = {}; // nº de cruce -> partido, para resolver ganadores ya definidos
  var koFeed = {}; // nº de cruce -> [alimentador1, alimentador2] (nº de cruce previo)
  function koFeeder(token) { var m = /^([WL])(\d+)$/.exec(token || ''); return m ? +m[2] : null; }

  // Ronda que alimenta a cada ronda (para reconstruir aristas del cuadro).
  var FEED_ROUND = {
    'Round of 16': 'Round of 32', 'Quarter-final': 'Round of 16',
    'Semi-final': 'Quarter-final', 'Final': 'Semi-final', 'Match for third place': 'Semi-final'
  };

  // Alimentador de un lado del cruce. Dos casos:
  //  · el slot trae un código (W83/L101) → el alimentador es ese número.
  //  · el slot ya trae el equipo resuelto (openfootball "mueve" al ganador en
  //    cuanto se juega) → buscamos en la ronda anterior el cruce que ese equipo
  //    ganó y reconstruimos la arista. Sin esto, los cruces cuyos ganadores ya
  //    avanzaron desaparecían del cuadro (se veía incompleto y descuadrado).
  function feederFor(m, token, byRound) {
    var wl = /^([WL])(\d+)$/.exec(token || '');
    if (wl) return +wl[2];
    var fr = FEED_ROUND[m.round];
    if (!fr) return null; // dieciseisavos: entran equipos de grupo, no hay alimentador
    var cands = byRound[fr] || [];
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c.num == null || c.num >= m.num || !c.ft || !c.winner) continue;
      var wTok = koResolveToken(c.winner === 1 ? c.t1 : c.t2, 0);
      if (wTok === token) return c.num;
    }
    return null;
  }
  function computeFeeders(ko) {
    koFeed = {};
    var byRound = {};
    ko.forEach(function (m) { (byRound[m.round] = byRound[m.round] || []).push(m); });
    ko.forEach(function (m) {
      if (m.num == null) return;
      koFeed[m.num] = [feederFor(m, m.t1, byRound), feederFor(m, m.t2, byRound)];
    });
  }
  function feedOf(num, side) { return koFeed[num] ? koFeed[num][side] : null; }
  // Si el cruce alimentador ya terminó, devuelve el token del equipo concreto
  // (ganador o perdedor); resuelve en cadena por si ese alimentador era otro W##.
  function koResolveToken(token, depth) {
    var m = /^([WL])(\d+)$/.exec(token || '');
    if (!m) return token;                       // ya es un equipo (o placeholder de grupo)
    if (depth > 8) return null;                 // tope de seguridad
    var match = koMap[+m[2]];
    if (!match || !match.ft || !match.winner) return null; // aún sin definir
    var side = (m[1] === 'W') ? match.winner : (match.winner === 1 ? 2 : 1);
    return koResolveToken(side === 1 ? match.t1 : match.t2, (depth || 0) + 1);
  }
  function koSlot(token) {
    var m = /^([WL])(\d+)$/.exec(token || '');
    if (m) {
      var resolved = koResolveToken(token, 0);
      if (resolved && !/^[WL]\d+$/.test(resolved)) {
        var rm = teamMeta(resolved);
        return { ph: rm.ph, placeholder: false, kind: 'team', code: rm.code, name: rm.name };
      }
      return {
        ph: true, placeholder: true, kind: m[1] === 'W' ? 'win' : 'lose', ref: +m[2], code: null,
        name: (m[1] === 'W' ? 'Ganador' : 'Perdedor') + ' ' + m[2]
      };
    }
    var meta = teamMeta(token);
    return { ph: meta.ph, placeholder: false, kind: 'team', code: meta.code, name: meta.name };
  }
  function bMed(slot) {
    if (slot.code) return '<span class="wc-med"><img loading="lazy" crossorigin="anonymous" width="34" height="34" src="' +
      flagURL(slot.code, 'w160') + '" alt="Bandera de ' + esc(slot.name) + '"></span>';
    if (slot.placeholder) return '<span class="wc-med is-ph ' + slot.kind + '" aria-hidden="true">' +
      (slot.kind === 'win' ? 'W' : 'L') + slot.ref + '</span>';
    return '<span class="wc-med is-ph" aria-hidden="true">·</span>';
  }
  function bTie(m) {
    var a = koSlot(m.t1), b = koSlot(m.t2);
    var w1 = m.winner === 1 ? ' win' : '', w2 = m.winner === 2 ? ' win' : '';
    // token del equipo ya resuelto (si el alimentador terminó), para la ★ y el color
    var t1r = koResolveToken(m.t1, 0) || m.t1, t2r = koResolveToken(m.t2, 0) || m.t2;
    // un cruce se ilumina si juega un favorito (dieciseisavos) o si está en
    // el camino que ese favorito recorrería hacia la final (rondas siguientes).
    var pathColor = favPathNum[m.num] || '';
    var fav = favColor[t1r] || favColor[t2r] || pathColor || '';
    var live = m.status === 'live';
    var isFinal = m.round === 'Final';
    var s1 = m.ft ? m.ft[0] : (m.live ? m.live.score[0] : '');
    var s2 = m.ft ? m.ft[1] : (m.live ? m.live.score[1] : '');
    var sub = m.ft ? (m.pen ? 'Penales ' + m.pen[0] + '–' + m.pen[1] : 'Final')
      : live ? 'En vivo ahora'
        : (fmtShort(m.key) + ' · ' + fmtTime(m.start));
    var tag = isFinal ? '<span class="wc-bnum is-final">🏆 Final</span>'
      : m.round === 'Match for third place' ? '<span class="wc-bnum">🥉 3.º lugar</span>'
        : '<span class="wc-bnum" title="Su ganador avanza como W' + m.num + '">W' + m.num + '</span>';
    return '<article class="wc-btie' + (isFinal ? ' is-final' : '') + (live ? ' is-live' : '') +
      (fav ? ' has-fav' : '') + (pathColor ? ' is-fav-path' : '') + '"' + (fav ? ' style="--fav:' + fav + '"' : '') +
      ' data-wc-tie="' + m.num + '" data-wc-open="' + m.i + '" role="button" tabindex="0"' +
      ' aria-label="Detalle del partido ' + esc(a.name) + ' contra ' + esc(b.name) + '">' +
      tag +
      '<div class="wc-bteam' + w1 + (a.placeholder ? ' is-ph' : '') + '">' + bMed(a) +
        '<span class="wc-bname">' + esc(a.name) + starFor(t1r) + '</span><b class="wc-bscore">' + (s1 === '' ? '' : s1) + '</b></div>' +
      '<div class="wc-bteam' + w2 + (b.placeholder ? ' is-ph' : '') + '">' + bMed(b) +
        '<span class="wc-bname">' + esc(b.name) + starFor(t2r) + '</span><b class="wc-bscore">' + (s2 === '' ? '' : s2) + '</b></div>' +
      '<small class="wc-bsub">' + esc(sub) + '</small>' +
      '</article>';
  }

  // columnas (exterior→interior) y su grid-row para alinear cada cruce con
  // el punto medio de su pareja. 16 filas por lado (8 cruces de dieciseisavos).
  var SPAN = { 'Round of 32': 2, 'Round of 16': 4, 'Quarter-final': 8, 'Semi-final': 16 };
  var SIDE_ROUNDS = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final'];

  function bracketSide(all, side, sides) {
    var html = '';
    SIDE_ROUNDS.forEach(function (rn, idx) {
      var ms = all.filter(function (m) { return m.round === rn && sides[m.num] === side; })
        .sort(function (a, b) { return a._ord - b._ord; });
      var span = SPAN[rn];
      var col = side === 'left' ? idx + 1 : 4 - idx;
      ms.forEach(function (m, k) {
        var rowStart = k * span + 1;
        var delay = (0.05 + idx * 0.08).toFixed(2);
        html += bTie(m).replace('<article ',
          '<article style="grid-column:' + col + ';grid-row:' + rowStart + ' / span ' + span + ';--d:' + delay + 's" ');
      });
    });
    return '<div class="wc-side wc-' + (side === 'left' ? 'l' : 'r') + '">' + html + '</div>';
  }

  function bracket(all) {
    var ko = all.filter(function (m) { return m.isKO; });
    if (!ko.length) return '<div class="wc-empty"><span class="wc-ball">⚽</span>El cuadro de eliminatorias se arma cuando termine la fase de grupos.</div>';

    // mapa nº→partido y reparto izquierda/derecha siguiendo el árbol desde la final
    var map = {}; ko.forEach(function (m) { if (m.num != null) map[m.num] = m; });
    koMap = map; // para resolver ganadores ya definidos en koSlot()
    computeFeeders(ko); // aristas completas, aunque el ganador ya haya avanzado
    var sides = {};
    var ord = { v: 0 };
    function inorder(num, side) {
      var m = map[num]; if (!m) return;
      sides[num] = side;
      var f1 = feedOf(num, 0), f2 = feedOf(num, 1);
      if (f1 != null) inorder(f1, side);
      m._ord = ord.v++;
      if (f2 != null) inorder(f2, side);
    }
    var final = ko.filter(function (m) { return m.round === 'Final'; })[0];
    var third = ko.filter(function (m) { return m.round === 'Match for third place'; })[0];
    if (final && final.num != null) {
      sides[final.num] = 'center';
      var lf = feedOf(final.num, 0), rf = feedOf(final.num, 1);
      if (lf != null) inorder(lf, 'left');
      if (rf != null) inorder(rf, 'right');
      final._ord = ord.v++;
    }

    // aristas para las líneas (cada partido recibe a sus dos alimentadores)
    bracketEdges = [];
    ko.forEach(function (t) {
      if (t.round === 'Match for third place' || t.num == null) return;
      [feedOf(t.num, 0), feedOf(t.num, 1)].forEach(function (f) {
        if (f != null && map[f]) bracketEdges.push([f, t.num]);
      });
    });

    computeFavPaths(ko); // traza el camino de cada favorito hacia la final

    var center = '<div class="wc-center" style="--d:0.42s">' +
      '<div class="wc-trophy" aria-hidden="true">🏆</div>' +
      '<div class="wc-center-label">La Gran Final</div>' +
      (final ? bTie(final) : '') +
      '</div>';

    var thirdHtml = third ? '<div class="wc-third"><span class="wc-third-label">Tercer lugar</span>' + bTie(third) + '</div>' : '';

    var bar = '<div class="wc-cuadro-bar">' +
      '<div class="wc-zoom" role="group" aria-label="Zoom del cuadro">' +
        '<button type="button" class="wc-zbtn" data-wc-zoom="out" aria-label="Alejar">−</button>' +
        '<button type="button" class="wc-zbtn wc-zfit" data-wc-zoom="fit">Ver todo</button>' +
        '<button type="button" class="wc-zbtn" data-wc-zoom="in" aria-label="Acercar">+</button>' +
      '</div>' +
      '<div class="wc-cuadro-actions">' +
        '<button type="button" class="wc-abtn" data-wc-export><span class="wc-ai" aria-hidden="true">⬇</span> <span class="wc-al">Descargar PNG</span></button>' +
        '<button type="button" class="wc-abtn wc-abtn-primary" data-wc-share><span class="wc-ai" aria-hidden="true">↗</span> <span class="wc-al">Compartir</span></button>' +
      '</div>' +
      '</div>';

    var pathLegend = favPaths.length ? '<div class="wc-fav-paths">' +
      favPaths.map(function (p) {
        return '<span class="wc-fav-path-chip' + (p.eliminated ? ' is-out' : '') + '" style="--fav:' + p.color + '">' +
          '<i></i>Camino de <b>' + esc(p.name) + '</b>' + (p.eliminated ? ' · eliminado' : ' a la final') + '</span>';
      }).join('') + '</div>' : '';

    return '<div class="wc-cuadro-wrap">' + bar + pathLegend +
      '<div class="wc-cuadro-scroll">' +
        '<div class="wc-cuadro' + (favPaths.length ? ' has-fav-path' : '') + '" data-wc-bracket>' +
        '<svg class="wc-cn-svg" aria-hidden="true" preserveAspectRatio="none"></svg>' +
        bracketSide(ko, 'left', sides) + center + bracketSide(ko, 'right', sides) +
        '</div>' +
      '</div>' + thirdHtml +
      '<p class="wc-cuadro-hint">Verás el cuadro completo de un vistazo. Usa <b>+</b> para acercarte, <b>Ver todo</b> para encuadrarlo y toca un partido para el detalle. Cada cruce lleva su código FIFA (su ganador avanza como <b>W##</b>).' +
      (favPaths.length ? ' Marca tu favorito arriba y verás iluminado su <b>camino a la final</b>.' : '') + '</p>' +
      '</div>';
  }

  // De cada favorito: localiza su cruce de entrada (dieciseisavos) y sigue las
  // aristas del árbol hacia adelante. La estructura del cuadro es fija, así que
  // el camino existe aunque los rivales aún no se conozcan; pero solo se ilumina
  // hasta el último partido que el equipo jugó: si ya perdió, se apaga de ahí en
  // adelante (más honesto que mostrar una final que ya no alcanzará).
  function computeFavPaths(ko) {
    favPathNum = {}; favPathEdge = {}; favPaths = [];
    getFavs().filter(Boolean).forEach(function (en) {
      var color = favColor[en]; if (!color) return;
      var entry = ko.filter(function (m) {
        return m.round === 'Round of 32' && m.num != null && (m.t1 === en || m.t2 === en);
      })[0];
      if (!entry) return; // su selección aún no aparece en el cuadro
      // ruta estructural completa (entrada -> final)
      var path = [entry.num], cur = entry.num, guard = 0;
      while (guard++ < 12) {
        var nx = null;
        for (var i = 0; i < bracketEdges.length; i++) {
          if (bracketEdges[i][0] === cur) { nx = bracketEdges[i][1]; break; }
        }
        if (nx == null) break;
        path.push(nx); cur = nx;
      }
      // ¿hasta dónde sigue vivo el favorito? recorta en el partido que perdió.
      var cut = path.length - 1, eliminated = false;
      for (var j = 0; j < path.length; j++) {
        var mm = koMap[path[j]];
        if (!mm || !mm.ft || !mm.winner) break;        // partido sin jugar: sigue vivo -> ruta completa
        var side = (koResolveToken(mm.t1, 0) === en) ? 1
          : (koResolveToken(mm.t2, 0) === en ? 2 : 0);
        if (side === 0) { cut = j - 1; eliminated = true; break; } // ya no está en este cruce
        if (mm.winner !== side) { cut = j; eliminated = true; break; } // perdió aquí: ilumina hasta este
        // ganó: continúa al siguiente cruce
      }
      if (cut < 0) return; // perdió antes de aparecer (no debería): sin camino
      // ilumina solo el tramo jugado/vigente
      for (var k = 0; k <= cut; k++) {
        if (!favPathNum[path[k]]) favPathNum[path[k]] = color;
        if (k < cut) favPathEdge[path[k] + '>' + path[k + 1]] = color;
      }
      favPaths.push({
        en: en, name: (TEAM[en] ? TEAM[en][1] : en), color: color,
        path: path.slice(0, cut + 1), eliminated: eliminated
      });
    });
  }

  // dibuja las llaves del cuadro como codos exactos sobre un SVG superpuesto.
  // Recibe el elemento .wc-cuadro (sirve igual en pantalla y en la copia de export).
  function drawLinesIn(cuadro) {
    if (!cuadro) return;
    var svg = cuadro.querySelector('.wc-cn-svg');
    if (!svg) return;
    var box = cuadro.getBoundingClientRect();
    if (!box.width || !box.height) return; // panel oculto: se redibuja al abrir
    svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
    var byNum = {};
    cuadro.querySelectorAll('[data-wc-tie]').forEach(function (t) { byNum[t.getAttribute('data-wc-tie')] = t; });
    function pt(el) {
      var r = el.getBoundingClientRect();
      return { l: r.left - box.left, r: r.right - box.left, cy: r.top - box.top + r.height / 2, cx: r.left - box.left + r.width / 2 };
    }
    var lines = '';
    bracketEdges.forEach(function (e) {
      var sEl = byNum[e[0]], tEl = byNum[e[1]];
      if (!sEl || !tEl) return;
      var S = pt(sEl), T = pt(tEl);
      var dir = T.cx > S.cx ? 1 : -1;
      var sx = dir > 0 ? S.r : S.l, tx = dir > 0 ? T.l : T.r;
      var mx = (sx + tx) / 2;
      var pc = favPathEdge[e[0] + '>' + e[1]]; // llave dentro del camino del favorito
      lines += '<polyline ' + (pc ? 'class="is-fav-line" style="stroke:' + pc + ';color:' + pc + '" ' : '') +
        'points="' + sx + ',' + S.cy + ' ' + mx + ',' + S.cy + ' ' +
        mx + ',' + T.cy + ' ' + tx + ',' + T.cy + '" />';
    });
    svg.innerHTML = lines;
  }
  function drawBracketLines(host) { drawLinesIn(host.querySelector('[data-wc-bracket]')); }

  // ---- Zoom del cuadro (ver el mapa completo) ---------------------------
  function clampZoom(z) { return Math.max(0.25, Math.min(1, z)); }
  function applyZoom(host, z) {
    var cu = host.querySelector('[data-wc-bracket]'); if (!cu) return;
    z = clampZoom(z); host._wcZoom = z;
    cu.style.zoom = z === 1 ? '' : z;
    var fit = host.querySelector('[data-wc-zoom="fit"]');
    if (fit) fit.textContent = z < 0.999 ? Math.round(z * 100) + '%' : 'Ver todo';
    requestAnimationFrame(function () { drawBracketLines(host); });
  }
  function fitZoom(host) {
    var scroll = host.querySelector('.wc-cuadro-scroll'), cu = host.querySelector('[data-wc-bracket]');
    if (!scroll || !cu) return;
    cu.style.zoom = '';                       // medir a tamaño natural (zoom 1)
    var natW = cu.getBoundingClientRect().width;
    if (!natW) return;
    applyZoom(host, (scroll.clientWidth - 10) / natW);
  }
  // revela el cuadro con una animación de entrada (una sola vez por montaje)
  function revealBracket(host) {
    var cu = host.querySelector('[data-wc-bracket]'); if (!cu) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!host._wcRevealed && !reduce) {
      host._wcRevealed = true;
      cu.classList.add('reveal-anim');
      setTimeout(function () { cu.classList.remove('reveal-anim'); }, 1800);
    }
    // por defecto encuadra TODO el cuadro (se ve completo de entrada);
    // si el usuario ya ajustó el zoom a mano, se respeta.
    if (host._wcUserZoom && host._wcZoom) applyZoom(host, host._wcZoom);
    else requestAnimationFrame(function () { fitZoom(host); });
  }

  // ---- Export / compartir como PNG (con marca y publicidad ACACIA) ------
  var _h2cPromise = null;
  function ensureH2C() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (_h2cPromise) return _h2cPromise;
    _h2cPromise = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = '/scripts/html2canvas.min.js';
      s.onload = function () { window.html2canvas ? res(window.html2canvas) : rej(new Error('h2c')); };
      s.onerror = function () { rej(new Error('no se pudo cargar html2canvas')); };
      document.head.appendChild(s);
    });
    return _h2cPromise;
  }
  function buildExportNode(host) {
    var live = host.querySelector('[data-wc-bracket]'); if (!live) return null;
    var clone = live.cloneNode(true);
    clone.style.zoom = '';
    clone.classList.remove('reveal-anim');
    var node = document.createElement('div');
    node.className = 'wc-export';
    node.innerHTML =
      '<div class="wc-export-head">' +
        '<img class="wc-export-logo" src="/assets/acacia-logo.jpg" crossorigin="anonymous" width="46" height="46" alt="ACACIA">' +
        '<div class="wc-export-ht"><b>ACACIA</b><span>Mundial 2026 · El camino a la final</span></div>' +
        '<div class="wc-export-tag">🏆 Eliminatorias</div>' +
      '</div>' +
      '<div class="wc-export-body"></div>' +
      '<div class="wc-export-foot">' +
        '<span class="wc-export-url">⚽ acaciaco.com.mx/mundial-2026</span>' +
        '<span class="wc-export-pub">Apps que ponen orden en tu negocio — StockFlow · FlowFin · Puntos+ · LIUMA · Rumbo</span>' +
      '</div>';
    node.querySelector('.wc-export-body').appendChild(clone);
    node.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1';
    document.body.appendChild(node);
    drawLinesIn(clone);
    return { node: node, cleanup: function () { if (node.parentNode) node.parentNode.removeChild(node); } };
  }
  function renderBracketCanvas(host) {
    var built = buildExportNode(host);
    if (!built) return Promise.reject(new Error('no bracket'));
    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    return ensureH2C().then(function (h2c) {
      return fontsReady.then(function () { return new Promise(function (r) { setTimeout(r, 80); }); }).then(function () {
        return h2c(built.node, { useCORS: true, backgroundColor: '#061410', scale: Math.min(2, window.devicePixelRatio || 1.6), logging: false });
      });
    }).then(function (canvas) { built.cleanup(); return canvas; },
      function (e) { built.cleanup(); throw e; });
  }
  function canvasToBlob(canvas) {
    return new Promise(function (res) {
      if (canvas.toBlob) canvas.toBlob(function (b) { res(b); }, 'image/png');
      else res(dataURLtoBlob(canvas.toDataURL('image/png')));
    });
  }
  function dataURLtoBlob(d) {
    var p = d.split(','), bin = atob(p[1]), n = bin.length, u = new Uint8Array(n);
    while (n--) u[n] = bin.charCodeAt(n);
    return new Blob([u], { type: 'image/png' });
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }
  function setBusy(btn, busy, busyLabel) {
    if (!btn) return;
    var lab = btn.querySelector('.wc-al');
    if (busy) { btn.disabled = true; btn.dataset.lab = lab ? lab.textContent : ''; if (lab) lab.textContent = busyLabel || 'Generando…'; btn.classList.add('is-busy'); }
    else { btn.disabled = false; if (lab && btn.dataset.lab != null) lab.textContent = btn.dataset.lab; btn.classList.remove('is-busy'); }
  }
  function track(ev, data) { if (window.acaciaTrack) try { window.acaciaTrack(ev, data || {}); } catch (e) {} }
  var EXPORT_NAME = 'mundial-2026-eliminatorias-acacia.png';
  // Emojis solo en móvil (ver IS_MOBILE): WhatsApp de escritorio los corrompe al
  // importar el texto de un enlace de compartir; en la app móvil se ven bien.
  var SHARE_TEXT = 'El camino a la final del Mundial 2026' +
    (IS_MOBILE ? ' ' + EMO.trophy + EMO.ball : '') +
    ' — calendario y marcador en vivo en ACACIA: https://acaciaco.com.mx/mundial-2026';

  function downloadBracketPNG(host, btn) {
    setBusy(btn, true);
    renderBracketCanvas(host).then(canvasToBlob).then(function (blob) {
      downloadBlob(blob, EXPORT_NAME); track('mundial_bracket_export'); setBusy(btn, false);
    }).catch(function () { setBusy(btn, false); alert('No pudimos generar la imagen. Intenta de nuevo.'); });
  }
  function shareBracketPNG(host, btn) {
    setBusy(btn, true, 'Preparando…');
    renderBracketCanvas(host).then(canvasToBlob).then(function (blob) {
      var file = new File([blob], EXPORT_NAME, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: 'Mundial 2026 — Eliminatorias', text: SHARE_TEXT })
          .then(function () { track('mundial_bracket_share', { m: 'native' }); },
            function (e) { if (!e || e.name !== 'AbortError') throw e; });
      }
      // Escritorio / sin compartir nativo: descarga la imagen y abre opciones
      downloadBlob(blob, EXPORT_NAME);
      openShareFallback();
      track('mundial_bracket_share', { m: 'fallback' });
    }).then(function () { setBusy(btn, false); })
      .catch(function () { setBusy(btn, false); alert('No pudimos preparar la imagen para compartir.'); });
  }
  function openShareFallback() {
    var prev = document.querySelector('.wc-sharemenu'); if (prev) prev.remove();
    var wa = 'https://wa.me/?text=' + encodeURIComponent(SHARE_TEXT);
    var mail = 'mailto:?subject=' + encodeURIComponent('Mundial 2026 — Eliminatorias (ACACIA)') +
      '&body=' + encodeURIComponent('Te comparto el cuadro de eliminatorias del Mundial 2026 (imagen adjunta).\n\n' + SHARE_TEXT);
    var box = document.createElement('div');
    box.className = 'wc-sharemenu';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Compartir imagen');
    box.innerHTML = '<div class="wc-sharemenu-card">' +
      '<button class="wc-sharemenu-x" type="button" aria-label="Cerrar">✕</button>' +
      '<h5>Imagen descargada ✔</h5>' +
      '<p>Adjunta el PNG en tu mensaje y compártelo:</p>' +
      '<a class="wc-act wa" href="' + wa + '" target="_blank" rel="noopener">Compartir por WhatsApp</a>' +
      '<a class="wc-act" href="' + mail + '">Enviar por correo</a>' +
      '</div>';
    box.addEventListener('click', function (e) { if (e.target === box || e.target.closest('.wc-sharemenu-x')) box.remove(); });
    document.body.appendChild(box);
  }

  // ---- Barra de favoritos ------------------------------------------------
  function favBar(favs) {
    var teams = Object.keys(TEAM).map(function (en) { return [en, TEAM[en][1]]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1], 'es'); });
    function sel(slot, label) {
      var cur = favs[slot] || '';
      var opts = '<option value="">' + label + '</option>' + teams.map(function (t) {
        return '<option value="' + esc(t[0]) + '"' + (t[0] === cur ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
      }).join('');
      return '<select data-wc-fav="' + slot + '" aria-label="' + label + '">' + opts + '</select>';
    }
    var chips = favs.filter(Boolean).map(function (en) {
      return '<span class="wc-favchip" style="--fav:' + (favColor[en] || '#e8c468') + '"><i></i>' + esc(TEAM[en][1]) + '</span>';
    }).join('');
    return '<div class="wc-favbar">' +
      '<span class="wc-favlabel">⭐ Tu selección:</span>' + sel(0, 'Elige tu favorito…') +
      '<span class="wc-favlabel wc-favplus">＋ otra:</span>' + sel(1, '(opcional)') +
      (chips ? '<span class="wc-favlegend">' + chips + '</span>' : '') +
      '</div>';
  }

  // ---- Constructores de acciones ----------------------------------------
  function icsStamp(date) {
    return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + 'T' +
      pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + '00Z';
  }
  function matchTitle(mm) {
    return EMO.ball + ' ' + teamMeta(mm.t1).name + ' vs ' + teamMeta(mm.t2).name + ' · Mundial 2026';
  }
  function venueLine(mm) {
    var st = STADIUM[mm.ground];
    return st ? st[0] + ', ' + st[1] : (GROUND[mm.ground] ? GROUND[mm.ground][0] : mm.ground);
  }
  function gcalURL(mm) {
    var end = new Date(mm.start.getTime() + 7200000);
    var details = (mm.group || mm.stage) + ' del Mundial 2026. Hora del centro de México: ' + fmtTime(mm.start) +
      '. Calendario vía ACACIA — https://acaciaco.com.mx/mundial-2026';
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(matchTitle(mm)) +
      '&dates=' + icsStamp(mm.start) + '/' + icsStamp(end) +
      '&details=' + encodeURIComponent(details) +
      '&location=' + encodeURIComponent(venueLine(mm));
  }
  function icsURL(mm) {
    var end = new Date(mm.start.getTime() + 7200000);
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ACACIA//Mundial2026//ES', 'BEGIN:VEVENT',
      'UID:wc2026-' + mm.i + '@acaciaco.com.mx', 'DTSTAMP:' + icsStamp(new Date()),
      'DTSTART:' + icsStamp(mm.start), 'DTEND:' + icsStamp(end),
      'SUMMARY:' + matchTitle(mm), 'LOCATION:' + venueLine(mm),
      'DESCRIPTION:' + (mm.group || mm.stage) + ' · Mundial 2026 · Hora del centro de México ' + fmtTime(mm.start),
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }
  function waURL(mm) {
    var a = teamMeta(mm.t1).name, b = teamMeta(mm.t2).name, msg;
    var url = 'https://acaciaco.com.mx/mundial-2026';
    // Emojis solo en móvil (ver IS_MOBILE): en escritorio WhatsApp los corrompe
    // al importar el texto del enlace, así que ahí va con etiquetas de texto.
    var em = IS_MOBILE;
    var lead = em ? EMO.ball + ' ' : '';
    var point = em ? EMO.point + ' ' : '';
    if (mm.status === 'ft') {
      var mark = em ? (mm.winner === 0 ? EMO.hands + ' ' : EMO.party + ' ') : '';
      var res = mm.winner === 0
        ? mark + 'Empataron ' + mm.ft[0] + '–' + mm.ft[1] + '.'
        : mark + '¡Ganó ' + (mm.winner === 1 ? a : b) + '! ' + Math.max(mm.ft[0], mm.ft[1]) + '–' + Math.min(mm.ft[0], mm.ft[1]);
      msg = lead + 'Mundial 2026 — ' + a + ' ' + mm.ft[0] + '–' + mm.ft[1] + ' ' + b + '\n' + res +
        '\n' + point + url;
    } else {
      msg = lead + 'Mundial 2026 — ' + a + ' vs ' + b +
        '\n\n' + (em ? EMO.cal + ' ' : 'Cuándo: ') + fmtDayLabel(mm.key) + ' · ' + fmtTime(mm.start) + ' (hora del centro de México)' +
        '\n' + (em ? EMO.pin + ' ' : 'Dónde: ') + venueLine(mm) +
        '\n\n¿Lo vemos?' + (em ? ' ' + EMO.pop + EMO.tv : '') + '\n' + point + url;
    }
    return 'https://wa.me/?text=' + encodeURIComponent(msg);
  }
  function fichaURL(mm) {
    return 'https://www.google.com/search?q=' +
      encodeURIComponent(teamMeta(mm.t1).name + ' vs ' + teamMeta(mm.t2).name + ' Mundial 2026 alineaciones resultado historial');
  }

  // ---- Compartir el RESULTADO (en vivo o finalizado) con goles ----------
  // Goleadores ordenados por minuto, con su selección y (pen.)/(a. g.).
  function goalEvents(mm) {
    var a = teamMeta(mm.t1).name, b = teamMeta(mm.t2).name;
    var toMin = function (g) { return parseInt(String(g.minute).replace(/[^\d].*$/, ''), 10) || 0; };
    return (mm.g1 || []).map(function (g) { return { g: g, team: a }; })
      .concat((mm.g2 || []).map(function (g) { return { g: g, team: b }; }))
      .sort(function (x, y) { return toMin(x.g) - toMin(y.g); });
  }
  function goalShareLines(mm, em) {
    return goalEvents(mm).map(function (e) {
      var tag = e.g.penalty ? ' (pen.)' : (e.g.owngoal ? ' (a. g.)' : '');
      return (em ? EMO.ball + ' ' : '- ') + e.g.minute + "' " + e.g.name + tag + ' — ' + e.team;
    });
  }
  // Texto del marcador + estadística de goles. em=false en WhatsApp de
  // escritorio (corrompe emojis); em=true en correo y WhatsApp móvil.
  function shareResultText(mm, em) {
    var a = teamMeta(mm.t1).name, b = teamMeta(mm.t2).name;
    var url = 'https://acaciaco.com.mx/mundial-2026';
    var stage = mm.group || mm.stage;
    var lead = em ? EMO.ball + ' ' : '';
    var point = em ? EMO.point + ' ' : '';
    var L = [];
    if (mm.status === 'ft') {
      L.push(lead + 'Mundial 2026 — ' + a + ' ' + mm.ft[0] + '–' + mm.ft[1] + ' ' + b);
      if (stage) L.push(stage + ' · Finalizado');
      if (mm.winner === 0) L.push((em ? EMO.hands + ' ' : '') + 'Empataron ' + mm.ft[0] + '–' + mm.ft[1] + '.');
      else L.push((em ? EMO.trophy + ' ' : '') + '¡Ganó ' + (mm.winner === 1 ? a : b) + '! ' + winLine(mm) + '.');
    } else {
      var sc = mm.live ? mm.live.score : [0, 0];
      var det = mm.live && mm.live.detail ? ' · ' + mm.live.detail : '';
      L.push(lead + 'Mundial 2026 — ' + a + ' ' + sc[0] + '–' + sc[1] + ' ' + b);
      L.push((em ? EMO.tv + ' ' : '') + 'EN VIVO' + det + (stage ? ' · ' + stage : ''));
    }
    var goals = goalShareLines(mm, em);
    if (goals.length) {
      L.push('');
      L.push((em ? EMO.ball + ' ' : '') + 'Goles:');
      goals.forEach(function (g) { L.push('  ' + g); });
    }
    L.push('');
    L.push(point + url);
    return L.join('\n');
  }
  function waResultURL(mm) {
    return 'https://wa.me/?text=' + encodeURIComponent(shareResultText(mm, IS_MOBILE));
  }
  function mailResultURL(mm) {
    var a = teamMeta(mm.t1).name, b = teamMeta(mm.t2).name;
    var sc = mm.status === 'ft' ? mm.ft : (mm.live ? mm.live.score : [0, 0]);
    var subject = 'Mundial 2026 — ' + a + ' ' + sc[0] + '–' + sc[1] + ' ' + b +
      (mm.status === 'ft' ? '' : ' (en vivo)');
    return 'mailto:?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(shareResultText(mm, true));
  }
  // Invitación por correo para un partido que aún no empieza (cuándo y dónde).
  function mailInviteURL(mm) {
    var a = teamMeta(mm.t1).name, b = teamMeta(mm.t2).name;
    var url = 'https://acaciaco.com.mx/mundial-2026';
    var body = [
      EMO.ball + ' Mundial 2026 — ' + a + ' vs ' + b,
      '',
      EMO.cal + ' ' + fmtDayLabel(mm.key) + ' · ' + fmtTime(mm.start) + ' (hora del centro de México)',
      EMO.pin + ' ' + venueLine(mm),
      '',
      '¿Lo vemos? ' + EMO.pop + EMO.tv,
      EMO.point + ' ' + url
    ].join('\n');
    return 'mailto:?subject=' + encodeURIComponent('Mundial 2026 — ' + a + ' vs ' + b) +
      '&body=' + encodeURIComponent(body);
  }

  // ---- Modal de detalle del partido -------------------------------------
  var modalEl = null;
  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'wc-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    document.body.appendChild(modalEl);
    return modalEl;
  }
  function closeModal() { if (modalEl) { modalEl.classList.remove('open'); modalEl.innerHTML = ''; } }

  function goalsBlock(mm) {
    if (mm.status !== 'ft' && !mm.live) return '';
    function line(g, side) {
      var tag = g.penalty ? ' (pen.)' : (g.owngoal ? ' (a. g.)' : '');
      return '<div class="wc-goal ' + side + '"><span class="m">' + esc(g.minute) + "'</span><span>" + esc(g.name) + tag + '</span></div>';
    }
    var rows = mm.g1.map(function (g) { return line(g, 'h'); }).concat(mm.g2.map(function (g) { return line(g, 'a'); }));
    if (!rows.length) return '';
    return '<div class="wc-goals"><h5>⚽ Goles' + (mm.status === 'ft' ? '' : ' · en vivo') + '</h5>' + rows.join('') + '</div>';
  }

  function openModal(mm) {
    var el = ensureModal();
    var a = teamMeta(mm.t1), b = teamMeta(mm.t2);
    var st = STADIUM[mm.ground];
    var badge = mm.status === 'live' ? '<span class="wc-badge live">EN VIVO' + (mm.live && mm.live.detail ? ' ' + esc(mm.live.detail) : '') + '</span>'
      : mm.status === 'ft' ? '<span class="wc-badge ft">Finalizado</span>'
      : '<span class="wc-badge soon">Próximo</span>';
    var mid = mm.status === 'ft'
      ? '<span class="wc-modal-vs">' + mm.ft[0] + ' – ' + mm.ft[1] + (mm.pen ? '<small> (' + mm.pen[0] + '–' + mm.pen[1] + ' pen)</small>' : '') + '</span>'
      : mm.live
      ? '<span class="wc-modal-vs">' + mm.live.score[0] + ' – ' + mm.live.score[1] + '<small>en vivo' + (mm.live.detail ? ' · ' + esc(mm.live.detail) : '') + '</small></span>'
      : '<span class="wc-modal-vs">vs</span>';
    var stadium = st
      ? '<div class="wc-stadium"><span class="wc-st-emoji">🏟️</span><div><b>' + esc(st[0]) + '</b>' +
        '<small> · ' + esc(st[1]) + ' · ' + esc(st[2]) + ' asientos</small><p>' + esc(st[3]) + '</p></div></div>'
      : '';
    var actions;
    if (mm.status === 'ft' || mm.live) {
      // Resultado (finalizado o en vivo): compartir el marcador con los goles,
      // por WhatsApp o por correo.
      var waLabel = mm.status === 'ft' ? 'Compartir resultado por WhatsApp' : 'Compartir marcador en vivo por WhatsApp';
      var mailLabel = mm.status === 'ft' ? 'Enviar resultado por correo' : 'Enviar marcador en vivo por correo';
      actions = '<a class="wc-act wa" href="' + waResultURL(mm) + '" target="_blank" rel="noopener">' + waLabel + '</a>' +
        '<a class="wc-act mail" href="' + mailResultURL(mm) + '">' + mailLabel + '</a>' +
        '<a class="wc-act" href="' + fichaURL(mm) + '" target="_blank" rel="noopener">Alineaciones e historial ↗</a>';
    } else {
      actions = '<a class="wc-act cal" href="' + gcalURL(mm) + '" target="_blank" rel="noopener">Recordar en Google Calendar</a>' +
        '<a class="wc-act" href="' + icsURL(mm) + '" download="mundial-' + mm.i + '.ics">Descargar .ics (Apple/Outlook)</a>' +
        '<a class="wc-act wa" href="' + waURL(mm) + '" target="_blank" rel="noopener">Compartir por WhatsApp · ¿Lo vemos?</a>' +
        '<a class="wc-act mail" href="' + mailInviteURL(mm) + '">Invitar por correo</a>' +
        '<a class="wc-act" href="' + fichaURL(mm) + '" target="_blank" rel="noopener">Alineaciones e historial ↗</a>';
    }
    el.innerHTML = '<div class="wc-modal-card">' +
      '<button class="wc-modal-close" type="button" data-wc-mclose aria-label="Cerrar">✕</button>' +
      '<div class="wc-modal-badge">' + '<span class="wc-tag">' + esc(mm.group || mm.stage) + '</span> ' + badge + '</div>' +
      '<div class="wc-modal-teams">' +
        '<div class="wc-mt">' + flagCell(a, true) + '<b>' + esc(a.name) + starFor(mm.t1) + '</b></div>' + mid +
        '<div class="wc-mt">' + flagCell(b, true) + '<b>' + esc(b.name) + starFor(mm.t2) + '</b></div>' +
      '</div>' +
      '<div class="wc-modal-when">' + fmtDayLabel(mm.key) + ' · ' + fmtTime(mm.start) + ' h · hora del centro de México</div>' +
      (mm.status === 'ft' && mm.winner ? '<p class="wc-result-note">🏆 ¡' + esc((mm.winner === 1 ? a : b).name) + '! ' + winLine(mm) + '.</p>' : '') +
      goalsBlock(mm) + stadium +
      '<div class="wc-actions">' + actions + '</div>' +
      '<p class="wc-modal-note">Las alineaciones y el historial entre selecciones se abren en una búsqueda con la información más reciente.</p>' +
      promoCard(promoOrder[mm.i % promoOrder.length], 'is-modal') +
      '</div>';
    el.querySelector('[data-wc-mclose]').addEventListener('click', closeModal);
    el.classList.add('open');
  }

  // ---- Modo campeón -----------------------------------------------------
  function champion(finalMatch) {
    var w = finalMatch.winner === 1 ? finalMatch.t1 : finalMatch.t2;
    var meta = teamMeta(w);
    var a = teamMeta(finalMatch.t1), b = teamMeta(finalMatch.t2);
    var strips = '';
    for (var i = 0; i < 16; i++) {
      strips += '<div class="wc-strip" style="background-position:' + (i * (100 / 15)) + '% 0;animation-delay:' + (-i * 0.13) + 's"></div>';
    }
    var flagBig = meta.ph ? '' : flagURL(meta.code, 'w1280');
    var confetti = '';
    var colors = ['#e8c468', '#36d07e', '#ff3b30', '#ffffff', '#f6dd8c'];
    for (var c = 0; c < 36; c++) {
      confetti += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + colors[c % 5] +
        ';animation-duration:' + (3 + Math.random() * 3).toFixed(1) + 's;animation-delay:' + (Math.random() * 4).toFixed(1) + 's"></i>';
    }
    return '<div class="wc-confetti" aria-hidden="true">' + confetti + '</div>' +
      '<div class="wc-champ">' +
        '<div class="wc-flagwrap" aria-hidden="true"><div class="wc-wave" style="--flag:url(' + flagBig + ')">' +
          '<div class="wc-pole"></div>' + strips + '</div></div>' +
        '<div class="wc-champ-copy">' +
          '<span class="wc-eyebrow"><span class="wc-ball">🏆</span> Campeón del Mundo · 2026</span>' +
          '<h2>¡Felicidades, <b>' + esc(meta.name) + '</b>!</h2>' +
          '<p>Campeón del Mundo 2026. Levantar esa copa es el resultado de años de trabajo, disciplina y entrega — el premio a no rendirse nunca. Desde ACACIA reconocemos el esfuerzo, la garra y el ejemplo: así se construye lo grande, un partido a la vez. ¡Gracias por la fiesta del fútbol! 🌍⚽</p>' +
          '<div class="wc-champ-final">' + flagCell(a, true) + '<b>' + finalMatch.ft[0] + ' – ' + finalMatch.ft[1] + '</b>' + flagCell(b, true) +
            (finalMatch.pen ? '<span class="wc-pens">(' + finalMatch.pen[0] + '–' + finalMatch.pen[1] + ' pens)</span>' : '') + '</div>' +
        '</div>' +
      '</div>';
  }

  // ---- Render principal -------------------------------------------------
  function render(host, data, opts) {
    var now = Date.now();
    lastData = data; lastHost = host; lastOpts = opts;
    var all = norm(data, now);
    if (!all.length) { host.innerHTML = '<div class="wc-shell"><div class="wc-empty"><span class="wc-ball">⚽</span>No pudimos cargar el calendario en este momento. Intenta de nuevo en un rato.</div></div>'; return; }

    var favs = getFavs();
    computeFavColors(favs);
    byIndex = {};
    all.forEach(function (m) { byIndex[m.i] = m; });

    var live = all.filter(function (m) { return m.status === 'live'; });
    LIVE_NOW = live.length > 0;
    var finalMatch = all.filter(function (m) { return m.round === 'Final'; })[0];
    var celebrating = finalMatch && finalMatch.status === 'ft' && now >= finalMatch.start.getTime() &&
      now < finalMatch.start.getTime() + CFG.celebrateDays * 86400000;

    if (celebrating) {
      host.innerHTML = '<div class="wc-shell">' + champion(finalMatch) +
        '<div class="wc-foot"><p>Sección temporal del Mundial 2026 en ACACIA. <a href="/mundial-2026">Ver el resumen del torneo →</a></p>' +
        (opts.dismissible ? '<button class="wc-close" type="button" data-wc-close>Cerrar sección ✕</button>' : '') + '</div></div>';
      wireClose(host, opts);
      return;
    }

    // buckets
    var todayKey = cdmxKey(new Date(now));
    var weekKeys = {};
    var base = new Date(Date.UTC(+todayKey.split('-')[0], +todayKey.split('-')[1] - 1, +todayKey.split('-')[2]));
    for (var d = 0; d < 7; d++) {
      var dd = new Date(base.getTime() + d * 86400000);
      weekKeys[dd.getUTCFullYear() + '-' + pad(dd.getUTCMonth() + 1) + '-' + pad(dd.getUTCDate())] = true;
    }
    var today = all.filter(function (m) { return m.key === todayKey; });
    var week = all.filter(function (m) { return weekKeys[m.key]; });
    var played = all.filter(function (m) { return m.status === 'ft'; }).length;

    // Los partidos en vivo se destacan arriba; se excluyen de la lista del día
    // para que no aparezcan dos veces en la pestaña "Hoy".
    var liveIds = {};
    live.forEach(function (m) { liveIds[m.i] = 1; });
    var todayRest = today.filter(function (m) { return !liveIds[m.i]; });
    var liveBanner = live.length
      ? '<div class="wc-daygroup"><div class="wc-dayhead">⚡ En vivo ahora <small>' +
        live.length + (live.length === 1 ? ' partido' : ' partidos') + '</small></div>' +
        '<div class="wc-grid">' + live.map(matchCard).join('') + '</div></div>'
      : '';
    var hoyEmpty = (!live.length && !today.length)
      ? '<div class="wc-empty"><span class="wc-ball">⚽</span>Hoy no hay partidos. Vuelve mañana. 📅</div>' : '';
    var hoyHtml = liveBanner + (todayRest.length ? listByDay(todayRest, '') : '') + hoyEmpty;

    var statusTxt = live.length ? '<span class="wc-pip"></span>' + live.length + (live.length === 1 ? ' partido en vivo' : ' partidos en vivo')
      : '<span class="wc-pip"></span>Jornada en curso · ' + played + ' de 104 partidos jugados';

    var tabs = [
      { id: 'hoy', label: 'Hoy', count: today.length, html: hoyHtml },
      { id: 'semana', label: 'Esta semana', count: week.length, html: listByDay(week, 'No hay partidos en los próximos 7 días.', true) },
      { id: 'cal', label: 'Calendario', count: all.length, html: listByDay(all, '', true) },
      { id: 'bracket', label: 'Eliminatorias', count: '', html: bracket(all) }
    ];
    var startTab = today.length || live.length ? 'hoy' : 'semana';

    var tabBtns = tabs.map(function (t) {
      return '<button class="wc-tab" type="button" role="tab" data-wc-tab="' + t.id + '" aria-selected="' + (t.id === startTab) + '">' +
        t.label + (t.count !== '' ? '<span class="wc-count">' + t.count + '</span>' : '') + '</button>';
    }).join('');
    var panels = tabs.map(function (t) {
      return '<div class="wc-panel" data-wc-panel="' + t.id + '" role="tabpanel"' + (t.id === startTab ? '' : ' hidden') + '>' + t.html + '</div>';
    }).join('');

    host.innerHTML = '<div class="wc-shell">' +
      '<div class="wc-head"><div>' +
        '<span class="wc-eyebrow"><span class="wc-ball">⚽</span> Mundial 2026 · Canadá · México · EE. UU.</span>' +
        '<h2>El <b>Mundial</b> se vive aquí.</h2>' +
        '<p class="wc-sub">Marcador en vivo, partidos de hoy, de la semana y el camino a la final. Horarios en hora del centro de México.</p>' +
      '</div><div class="wc-status">' + statusTxt + '</div></div>' +
      favBar(favs) +
      '<div class="wc-sponsor" data-wc-sponsor>' + promoCard(promoOrder[bannerIdx], 'is-banner') + '</div>' +
      '<div class="wc-tabs" role="tablist" aria-label="Vistas del Mundial 2026">' + tabBtns + '</div>' +
      '<div class="wc-body">' + panels + '</div>' +
      '<div class="wc-foot"><p>Datos abiertos del calendario oficial, actualizados durante el torneo. ¿No eres de fútbol? Cierra la sección con un clic.' +
        ' <a href="/mundial-2026">Versión completa →</a></p>' +
        (opts.dismissible ? '<button class="wc-close" type="button" data-wc-close>Cerrar sección ✕</button>' : '') +
      '</div></div>';

    // interacciones de pestañas
    host.querySelectorAll('[data-wc-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        host.querySelectorAll('[data-wc-tab]').forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
        btn.setAttribute('aria-selected', 'true');
        var id = btn.getAttribute('data-wc-tab');
        host.querySelectorAll('[data-wc-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-wc-panel') !== id; });
        if (id === 'bracket') requestAnimationFrame(function () { revealBracket(host); });
      });
    });

    // zoom del cuadro (ver el mapa completo / acercar / alejar)
    host.querySelectorAll('[data-wc-zoom]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = btn.getAttribute('data-wc-zoom');
        if (a === 'fit') { host._wcUserZoom = false; fitZoom(host); }
        else { host._wcUserZoom = true; applyZoom(host, (host._wcZoom || 1) * (a === 'in' ? 1.18 : 0.84)); }
      });
    });
    // exportar / compartir como PNG con marca ACACIA
    var expBtn = host.querySelector('[data-wc-export]');
    if (expBtn) expBtn.addEventListener('click', function () { downloadBracketPNG(host, expBtn); });
    var shBtn = host.querySelector('[data-wc-share]');
    if (shBtn) shBtn.addEventListener('click', function () { shareBracketPNG(host, shBtn); });

    // líneas del cuadro: dibuja al abrir la pestaña activa y al cambiar el tamaño
    if (startTab === 'bracket') requestAnimationFrame(function () { revealBracket(host); });
    if (!host._wcResize) {
      host._wcResize = true;
      var rt = null;
      window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(function () {
          if (host._wcUserZoom) drawBracketLines(host); else fitZoom(host);
        }, 120);
      });
    }

    // abrir detalle del partido (delegación enganchada una sola vez por host)
    if (!host._wcWired) {
      host._wcWired = true;
      var openFromEvent = function (e) {
        var t = e.target.closest ? e.target.closest('[data-wc-open]') : null;
        if (!t) return;
        if (e.type === 'keydown') { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); }
        var i = +t.getAttribute('data-wc-open');
        if (byIndex[i]) openModal(byIndex[i]);
      };
      host.addEventListener('click', openFromEvent);
      host.addEventListener('keydown', openFromEvent);
    }

    // selección de favoritos
    host.querySelectorAll('[data-wc-fav]').forEach(function (selEl) {
      selEl.addEventListener('change', function () {
        var favs = [];
        host.querySelectorAll('[data-wc-fav]').forEach(function (s) { if (s.value && favs.indexOf(s.value) < 0) favs.push(s.value); });
        setFavs(favs);
        var cur = host.querySelector('[data-wc-tab][aria-selected="true"]');
        var keep = cur ? cur.getAttribute('data-wc-tab') : null;
        render(lastHost, lastData, lastOpts);
        if (keep) { var b = host.querySelector('[data-wc-tab="' + keep + '"]'); if (b) b.click(); }
      });
    });

    startBannerRotation(host);
    wireClose(host, opts);
  }

  function wireClose(host, opts) {
    var btn = host.querySelector('[data-wc-close]');
    if (btn) btn.addEventListener('click', function () {
      try { localStorage.setItem(CFG.dismissKey, '1'); } catch (e) {}
      if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }
      host.hidden = true;
      showReopen(host, opts);
    });
  }

  function showReopen(host, opts) {
    if (document.querySelector('.wc-reopen')) return;
    var chip = document.createElement('button');
    chip.className = 'wc-reopen';
    chip.type = 'button';
    chip.innerHTML = '<span class="wc-ball">⚽</span> Ver el Mundial';
    chip.setAttribute('aria-label', 'Volver a abrir la sección del Mundial 2026');
    chip.addEventListener('click', function () {
      try { localStorage.removeItem(CFG.dismissKey); } catch (e) {}
      chip.remove();
      host.hidden = false;
      boot(host, opts, true);
    });
    document.body.appendChild(chip);
  }

  // ---- Carga de datos ---------------------------------------------------
  function validData(d) {
    if (!d || !d.matches || !d.matches.length) throw 0;
    return d;
  }
  function fetchData() {
    return fetch(CFG.apiUrl, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(validData)
      // Respaldo: archivo público de openfootball. Validamos igual que la fuente
      // primaria (ok + partidos) para no aceptar una página de error como datos.
      .catch(function () {
        return fetch(CFG.fallbackUrl, { headers: { Accept: 'application/json' } })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(validData);
      });
  }

  var refreshTimer = null;
  function boot(host, opts, force) {
    var now = Date.now();
    // En la home (modo sección): reja de fechas + opción de cerrar.
    // En la página dedicada (modo página): siempre visible, sin reja ni cierre.
    if (opts.dismissible) {
      var endWindow = CFG.finalDate + (CFG.celebrateDays + 1) * 86400000;
      if (now < CFG.start || now > endWindow) { host.hidden = true; return; }
      var dismissed = false;
      try { dismissed = localStorage.getItem(CFG.dismissKey) === '1'; } catch (e) {}
      if (dismissed && !force) { host.hidden = true; showReopen(host, opts); return; }
    }

    host.hidden = false;
    host.innerHTML = '<div class="wc-shell"><div class="wc-body"><div class="wc-grid">' +
      '<div class="wc-skeleton"></div><div class="wc-skeleton"></div><div class="wc-skeleton"></div></div></div></div>';

    fetchData().then(function (data) {
      if (host.hidden) return;
      render(host, data, opts);
      // Auto-refresco: cada 30 s si hay partido en vivo, cada 90 s si no.
      if (refreshTimer) clearInterval(refreshTimer);
      var tick = 0;
      refreshTimer = setInterval(function () {
        if (host.hidden) return;
        tick++;
        if (!LIVE_NOW && tick % 3 !== 0) return; // sin vivo: solo cada 3.º tick (~90 s)
        var sel = host.querySelector('[data-wc-tab][aria-selected="true"]');
        var keep = sel ? sel.getAttribute('data-wc-tab') : null;
        fetchData().then(function (d) {
          if (host.hidden) return;
          render(host, d, opts);
          if (keep) { var b = host.querySelector('[data-wc-tab="' + keep + '"]'); if (b) b.click(); }
        });
      }, 30000);
    }).catch(function () {
      host.innerHTML = '<div class="wc-shell"><div class="wc-empty"><span class="wc-ball">⚽</span>No pudimos cargar el calendario. Revisa tu conexión e intenta más tarde.</div></div>';
    });
  }

  function init() {
    var host = document.getElementById('mundial-2026');
    if (!host) return;
    // medición de clics en promos de apps (Vercel Web Analytics)
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-wc-promo]') : null;
      if (t && window.acaciaTrack) window.acaciaTrack('mundial_promo_click', { app: t.getAttribute('data-wc-promo') });
    });
    var opts = { dismissible: host.getAttribute('data-wc-mode') !== 'page' };
    boot(host, opts, false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
