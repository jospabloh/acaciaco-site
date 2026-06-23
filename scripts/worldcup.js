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
      var status = ft ? 'ft' : (now >= start.getTime() && now < start.getTime() + CFG.liveWindowMin * 60000 ? 'live' : 'soon');
      var winner = 0; // 0 empate/sin definir, 1 ó 2
      if (ft) {
        if (ft[0] > ft[1]) winner = 1; else if (ft[1] > ft[0]) winner = 2;
        else if (pen) winner = pen[0] > pen[1] ? 1 : (pen[1] > pen[0] ? 2 : 0);
      }
      out.push({
        i: i, round: m.round, group: m.group || '', stage: ROUND_ES[m.round] || m.group || m.round,
        isKO: KO_ORDER.indexOf(m.round) >= 0,
        t1: m.team1, t2: m.team2, start: start, key: cdmxKey(start),
        ft: ft, pen: pen, status: status, winner: winner, ground: m.ground || ''
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

  function matchCard(mm) {
    var a = teamMeta(mm.t1), b = teamMeta(mm.t2);
    var g = GROUND[mm.ground] || [mm.ground, ''];
    var badge = mm.status === 'live' ? '<span class="wc-badge live">EN VIVO</span>'
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
    } else {
      s1 = '<span class="wc-score tbd">' + (mm.status === 'live' ? '·' : '') + '</span>';
      s2 = '<span class="wc-score tbd">' + (mm.status === 'live' ? '·' : '') + '</span>';
    }
    return '<article class="wc-match ' + (mm.status === 'live' ? 'is-live' : '') + '">' +
      '<div class="wc-match-top"><span class="wc-tag">' + esc(mm.group || mm.stage) + '</span>' + badge + '</div>' +
      '<div>' +
        '<div class="wc-row' + cls1 + '">' + flagCell(a) + '<span class="wc-team' + (a.ph ? ' ph' : '') + '">' + esc(a.name) + '</span>' + s1 + '</div>' +
        '<div class="wc-row' + cls2 + '">' + flagCell(b) + '<span class="wc-team' + (b.ph ? ' ph' : '') + '">' + esc(b.name) + '</span>' + s2 + '</div>' +
        note +
      '</div>' +
      '<div class="wc-match-foot"><span class="wc-when">' + (mm.status === 'ft' ? 'Finalizado' : fmtTime(mm.start) + ' h · centro de México') + '</span>' +
        '<span class="wc-venue">' + esc(g[0]) + ' ' + (g[1] || '') + '</span></div>' +
      '</article>';
  }

  function listByDay(matches, emptyMsg) {
    if (!matches.length) return '<div class="wc-empty"><span class="wc-ball">⚽</span>' + emptyMsg + '</div>';
    var days = {}, order = [];
    matches.forEach(function (m) { if (!days[m.key]) { days[m.key] = []; order.push(m.key); } days[m.key].push(m); });
    return order.map(function (k) {
      return '<div class="wc-daygroup"><div class="wc-dayhead">' + fmtDayLabel(k) +
        ' <small>' + days[k].length + (days[k].length === 1 ? ' partido' : ' partidos') + '</small></div>' +
        '<div class="wc-grid">' + days[k].map(matchCard).join('') + '</div></div>';
    }).join('');
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
        return '<div class="wc-btie ' + (r === 'Final' ? 'is-final' : '') + '">' +
          '<div class="wc-bteam' + w1 + '">' + flagCell(a) + '<span>' + esc(a.name) + '</span><b>' + sc[0] + '</b></div>' +
          '<div class="wc-bteam' + w2 + '">' + flagCell(b) + '<span>' + esc(b.name) + '</span><b>' + sc[1] + '</b></div>' +
          '<small>' + esc(sub) + '</small></div>';
      }).join('');
      return '<div class="wc-bcol"><h4>' + (ROUND_ES[r] || r) + '</h4>' + ties + '</div>';
    }).join('');
    return '<div class="wc-bracket">' + cols + '</div>';
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
    var all = norm(data, now);
    if (!all.length) { host.innerHTML = '<div class="wc-shell"><div class="wc-empty"><span class="wc-ball">⚽</span>No pudimos cargar el calendario en este momento. Intenta de nuevo en un rato.</div></div>'; return; }

    var live = all.filter(function (m) { return m.status === 'live'; });
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
      { id: 'semana', label: 'Esta semana', count: week.length, html: listByDay(week, 'No hay partidos en los próximos 7 días.') },
      { id: 'cal', label: 'Calendario', count: all.length, html: listByDay(all, '') },
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
    wireClose(host, opts);
  }

  function wireClose(host, opts) {
    var btn = host.querySelector('[data-wc-close]');
    if (btn) btn.addEventListener('click', function () {
      try { localStorage.setItem(CFG.dismissKey, '1'); } catch (e) {}
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
      // Auto-refresco cada 90 s mientras haya partidos en vivo o por jugar hoy.
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(function () {
        if (host.hidden) return;
        var sel = host.querySelector('[data-wc-tab][aria-selected="true"]');
        var keep = sel ? sel.getAttribute('data-wc-tab') : null;
        fetchData().then(function (d) {
          if (host.hidden) return;
          render(host, d, opts);
          if (keep) { var b = host.querySelector('[data-wc-tab="' + keep + '"]'); if (b) b.click(); }
        });
      }, 90000);
    }).catch(function () {
      host.innerHTML = '<div class="wc-shell"><div class="wc-empty"><span class="wc-ball">⚽</span>No pudimos cargar el calendario. Revisa tu conexión e intenta más tarde.</div></div>';
    });
  }

  function init() {
    var host = document.getElementById('mundial-2026');
    if (!host) return;
    var opts = { dismissible: host.getAttribute('data-wc-mode') !== 'page' };
    boot(host, opts, false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
