(function () {
  const puzzle = document.getElementById("puzzle");
  const maxStep = 3;
  let step = 0;

  function setStep(n) {
    step = Math.min(maxStep, Math.max(0, n));
    puzzle.className = "reveal-step-" + step;
  }

  function advance() {
    if (step < maxStep) setStep(step + 1);
  }

  document.addEventListener("click", advance);
  document.addEventListener("keydown", function (e) {
    if (e.key === " " || e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      advance();
    }
  });

  var lastWheel = 0;

  document.addEventListener("wheel", function (e) {
    if (e.deltaY <= 0) return;
    var now = Date.now();
    if (now - lastWheel < 400) return;
    lastWheel = now;
    advance();
  }, { passive: true });
})();
