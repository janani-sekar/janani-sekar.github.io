(function () {
  // Galton board: balls fall through a triangle of pegs and pile into bins,
  // building a binomial (≈ normal) curve as the visitor reveals the page.
  var ROWS = 12;
  var BINS = ROWS + 1;
  var FOOTER = 34; // space kept free for the "drop again" button

  var container = document.getElementById("sidebar-graphic");
  if (!container) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.createElement("canvas");
  container.appendChild(canvas);
  var ctx = canvas.getContext("2d");

  var g = null; // geometry, recomputed on resize
  var counts = [];
  var active = [];
  var total = 0; // balls to drop for a full curve
  var spawned = 0;
  var target = 0;
  var lastSpawn = 0;
  var linked = true;
  var raf = 0;

  function binomial(n, k) {
    var r = 1;
    for (var i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
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
    var dx = Math.min((w - 2 * pad) / BINS, 22);
    var dy = Math.min(dx * 1.6, (h * 0.5) / (ROWS + 1));
    var r = Math.max(1.8, Math.min(dx * 0.3, 3.6));
    var cols = Math.max(1, Math.floor((dx * 0.86) / (2 * r)));
    var top = pad + dy;
    var binTop = top + ROWS * dy + dy * 0.6;
    var binBottom = h - FOOTER;
    var stackStep = 2 * r * 0.92;
    var capacity = Math.floor((binBottom - binTop - r) / stackStep) * cols;
    // Size the run so the tallest bin ends up about half full.
    var centerShare = binomial(ROWS, ROWS / 2) / Math.pow(2, ROWS);

    g = {
      w: w, h: h, cx: w / 2, dx: dx, dy: dy, r: r, cols: cols,
      top: top, binTop: binTop, binBottom: binBottom,
      stackStep: stackStep, capacity: capacity
    };
    total = Math.max(30, Math.floor((capacity * 0.5) / centerShare));
    return true;
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
      y: g.binBottom - g.r - row * g.stackStep
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
    active.push({ bits: bits, born: now });
    spawned++;
  }

  var HOP = 70; // ms per peg row
  var FALL = 380; // ms from last peg into the bin

  // Returns the ball's position, or null once it has landed. Timeline: one
  // HOP to drop onto the top peg, one HOP per row, then FALL into the bin.
  function ballPos(b, now) {
    var t = now - b.born;
    var lift = g.r + 1.2;
    if (t < HOP) {
      var u0 = t / HOP;
      return { x: g.cx, y: g.top - g.dy + g.dy * u0 * u0 - lift * u0 };
    }
    t -= HOP;
    if (t < ROWS * HOP) {
      var row = Math.floor(t / HOP);
      var u = (t - row * HOP) / HOP;
      var j = 0;
      for (var i = 0; i < row; i++) j += b.bits[i];
      var x0 = pegX(row, j);
      var x1 = pegX(row + 1, j + b.bits[row]);
      var y0 = pegY(row) - lift;
      var y1 = pegY(row + 1) - lift;
      return {
        x: x0 + (x1 - x0) * u,
        y: y0 + (y1 - y0) * u * u - Math.sin(Math.PI * u) * g.dy * 0.3
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

  function draw(now) {
    ctx.clearRect(0, 0, g.w, g.h);
    ctx.fillStyle = getComputedStyle(container).color;

    // Pegs.
    ctx.globalAlpha = 0.4;
    var pegR = Math.max(0.9, g.r * 0.5);
    for (var row = 0; row < ROWS; row++) {
      for (var j = 0; j <= row; j++) {
        ctx.beginPath();
        ctx.arc(pegX(row, j), pegY(row), pegR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bin dividers, drawn as columns of dots to match the pegs.
    ctx.globalAlpha = 0.25;
    var gap = g.dy;
    for (var k = 0; k <= BINS; k++) {
      var x = binX(k) - g.dx / 2;
      for (var y = g.binBottom; y >= g.binTop; y -= gap) {
        ctx.beginPath();
        ctx.arc(x, y, pegR * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Settled balls.
    ctx.globalAlpha = 0.7;
    for (k = 0; k < BINS; k++) {
      var n = Math.min(counts[k], g.capacity);
      for (var i = 0; i < n; i++) {
        var s = slot(k, i);
        ctx.beginPath();
        ctx.arc(s.x, s.y, g.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Balls in flight.
    ctx.globalAlpha = 0.9;
    for (i = active.length - 1; i >= 0; i--) {
      var p = ballPos(active[i], now);
      if (!p) {
        counts[active[i].bin]++;
        active.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, g.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function tick(now) {
    raf = 0;
    if (!g) return;
    if (spawned < target) {
      // Pace drops so any backlog clears in about two seconds.
      var interval = Math.min(60, Math.max(3, 2000 / (target - spawned)));
      if (now - lastSpawn > 250) lastSpawn = now - interval;
      while (spawned < target && now - lastSpawn >= interval) {
        lastSpawn += interval;
        spawn(lastSpawn);
      }
    }
    draw(now);
    if (active.length || spawned < target) {
      raf = requestAnimationFrame(tick);
    }
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
    var hadBalls = spawned;
    var wasLinked = linked;
    var fraction = total ? target / total : 0;
    if (!layout()) return;
    // Rebuild the pile at the new size rather than stretching it.
    restart(wasLinked);
    if (hadBalls) setTarget(total * fraction);
    draw(performance.now());
  }

  var lastStep = 0;
  var lastMax = 4;

  function syncStep(step, maxStep) {
    lastStep = step;
    lastMax = maxStep;
    if (!linked || !g) return;
    setTarget(total * (0.12 + 0.88 * (maxStep > 0 ? step / maxStep : 0)));
  }

  resetCounts();
  if (layout()) {
    draw(performance.now());
    syncStep(0, 4);
  }

  if (typeof ResizeObserver === "function") {
    var resizeTimer = 0;
    new ResizeObserver(function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 120);
    }).observe(container);
  }

  window.jananiGraphic = {
    reset: function () {
      if (!g) return;
      restart(false);
      setTarget(total);
    },
    syncStep: syncStep
  };
})();
