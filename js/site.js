(function () {
  const puzzle = document.getElementById("puzzle");
  const sidebar = document.querySelector(".sidebar");
  const mazeResetBtn = document.getElementById("maze-reset");
  const maxStep = 4;
  let step = 0;
  const mobileMq = window.matchMedia("(max-width: 720px)");
  let scrollRaf = 0;

  function isMobileLayout() {
    return mobileMq.matches;
  }

  function setStep(n) {
    step = Math.min(maxStep, Math.max(0, n));
    puzzle.className = "reveal-step-" + step;
    document.body.classList.toggle("reveal-complete", step === maxStep);
    if (sidebar) {
      sidebar.setAttribute("aria-hidden", step === maxStep ? "false" : "true");
    }
    if (mazeResetBtn) {
      mazeResetBtn.hidden = step !== maxStep;
    }
    if (window.jananiMaze && typeof window.jananiMaze.syncStep === "function") {
      window.jananiMaze.syncStep(step, maxStep);
    }
    applyMobileScrollShell();
  }

  function applyMobileScrollShell() {
    if (!puzzle) return;
    if (isMobileLayout() && step < maxStep) {
      puzzle.style.minHeight = (100 + (maxStep - step) * 28) + "vh";
    } else {
      puzzle.style.minHeight = "";
    }
  }

  function stepFromScroll() {
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    var p = window.scrollY / scrollable;
    return Math.min(maxStep, Math.floor(p * (maxStep + 1)));
  }

  function onScroll() {
    if (!isMobileLayout()) return;
    if (scrollRaf) return;
    scrollRaf = window.requestAnimationFrame(function () {
      scrollRaf = 0;
      if (step >= maxStep) return;
      var target = stepFromScroll();
      if (target > step) {
        setStep(target);
      }
    });
  }

  function advance() {
    if (step < maxStep) setStep(step + 1);
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest(".maze-reset")) return;
    advance();
  });

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

  window.addEventListener("scroll", onScroll, { passive: true });

  function onLayoutChange() {
    applyMobileScrollShell();
    if (isMobileLayout() && step < maxStep) {
      var t = stepFromScroll();
      if (t > step) setStep(t);
    }
  }

  if (typeof mobileMq.addEventListener === "function") {
    mobileMq.addEventListener("change", onLayoutChange);
  } else if (typeof mobileMq.addListener === "function") {
    mobileMq.addListener(onLayoutChange);
  }
  window.addEventListener("resize", onLayoutChange);

  if (mazeResetBtn) {
    mazeResetBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      if (step !== maxStep) return;
      if (window.jananiMaze && typeof window.jananiMaze.reset === "function") {
        window.jananiMaze.reset();
      }
    });
  }

  applyMobileScrollShell();
})();
