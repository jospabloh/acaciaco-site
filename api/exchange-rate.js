const BANXICO_SERIES = 'SF43718'; // FIX exchange rate (MXN per USD)
const BANXICO_BASE_URL = 'https://www.banxico.org.mx/SieAPIRest/service/v1/series';
const FALLBACK_RATE = 17;
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

const memoryCache = globalThis.__acaciaExchangeRateCache || {
  value: null,
  fetchedAt: 0
};

globalThis.__acaciaExchangeRateCache = memoryCache;

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const parseBanxicoRate = (payload) => {
  const series = payload?.bmx?.series?.[0];
  const datos = Array.isArray(series?.datos) ? series.datos : [];

  for (let i = datos.length - 1; i >= 0; i -= 1) {
    const value = Number(String(datos[i]?.dato || '').replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0) {
      return {
        rate: value,
        date: datos[i]?.fecha || null,
        source: 'Banxico SIE SF43718 (FIX)'
      };
    }
  }

  return null;
};

const fetchBanxicoRate = async () => {
  const token = process.env.BANXICO_API_TOKEN;
  if (!token) {
    throw new Error('missing-banxico-token');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);

  const url = `${BANXICO_BASE_URL}/${BANXICO_SERIES}/datos/${toIsoDate(startDate)}/${toIsoDate(endDate)}?token=${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`banxico-http-${response.status}`);
  }

  const payload = await response.json();
  const parsed = parseBanxicoRate(payload);
  if (!parsed) throw new Error('banxico-empty-response');
  return parsed;
};

export default async function handler(req, res) {
  const now = Date.now();

  if (memoryCache.value && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({
      ...memoryCache.value,
      cached: true,
      cacheAgeMs: now - memoryCache.fetchedAt
    });
  }

  try {
    const latestRate = await fetchBanxicoRate();
    memoryCache.value = latestRate;
    memoryCache.fetchedAt = now;

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ ...latestRate, cached: false });
  } catch (error) {
    if (memoryCache.value) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({
        ...memoryCache.value,
        cached: true,
        stale: true,
        error: 'banxico-fetch-failed'
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      rate: FALLBACK_RATE,
      date: null,
      source: 'Fallback MXN baseline',
      cached: false,
      stale: true,
      error: 'banxico-fetch-failed-no-cache'
    });
  }
}
