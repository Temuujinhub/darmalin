// DAR AL RIMAL — Global Port Watch
// Local time ticks client-side (works even offline); current weather
// comes from /api/ports (Cloudflare Worker -> open-meteo.com, cached).

(function () {
  var board = document.getElementById('port-board');
  if (!board) return;

  var PORTS = [
    { key: 'fujairah',  name: 'Fujairah',      country: 'UAE',          tz: 'Asia/Dubai',       role: 'Bunkering & storage hub' },
    { key: 'jebelali',  name: 'Jebel Ali',     country: 'Dubai · UAE',  tz: 'Asia/Dubai',       role: 'Container & liquids port' },
    { key: 'singapore', name: 'Singapore',     country: 'Singapore',    tz: 'Asia/Singapore',   role: 'Asia trading hub' },
    { key: 'rotterdam', name: 'Rotterdam',     country: 'Netherlands',  tz: 'Europe/Amsterdam', role: 'Europe refining hub' },
    { key: 'houston',   name: 'Houston',       country: 'USA',          tz: 'America/Chicago',  role: 'US Gulf export hub' },
    { key: 'mumbai',    name: 'Mumbai (JNPT)', country: 'India',        tz: 'Asia/Kolkata',     role: 'Indian subcontinent' }
  ];

  // WMO weather code -> icon + label
  function wmo(code) {
    if (code === 0) return ['☀️', 'Clear'];
    if (code <= 2) return ['⛅', 'Partly cloudy'];
    if (code === 3) return ['☁️', 'Overcast'];
    if (code === 45 || code === 48) return ['🌫️', 'Fog'];
    if (code <= 57) return ['🌦️', 'Drizzle'];
    if (code <= 67) return ['🌧️', 'Rain'];
    if (code <= 77) return ['🌨️', 'Snow'];
    if (code <= 82) return ['🌧️', 'Showers'];
    if (code <= 86) return ['🌨️', 'Snow showers'];
    return ['⛈️', 'Thunderstorm'];
  }

  // Build cards once
  var cells = {};
  PORTS.forEach(function (p) {
    var card = document.createElement('div');
    card.className = 'port-card';
    card.innerHTML =
      '<div class="port-head"><span class="port-name">' + p.name + '</span>' +
      '<span class="port-country">' + p.country + '</span></div>' +
      '<div class="port-time" data-k="time">--:--</div>' +
      '<div class="port-wx" data-k="wx"><span class="wx-icon">·</span> <span class="wx-text">loading…</span></div>' +
      '<div class="port-role">' + p.role + '</div>';
    board.appendChild(card);
    cells[p.key] = {
      time: card.querySelector('[data-k="time"]'),
      wx: card.querySelector('[data-k="wx"]')
    };
  });

  function tick() {
    var now = new Date();
    PORTS.forEach(function (p) {
      try {
        cells[p.key].time.textContent = new Intl.DateTimeFormat('en-GB', {
          timeZone: p.tz, hour: '2-digit', minute: '2-digit', hour12: false
        }).format(now);
      } catch (e) { /* keep placeholder */ }
    });
  }
  tick();
  setInterval(tick, 30000);

  function loadWeather() {
    fetch('/api/ports', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (data) {
        PORTS.forEach(function (p) {
          var w = data.ports && data.ports[p.key];
          if (!w) return;
          var m = wmo(w.code);
          cells[p.key].wx.innerHTML =
            '<span class="wx-icon">' + m[0] + '</span> ' +
            '<span class="wx-text">' + Math.round(w.temp) + '°C · ' + m[1] +
            ' · wind ' + Math.round(w.windKn) + ' kn</span>';
        });
      })
      .catch(function () {
        PORTS.forEach(function (p) {
          cells[p.key].wx.innerHTML = '<span class="wx-text">weather feed offline</span>';
        });
      });
  }
  loadWeather();
  setInterval(loadWeather, 30 * 60 * 1000);
})();
