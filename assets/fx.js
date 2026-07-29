/*
 * ODYSSEUS — atmosphere layer.
 *
 * Everything here is decoration: a drifting constellation, the boot sequence,
 * scroll reveals, text scrambles, pointer light. None of it owns state the
 * page depends on, so all of it is safe to skip — and it is skipped entirely
 * under prefers-reduced-motion.
 */
window.ORACLE_FX = (function () {
  "use strict";

  var MOTION = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s) { return document.querySelector(s); };

  /* ── drifting constellation ──────────────────────────── */

  function constellation() {
    var cv = $("#fxNet");
    if (!cv || !MOTION) return;

    var ctx = cv.getContext("2d");
    var nodes = [];
    var w = 0, h = 0, dpr = 1;
    var pointer = { x: -999, y: -999 };
    var running = true;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var target = Math.min(96, Math.round((w * h) / 17000));
      nodes = [];
      for (var i = 0; i < target; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.4 + 0.6,
          cyan: Math.random() < 0.3,
        });
      }
    }

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;

        // the pointer bends nearby nodes toward it, gently
        var pdx = pointer.x - n.x, pdy = pointer.y - n.y;
        var pd2 = pdx * pdx + pdy * pdy;
        if (pd2 < 26000 && pd2 > 1) {
          var pull = 0.00022 * (1 - pd2 / 26000);
          n.vx += pdx * pull;
          n.vy += pdy * pull;
        }
        var sp = Math.hypot(n.vx, n.vy);
        if (sp > 0.55) { n.vx *= 0.55 / sp; n.vy *= 0.55 / sp; }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, 6.2832);
        ctx.fillStyle = n.cyan ? "rgba(34,211,238,0.55)" : "rgba(167,139,255,0.45)";
        ctx.fill();
      }

      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x;
          var dy = nodes[a].y - nodes[b].y;
          var d2 = dx * dx + dy * dy;
          if (d2 > 19600) continue; // 140px

          var t = 1 - d2 / 19600;
          // links near the pointer glow brighter than the rest of the web
          var mx = (nodes[a].x + nodes[b].x) / 2 - pointer.x;
          var my = (nodes[a].y + nodes[b].y) / 2 - pointer.y;
          var near = Math.max(0, 1 - (mx * mx + my * my) / 90000);

          ctx.beginPath();
          ctx.moveTo(nodes[a].x, nodes[a].y);
          ctx.lineTo(nodes[b].x, nodes[b].y);
          ctx.strokeStyle = "rgba(123,92,255," + (t * 0.13 + near * t * 0.4).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      requestAnimationFrame(frame);
    }

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(resize, 200);
    });
    window.addEventListener("pointermove", function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }, { passive: true });
    window.addEventListener("pointerleave", function () {
      pointer.x = pointer.y = -999;
    });
    // no reason to burn frames on a tab nobody is looking at
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { running = false; }
      else if (!running) { running = true; requestAnimationFrame(frame); }
    });

    resize();
    requestAnimationFrame(frame);
    cv.classList.add("on");
  }

  /* ── text scramble ───────────────────────────────────── */

  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/\\<>*+=~";

  function scramble(el, text, ms) {
    if (!MOTION) { el.textContent = text; return; }
    var start = performance.now();
    var dur = ms || 900;
    el.classList.add("scrambling");

    (function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var settled = Math.floor(p * text.length);
      var out = "";
      for (var i = 0; i < text.length; i++) {
        if (i < settled || text[i] === " ") out += text[i];
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
      else { el.textContent = text; el.classList.remove("scrambling"); }
    })(start);
  }

  function scrambleTitles() {
    [].forEach.call(document.querySelectorAll("[data-scramble]"), function (el) {
      var text = el.getAttribute("data-scramble");
      var delay = +(el.getAttribute("data-delay") || 0);
      if (!MOTION) { el.textContent = text; return; }
      el.textContent = "";
      setTimeout(function () { scramble(el, text, 900); }, delay);
    });
  }

  /* ── boot sequence ───────────────────────────────────── */

  var BOOT = [
    "> establishing link to <u>solana</u> … <b>ok</b>",
    "> reading treasury key … <b>held</b>",
    "> loading doctrine … <b>4 directives</b>",
    "> binding to the mast … <b>irreversible</b>",
    "> <b>ODYSSEUS online.</b> the voyage continues.",
  ];

  function boot(done) {
    var el = $("#boot"), log = $("#bootLog");
    var seen = false;
    try { seen = sessionStorage.getItem("odysseus.boot") === "1"; } catch (e) {}

    if (!el || !log || !MOTION || seen) {
      if (el) el.remove();
      document.body.classList.remove("booting");
      done();
      return;
    }

    document.body.classList.add("booting");
    el.classList.add("on");

    var i = 0, timers = [];
    function finish() {
      timers.forEach(clearTimeout);
      try { sessionStorage.setItem("odysseus.boot", "1"); } catch (e) {}
      el.classList.add("done");
      document.body.classList.remove("booting");
      setTimeout(function () { el.remove(); }, 650);
      done();
    }

    function next() {
      if (i >= BOOT.length) {
        timers.push(setTimeout(finish, 480));
        return;
      }
      log.innerHTML += BOOT[i] + "\n";
      i++;
      timers.push(setTimeout(next, 240));
    }

    el.addEventListener("click", finish);
    window.addEventListener("keydown", finish, { once: true });
    timers.push(setTimeout(next, 260));
    timers.push(setTimeout(finish, 4200)); // never trap anyone behind the curtain
  }

  /* ── scroll reveals + progress ───────────────────────── */

  function reveals() {
    var items = document.querySelectorAll("[data-reveal], .laws li");
    if (!("IntersectionObserver" in window) || !MOTION) {
      [].forEach.call(items, function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    [].forEach.call(items, function (el) { io.observe(el); });
  }

  function progress() {
    var bar = $("#progressBar");
    if (!bar) return;
    var queued = false;
    function update() {
      queued = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.scrollY / max : 0;
      bar.style.width = (Math.min(1, Math.max(0, p)) * 100).toFixed(2) + "%";
    }
    window.addEventListener("scroll", function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ── pointer light ───────────────────────────────────── */

  function pointerLight() {
    if (!MOTION) { var s = $(".spotlight"); if (s) s.style.display = "none"; return; }
    var root = document.documentElement;
    window.addEventListener("pointermove", function (e) {
      root.style.setProperty("--mx", e.clientX + "px");
      root.style.setProperty("--my", e.clientY + "px");
    }, { passive: true });

    // per-card spotlight, so hovering a panel lights it from where you are
    document.addEventListener("pointermove", function (e) {
      var card = e.target && e.target.closest && e.target.closest("[data-spotlight]");
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty("--cx", (e.clientX - r.left) + "px");
      card.style.setProperty("--cy", (e.clientY - r.top) + "px");
    }, { passive: true });
  }

  /* ── ledger status line ──────────────────────────────── */

  var STATUS = [
    "watching the book",
    "counting what arrived",
    "measuring depth beneath the price",
    "listening for weakness",
    "holding. the doctrine says hold",
    "reading the tape",
    "fees settling",
    "nothing to answer yet",
  ];

  function statusLine() {
    var el = $("#logStatus");
    if (!el) return;
    var i = 0;
    setInterval(function () {
      i = (i + 1) % STATUS.length;
      if (MOTION) scramble(el, STATUS[i], 550);
      else el.textContent = STATUS[i];
    }, 4200);
  }

  /* ── marquee ─────────────────────────────────────────── */

  function marquee(items) {
    var track = document.getElementById("marqueeTrack");
    if (!track) return;
    var half = items.map(function (t) { return "<span>" + t + "</span>"; }).join("");
    track.innerHTML = half + half; // duplicated so the loop has no seam
  }

  return {
    motion: MOTION,
    scramble: scramble,
    marquee: marquee,
    start: function () {
      boot(function () {
        // held until the curtain lifts, so the entrance is not spent behind it
        scrambleTitles();
        constellation();
        reveals();
      });
      progress();
      pointerLight();
      statusLine();
    },
  };
})();
