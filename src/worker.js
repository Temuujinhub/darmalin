// DAR AL RIMAL — Cloudflare Worker
// Serves the static site from ./public and exposes:
//   /api/prices — petroleum benchmarks by hub, from three public sources:
//                 NYMEX/ICE futures (Yahoo Finance, stooq fallback),
//                 Shanghai INE/SHFE + Dalian DCE (Sina Finance),
//                 U.S. port spot prices (EIA open data, needs EIA_API_KEY)
//   /api/ports  — current weather at key oil ports (Open-Meteo)
// Everything is fetched server-side and cached at the edge.

import { parseYahooChart, parseStooqCsv, parseSina, parseEia } from './parsers.js';

// ---- NYMEX / ICE futures via Yahoo Finance ----
// strict: instrument name must be present and match (unproven symbols).
const YAHOO = [
  { y: 'BZ=F',  s: 'cb.f', key: 'brent',     name: 'Brent Crude',      unit: 'USD/bbl',   region: 'North Sea · Europe',     source: 'ICE / NYMEX', expect: /brent/i,              min: 5,   max: 400 },
  { y: 'CL=F',  s: 'cl.f', key: 'wti',       name: 'WTI Crude',        unit: 'USD/bbl',   region: 'Cushing, Oklahoma',      source: 'NYMEX',       expect: /crude/i,              min: 5,   max: 400 },
  { y: 'HCL=F', s: null,   key: 'wti_hou',   name: 'WTI Houston',      unit: 'USD/bbl',   region: 'Houston, Texas',         source: 'NYMEX',       expect: /houston/i, strict: true, min: 5, max: 400 },
  { y: 'RB=F',  s: 'rb.f', key: 'rbob',      name: 'Gasoline RBOB',    unit: 'USD/gal',   region: 'New York Harbor',        source: 'NYMEX',       expect: /gasoline|rbob/i,      min: 0.2, max: 12 },
  { y: 'HO=F',  s: 'ho.f', key: 'ulsd',      name: 'Diesel ULSD',      unit: 'USD/gal',   region: 'New York Harbor',        source: 'NYMEX',       expect: /heating oil|ulsd/i,   min: 0.2, max: 12 },
  { y: 'B0=F',  s: null,   key: 'propane',   name: 'Propane (LPG)',    unit: 'USD/gal',   region: 'Mont Belvieu, Texas',    source: 'NYMEX · OPIS',expect: /propane/i, strict: true, min: 0.05, max: 6 },
  { y: 'NG=F',  s: 'ng.f', key: 'natgas',    name: 'Natural Gas',      unit: 'USD/MMBtu', region: 'Henry Hub, Louisiana',   source: 'NYMEX',       expect: /natural gas/i,        min: 0.5, max: 60 },
  { y: 'TTF=F', s: null,   key: 'ttf',       name: 'Natural Gas TTF',  unit: 'EUR/MWh',   region: 'Netherlands · Europe',   source: 'ICE Endex',   expect: /ttf/i, strict: true,  min: 2,   max: 500 },
  { y: 'JKM=F', s: null,   key: 'jkm',       name: 'LNG (JKM)',        unit: 'USD/MMBtu', region: 'Japan / Korea',          source: 'NYMEX · Platts', expect: /jkm|lng/i, strict: true, min: 1, max: 120 },
];

// ---- Shanghai INE / SHFE and Dalian DCE via Sina Finance ----
const SINA = [
  { c: 'nf_SC0', key: 'ine_crude', name: 'Crude Oil (INE)',      unit: 'CNY/bbl', region: 'Shanghai · China', source: 'INE',  min: 150,  max: 1500 },
  { c: 'nf_FU0', key: 'shfe_fo',   name: 'Fuel Oil 380',         unit: 'CNY/t',   region: 'Shanghai · China', source: 'SHFE', min: 1000, max: 9000 },
  { c: 'nf_LU0', key: 'ine_lsfo',  name: 'Low-Sulphur Fuel Oil', unit: 'CNY/t',   region: 'Shanghai · China', source: 'INE',  min: 1500, max: 12000 },
  { c: 'nf_BU0', key: 'shfe_bu',   name: 'Bitumen',              unit: 'CNY/t',   region: 'Shanghai · China', source: 'SHFE', min: 1500, max: 8000 },
  { c: 'nf_PG0', key: 'dce_lpg',   name: 'LPG',                  unit: 'CNY/t',   region: 'Dalian · China',   source: 'DCE',  min: 2000, max: 10000 },
];

