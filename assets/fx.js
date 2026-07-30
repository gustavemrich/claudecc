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

  /* ── the core ────────────────────────────────────────── */

  // Particles in orbit, drawn as trails. The whole thing leans toward the
  // pointer, so the entity reads as looking back at you.
  function core() {
    var cv = document.getElementById("coreCanvas");
    if (!cv || !MOTION) return;

    var ctx = cv.getContext("2d");
    var w = 0, h = 0, cx = 0, cy = 0, R = 0;
    var lean = { x: 0, y: 0, tx: 0, ty: 0 };
    var bits = [];
    var alive = true;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2; cy = h / 2; R = Math.min(w, h) / 2;

      bits = [];
      for (var i = 0; i < 58; i++) {
        bits.push({
          a: Math.random() * 6.2832,
          r: R * (0.30 + Math.random() * 0.62),
          sp: (0.10 + Math.random() * 0.45) * (Math.random() < 0.3 ? -1 : 1),
          tilt: 0.24 + Math.random() * 0.5,
          size: 0.7 + Math.random() * 1.7,
          cyan: Math.random() < 0.42,
        });
      }
    }

    function frame() {
      if (!alive) return;
      ctx.clearRect(0, 0, w, h);

      lean.x += (lean.tx - lean.x) * 0.05;
      lean.y += (lean.ty - lean.y) * 0.05;

      for (var i = 0; i < bits.length; i++) {
        var b = bits[i];
        b.a += b.sp * 0.006;

        // an ellipse rather than a circle, so the orbits read as 3D
        var x = cx + Math.cos(b.a) * b.r + lean.x;
        var y = cy + Math.sin(b.a) * b.r * b.tilt + lean.y;
        var depth = (Math.sin(b.a) + 1) / 2; // behind vs in front

        ctx.beginPath();
        ctx.arc(x, y, b.size * (0.55 + depth * 0.7), 0, 6.2832);
        ctx.fillStyle = b.cyan
          ? "rgba(34,211,238," + (0.14 + depth * 0.5).toFixed(3) + ")"
          : "rgba(167,139,255," + (0.12 + depth * 0.45).toFixed(3) + ")";
        ctx.fill();

        // a short trail behind each particle
        ctx.beginPath();
        ctx.moveTo(x, y);
        var pa = b.a - b.sp * 0.09;
        ctx.lineTo(cx + Math.cos(pa) * b.r + lean.x, cy + Math.sin(pa) * b.r * b.tilt + lean.y);
        ctx.strokeStyle = b.cyan
          ? "rgba(34,211,238," + (0.06 + depth * 0.16).toFixed(3) + ")"
          : "rgba(167,139,255," + (0.05 + depth * 0.14).toFixed(3) + ")";
        ctx.lineWidth = b.size * 0.7;
        ctx.stroke();
      }
      requestAnimationFrame(frame);
    }

    window.addEventListener("pointermove", function (e) {
      lean.tx = (e.clientX / window.innerWidth - 0.5) * 34;
      lean.ty = (e.clientY / window.innerHeight - 0.5) * 26;
    }, { passive: true });

    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(size, 200); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) alive = false;
      else if (!alive) { alive = true; requestAnimationFrame(frame); }
    });

    size();
    requestAnimationFrame(frame);
  }

  /* ── pointer ring ────────────────────────────────────── */

  function cursor() {
    // only where there is a real pointer to follow
    if (!MOTION || !window.matchMedia("(pointer: fine)").matches) return;

    var ring = document.createElement("div");
    ring.className = "cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring);

    var x = -100, y = -100, rx = -100, ry = -100;
    window.addEventListener("pointermove", function (e) {
      x = e.clientX; y = e.clientY;
      var hot = e.target && e.target.closest &&
        e.target.closest("a, button, [role='button'], .ca-bar, .sim-btn, .sim-chip");
      ring.classList.toggle("hot", !!hot);
    }, { passive: true });
    document.addEventListener("pointerdown", function () { ring.classList.add("down"); });
    document.addEventListener("pointerup", function () { ring.classList.remove("down"); });

    (function trail() {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0) translate(-50%,-50%)";
      requestAnimationFrame(trail);
    })();
  }

  /* ── magnetic buttons + click ripple ─────────────────── */

  function magnets() {
    if (!MOTION) return;

    document.addEventListener("pointermove", function (e) {
      var el = e.target && e.target.closest && e.target.closest(".btn, .sim-btn");
      if (!el) return;
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = "translate(" + (dx * 7).toFixed(1) + "px," + (dy * 5 - 2).toFixed(1) + "px)";
    }, { passive: true });

    document.addEventListener("pointerout", function (e) {
      var el = e.target && e.target.closest && e.target.closest(".btn, .sim-btn");
      if (el) el.style.transform = "";
    }, { passive: true });

    document.addEventListener("pointerdown", function (e) {
      var el = e.target && e.target.closest && e.target.closest(".btn, .sim-btn, .sim-chip, .copy-btn");
      if (!el) return;
      var r = el.getBoundingClientRect();
      var ink = document.createElement("span");
      ink.className = "ripple";
      ink.style.left = (e.clientX - r.left) + "px";
      ink.style.top = (e.clientY - r.top) + "px";
      el.appendChild(ink);
      setTimeout(function () { ink.remove(); }, 650);
    });
  }

  /* ── card tilt ───────────────────────────────────────── */

  function tilt() {
    if (!MOTION || !window.matchMedia("(pointer: fine)").matches) return;

    document.addEventListener("pointermove", function (e) {
      var el = e.target && e.target.closest && e.target.closest("[data-spotlight]");
      if (!el) return;
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      el.style.transform =
        "perspective(900px) rotateX(" + (-dy * 2.2).toFixed(2) + "deg) rotateY(" +
        (dx * 2.6).toFixed(2) + "deg) translateY(-2px)";
    }, { passive: true });

    document.addEventListener("pointerout", function (e) {
      var el = e.target && e.target.closest && e.target.closest("[data-spotlight]");
      if (el) el.style.transform = "";
    }, { passive: true });
  }

  /* ── headings arrive word by word ────────────────────── */

  function headings() {
    [].forEach.call(document.querySelectorAll(".section-head h2, .closer-line"), function (h) {
      if (h.querySelector(".word")) return;
      var words = h.textContent.trim().split(/\s+/);
      h.innerHTML = words.map(function (w, i) {
        return '<span class="word" style="--w:' + i + '">' + w + "</span>";
      }).join(" ");
    });
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
      headings();
      boot(function () {
        // held until the curtain lifts, so the entrance is not spent behind it
        scrambleTitles();
        constellation();
        core();
        reveals();
      });
      progress();
      pointerLight();
      statusLine();
      cursor();
      magnets();
      tilt();
    },
  };
})();
