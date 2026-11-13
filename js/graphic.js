(function () {
  // Galton board: balls wait in a hopper, fall through a triangle of pegs and
  // pile into bins, building a binomial curve as the visitor reveals the page.
  // Drawn with rough.js for a hand-drawn look; falls back to plain shapes.
  var ROWS = 12;
  var BINS = ROWS + 1;
  var FOOTER = 34; // space kept free for the "drop again" button
  var VARIANTS = 8; // distinct hand-drawn ball sprites

  var container = document.getElementById("sidebar-graphic");
  if (!container) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.createElement("canvas");
  container.appendChild(canvas);
  var ctx = canvas.getContext("2d");

  var g = null; // geometry, recomputed on resize
  var bg = null; // static layer: hopper, pegs, bins
  var sprites = [];
  var hopperSlots = [];
  var counts = [];
  var active = [];
  var total = 0; // balls to drop for a full curve
  var spawned = 0;
  var target = 0;
  var lastSpawn = 0;
  var linked = true;
  var raf = 0;
  var lastStep = 0;
  var lastMax = 4;

  function binomial(n, k) {
    var r = 1;
    for (var i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  }

  function makeCanvas(w, h, dpr) {
    var c = document.createElement("canvas");
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }

  function layout() {
    var w = container.clientWidth;
    var h = container.clientHeight;
    if (!w || !h) return false;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var pad = 10;
    var usable = h - FOOTER - pad;
    var dx = Math.min((w - 2 * pad) / BINS, 24);
    var r = Math.max(2.3, Math.min(dx * 0.38, 5.1));

    // Hopper across the top ~20%, pegs below it, bins fill the rest.
    var hopperTop = pad;
    var hopperBottom = pad + usable * (w > h ? 0.27 : 0.2); // deeper on wide phone layouts
    var neckW = Math.max(4 * r, dx * 1.2);
    var top = hopperBottom + Math.max(dx, 14);
    var dy = Math.min(dx * 1.6, (usable * 0.36) / ROWS);
    var binTop = top + ROWS * dy + dy * 0.6;
    var binBottom = h - FOOTER;
    var cols = Math.max(1, Math.floor((dx * 0.86) / (2 * r)));
    var stackStep = 2 * r * 1.02;
    var capacity = Math.floor((binBottom - binTop - r) / stackStep) * cols;

    g = {
      w: w, h: h, cx: w / 2, dx: dx, dy: dy, r: r, cols: cols, pad: pad,
      top: top, binTop: binTop, binBottom: binBottom, stackStep: stackStep,
      capacity: capacity, hopperTop: hopperTop, hopperBottom: hopperBottom,
      neckW: neckW, dpr: dpr
    };

    hopperSlots = packHopper();
    // Tallest bin ends up about half full, limited by what the hopper holds.
    var centerShare = binomial(ROWS, ROWS / 2) / Math.pow(2, ROWS);
    total = Math.max(20, Math.min(Math.floor((capacity * 0.5) / centerShare), hopperSlots.length));

    buildSprites();
    buildBackground();
    return true;
  }

  // Hopper outline: wide at the top, narrowing to a neck above the first peg.
  function hopperHalfWidth(y) {
    var t = (y - g.hopperTop) / (g.hopperBottom - g.hopperTop);
    var topHalf = Math.min((g.w - 2 * g.pad) / 2, (BINS * g.dx) / 2);
    return topHalf + (g.neckW / 2 - topHalf) * t;
  }

  // Ball positions inside the hopper, bottom row first, so the level drops
  // from the top as balls leave.
  function packHopper() {
    var slots = [];
    var step = 2 * g.r * 1.08;
    var row = 0;
    for (var y = g.hopperBottom - g.r - 1; y > g.hopperTop + g.r; y -= step * 0.9, row++) {
      var half = hopperHalfWidth(y) - g.r * 1.6 - 3; // stay clear of the wobbly sides
      var n = Math.floor((2 * half) / step) + 1;
      if (n < 1) continue;
      var off = row % 2 ? step / 4 : -step / 4; // stagger rows like stacked marbles
      var x0 = g.cx - ((n - 1) * step) / 2 + (n > 1 ? off : 0);
      for (var i = 0; i < n; i++) slots.push({ x: x0 + i * step, y: y });
    }
    return slots;
  }

  function roughOn(c) {
    return window.rough ? window.rough.canvas(c) : null;
  }

  // "rgb(r, g, b)" -> "rgba(r, g, b, a)"
  function tint(color, a) {
    var m = color.match(/\d+(\.\d+)?/g);
    return m ? "rgba(" + m[0] + "," + m[1] + "," + m[2] + "," + a + ")" : color;
  }

  function buildSprites() {
    var ink = getComputedStyle(container).color;
    var size = g.r * 2 + 6;
    sprites = [];
    for (var v = 0; v < VARIANTS; v++) {
      var c = makeCanvas(size, size, g.dpr);
      var rc = roughOn(c);
      if (rc) {
        rc.circle(size / 2, size / 2, g.r * 2, {
          seed: v + 1,
          roughness: 0.9,
          stroke: ink,
          strokeWidth: 1,
          fill: tint(ink, 0.3),
          fillStyle: "solid"
        });
      } else {
        var cx = c.getContext("2d");
        cx.fillStyle = ink;
        cx.beginPath();
        cx.arc(size / 2, size / 2, g.r, 0, Math.PI * 2);
        cx.fill();
      }
      sprites.push(c);
    }
  }

  function buildBackground() {
    var ink = getComputedStyle(container).color;
    bg = makeCanvas(g.w, g.h, g.dpr);
    var bx = bg.getContext("2d");
    var rc = roughOn(bg);
    var seed = 7;

    function sketchLine(x1, y1, x2, y2) {
      if (rc) {
        rc.line(x1, y1, x2, y2, { seed: seed++, stroke: ink, strokeWidth: 0.9, roughness: 1.2, bowing: 1.5 });
      } else {
        bx.strokeStyle = ink;
        bx.beginPath();
        bx.moveTo(x1, y1);
        bx.lineTo(x2, y2);
        bx.stroke();
      }
    }

    function dot(x, y, d, filled) {
      if (rc) {
        var opts = { seed: seed++, roughness: 0.9, stroke: ink, strokeWidth: 0.7 };
        if (filled) {
          opts.fill = ink;
          opts.fillStyle = "solid";
        }
        rc.circle(x, y, d, opts);
      } else {
        bx.fillStyle = ink;
        bx.beginPath();
        bx.arc(x, y, d / 2, 0, Math.PI * 2);
        bx.fill();
      }
    }

    // Hopper.
    bx.globalAlpha = 0.55;
    var topHalf = hopperHalfWidth(g.hopperTop);
    var neck = g.neckW / 2;
    // Each side wobbles through a few nudged points, like a quick pen stroke.
    function wobblySide(sign, wobble) {
      var pts = [];
      for (var i = 0; i <= 4; i++) {
        var t = i / 4;
        var y = g.hopperTop + (g.hopperBottom - g.hopperTop) * t;
        var x = g.cx + sign * hopperHalfWidth(y) + (i > 0 && i < 4 ? wobble[i - 1] : 0);
        pts.push([x, y]);
      }
      pts.push([g.cx + sign * (neck - 0.6), g.hopperBottom + 6]); // little spout
      if (rc) rc.curve(pts, { seed: seed++, stroke: ink, strokeWidth: 1, roughness: 1.6, bowing: 2 });
      else for (var k = 1; k < pts.length; k++) sketchLine(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]);
    }
    wobblySide(-1, [-1.8, 1.2, -0.6]);
    wobblySide(1, [1.4, -1.6, 0.9]);

    // Pegs: little open doodled circles.
    bx.globalAlpha = 0.5;
    var pegD = Math.max(2.8, g.r * 0.95);
    for (var row = 0; row < ROWS; row++) {
      for (var j = 0; j <= row; j++) dot(pegX(row, j), pegY(row), pegD, false);
    }

    // Bin dividers as columns of small doodled dots, plus a sketchy floor.
    bx.globalAlpha = 0.28;
    for (var k = 0; k <= BINS; k++) {
      var x = binX(k) - g.dx / 2;
      for (var y = g.binBottom - g.dy * 0.5; y >= g.binTop; y -= g.dy) {
        dot(x, y, Math.max(1.8, g.r * 0.55), false);
      }
    }
    bx.globalAlpha = 0.45;
    sketchLine(binX(0) - g.dx / 2, g.binBottom, binX(ROWS) + g.dx / 2, g.binBottom);
    bx.globalAlpha = 1;
  }

  function pegX(row, j) {
    return g.cx + (j - row / 2) * g.dx;
  }

  function pegY(row) {
    return g.top + row * g.dy;
  }

  function binX(k) {
    return g.cx + (k - ROWS / 2) * g.dx;
  }

  function slot(k, n) {
    n = Math.min(n, g.capacity - 1);
    var col = n % g.cols;
    var row = Math.floor(n / g.cols);
    return {
      x: binX(k) + (col - (g.cols - 1) / 2) * 2 * g.r,
      y: g.binBottom - g.r - 1 - row * g.stackStep
    };
  }

  function resetCounts() {
    counts = [];
    for (var k = 0; k < BINS; k++) counts[k] = 0;
  }

  function settleInstantly(n) {
    for (var i = 0; i < n; i++) {
      var k = 0;
      for (var row = 0; row < ROWS; row++) if (Math.random() < 0.5) k++;
      counts[k]++;
    }
  }

  function spawn(now) {
    var bits = [];
    for (var i = 0; i < ROWS; i++) bits.push(Math.random() < 0.5 ? 1 : 0);
    active.push({ bits: bits, born: now, v: spawned % VARIANTS });
    spawned++;
  }

  var HOP = 75; // ms per peg row
  var FALL = 360; // ms from last peg into the bin

  // Returns the ball's position, or null once it has landed. Timeline: one
  // HOP from the hopper neck onto the top peg, one HOP per row, then FALL.
  function ballPos(b, now) {
    var t = now - b.born;
    var lift = g.r + 1.5;
    if (t < HOP) {
      var u0 = t / HOP;
      var y0 = g.hopperBottom;
      return { x: g.cx, y: y0 + (pegY(0) - lift - y0) * u0 * u0 };
    }
    t -= HOP;
    if (t < ROWS * HOP) {
      var row = Math.floor(t / HOP);
      var u = (t - row * HOP) / HOP;
      var j = 0;
      for (var i = 0; i < row; i++) j += b.bits[i];
      var x0 = pegX(row, j);
      var x1 = pegX(row + 1, j + b.bits[row]);
      var ya = pegY(row) - lift;
      var yb = pegY(row + 1) - lift;
      return {
        x: x0 + (x1 - x0) * u,
        y: ya + (yb - ya) * u * u - Math.sin(Math.PI * u) * g.dy * 0.3
      };
    }
    var k = 0;
    for (var m = 0; m < ROWS; m++) k += b.bits[m];
    var f = (t - ROWS * HOP) / FALL;
    if (f >= 1) {
      b.bin = k;
      return null;
    }
    var end = slot(k, counts[k]);
    var sy = pegY(ROWS) - lift;
    return {
      x: binX(k) + (end.x - binX(k)) * Math.min(1, f * 2),
      y: sy + (end.y - sy) * f * f
    };
  }

  function sprite(x, y, v) {
    var s = sprites[v % VARIANTS];
    var size = s.width / g.dpr;
    ctx.drawImage(s, x - size / 2, y - size / 2, size, size);
  }

  function draw(now) {
    ctx.clearRect(0, 0, g.w, g.h);
    ctx.drawImage(bg, 0, 0, g.w, g.h);

    // Balls still waiting in the hopper.
    ctx.globalAlpha = 0.85;
    var waiting = Math.max(0, total - spawned);
    for (var i = 0; i < waiting; i++) sprite(hopperSlots[i].x, hopperSlots[i].y, i);

    // Settled balls.
    for (var k = 0; k < BINS; k++) {
      var n = Math.min(counts[k], g.capacity);
      for (i = 0; i < n; i++) {
        var s = slot(k, i);
        sprite(s.x, s.y, k * 3 + i);
      }
    }

    // Balls in flight.
    ctx.globalAlpha = 1;
    for (i = active.length - 1; i >= 0; i--) {
      var p = ballPos(active[i], now);
      if (!p) {
        counts[active[i].bin]++;
        active.splice(i, 1);
        continue;
      }
      sprite(p.x, p.y, active[i].v);
    }
  }

  function tick(now) {
    raf = 0;
    if (!g) return;
    if (spawned < target) {
      // Pace drops so any backlog clears in about two seconds.
      var interval = Math.min(70, Math.max(4, 2000 / (target - spawned)));
      if (now - lastSpawn > 250) lastSpawn = now - interval;
      while (spawned < target && now - lastSpawn >= interval) {
        lastSpawn += interval;
        spawn(lastSpawn);
      }
    }
    draw(now);
    if (active.length || spawned < target) raf = requestAnimationFrame(tick);
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function setTarget(n) {
    n = Math.min(total, Math.round(n));
    if (n <= target) return;
    if (reduceMotion) {
      settleInstantly(n - spawned);
      spawned = n;
      target = n;
      draw(performance.now());
      return;
    }
    target = n;
    kick();
  }

  function restart(isLinked) {
    linked = isLinked;
    active = [];
    spawned = 0;
    target = 0;
    resetCounts();
  }

  function onResize() {
    var fraction = total ? target / total : 0;
    var wasLinked = linked;
    if (!layout()) return;
    // Rebuild the pile at the new size rather than stretching it.
    restart(wasLinked);
    if (fraction) setTarget(total * fraction);
    draw(performance.now());
  }

  function syncStep(step, maxStep) {
    lastStep = step;
    lastMax = maxStep;
    if (!linked || !g) return;
    setTarget(total * (0.12 + 0.88 * (maxStep > 0 ? lastStep / maxStep : 0)));
  }

  function start() {
    resetCounts();
    if (layout()) {
      draw(performance.now());
      syncStep(lastStep, lastMax);
    }
    if (typeof ResizeObserver === "function") {
      var resizeTimer = 0;
      var first = true;
      new ResizeObserver(function () {
        if (first) {
          first = false;
          return;
        }
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(onResize, 120);
      }).observe(container);
    }
  }

  window.jananiGraphic = {
    reset: function () {
      if (!g) return;
      restart(false);
      setTarget(total);
    },
    syncStep: syncStep
  };

  // Wait for web fonts so the sidebar's final size is known before drawing.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  else start();
})();
