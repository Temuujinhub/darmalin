// DAR AL RIMAL — subtle hero atmosphere: golden dust motes drifting over
// the photographic hero, with gentle mouse parallax. Plain 2D canvas,
// no dependencies. Skipped under prefers-reduced-motion.

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var canvas = document.getElementById('hero-dust');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var hero = canvas.parentElement;

  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    W = hero.clientWidth; H = hero.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  var N = 70;
  var parts = [];
  for (var i = 0; i < N; i++) {
    parts.push({
      x: Math.random(), y: Math.random(),
      r: 0.6 + Math.random() * 1.8,          // radius px
      d: 0.3 + Math.random() * 0.7,          // depth (parallax + speed)
      vy: 0.008 + Math.random() * 0.02,      // upward drift %/s
      ph: Math.random() * Math.PI * 2        // twinkle phase
    });
  }

  var mx = 0, my = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  var running = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { running = en[0].isIntersecting; }, { threshold: 0 })
      .observe(canvas);
  }

  var last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) { last = now; return; }
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    mx += (tx - mx) * 0.04;
    my += (ty - my) * 0.04;

    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < N; i++) {
      var p = parts[i];
      p.y -= p.vy * dt * p.d * 4;
      if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      var sway = Math.sin(now / 2400 + p.ph) * 0.006;
      var x = (p.x + sway + mx * 0.015 * p.d) * W;
      var y = (p.y + my * 0.012 * p.d) * H;
      var tw = 0.35 + 0.3 * Math.sin(now / 900 + p.ph);
      ctx.beginPath();
      ctx.arc(x, y, p.r * (0.6 + p.d * 0.7), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212,179,110,' + (tw * p.d).toFixed(3) + ')';
      ctx.fill();
    }
  }
  requestAnimationFrame(frame);
})();
