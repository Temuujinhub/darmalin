// DAR AL RIMAL — shared site behavior

(function () {
  // Sticky header shadow
  var header = document.querySelector('.site-header');
  var onScroll = function () {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 10);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile nav
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.classList.remove('open');
      });
    });
  }

  // When animations.js has GSAP running, it owns reveals and counters.
  var gsapActive = !!window.__GSAP_ANIMS__;

  // Scroll reveal
  var revealEls = gsapActive ? [] : document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  // Animated counters
  var counters = gsapActive ? [] : document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target;
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';
        var pad = parseInt(el.getAttribute('data-pad') || '0', 10);
        var dur = 1600;
        var start = null;
        var step = function (ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          var v = String(Math.round(target * eased));
          if (pad) v = v.padStart(pad, '0');
          el.textContent = v + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  // DXB clock + desk status in the top bar
  var clockEl = document.getElementById('dxb-clock');
  var statusEl = document.getElementById('desk-status');
  if (clockEl) {
    var tick = function () {
      try {
        var now = new Date();
        var time = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: false
        }).format(now);
        clockEl.textContent = 'DXB ' + time + ' GMT+4';
        if (statusEl) {
          var parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Dubai', weekday: 'short', hour: 'numeric', hourCycle: 'h23'
          }).formatToParts(now);
          var wd = '', hr = 0;
          parts.forEach(function (p) {
            if (p.type === 'weekday') wd = p.value;
            if (p.type === 'hour') hr = parseInt(p.value, 10);
          });
          var open = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(wd) !== -1 && hr >= 9 && hr < 18;
          statusEl.textContent = open ? 'ACTIVE' : 'ON CALL';
        }
      } catch (e) { /* older browsers: leave defaults */ }
    };
    tick();
    setInterval(tick, 30000);
  }

  // Floating WhatsApp button (the desk number is on WhatsApp)
  if (!document.querySelector('.wa-float')) {
    var wa = document.createElement('a');
    wa.className = 'wa-float';
    wa.href = 'https://wa.me/971523527887';
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.setAttribute('aria-label', 'Chat with the trade desk on WhatsApp');
    wa.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3l-4.5 1.2Z"/>' +
      '<path d="M9 8.5c-.3 1 .3 2.6 1.8 4.1 1.5 1.5 3.1 2.1 4.1 1.8l.9-1.2-1.7-1-.8.7c-.6-.2-1.3-.8-1.9-1.6l.6-.9-1.1-1.7L9 8.5Z" fill="currentColor" stroke="none"/></svg>' +
      '<span>WhatsApp</span>';
    document.body.appendChild(wa);
  }

  // Footer year
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();
