// DAR AL RIMAL — GSAP + ScrollTrigger + Lenis animations.
// Loaded before main.js; sets window.__GSAP_ANIMS__ so main.js skips its
// IntersectionObserver fallbacks. If GSAP fails to load (offline/CDN),
// main.js's lightweight animations take over automatically.

(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !window.gsap || !window.ScrollTrigger) return;

  window.__GSAP_ANIMS__ = true;
  document.documentElement.classList.add('has-gsap');
  gsap.registerPlugin(ScrollTrigger);

  // ---- Lenis smooth scrolling ----
  if (window.Lenis) {
    var lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // keep anchor links working with Lenis
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length > 1 && document.querySelector(id)) {
          e.preventDefault();
          lenis.scrollTo(id, { offset: -90 });
        }
      });
    });
  }

  // ---- Hero intro timeline ----
  var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.from('.hero .eyebrow', { y: 28, autoAlpha: 0, duration: 0.7 }, 0.15)
    .from('.hero h1', { y: 56, autoAlpha: 0, duration: 1.0 }, '-=0.45')
    .from('.hero p.lead', { y: 40, autoAlpha: 0, duration: 0.8 }, '-=0.6')
    .from('.hero-actions .btn', { y: 26, autoAlpha: 0, duration: 0.6, stagger: 0.12 }, '-=0.5');

  // ---- Scroll reveals (replaces the IO/.visible fallback) ----
  gsap.utils.toArray('.reveal').forEach(function (el) {
    var delay = el.classList.contains('d3') ? 0.3
              : el.classList.contains('d2') ? 0.2
              : el.classList.contains('d1') ? 0.1 : 0;
    gsap.from(el, {
      y: 46,
      autoAlpha: 0,
      duration: 0.9,
      delay: delay,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 87%', once: true }
    });
  });

  // ---- Animated counters ----
  // Markup already carries the final value, so a trigger that never fires
  // can only leave the correct number in place.
  gsap.utils.toArray('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var pad = parseInt(el.getAttribute('data-pad') || '0', 10);
    var obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 95%', once: true },
      onUpdate: function () {
        var v = String(Math.round(obj.v));
        if (pad) v = v.padStart(pad, '0');
        el.textContent = v + suffix;
      }
    });
  });

  // Recalculate trigger positions once everything (fonts, photos) has loaded
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  // ---- Gentle parallax on hero dunes and section visuals ----
  gsap.utils.toArray('.hero-dunes').forEach(function (el) {
    gsap.to(el, {
      yPercent: 18,
      ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top top', end: 'bottom top', scrub: true }
    });
  });
  gsap.utils.toArray('.split-feature .visual').forEach(function (el) {
    gsap.fromTo(el, { y: 40 }, {
      y: -40,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
})();
