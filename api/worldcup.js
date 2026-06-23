// Proxy + edge cache for the 2026 World Cup dataset (openfootball, public domain).
// Keeps the source swappable, hides it behind our origin, and adds a short
// edge cache so a burst of fans doesn't hammer the upstream file.
let cache = { data: null, ts: 0 };

const SOURCE =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

export default async function handler(req, res) {
  const now = Date.now();

  // Serve from warm in-memory cache (2 min) to keep things snappy and live-ish.
  if (cache.data && now - cache.ts < 120000) {
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    return res.status(200).json(cache.data);
  }

  try {
    const r = await fetch(SOURCE, {
      headers: { 'User-Agent': 'acaciaco-mundial/1.0 (+https://acaciaco.com.mx)' }
    });
    if (!r.ok) throw new Error('upstream-' + r.status);
    const data = await r.json();
    data._fetchedAt = new Date(now).toISOString();
    cache = { data, ts: now };
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (e) {
    // Degrade gracefully: last good snapshot if we have one, else signal the client
    // to fall back to fetching the public file directly.
    if (cache.data) {
      res.setHeader('Cache-Control', 's-maxage=30');
      return res.status(200).json(cache.data);
    }
    return res.status(502).json({ error: e.message, name: 'World Cup 2026', matches: [] });
  }
}
