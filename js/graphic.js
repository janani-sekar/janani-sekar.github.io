(function () {
  var W = 200;
  var H = 600;
  var R = 30;
  var C = 6;
  var container = document.getElementById("sidebar-graphic");
  if (!container) return;

  function rndInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = rndInt(0, i);
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  var dirs = [
    { dr: -1, dc: 0, out: "n", in: "s" },
    { dr: 1, dc: 0, out: "s", in: "n" },
    { dr: 0, dc: -1, out: "w", in: "e" },
    { dr: 0, dc: 1, out: "e", in: "w" }
  ];

  var cell = [];
  for (var r = 0; r < R; r++) {
    cell[r] = [];
    for (var c = 0; c < C; c++) {
      cell[r][c] = { n: false, s: false, e: false, w: false };
    }
  }

  function carve(r, c) {
    var order = shuffle([0, 1, 2, 3]);
    for (var i = 0; i < 4; i++) {
      var d = dirs[order[i]];
      var nr = r + d.dr;
      var nc = c + d.dc;
      if (nr >= 0 && nr < R && nc >= 0 && nc < C && !cell[nr][nc].n && !cell[nr][nc].s && !cell[nr][nc].e && !cell[nr][nc].w) {
        cell[r][c][d.out] = true;
        cell[nr][nc][d.in] = true;
        carve(nr, nc);
      }
    }
  }
  carve(0, 0);

  var cw = W / C;
  var ch = H / R;

  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  var walls = document.createElementNS("http://www.w3.org/2000/svg", "g");
  walls.setAttribute("stroke", "currentColor");
  walls.setAttribute("stroke-width", "0.6");
  walls.setAttribute("opacity", "0.35");

  for (var r = 0; r < R; r++) {
    for (var c = 0; c < C; c++) {
      var x0 = c * cw;
      var y0 = r * ch;
      if (!cell[r][c].n) {
        var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", x0);
        l.setAttribute("y1", y0);
        l.setAttribute("x2", x0 + cw);
        l.setAttribute("y2", y0);
        walls.appendChild(l);
      }
      if (!cell[r][c].w) {
        var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", x0);
        l.setAttribute("y1", y0);
        l.setAttribute("x2", x0);
        l.setAttribute("y2", y0 + ch);
        walls.appendChild(l);
      }
      if (c === C - 1) {
        var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", x0 + cw);
        l.setAttribute("y1", y0);
        l.setAttribute("x2", x0 + cw);
        l.setAttribute("y2", y0 + ch);
        walls.appendChild(l);
      }
      if (r === R - 1) {
        var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", x0);
        l.setAttribute("y1", y0 + ch);
        l.setAttribute("x2", x0 + cw);
        l.setAttribute("y2", y0 + ch);
        walls.appendChild(l);
      }
    }
  }
  svg.appendChild(walls);

  function neighbors(rc) {
    var r = rc[0];
    var c = rc[1];
    var out = [];
    if (cell[r][c].n) out.push([r - 1, c]);
    if (cell[r][c].s) out.push([r + 1, c]);
    if (cell[r][c].w) out.push([r, c - 1]);
    if (cell[r][c].e) out.push([r, c + 1]);
    return out;
  }

  function astar(start, end) {
    var open = [{ rc: start, g: 0, f: 0 }];
    var cameFrom = {};
    var gScore = {};
    gScore[start[0] + "," + start[1]] = 0;

    function key(rc) {
      return rc[0] + "," + rc[1];
    }
    function heuristic(rc) {
      return Math.abs(rc[0] - end[0]) + Math.abs(rc[1] - end[1]);
    }

    while (open.length > 0) {
      open.sort(function (a, b) {
        return a.f - b.f;
      });
      var curr = open.shift();
      var rc = curr.rc;
      if (rc[0] === end[0] && rc[1] === end[1]) {
        var path = [];
        var k = key(rc);
        while (k) {
          var p = k.split(",").map(Number);
          path.unshift(p);
          k = cameFrom[k];
        }
        return path;
      }
      var ns = neighbors(rc);
      for (var i = 0; i < ns.length; i++) {
        var next = ns[i];
        var tentative = gScore[key(rc)] + 1;
        var nk = key(next);
        if (tentative < (gScore[nk] === undefined ? Infinity : gScore[nk])) {
          cameFrom[nk] = key(rc);
          gScore[nk] = tentative;
          open.push({ rc: next, g: tentative, f: tentative + heuristic(next) });
        }
      }
    }
    return [];
  }

  var start = [0, 0];
  var end = [R - 1, C - 1];
  var path = astar(start, end);

  if (path.length > 0) {
    var d = "M";
    for (var p = 0; p < path.length; p++) {
      var rr = path[p][0];
      var cc = path[p][1];
      var px = cc * cw + cw / 2;
      var py = rr * ch + ch / 2;
      d += (p === 0 ? "" : " L") + px + "," + py;
    }
    var pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute("d", d);
    pathEl.setAttribute("fill", "none");
    pathEl.setAttribute("stroke", "currentColor");
    pathEl.setAttribute("stroke-width", "0.8");
    pathEl.setAttribute("stroke-linecap", "round");
    pathEl.setAttribute("stroke-linejoin", "round");
    pathEl.setAttribute("opacity", "0.6");
    svg.appendChild(pathEl);
  }

  var pathEl = path.length > 0 ? svg.lastChild : null;
  container.appendChild(svg);

  if (pathEl) {
    var totalLength = pathEl.getTotalLength();
    var maxSteps = 10;
    var pathStep = 0;

    pathEl.setAttribute("stroke-dasharray", totalLength);
    pathEl.setAttribute("stroke-dashoffset", totalLength);
    pathEl.style.transition = "stroke-dashoffset 0.4s ease-out";

    document.addEventListener("click", function () {
      if (pathStep < maxSteps) {
        pathStep++;
        pathEl.setAttribute("stroke-dashoffset", totalLength * (1 - pathStep / maxSteps));
      }
    });
  }
})();
