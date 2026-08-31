// DAR AL RIMAL — Three.js particle-wave hero background.
// A field of gold/blue particles undulating like desert dunes, with
// mouse-follow parallax. Degrades gracefully: no WebGL, no THREE, or
// prefers-reduced-motion => the static gradient hero remains.

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var container = document.getElementById('hero-canvas');
  if (!container || !window.THREE) return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 1000);
  camera.position.set(0, 42, 120);
  camera.lookAt(0, 0, 0);

  // ---- Dune wave grid ----
  var COLS = 130, ROWS = 70;
  var SPREAD_X = 420, SPREAD_Z = 260;
  var count = COLS * ROWS;
  var positions = new Float32Array(count * 3);
  var colors = new Float32Array(count * 3);

  var gold = new THREE.Color(0xd9b96a);
  var blue = new THREE.Color(0x4a6db5);
  var white = new THREE.Color(0xf7f3ea);
  var tmp = new THREE.Color();

  var i3 = 0;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      positions[i3]     = (c / (COLS - 1) - 0.5) * SPREAD_X;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = (r / (ROWS - 1) - 0.5) * SPREAD_Z;
      // gold on the right, blue on the left, occasional white sparkle
      var t = c / (COLS - 1);
      tmp.copy(blue).lerp(gold, Math.pow(t, 1.3));
      if (Math.random() < 0.04) tmp.copy(white);
      colors[i3] = tmp.r; colors[i3 + 1] = tmp.g; colors[i3 + 2] = tmp.b;
      i3 += 3;
    }
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // soft round sprite so particles render as glowing dots, not squares
  function makeDotTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }
  var dotTex = makeDotTexture();

  var mat = new THREE.PointsMaterial({
    size: 2.6,
    map: dotTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    alphaTest: 0.01,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  var points = new THREE.Points(geo, mat);
  points.position.y = -26;
  scene.add(points);

  // ---- Floating dust motes ----
  var DUST = 260;
  var dustPos = new Float32Array(DUST * 3);
  for (var d = 0; d < DUST * 3; d += 3) {
    dustPos[d]     = (Math.random() - 0.5) * 420;
    dustPos[d + 1] = Math.random() * 120 - 20;
    dustPos[d + 2] = (Math.random() - 0.5) * 240;
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dustMat = new THREE.PointsMaterial({
    size: 2.4,
    map: dotTex,
    color: 0xd9b96a,
    transparent: true,
    opacity: 0.45,
    alphaTest: 0.01,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  var dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // ---- Mouse parallax ----
  var mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  window.addEventListener('pointermove', function (e) {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  var clock = new THREE.Clock();
  var running = true;

  // Pause rendering when the hero is off-screen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      running = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(container);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!running) return;

    var t = clock.getElapsedTime();
    mouseX += (targetX - mouseX) * 0.04;
    mouseY += (targetY - mouseY) * 0.04;

    // dune waves
    var pos = geo.attributes.position.array;
    var i = 0;
    for (var rr = 0; rr < ROWS; rr++) {
      for (var cc = 0; cc < COLS; cc++) {
        var x = pos[i], z = pos[i + 2];
        pos[i + 1] =
          Math.sin(x * 0.022 + t * 0.8) * 7 +
          Math.cos(z * 0.035 + t * 0.55) * 5 +
          Math.sin((x + z) * 0.012 + t * 0.35) * 4;
        i += 3;
      }
    }
    geo.attributes.position.needsUpdate = true;

    // slow dust drift upward
    var dp = dustGeo.attributes.position.array;
    for (var k = 1; k < dp.length; k += 3) {
      dp[k] += 0.045;
      if (dp[k] > 110) dp[k] = -20;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // camera follows the mouse gently
    camera.position.x = mouseX * 26;
    camera.position.y = 42 - mouseY * 14;
    camera.lookAt(0, 0, 0);

    points.rotation.y = Math.sin(t * 0.06) * 0.06;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function () {
    var w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
})();
