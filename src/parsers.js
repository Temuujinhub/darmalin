// Pure parsing + validation helpers for the market feeds.
// Every parser returns null (or skips the row) rather than a doubtful
// number: a quote is only shown when the upstream payload passes its
// identity and plausibility checks.

function round(n, dp) {
  return +n.toFixed(dp);
}

function withChange(price, prev) {
  const ok = typeof prev === 'number' && isFinite(prev) && prev > 0;
  return {
    price: round(price, 4),
    change: ok ? round(price - prev, 4) : null,
    changePct: ok ? round(((price - prev) / prev) * 100, 2) : null,
  };
}

// ---- Yahoo Finance v8 chart ----
// cfg.expect: regex the instrument name must match.
// cfg.strict: when true, a missing name is a rejection too (used for
// symbols that have not been seen working in production).
export function parseYahooChart(json, cfg) {
  const result = json && json.chart && json.chart.result && json.chart.result[0];
  const meta = result && result.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number' || !(meta.regularMarketPrice > 0)) return null;

  const name = String(meta.shortName || meta.longName || '');
  if (cfg.expect) {
    if (name) {
      if (!cfg.expect.test(name)) return null;
    } else if (cfg.strict) {
      return null;
    }
  }

  const price = meta.regularMarketPrice;
  if (cfg.min != null && price < cfg.min) return null;
  if (cfg.max != null && price > cfg.max) return null;

  // Daily change: previous daily close from the series, not
  // chartPreviousClose (which is the close before the whole range).
  let prev = null;
  const q = result.indicators && result.indicators.quote && result.indicators.quote[0];
  const closes = q && Array.isArray(q.close) ? q.close.filter((v) => typeof v === 'number' && v > 0) : [];
  if (closes.length >= 2) prev = closes[closes.length - 2];
  else if (typeof meta.previousClose === 'number') prev = meta.previousClose;
  else if (typeof meta.chartPreviousClose === 'number') prev = meta.chartPreviousClose;

  const t = typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime * 1000 : Date.now();
  return { ...withChange(price, prev), date: new Date(t).toISOString().slice(0, 10) };
}

// ---- stooq.com daily history CSV (fallback) ----
export function parseStooqCsv(text) {
  const rows = String(text).trim().split('\n').slice(1)
    .map((l) => l.split(','))
    .filter((c) => c.length >= 5 && isFinite(parseFloat(c[4])) && parseFloat(c[4]) > 0);
  if (rows.length < 1) return null;
  const last = rows[rows.length - 1];
  const prev = rows.length > 1 ? parseFloat(rows[rows.length - 2][4]) : null;
  return { ...withChange(parseFloat(last[4]), prev), date: last[0] };
}

// ---- Sina Finance domestic futures (hq.sinajs.cn, nf_ codes) ----
// Line: var hq_str_nf_SC0="name,time,open,high,low,_,bid,ask,last,settle,prevSettle,...,date,...";
// Accepted only if last sits inside the day's [low, high], inside the
// configured plausible range, and within 20% of the previous settlement.
export function parseSina(text, cfgList) {
  const out = {};
  const re = /hq_str_(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(String(text)))) {
    const cfg = cfgList.find((c) => c.c === m[1]);
    if (!cfg) continue;
    const f = m[2].split(',');
    if (f.length < 11) continue;
    const high = parseFloat(f[3]);
    const low = parseFloat(f[4]);
    const last = parseFloat(f[8]);
    const prev = parseFloat(f[10]);
    if (![high, low, last, prev].every((v) => isFinite(v) && v > 0)) continue;
    if (last < low * 0.999 || last > high * 1.001) continue;
    if (last < cfg.min || last > cfg.max) continue;
    if (Math.abs(last / prev - 1) > 0.2) continue;
    const date = f.find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) || null;
    out[cfg.key] = { ...withChange(last, prev), date };
  }
  return out;
}

// ---- U.S. EIA open data v2 (petroleum spot prices) ----
// Rows arrive newest-first; first row per series is the latest value,
// the second is the previous publication.
export function parseEia(json, cfgList) {
  const rows = json && json.response && Array.isArray(json.response.data) ? json.response.data : [];
  const bySeries = {};
  rows.forEach((r) => {
    const v = parseFloat(r.value);
    if (!r.series || !isFinite(v) || !(v > 0)) return;
    (bySeries[r.series] = bySeries[r.series] || []).push({ period: String(r.period || ''), value: v });
  });
  const out = {};
  cfgList.forEach((cfg) => {
    const list = (bySeries[cfg.id] || []).sort((a, b) => (a.period < b.period ? 1 : -1));
    if (!list.length) return;
    const latest = list[0];
    if (latest.value < cfg.min || latest.value > cfg.max) return;
    const prev = list[1] ? list[1].value : null;
    out[cfg.key] = { ...withChange(latest.value, prev), date: latest.period };
  });
  return out;
}
