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
    liveWindowMin: 135,                        // ventana "en vivo" por partido
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
    'Mexico City': ['Ciudad de México', '🇲🇽'], 'Monterrey (Guadalupe)': ['Monterrey', '🇲🇽'],
    'Guadalajara (Zapopan)': ['Guadalajara', '🇲🇽'], 'Toronto': ['Toronto', '🇨🇦'], 'Vancouver': ['Vancouver', '🇨🇦'],
    'Atlanta': ['Atlanta', '🇺🇸'], 'Boston (Foxborough)': ['Boston', '🇺🇸'], 'Dallas (Arlington)': ['Dallas', '🇺🇸'],
    'Houston': ['Houston', '🇺🇸'], 'Kansas City': ['Kansas City', '🇺🇸'], 'Los Angeles (Inglewood)': ['Los Ángeles', '🇺🇸'],
    'Miami (Miami Gardens)': ['Miami', '🇺🇸'], 'New York/New Jersey (East Rutherford)': ['Nueva York', '🇺🇸'],
    'Philadelphia': ['Filadelfia', '🇺🇸'], 'San Francisco Bay Area (Santa Clara)': ['San Francisco', '🇺🇸'],
    'Seattle': ['Seattle', '🇺🇸']
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
  function flagURL(code, w) { return 'https://flagcdn.com/' + (w || 'w40') + '/' + code + '.png'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- Normalización ----------------------------------------------------
  function norm(raw, now) {
    var out = [];
    (raw.matches || []).forEach(function (m, i) {
      var start = parseStart(m.date, m.time);
      if (!start) return;
      var ft = m.score && m.score.ft ? m.score.ft : null;
      var pen = m.score && m.score.p ? m.score.p : null;
      // Marcador EN JUEGO inyectado por el proxy (capa en vivo).
      var liveInfo = (m.live && m.live.state === 'in' && m.live.score) ? m.live : null;
      var status = ft ? 'ft'
        : liveInfo ? 'live'
        : (now >= start.getTime() && now < start.getTime() + CFG.liveWindowMin * 60000 ? 'live' : 'soon');
      var winner = 0; // 0 empate/sin definir, 1 ó 2
      if (ft) {
        if (ft[0] > ft[1]) winner = 1; else if (ft[1] > ft[0]) winner = 2;
        else if (pen) winner = pen[0] > pen[1] ? 1 : (pen[1] > pen[0] ? 2 : 0);
      }
      out.push({
        i: i, round: m.round, group: m.group || '', stage: ROUND_ES[m.round] || m.group || m.round,
        isKO: KO_ORDER.indexOf(m.round) >= 0,
        t1: m.team1, t2: m.team2, start: start, key: cdmxKey(start),
        ft: ft, pen: pen, status: status, winner: winner, ground: m.ground || '',
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

  // ---- Plantillas HTML --------------------------------------------------
  function flagCell(meta, big) {
    if (meta.ph) return '<span class="wc-flag ph">' + esc(meta.name.length > 4 ? '·' : meta.name) + '</span>';
    return '<img class="wc-flag" loading="lazy" width="' + (big ? 30 : 26) + '" height="' + (big ? 20 : 18) +
      '" src="' + flagURL(meta.code, big ? 'w80' : 'w40') + '" alt="Bandera de ' + esc(meta.name) + '">';
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
        var pen = mm.pen ? ' (' + mm.pen[0] + '–' + mm.pen[1] + ' en penales)' : '';
        note = '<p class="wc-result-note">🏆 ¡Felicidades, ' + esc(w.name) + '! Victoria ' + Math.max(mm.ft[0], mm.ft[1]) + '–' + Math.min(mm.ft[0], mm.ft[1]) + pen + '.</p>';
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
        '<span class="wc-venue">' + esc(g[0]) + ' ' + (g[1] || '') + '</span></div>' +
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

  function bracket(all) {
    var cols = KO_ORDER.map(function (r) {
      var ms = all.filter(function (m) { return m.round === r; });
      if (!ms.length) return '';
      var ties = ms.map(function (m) {
        var a = teamMeta(m.t1), b = teamMeta(m.t2);
        var sc = m.ft ? [m.ft[0], m.ft[1]] : ['', ''];
        var w1 = m.winner === 1 ? ' win' : '', w2 = m.winner === 2 ? ' win' : '';
        var sub = m.ft ? (m.pen ? 'Penales ' + m.pen[0] + '–' + m.pen[1] : 'Final') : fmtDayLabel(m.key) + ' · ' + fmtTime(m.start);
        var fav = favColor[m.t1] || favColor[m.t2] || '';
        return '<div class="wc-btie ' + (r === 'Final' ? 'is-final' : '') + (fav ? ' has-fav' : '') + '"' + (fav ? ' style="--fav:' + fav + '"' : '') +
          ' data-wc-open="' + m.i + '" role="button" tabindex="0">' +
          '<div class="wc-bteam' + w1 + '">' + flagCell(a) + '<span>' + esc(a.name) + starFor(m.t1) + '</span><b>' + sc[0] + '</b></div>' +
          '<div class="wc-bteam' + w2 + '">' + flagCell(b) + '<span>' + esc(b.name) + starFor(m.t2) + '</span><b>' + sc[1] + '</b></div>' +
          '<small>' + esc(sub) + '</small></div>';
      }).join('');
      return '<div class="wc-bcol"><h4>' + (ROUND_ES[r] || r) + '</h4>' + ties + '</div>';
    }).join('');
    return '<div class="wc-bracket">' + cols + '</div>';
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
    return '⚽ ' + teamMeta(mm.t1).name + ' vs ' + teamMeta(mm.t2).name + ' · Mundial 2026';
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
    if (mm.status === 'ft') {
      var res = mm.winner === 0 ? 'Empataron ' + mm.ft[0] + '–' + mm.ft[1] + ' 🤝'
        : '¡Ganó ' + (mm.winner === 1 ? a : b) + '! ' + Math.max(mm.ft[0], mm.ft[1]) + '–' + Math.min(mm.ft[0], mm.ft[1]) + ' 🎉';
      msg = '⚽ ' + a + ' ' + mm.ft[0] + '–' + mm.ft[1] + ' ' + b + ' · Mundial 2026\n' + res;
    } else {
      msg = '⚽ ' + a + ' vs ' + b + '\n📅 ' + fmtDayLabel(mm.key) + ' a las ' + fmtTime(mm.start) +
        ' h (hora de México)\n📍 ' + venueLine(mm) + '\n\n¿Lo vemos? 🇲🇽🍿';
    }
    return 'https://wa.me/?text=' + encodeURIComponent(msg);
  }
  function fichaURL(mm) {
    return 'https://www.google.com/search?q=' +
      encodeURIComponent(teamMeta(mm.t1).name + ' vs ' + teamMeta(mm.t2).name + ' Mundial 2026 alineaciones resultado historial');
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
    if (mm.status !== 'ft') return '';
    function line(g, side) {
      var tag = g.penalty ? ' (pen.)' : (g.owngoal ? ' (a. g.)' : '');
      return '<div class="wc-goal ' + side + '"><span class="m">' + esc(g.minute) + "'</span><span>" + esc(g.name) + tag + '</span></div>';
    }
    var rows = mm.g1.map(function (g) { return line(g, 'h'); }).concat(mm.g2.map(function (g) { return line(g, 'a'); }));
    if (!rows.length) return '';
    return '<div class="wc-goals"><h5>⚽ Goles</h5>' + rows.join('') + '</div>';
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
    if (mm.status === 'ft') {
      actions = '<a class="wc-act wa" href="' + waURL(mm) + '" target="_blank" rel="noopener">Compartir resultado por WhatsApp</a>' +
        '<a class="wc-act" href="' + fichaURL(mm) + '" target="_blank" rel="noopener">Alineaciones e historial ↗</a>';
    } else {
      actions = '<a class="wc-act cal" href="' + gcalURL(mm) + '" target="_blank" rel="noopener">Recordar en Google Calendar</a>' +
        '<a class="wc-act" href="' + icsURL(mm) + '" download="mundial-' + mm.i + '.ics">Descargar .ics (Apple/Outlook)</a>' +
        '<a class="wc-act wa" href="' + waURL(mm) + '" target="_blank" rel="noopener">Compartir por WhatsApp · ¿Lo vemos?</a>' +
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
      });
    });

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
  function fetchData() {
    return fetch(CFG.apiUrl, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { if (!d.matches || !d.matches.length) throw 0; return d; })
      .catch(function () { return fetch(CFG.fallbackUrl).then(function (r) { return r.json(); }); });
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
