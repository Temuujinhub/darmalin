// DAR AL RIMAL — Cloudflare Worker
// Serves the static site from ./public and exposes:
//   /api/prices — delayed exchange benchmark quotes (stooq.com CSV),
//   /api/ports  — current weather at key oil ports (Open-Meteo),
// both fetched server-side and cached at the edge.

const SYMBOLS = [
  { y: 'BZ=F',     s: 'cb.f', key: 'brent',   name: 'Brent Crude',      unit: 'USD/bbl',   region: 'Europe · ICE' },
  { y: 'CL=F',     s: 'cl.f', key: 'wti',     name: 'WTI Crude',        unit: 'USD/bbl',   region: 'Americas · NYMEX' },
  { y: 'RB=F',     s: 'rb.f', key: 'gasoline',name: 'Gasoline (RBOB)',  unit: 'USD/gal',   region: 'Benchmark · RON 92/95' },
  { y: 'HO=F',     s: 'ho.f', key: 'diesel',  name: 'Gasoil / ULSD',    unit: 'USD/gal',   region: 'Benchmark · EN590' },
  { y: 'NG=F',     s: 'ng.f', key: 'natgas',  name: 'Natural Gas',      unit: 'USD/MMBtu', region: 'Americas · Henry Hub' },
  { y: 'TTF=F',    s: null,   key: 'ttf',     name: 'Natural Gas (TTF)',unit: 'EUR/MWh',   region: 'Europe · ICE' },
  { y: 'GC=F',     s: 'gc.f', key: 'gold',    name: 'Gold',             unit: 'USD/oz',    region: 'COMEX' },
  { y: 'DX=F',     s: null,   key: 'dxy',     name: 'US Dollar Index',  unit: 'index',     region: 'ICE · DXY' },
  { y: 'EURUSD=X', s: null,   key: 'eurusd',  name: 'EUR / USD',        unit: 'FX',        region: 'Currency' },
  { y: 'USDJPY=X', s: null,   key: 'usdjpy',  name: 'USD / JPY',        unit: 'FX',        region: 'Currency' },
];

// Primary source: Yahoo Finance chart API (no key needed).
async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
      'Accept': 'application/json',
    },
    cf: { cacheTtl: 600, cacheEverything: true },
  });
  if (!res.ok) throw new Error('yahoo ' + res.status);
  const j = await res.json();
  const result = j && j.chart && j.chart.result && j.chart.result[0];
  const meta = result && result.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('yahoo shape');
  const price = meta.regularMarketPrice;
  const prev = (typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose) ||
               (typeof meta.previousClose === 'number' && meta.previousClose) || null;
  return {
    price: +price.toFixed(4),
    date: new Date((meta.regularMarketTime || Date.now() / 1000) * 1000).toISOString().slice(0, 10),
    change: prev ? +(price - prev).toFixed(4) : null,
    changePct: prev ? +(((price - prev) / prev) * 100).toFixed(2) : null,
  };
}

// Fallback source: stooq.com daily-history CSV.
async function fetchHistory(symbol) {
  // Last ~14 days of daily closes -> last price + change vs previous close.
  const end = new Date();
  const start = new Date(end.getTime() - 14 * 86400 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://stooq.com/q/d/l/?s=${symbol}&d1=${fmt(start)}&d2=${fmt(end)}&i=d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'site-market-widget' },
    cf: { cacheTtl: 600, cacheEverything: true },
  });
  if (!res.ok) throw new Error('upstream ' + res.status);
  const text = await res.text();
  const rows = text.trim().split('\n').slice(1) // drop header
    .map((l) => l.split(','))
    .filter((c) => c.length >= 5 && !isNaN(parseFloat(c[4])));
  if (rows.length < 1) throw new Error('no data');
  const last = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const close = parseFloat(last[4]);
  const prevClose = prev ? parseFloat(prev[4]) : null;
  return {
    price: close,
    date: last[0],
    change: prevClose ? +(close - prevClose).toFixed(4) : null,
    changePct: prevClose ? +(((close - prevClose) / prevClose) * 100).toFixed(2) : null,
  };
}

async function prices() {
  const quotes = await Promise.all(
    SYMBOLS.map(async (sym) => {
      try {
        const q = await fetchYahoo(sym.y);
        return { key: sym.key, name: sym.name, unit: sym.unit, region: sym.region, ...q };
      } catch (e1) {
        if (!sym.s) {
          return { key: sym.key, name: sym.name, unit: sym.unit, region: sym.region, price: null };
        }
        try {
          const q = await fetchHistory(sym.s);
          return { key: sym.key, name: sym.name, unit: sym.unit, region: sym.region, ...q };
        } catch (e2) {
          return { key: sym.key, name: sym.name, unit: sym.unit, region: sym.region, price: null };
        }
      }
    })
  );
  return new Response(
    JSON.stringify({ updated: new Date().toISOString(), source: 'exchange data via Yahoo Finance / stooq (delayed)', quotes }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

// Key ports for the Global Port Watch board. Order matters: the
// Open-Meteo multi-location response comes back in the same order.
const PORTS = [
  { key: 'fujairah',  lat: 25.12, lon: 56.33 },
  { key: 'jebelali',  lat: 25.01, lon: 55.06 },
  { key: 'singapore', lat: 1.26,  lon: 103.84 },
  { key: 'rotterdam', lat: 51.95, lon: 4.14 },
  { key: 'houston',   lat: 29.73, lon: -95.27 },
  { key: 'mumbai',    lat: 18.95, lon: 72.95 },
];

async function ports() {
  const lats = PORTS.map((p) => p.lat).join(',');
  const lons = PORTS.map((p) => p.lon).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,wind_speed_10m,weather_code&wind_speed_unit=kn`;
  const res = await fetch(url, { cf: { cacheTtl: 1800, cacheEverything: true } });
  if (!res.ok) throw new Error('upstream ' + res.status);
  const data = await res.json();
  const list = Array.isArray(data) ? data : [data];
  const out = {};
  PORTS.forEach((p, i) => {
    const cur = list[i] && list[i].current;
    out[p.key] = cur ? {
      temp: cur.temperature_2m,
      windKn: cur.wind_speed_10m,
      code: cur.weather_code,
    } : null;
  });
  return new Response(
    JSON.stringify({ updated: new Date().toISOString(), source: 'open-meteo.com', ports: out }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=900',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/prices') {
      try {
        return await prices();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'feed unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
    }
    if (url.pathname === '/api/ports') {
      try {
        return await ports();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'feed unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
