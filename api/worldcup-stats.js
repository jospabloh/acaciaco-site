// Estadísticas de partido (posesión, tiros, tiros a puerta) para el Mundial 2026.
// A diferencia de /api/worldcup (calendario completo, refrescado en segundo plano),
// esto se pide BAJO DEMANDA — solo cuando alguien abre el detalle de un partido — para
// no multiplicar por 104 partidos una llamada que la mayoría de las veces no se usa.
// Fuente: ESPN (pública, sin llave). Degrada con elegancia: si ESPN no tiene el
// partido o no trae estos campos, respondemos found:false / stats:null y el
// cliente simplemente oculta el bloque.
let cache = new Map(); // "home|away|date" -> { data, ts, final }
const TTL_LIVE = 20000;
const TTL_UNRESOLVED = 30000; // partido no encontrado o aún no arranca: reintenta pronto
const TTL_FINAL = 6 * 60 * 60 * 1000; // finalizado: ya no cambia, cachea horas
const MAX_CACHE = 500; // tope simple para no crecer sin límite entre invocaciones cálidas

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, ms);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

// Mismo alias que /api/worldcup: nombres de ESPN vs. openfootball no siempre calzan.
function canon(name) {
  if (!name) return '';
  var n = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
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

function ymd(d) {
  return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
}

// Busca el evento de ESPN para este cruce. Tolerancia de ±1 día como en el
// merge de marcador en vivo: la fecha de openfootball es local y la de ESPN
// viene en UTC, así que un juego nocturno cae en el día UTC siguiente.
async function findEvent(home, away, dateStr) {
  var base = Date.parse(dateStr + 'T00:00:00Z');
  if (isNaN(base)) base = Date.now();
  var range = ymd(new Date(base - 86400000)) + '-' + ymd(new Date(base + 86400000));
  var r = await fetchWithTimeout(SCOREBOARD + '?dates=' + range, { headers: { 'User-Agent': 'acaciaco-mundial/1.0' } }, 3500);
  if (!r.ok) return null;
  var d = await r.json();
  var ka = canon(home), kb = canon(away);
  var events = d.events || [];
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    var comp = (e.competitions && e.competitions[0]) || {};
    var cs = comp.competitors || [];
    var names = cs.map(function (c) { return canon(c.team && (c.team.displayName || c.team.name)); });
    if (names.length === 2 && ((names[0] === ka && names[1] === kb) || (names[0] === kb && names[1] === ka))) {
      var st = (e.status && e.status.type) || {};
      return { id: e.id, state: st.state || 'pre' };
    }
  }
  return null;
}

// ESPN nombra estas métricas de forma algo inconsistente entre partidos; primero
// probamos claves exactas conocidas y, si no aparecen, buscamos por coincidencia
// parcial en la etiqueta (así una variante de nombre no tumba el dato). `exclude`
// evita que "shots" (genérico) confunda "tiros totales" con "tiros a puerta"
// cuando ambas etiquetas comparten la palabra "shots".
function findStat(list, opts) {
  if (!list || !list.length) return null;
  var names = opts.names || [], include = opts.include || [], exclude = opts.exclude || [];
  for (var i = 0; i < list.length; i++) {
    var name = ((list[i].name || '') + '').toLowerCase();
    if (names.indexOf(name) >= 0) return list[i].displayValue;
  }
  for (var j = 0; j < list.length; j++) {
    var label = ((list[j].label || list[j].displayName || '') + '').toLowerCase();
    var excluded = exclude.some(function (x) { return label.indexOf(x) >= 0; });
    if (excluded) continue;
    var matched = include.some(function (x) { return label.indexOf(x) >= 0; });
    if (matched) return list[j].displayValue;
  }
  return null;
}

function parseNum(v) {
  if (v == null) return null;
  var n = parseFloat(String(v).replace('%', ''));
  return isNaN(n) ? null : n;
}

async function fetchStats(eventId, home, away) {
  var r = await fetchWithTimeout(SUMMARY + '?event=' + encodeURIComponent(eventId), { headers: { 'User-Agent': 'acaciaco-mundial/1.0' } }, 4000);
  if (!r.ok) return null;
  var d = await r.json();
  var teams = (d.boxscore && d.boxscore.teams) || [];
  if (teams.length < 2) return null;
  var t1 = teams.find(function (t) { return canon(t.team && (t.team.displayName || t.team.name)) === canon(home); });
  var t2 = teams.find(function (t) { return canon(t.team && (t.team.displayName || t.team.name)) === canon(away); });
  if (!t1 || !t2) return null;
  function extract(t) {
    var st = t.statistics || [];
    return {
      possession: parseNum(findStat(st, { names: ['possessionpct', 'ballpossession', 'possession'], include: ['posesi', 'possession'] })),
      shotsOnTarget: parseNum(findStat(st, {
        names: ['shotsontarget', 'shotsongoal'],
        include: ['on target', 'on goal', 'a puerta', 'a marco']
      })),
      shots: parseNum(findStat(st, {
        names: ['totalshots', 'shots'],
        include: ['total shots', 'tiros totales', 'shots'],
        exclude: ['target', 'goal', 'puerta', 'marco']
      }))
    };
  }
  var s1 = extract(t1), s2 = extract(t2);
  var any = [s1.possession, s1.shots, s1.shotsOnTarget, s2.possession, s2.shots, s2.shotsOnTarget]
    .some(function (v) { return v != null; });
  if (!any) return null;
  return { t1: s1, t2: s2 };
}

export default async function handler(req, res) {
  const q = req.query || {};
  const home = q.home, away = q.away, date = q.date;
  if (!home || !away || !date) {
    return res.status(400).json({ found: false, error: 'missing-params' });
  }

  const key = home + '|' + away + '|' + date;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < (hit.final ? TTL_FINAL : (hit.data.found ? TTL_LIVE : TTL_UNRESOLVED))) {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
    return res.status(200).json(hit.data);
  }

  try {
    const ev = await findEvent(home, away, date);
    let payload, final = false;
    if (!ev || ev.state === 'pre') {
      payload = { found: false };
    } else {
      const stats = await fetchStats(ev.id, home, away);
      payload = { found: true, live: ev.state === 'in', stats: stats };
      final = ev.state === 'post';
    }
    if (cache.size > MAX_CACHE) cache.clear();
    cache.set(key, { data: payload, ts: now, final: final });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
    return res.status(200).json(payload);
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=15');
    return res.status(200).json({ found: false });
  }
}