// ---- U.S. port spot prices via EIA open data (free key required) ----
const EIA = [
  { id: 'EER_EPMRU_PF4_RGC_DPG',    key: 'usgc_gas',  name: 'Gasoline Regular',  unit: 'USD/gal', region: 'US Gulf Coast',   source: 'EIA spot', min: 0.2, max: 12 },
  { id: 'EER_EPD2DXL0_PF4_RGC_DPG', key: 'usgc_ulsd', name: 'Diesel ULSD',       unit: 'USD/gal', region: 'US Gulf Coast',   source: 'EIA spot', min: 0.2, max: 12 },
  { id: 'EER_EPJK_PF4_RGC_DPG',     key: 'usgc_jet',  name: 'Jet Fuel',          unit: 'USD/gal', region: 'US Gulf Coast',   source: 'EIA spot', min: 0.2, max: 12 },
  { id: 'EER_EPD2DC_PF4_Y05LA_DPG', key: 'la_carb',   name: 'Diesel CARB ULSD',  unit: 'USD/gal', region: 'Los Angeles',     source: 'EIA spot', min: 0.2, max: 12 },
  { id: 'EER_EPMRR_PF4_Y05LA_DPG',  key: 'la_rbob',   name: 'Gasoline RBOB',     unit: 'USD/gal', region: 'Los Angeles',     source: 'EIA spot', min: 0.2, max: 12 },
  { id: 'EER_EPD2F_PF4_Y35NY_DPG',  key: 'nyh_ho',    name: 'Heating Oil No. 2', unit: 'USD/gal', region: 'New York Harbor', source: 'EIA spot', min: 0.2, max: 12 },
];

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';

function card(cfg, q) {
  return { key: cfg.key, name: cfg.name, unit: cfg.unit, region: cfg.region, source: cfg.source, ...q };
}

async function yahooQuote(cfg) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cfg.y)}?range=5d&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      cf: { cacheTtl: 600, cacheEverything: true },
    });
    if (res.ok) {
      const q = parseYahooChart(await res.json(), cfg);
      if (q) return card(cfg, q);
    }
  } catch (e) { /* fall through to stooq */ }

  if (!cfg.s) return null;
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 14 * 86400 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const res = await fetch(`https://stooq.com/q/d/l/?s=${cfg.s}&d1=${fmt(start)}&d2=${fmt(end)}&i=d`, {
      headers: { 'User-Agent': UA },
      cf: { cacheTtl: 600, cacheEverything: true },
    });
    if (!res.ok) return null;
    const q = parseStooqCsv(await res.text());
    if (!q || q.price < cfg.min || q.price > cfg.max) return null;
    return card(cfg, q);
  } catch (e) {
    return null;
  }
}

async function sinaQuotes() {
  try {
    const res = await fetch('https://hq.sinajs.cn/list=' + SINA.map((c) => c.c).join(','), {
      headers: { 'Referer': 'https://finance.sina.com.cn/', 'User-Agent': UA },
      cf: { cacheTtl: 600, cacheEverything: true },
    });
    if (!res.ok) return [];
    const parsed = parseSina(await res.text(), SINA);
    return SINA.filter((c) => parsed[c.key]).map((c) => card(c, parsed[c.key]));
  } catch (e) {
    return [];
  }
}

async function eiaQuotes(env) {
  const apiKey = env && env.EIA_API_KEY;
  if (!apiKey) return [];
  try {
    const facets = EIA.map((c) => 'facets[series][]=' + c.id).join('&');
    const url = 'https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=' + encodeURIComponent(apiKey) +
      '&frequency=daily&data[0]=value&' + facets +
      '&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=80';
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const parsed = parseEia(await res.json(), EIA);
    return EIA.filter((c) => parsed[c.key]).map((c) => card(c, parsed[c.key]));
  } catch (e) {
    return [];
  }
}

async function prices(env) {
  const [yahoo, sina, eia] = await Promise.all([
    Promise.all(YAHOO.map(yahooQuote)).then((list) => list.filter(Boolean)),
    sinaQuotes(),
    eiaQuotes(env),
  ]);

  // Display order: crude by hub, then products by hub, then gas.
  const byKey = {};
  [...yahoo, ...sina, ...eia].forEach((q) => { byKey[q.key] = q; });
  const ORDER = [
    'brent', 'wti', 'wti_hou', 'ine_crude',
    'rbob', 'ulsd', 'nyh_ho',
    'usgc_gas', 'usgc_ulsd', 'usgc_jet',
    'la_rbob', 'la_carb',
    'shfe_fo', 'ine_lsfo', 'shfe_bu',
    'propane', 'dce_lpg',
    'natgas', 'ttf', 'jkm',
  ];
  const quotes = ORDER.map((k) => byKey[k]).filter(Boolean);

  const sources = [];
  if (yahoo.length) sources.push('NYMEX / ICE futures via Yahoo Finance');
  if (sina.length) sources.push('Shanghai INE / SHFE and Dalian DCE via Sina Finance');
  if (eia.length) sources.push('U.S. port spot prices via EIA');

  return new Response(
    JSON.stringify({ updated: new Date().toISOString(), sources, quotes }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

// ---- Global Port Watch ----
// Order matters: the Open-Meteo multi-location response comes back in
// the same order.
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

function unavailable() {
  return new Response(JSON.stringify({ error: 'feed unavailable' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/prices') {
      try { return await prices(env); } catch (e) { return unavailable(); }
    }
    if (url.pathname === '/api/ports') {
      try { return await ports(); } catch (e) { return unavailable(); }
    }
    return env.ASSETS.fetch(request);
  },
};
