// DAR AL RIMAL — Live market watch
// /api/prices (Cloudflare Worker -> stooq.com delayed exchange data)
// + FX reference rates fetched directly from api.frankfurter.app (ECB).
// Renders an exchange-style board; degrades to a quiet notice if feeds fail.

(function () {
  var board = document.getElementById('market-board');
  if (!board) return;
  var updatedEl = document.getElementById('market-updated');
  var fxEl = document.getElementById('fx-strip');

  function fmtPrice(q) {
    if (q.price == null) return '—';
    return q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: q.price < 10 ? 4 : 2 });
  }

  function render(data) {
    board.innerHTML = '';
    data.quotes.forEach(function (q) {
      var dir = q.changePct == null ? 'flat' : q.changePct >= 0 ? 'up' : 'down';
      var arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•';
      var chg = q.changePct == null ? '' :
        (q.change >= 0 ? '+' : '') + q.change.toFixed(2) + ' (' + (q.changePct >= 0 ? '+' : '') + q.changePct.toFixed(2) + '%)';
      var card = document.createElement('div');
      card.className = 'mkt-card';
      card.innerHTML =
        '<div class="mkt-name">' + q.name + '</div>' +
        '<div class="mkt-region">' + q.region + '</div>' +
        '<div class="mkt-price">' + fmtPrice(q) + ' <span class="mkt-unit">' + q.unit + '</span></div>' +
        '<div class="mkt-chg ' + dir + '">' + arrow + ' ' + (chg || 'n/a') + '</div>';
      board.appendChild(card);
    });
    if (updatedEl) {
      var d = new Date(data.updated);
      updatedEl.textContent = 'Updated ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' · delayed data';
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

  function loadFx() {
    if (!fxEl) return;
    fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CNY')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var r = d.rates || {};
        var parts = [];
        if (r.EUR) parts.push('EUR/USD ' + (1 / r.EUR).toFixed(4));
        if (r.GBP) parts.push('GBP/USD ' + (1 / r.GBP).toFixed(4));
        if (r.JPY) parts.push('USD/JPY ' + r.JPY.toFixed(2));
        if (r.CNY) parts.push('USD/CNY ' + r.CNY.toFixed(4));
        parts.push('USD/AED 3.6725 (pegged)');
        fxEl.textContent = 'FX · ' + parts.join('   ·   ') + '   ·   ECB reference rates';
      })
      .catch(function () {
        fxEl.textContent = 'FX · USD/AED 3.6725 (pegged)';
      });
  }

  load();
  loadFx();
  setInterval(load, 5 * 60 * 1000);
  setInterval(loadFx, 60 * 60 * 1000);
})();
