// DAR AL RIMAL — Cloudflare Worker
// Serves the static site from ./public and exposes:
//   /api/prices — delayed exchange benchmark quotes (stooq.com CSV),
//   /api/ports  — current weather at key oil ports (Open-Meteo),
// both fetched server-side and cached at the edge.

const SYMBOLS = [
  { s: 'cb.f', key: 'brent',   name: 'Brent Crude',      unit: 'USD/bbl',   region: 'Europe · ICE' },
  { s: 'cl.f', key: 'wti',     name: 'WTI Crude',        unit: 'USD/bbl',   region: 'Americas · NYMEX' },
  { s: 'rb.f', key: 'gasoline',name: 'Gasoline (RBOB)',  unit: 'USD/gal',   region: 'Benchmark · RON 92/95' },
  { s: 'ho.f', key: 'diesel',  name: 'Gasoil / ULSD',    unit: 'USD/gal',   region: 'Benchmark · EN590' },
  { s: 'ng.f', key: 'natgas',  name: 'Natural Gas',      unit: 'USD/MMBtu', region: 'Americas · Henry Hub' },
];

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
        const q = await fetchHistory(sym.s);
        return { key: sym.key, name: sym.name, unit: sym.unit, region: sym.region, ...q };
      } catch (e) {
        return { key: sym.key, name: sym.name, unit: sym.unit, region: sym.region, price: null };
      }
    })
  );
  return new Response(
    JSON.stringify({ updated: new Date().toISOString(), source: 'stooq.com (delayed exchange data)', quotes }),
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
