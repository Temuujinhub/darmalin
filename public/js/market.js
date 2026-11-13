// DAR AL RIMAL — Live market watch
// /api/prices (Cloudflare Worker) returns petroleum benchmarks by hub
// from several public sources. Renders an auto-scrolling exchange-style
// ticker; degrades to a quiet notice if the feed fails.

(function () {
  var board = document.getElementById('market-board');
  if (!board) return;
  var updatedEl = document.getElementById('market-updated');
  var sourcesEl = document.getElementById('market-sources');

  function fmtPrice(q) {
    if (q.price == null) return '—';
    var dp = q.price >= 1000 ? 0 : 2;
    return q.price.toLocaleString('en-US', {
      minimumFractionDigits: dp,
      maximumFractionDigits: q.price < 10 ? 4 : dp
    });
  }

  function fmtDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
    var d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  }

  function cardHTML(q) {
    var dir = q.changePct == null ? 'flat' : q.changePct >= 0 ? 'up' : 'down';
    var arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•';
    var dp = Math.abs(q.change || 0) >= 100 ? 0 : 2;
    var chg = q.changePct == null ? '' :
      (q.change >= 0 ? '+' : '') + q.change.toFixed(dp) + ' (' + (q.changePct >= 0 ? '+' : '') + q.changePct.toFixed(2) + '%)';
    var date = fmtDate(q.date);
    return '<div class="mkt-card">' +
      '<div class="mkt-name">' + q.name + '</div>' +
      '<div class="mkt-region">' + q.region + '</div>' +
      '<div class="mkt-price">' + fmtPrice(q) + ' <span class="mkt-unit">' + q.unit + '</span></div>' +
      '<div class="mkt-chg ' + dir + '">' + arrow + ' ' + (chg || 'n/a') + '</div>' +
      '<div class="mkt-src">' + (q.source || '') + (date ? ' · ' + date : '') + '</div>' +
      '</div>';
  }

  function render(data) {
    var quotes = data.quotes.filter(function (q) { return q.price != null; });
    var strip = quotes.map(cardHTML).join('');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Duplicate the strip so the marquee loops seamlessly.
    board.innerHTML = '<div class="mkt-track' + (reduced ? ' static' : '') + '">' + strip + strip + '</div>';
    board.firstChild.style.animationDuration = (quotes.length * 4.5) + 's';
    if (updatedEl) {
      var d = new Date(data.updated);
      updatedEl.textContent = 'Updated ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' · delayed data';
    }
    if (sourcesEl && data.sources && data.sources.length) {
      sourcesEl.textContent = 'Sources: ' + data.sources.join(' · ') + '.';
    }
  }

  function renderError() {
    board.innerHTML = '<div class="mkt-offline">Live benchmark feed is temporarily unavailable. Our desk quotes firm prices for all products — call +971 52 352 7887.</div>';
    if (updatedEl) updatedEl.textContent = '';
  }

  function load() {
    fetch('/api/prices', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (data) {
        if (!data.quotes || !data.quotes.some(function (q) { return q.price != null; })) throw 0;
        render(data);
      })
      .catch(renderError);
  }

  load();
  setInterval(load, 5 * 60 * 1000);
})();
