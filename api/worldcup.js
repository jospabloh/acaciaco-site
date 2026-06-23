// Proxy + edge cache para el Mundial 2026.
//  · Base: openfootball (dominio público) → calendario + goleadores + finales.
//  · Capa en vivo (best-effort): ESPN scoreboard público → marcador EN JUEGO
//    con minuto y finales en minutos (no horas). Se fusiona por fecha + equipos.
// Degrada con elegancia: si la capa en vivo falla o no hay partidos, devuelve
// el calendario tal cual. Sin llaves ni secretos.
let cache = { data: null, ts: 0 };

const SOURCE =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
// ESPN expone un scoreboard público del Mundial (fifa.world). Sin API key.
const LIVE_SOURCE =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// ESPN usa nombres ligeramente distintos → los llevamos a los de openfootball.
function canon(name) {
  if (!name) return '';
  var n = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // sin acentos
    .replace(/[.'&-]/g, ' ').replace(/\s+/g, ' ').trim();
  var alias = {
    'united states': 'usa', 'us': 'usa', 'usmnt': 'usa',
    'korea republic': 'south korea', 'south korea': 'south korea',
    'ir iran': 'iran', 'czechia': 'czech republic', 'turkiye': 'turkey',
    'cabo verde': 'cape verde', 'congo dr': 'dr congo', 'dr congo': 'dr congo',
    'cote d ivoire': 'ivory coast', 'ivory coast': 'ivory coast',
    'bosnia and herzegovina': 'bosnia herzegovina', 'bosnia herzegovina': 'bosnia herzegovina',
    'curacao': 'curacao'
  };
  return alias[n] || n;
}

async function fetchLive(diag) {
  try {
    // fecha UTC de hoy para asegurar el slate correcto sin depender del default
    const now = new Date();
    const ymd = now.getUTCFullYear() + String(now.getUTCMonth() + 1).padStart(2, '0') + String(now.getUTCDate()).padStart(2, '0');
    const r = await fetch(LIVE_SOURCE + '?dates=' + ymd, { headers: { 'User-Agent': 'acaciaco-mundial/1.0' } });
    if (diag) { diag.status = r.status; }
    if (!r.ok) return [];
    const d = await r.json();
    if (diag) { diag.raw = (d.events || []).length; }
    return (d.events || []).map(function (e) {
      var comp = (e.competitions && e.competitions[0]) || {};
      var cs = comp.competitors || [];
      var st = (e.status && e.status.type) || {};
      function side(ha) { return cs.find(function (c) { return c.homeAway === ha; }) || cs[0] || {}; }
      var home = side('home'), away = side('away');
      return {
        date: (e.date || '').slice(0, 10),
        a: canon(home.team && (home.team.displayName || home.team.name)),
        b: canon(away.team && (away.team.displayName || away.team.name)),
        sa: parseInt(home.score, 10), sb: parseInt(away.score, 10),
        state: st.state || 'pre',                       // pre | in | post
        detail: st.shortDetail || st.detail || ''       // "67'", "HT", "FT"...
      };
    }).filter(function (x) { return x.a && x.b; });
  } catch (e) { return []; }
}

function mergeLive(data, live) {
  if (!live.length) return 0;
  var merged = 0;
  (data.matches || []).forEach(function (m) {
    var ka = canon(m.team1), kb = canon(m.team2), day = (m.date || '').slice(0, 10);
    var ev = live.find(function (x) {
      return x.date === day && ((x.a === ka && x.b === kb) || (x.a === kb && x.b === ka));
    });
    if (!ev || isNaN(ev.sa) || isNaN(ev.sb)) return;
    // orienta el marcador a team1/team2 de openfootball
    var s1 = ev.a === ka ? ev.sa : ev.sb;
    var s2 = ev.a === ka ? ev.sb : ev.sa;
    if (ev.state === 'in') {
      m.live = { score: [s1, s2], detail: ev.detail, state: 'in' };
      merged++;
    } else if (ev.state === 'post' && !(m.score && m.score.ft)) {
      // final más rápido que openfootball (minutos vs horas)
      m.score = { ft: [s1, s2] };
      merged++;
    }
  });
  return merged;
}

export default async function handler(req, res) {
  const now = Date.now();

  if (cache.data && now - cache.ts < 30000) {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json(cache.data);
  }

  try {
    const r = await fetch(SOURCE, {
      headers: { 'User-Agent': 'acaciaco-mundial/1.0 (+https://acaciaco.com.mx)' }
    });
    if (!r.ok) throw new Error('upstream-' + r.status);
    const data = await r.json();

    // Capa en vivo (best-effort): nunca rompe la respuesta base.
    const diag = {};
    const live = await fetchLive(diag);
    const mergedCount = mergeLive(data, live);

    data._fetchedAt = new Date(now).toISOString();
    data._live = mergedCount;
    data._liveDiag = { httpStatus: diag.status || null, espnEvents: diag.raw || 0, parsed: live.length };
    cache = { data, ts: now };
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json(data);
  } catch (e) {
    if (cache.data) {
      res.setHeader('Cache-Control', 's-maxage=15');
      return res.status(200).json(cache.data);
    }
    return res.status(502).json({ error: e.message, name: 'World Cup 2026', matches: [] });
  }
}
