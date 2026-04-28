let cache = { rate: null, ts: 0 };

export default async function handler(req, res) {
  const FALLBACK = parseFloat(process.env.EXCHANGE_RATE_FALLBACK || '18.50');
  const TOKEN = process.env.BANXICO_TOKEN;
  const now = Date.now();

  if (cache.rate && (now - cache.ts) < 43200000) {
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=86400');
    return res.status(200).json({ rate: cache.rate, source: 'cache', timestamp: new Date(cache.ts).toISOString() });
  }

  if (!TOKEN) {
    return res.status(200).json({ rate: FALLBACK, source: 'fallback-no-token', timestamp: new Date().toISOString() });
  }

  try {
    const r = await fetch(
      'https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno',
      { headers: { 'Bmx-Token': TOKEN } }
    );
    if (!r.ok) throw new Error('banxico-' + r.status);
    const data = await r.json();
    const rateStr = data?.bmx?.series?.[0]?.datos?.[0]?.dato;
    const rate = parseFloat(rateStr);
    if (!rate || isNaN(rate)) throw new Error('parse-fail');
    cache = { rate, ts: now };
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=86400');
    return res.status(200).json({ rate, source: 'banxico', timestamp: new Date(now).toISOString() });
  } catch (e) {
    return res.status(200).json({ rate: FALLBACK, source: 'fallback-error', error: e.message, timestamp: new Date().toISOString() });
  }
}
