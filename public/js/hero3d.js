// DAR AL RIMAL — animated hero: a glittering particle ocean with a tanker
// silhouette steaming across, leaving a foam wake (Centalion-style motion,
// in brand navy/gold). Mouse-follow parallax. Degrades gracefully: no WebGL,
// no THREE, or prefers-reduced-motion => the static gradient hero remains.

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
  var camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 1, 1200);
  camera.position.set(0, 40, 120);
  camera.lookAt(0, 0, -10);

  // soft round sprite for glowing dots
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
    return new THREE.CanvasTexture(c);
  }
  var dotTex = makeDotTexture();

  // ---- Ocean wave height (shared by sea, ship and wake) ----
  function waveY(x, z, t) {
    return Math.sin(x * 0.022 + t * 0.8) * 7 +
           Math.cos(z * 0.035 + t * 0.55) * 5 +
           Math.sin((x + z) * 0.012 + t * 0.35) * 4;
  }

  // ---- Particle ocean ----
  var COLS = 130, ROWS = 70;
  var SPREAD_X = 460, SPREAD_Z = 280;
  var count = COLS * ROWS;
  var positions = new Float32Array(count * 3);
  var colors = new Float32Array(count * 3);
  var gold = new THREE.Color(0xd4b36e);
  var blue = new THREE.Color(0x4a6db5);
  var white = new THREE.Color(0xf4f6f9);
  var tmp = new THREE.Color();
  var i3 = 0;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      positions[i3]     = (c / (COLS - 1) - 0.5) * SPREAD_X;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = (r / (ROWS - 1) - 0.5) * SPREAD_Z;
      var tcol = c / (COLS - 1);
      tmp.copy(blue).lerp(gold, Math.pow(tcol, 1.3));
      if (Math.random() < 0.04) tmp.copy(white);
      colors[i3] = tmp.r; colors[i3 + 1] = tmp.g; colors[i3 + 2] = tmp.b;
      i3 += 3;
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  var seaMat = new THREE.PointsMaterial({
    size: 2.6, map: dotTex, vertexColors: true, transparent: true, opacity: 0.9,
    alphaTest: 0.01, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  var sea = new THREE.Points(geo, seaMat);
  sea.position.y = -26;
  scene.add(sea);

  // ---- Floating dust motes ----
  var DUST = 220;
  var dustPos = new Float32Array(DUST * 3);
  for (var d = 0; d < DUST * 3; d += 3) {
    dustPos[d]     = (Math.random() - 0.5) * 460;
    dustPos[d + 1] = Math.random() * 120 - 20;
    dustPos[d + 2] = (Math.random() - 0.5) * 260;
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dustMat = new THREE.PointsMaterial({
    size: 2.2, map: dotTex, color: 0xd4b36e, transparent: true, opacity: 0.4,
    alphaTest: 0.01, blending: THREE.AdditiveBlending, depthWrite: false
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  // ---- Tanker silhouette ----
  var ship = new THREE.Group();
  var hullMat = new THREE.MeshBasicMaterial({ color: 0x050d1c });
  var trimMat = new THREE.MeshBasicMaterial({ color: 0xc5a059 });
  var glowMat = new THREE.MeshBasicMaterial({ color: 0xf0dcae });

  // hull
  var hull = new THREE.Mesh(new THREE.BoxGeometry(84, 7, 11), hullMat);
  hull.position.y = 3.5;
  ship.add(hull);
  // bow wedge
  var bowShape = new THREE.Shape();
  bowShape.moveTo(0, 0); bowShape.lineTo(16, 5.5); bowShape.lineTo(0, 11);
  var bowGeo = new THREE.ExtrudeGeometry(bowShape, { depth: 7, bevelEnabled: false });
  var bow = new THREE.Mesh(bowGeo, hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.position.set(-42 - 0, 7, -5.5);
  bow.rotation.z = Math.PI;
  bow.position.x = -42;
  ship.add(bow);
  // gold waterline trim
  var trim = new THREE.Mesh(new THREE.BoxGeometry(84.4, 0.7, 11.4), trimMat);
  trim.position.y = 1.2;
  ship.add(trim);
  // deck piping blocks
  for (var k = 0; k < 4; k++) {
    var tank = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 7), hullMat);
    tank.position.set(-26 + k * 15, 8.2, 0);
    ship.add(tank);
  }
  // aft superstructure
  var tower = new THREE.Mesh(new THREE.BoxGeometry(10, 13, 9), hullMat);
  tower.position.set(33, 13.5, 0);
  ship.add(tower);
  // lit windows
  for (var w = 0; w < 3; w++) {
    var win = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.8, 9.3), glowMat);
    win.position.set(33, 10 + w * 3.2, 0);
    ship.add(win);
  }
  // funnel
  var funnel = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.5, 5), trimMat);
  funnel.position.set(35.5, 22, 0);
  ship.add(funnel);
  // mast light
  var mast = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), hullMat);
  mast.position.set(-38, 11, 0);
  ship.add(mast);
  var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), glowMat);
  lamp.position.set(-38, 14.5, 0);
  ship.add(lamp);

  var SHIP_SCALE = 0.55;
  ship.position.set(320, -24, -10);
  ship.scale.setScalar(SHIP_SCALE);
  scene.add(ship);

  // ---- Foam wake ----
  var WAKE = 520;
  var wakePos = new Float32Array(WAKE * 3);
  var wakeVel = new Float32Array(WAKE * 3);
  var wakeLife = new Float32Array(WAKE);
  for (var q = 0; q < WAKE; q++) { wakeLife[q] = -1; wakePos[q * 3 + 1] = -9999; }
  var wakeGeo = new THREE.BufferGeometry();
  wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakePos, 3));
  var wakeMat = new THREE.PointsMaterial({
    size: 3.2, map: dotTex, color: 0xeef3fa, transparent: true, opacity: 0.8,
    alphaTest: 0.01, blending: THREE.AdditiveBlending, depthWrite: false
  });
  scene.add(new THREE.Points(wakeGeo, wakeMat));
  var wakeCursor = 0;

  function spawnWake(x, y, z, spread) {
    var i = wakeCursor;
    wakeCursor = (wakeCursor + 1) % WAKE;
    wakeLife[i] = 1;
    wakePos[i * 3] = x;
    wakePos[i * 3 + 1] = y;
    wakePos[i * 3 + 2] = z + (Math.random() - 0.5) * 3;
    wakeVel[i * 3] = 0.25 + Math.random() * 0.2;            // drift aft
    wakeVel[i * 3 + 1] = 0.02 + Math.random() * 0.05;       // slight rise
    wakeVel[i * 3 + 2] = (Math.random() - 0.5) * spread;    // V spread
  }

  // ---- Mouse parallax ----
  var mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  window.addEventListener('pointermove', function (e) {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  var clock = new THREE.Clock();
  var running = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      running = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(container);
  }

  var SHIP_SPEED = 6; // units per second, sailing right to left

  function animate() {
    requestAnimationFrame(animate);
    if (!running) return;
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.getElapsedTime();

    mouseX += (targetX - mouseX) * 0.04;
    mouseY += (targetY - mouseY) * 0.04;

    // ocean swell
    var pos = geo.attributes.position.array;
    for (var i = 0; i < pos.length; i += 3) {
      pos[i + 1] = waveY(pos[i], pos[i + 2], t);
    }
    geo.attributes.position.needsUpdate = true;

    // dust drift
    var dp = dustGeo.attributes.position.array;
    for (var k2 = 1; k2 < dp.length; k2 += 3) {
      dp[k2] += 0.04;
      if (dp[k2] > 110) dp[k2] = -20;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // Ship cruises in from the right on the mid-distance swell, then, as it
    // nears the headline, veers toward the camera and slips out bottom-left —
    // so it never crosses behind the text.
    ship.position.x -= SHIP_SPEED * dt;
    var sx = ship.position.x;
    var shipZ = -10 + Math.max(0, 40 - sx) * 0.9;
    if (sx < -170 || shipZ > 118) { ship.position.x = 340; sx = 340; shipZ = -10; }
    ship.position.z = shipZ;
    var swell = waveY(sx, shipZ, t);
    ship.position.y = -26 + swell * 0.3;
    ship.rotation.z = Math.sin(t * 0.5) * 0.015 + 0.02;
    ship.rotation.x = Math.sin(t * 0.38) * 0.012;

    // spawn foam at the bow and stern
    if (sx < 330) {
      spawnWake(sx - 38 * SHIP_SCALE, ship.position.y + 1.5, shipZ, 0.8); // bow spray
      spawnWake(sx + 40 * SHIP_SCALE, ship.position.y + 1, shipZ, 0.5);   // stern wash
    }

    // advance wake
    for (var p = 0; p < WAKE; p++) {
      if (wakeLife[p] <= 0) continue;
      wakeLife[p] -= dt * 0.22;
      if (wakeLife[p] <= 0) { wakePos[p * 3 + 1] = -9999; continue; }
      wakePos[p * 3]     += wakeVel[p * 3];
      wakePos[p * 3 + 1] += wakeVel[p * 3 + 1] * wakeLife[p];
      wakePos[p * 3 + 2] += wakeVel[p * 3 + 2];
    }
    wakeGeo.attributes.position.needsUpdate = true;

    // camera parallax
    camera.position.x = mouseX * 24;
    camera.position.y = 40 - mouseY * 12;
    camera.lookAt(0, -4, -10);

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
