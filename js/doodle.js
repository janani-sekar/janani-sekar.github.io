(function () {
  // Redraw the small icons (links, location pin) with rough.js so they match
  // the hand-drawn sidebar. Leaves the original icons if rough.js is missing.
  if (!window.rough) return;

  var icons = document.querySelectorAll("svg.doodle");
  for (var i = 0; i < icons.length; i++) {
    var svg = icons[i];
    var rs = window.rough.svg(svg);
    var shapes = svg.querySelectorAll("path, circle");
    var m = getComputedStyle(svg).color.match(/\d+(\.\d+)?/g);
    var tint = m ? "rgba(" + m[0] + "," + m[1] + "," + m[2] + ",0.3)" : "none";
    var drawn = [];
    for (var j = 0; j < shapes.length; j++) {
      // Soft tinted fill under a sketchy outline, like the balls.
      var opts = {
        seed: i * 10 + j + 3,
        roughness: 0.55,
        bowing: 0.5,
        stroke: "currentColor",
        strokeWidth: 1.25,
        fill: tint,
        fillStyle: "solid"
      };
      var el = shapes[j];
      drawn.push(
        el.tagName.toLowerCase() === "circle"
          ? rs.circle(+el.getAttribute("cx"), +el.getAttribute("cy"), 2 * el.getAttribute("r"), opts)
          : rs.path(el.getAttribute("d"), opts)
      );
    }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (j = 0; j < drawn.length; j++) svg.appendChild(drawn[j]);
    svg.style.overflow = "visible";
  }

  var frame = document.querySelector(".frame-doodle");
  if (frame) {
    frame.appendChild(
      window.rough.svg(frame).rectangle(1.5, 1.5, 97, 97, {
        seed: 42,
        roughness: 1.3,
        bowing: 1.5,
        stroke: "currentColor",
        strokeWidth: 0.9
      })
    );
  }
})();
