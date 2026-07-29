/*
 * ODYSSEUS — the sandbox.
 *
 * A toy model of the doctrine, not a market model and not live data. You push
 * the price around; the entity answers according to the same weights the rest
 * of the page describes. The point is to make two laws visible:
 *
 *   "Buybacks execute into weakness, never into euphoria."
 *   "Liquidity is added, never removed."
 *
 * The floor line only ever rises, and buybacks get larger the further price
 * sits below its own average — funded, when it needs to be, out of the reserve.
 */
(function () {
  "use strict";

  var CFG = window.ORACLE_CONFIG || {};
  var DOCTRINE = (CFG.doctrine || []).slice();
  var $ = function (s) { return document.querySelector(s); };

  var root = $("#simChart");
  if (!root || !DOCTRINE.length) return;

  var MOTION = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SEG = { buyback: "#7b5cff", liquidity: "#22d3ee", warchest: "#ffb547", signal: "#5b6180" };

  var POINTS = 170;     // samples kept on screen
  var SAMPLE = 0.08;    // sim-seconds between samples
  var BATCH = 1;        // ◎ that must accrue before a directive fires

  // Wall-clock pace. Sampling is measured in sim-seconds, so lowering this
  // draws the same chart more slowly rather than flattening it: roughly a
  // directive every 16s at ×1, with the speed control on top.
  var TEMPO = 0.25;

  var S, speed = 1, playing = false, raf = 0, lastT = 0;

  function fresh() {
    return {
      price: 1,
      ema: 1,
      floor: 0.62,
      impulse: 0,
      volume: 1,
      fees: 0,
      burned: 0,
      chest: 0,
      count: 0,
      spent: { buyback: 0, liquidity: 0, warchest: 0, signal: 0 },
      series: [],
      acc: 0,
      opened: 1,
    };
  }

  /* ── model ───────────────────────────────────────────── */

  function step(dt) {
    // volume decays back to its baseline; impulses fade
    S.volume += (1 - S.volume) * Math.min(1, 0.75 * dt);
    S.impulse *= Math.exp(-2.1 * dt);

    if (live.on) {
      // A real price is not ours to push around: follow the feed, and never
      // clamp it to a floor the model invented.
      S.price += (live.price - S.price) * Math.min(1, 2.5 * dt);
      S.impulse = 0;
    } else {
      var noise = (Math.random() - 0.5) * 0.42 * dt * Math.sqrt(S.volume);
      S.price = S.price + S.impulse * dt + noise;

      // the floor is a floor: price cannot settle beneath the liquidity below it
      if (S.price < S.floor) {
        S.price = S.floor + (S.price - S.floor) * 0.25;
        if (S.price < S.floor) S.price = S.floor;
      }
    }
    if (S.price < 0.02) S.price = 0.02;

    S.ema += (S.price - S.ema) * Math.min(1, 0.55 * dt);

    // fees accrue with volume — a busier book pays the treasury faster
    S.fees += S.volume * 0.26 * dt;
    if (S.fees >= BATCH) { S.fees -= BATCH; fire(); }

    S.acc += dt;
    while (S.acc >= SAMPLE) {
      S.acc -= SAMPLE;
      S.series.push({ p: S.price, f: S.floor });
      if (S.series.length > POINTS) S.series.shift();
    }
  }

  function weight(key) {
    var d = DOCTRINE.filter(function (x) { return x.key === key; })[0];
    return d ? d.weight / 100 : 0;
  }

  function fire() {
    S.count++;

    var weak = S.price < S.ema;
    var depth = weak ? Math.min(1, (S.ema - S.price) / (S.ema || 1) * 6) : 0;

    var buy = BATCH * weight("buyback");
    var liq = BATCH * weight("liquidity");
    var war = BATCH * weight("warchest");
    var sig = BATCH * weight("signal");

    // into weakness, the reserve is spent; into strength, it is not
    var drawn = 0;
    if (depth > 0.15 && S.chest > 0.05) {
      drawn = Math.min(S.chest, BATCH * 0.9 * depth);
      S.chest -= drawn;
      buy += drawn;
    }

    S.spent.buyback += buy;
    S.spent.liquidity += liq;
    S.spent.warchest += war;
    S.spent.signal += sig;
    S.chest += war;

    S.impulse += buy * 0.55;                  // the bid lifts the book
    S.burned += (buy / Math.max(S.price, 0.05)) * 1.8e6;
    S.floor += liq * 0.021;                   // added, never removed
    S.volume += sig * 1.9;                    // attention becomes volume

    flash();
    if (drawn > 0.01) {
      feed("buyback", "Price under its own average. <b>" + fmt(buy) +
        " ◎</b> into the bid — <b>" + fmt(drawn) + " ◎</b> of it from the reserve.");
    } else if (weak) {
      feed("buyback", "Weakness answered. <b>" + fmt(buy) + " ◎</b> spent absorbing the offer.");
    } else {
      feed("buyback", "Strength needs no help. <b>" + fmt(buy) + " ◎</b> deployed, reserve untouched.");
    }
    if (S.count % 2 === 0) {
      feed("liquidity", "<b>" + fmt(liq) + " ◎</b> added beneath the price. Floor now <b>" +
        S.floor.toFixed(3) + "</b>.");
    }
    if (S.count % 3 === 0) {
      feed("burn", "<b>" + short(S.burned) + "</b> tokens burned to date. None of it comes back.");
    }
  }

  /* ── formatting ──────────────────────────────────────── */

  function fmt(v) { return v.toFixed(2); }

  function short(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(0);
  }

  /* ── rendering ───────────────────────────────────────── */

  var W = 720, H = 260, PAD = 10;

  function draw() {
    var s = S.series;
    if (s.length < 2) return;

    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < s.length; i++) {
      if (s[i].p < lo) lo = s[i].p;
      if (s[i].f < lo) lo = s[i].f;
      if (s[i].p > hi) hi = s[i].p;
    }
    var span = Math.max(0.08, hi - lo);
    lo -= span * 0.14;
    hi += span * 0.14;

    var x = function (i) { return PAD + (i / (s.length - 1)) * (W - PAD * 2); };
    var y = function (v) { return H - PAD - ((v - lo) / (hi - lo)) * (H - PAD * 2); };

    var price = "", floor = "";
    for (var j = 0; j < s.length; j++) {
      price += (j ? "L" : "M") + x(j).toFixed(1) + " " + y(s[j].p).toFixed(1);
      floor += (j ? "L" : "M") + x(j).toFixed(1) + " " + y(s[j].f).toFixed(1);
    }
    var floorFill = floor + "L" + x(s.length - 1).toFixed(1) + " " + (H - PAD) +
                    "L" + x(0).toFixed(1) + " " + (H - PAD) + "Z";

    var last = s[s.length - 1];

    root.innerHTML =
      '<defs><linearGradient id="simFloorFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#7b5cff" stop-opacity="0.26"/>' +
      '<stop offset="100%" stop-color="#7b5cff" stop-opacity="0.02"/>' +
      "</linearGradient></defs>" +
      '<path d="' + floorFill + '" fill="url(#simFloorFill)"/>' +
      '<path d="' + floor + '" fill="none" stroke="#7b5cff" stroke-width="1.6" stroke-dasharray="4 4"/>' +
      '<path d="' + price + '" fill="none" stroke="#22d3ee" stroke-width="2.1" stroke-linejoin="round"/>' +
      '<circle cx="' + x(s.length - 1).toFixed(1) + '" cy="' + y(last.p).toFixed(1) +
      '" r="3.6" fill="#22d3ee"/>';
  }

  var els = {};

  function paint() {
    var pct = Math.min(100, (S.fees / BATCH) * 100);
    els.feeBar.style.width = pct.toFixed(1) + "%";
    els.feeVal.textContent = S.fees.toFixed(2) + " ◎";

    els.price.textContent = S.price.toFixed(3);
    var chg = ((S.price / S.opened - 1) * 100);
    els.change.textContent = (chg >= 0 ? "+" : "") + chg.toFixed(1) + "% since genesis";
    els.price.className = "sim-price-val " + (chg >= 0 ? "up" : "down");
    els.change.className = "sim-price-chg " + (chg >= 0 ? "up" : "down");

    els.burned.textContent = short(S.burned);
    els.floor.textContent = S.floor.toFixed(3);
    els.chest.textContent = S.chest.toFixed(2) + " ◎";
    els.count.textContent = S.count;

    var total = 0;
    DOCTRINE.forEach(function (d) { total += S.spent[d.key] || 0; });
    DOCTRINE.forEach(function (d) {
      var bar = els.alloc[d.key];
      if (!bar) return;
      var v = S.spent[d.key] || 0;
      bar.fill.style.width = (total ? (v / total) * 100 : 0).toFixed(1) + "%";
      bar.val.textContent = v.toFixed(2) + " ◎";
    });
  }

  function flash() {
    var f = $("#simFlash");
    if (!f || !MOTION) return;
    f.classList.remove("go");
    void f.offsetWidth;
    f.classList.add("go");
  }

  function feed(kind, msg) {
    var list = $("#simFeed");
    if (!list) return;
    var li = document.createElement("li");
    li.innerHTML = '<span class="sf-kind ' + kind + '">' + kind + '</span><span class="sf-msg">' + msg + "</span>";
    list.prepend(li);
    while (list.children.length > 14) list.removeChild(list.lastChild);
  }

  /* ── loop ────────────────────────────────────────────── */

  function loop(now) {
    if (!playing) return;
    var dt = Math.min(0.12, (now - lastT) / 1000) * speed * TEMPO;
    lastT = now;
    step(dt);
    draw();
    paint();
    raf = requestAnimationFrame(loop);
  }

  function play() {
    if (playing) return;
    playing = true;
    lastT = performance.now();
    els.toggle.querySelector(".sim-btn-k").textContent = "Pause";
    raf = requestAnimationFrame(loop);
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    els.toggle.querySelector(".sim-btn-k").textContent = "Resume";
  }

  function reset() {
    S = fresh();
    var list = $("#simFeed");
    if (list) list.innerHTML = "";
    for (var i = 0; i < 40; i++) step(SAMPLE); // a little history to draw against
    draw();
    paint();
  }

  /* ── optional live price ─────────────────────────────── */

  var MKT = CFG.market || {};
  var live = { on: false, price: 0, base: 0 };

  function dig(obj, path) {
    return String(path).split(".").reduce(function (o, k) {
      return o == null ? o : o[k];
    }, obj);
  }

  function pollPrice() {
    var mint = (CFG.token && CFG.token.mint) || "";
    var url = String(MKT.feed || "").replace("{mint}", mint);
    if (!url || !mint) return;

    fetch(url, { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (json) {
        var raw = parseFloat(dig(json, MKT.pricePath));
        if (!isFinite(raw) || raw <= 0) throw new Error("no price at " + MKT.pricePath);

        // The chart is an index, not a dollar figure: the first reading becomes
        // 1.000 and everything after is measured against it.
        if (!live.base) live.base = raw;
        live.price = raw / live.base;
        live.on = true;
        mark("live price · doctrine overlay still modelled");
      })
      .catch(function (e) {
        live.on = false;
        mark("price feed unreachable · running the sandbox model");
      });
  }

  function mark(text) {
    var el = document.getElementById("simSource");
    if (el) el.textContent = text;
  }

  function startFeed() {
    if (MKT.mode !== "live") return;
    pollPrice();
    setInterval(pollPrice, Math.max(5000, MKT.pollMs || 20000));
  }

  /* ── wiring ──────────────────────────────────────────── */

  function build() {
    els = {
      feeBar: $("#simFeeBar"),
      feeVal: $("#simFeeVal"),
      price: $("#simPrice"),
      change: $("#simChange"),
      burned: $("#simBurned"),
      floor: $("#simFloor"),
      chest: $("#simChest"),
      count: $("#simCount"),
      toggle: $("#simToggle"),
      speed: $("#simSpeed"),
      alloc: {},
    };

    var box = $("#simAlloc");
    box.innerHTML = DOCTRINE.map(function (d) {
      return (
        '<div class="sim-alloc-row" style="--seg:' + (SEG[d.key] || "#7b5cff") + '">' +
        '<div class="sim-alloc-top"><span>' + d.label + '</span><b data-alloc="' + d.key + '">0.00 ◎</b></div>' +
        '<div class="sim-alloc-bar"><i></i></div>' +
        "</div>"
      );
    }).join("");

    DOCTRINE.forEach(function (d) {
      var row = box.querySelector('[data-alloc="' + d.key + '"]');
      if (!row) return;
      els.alloc[d.key] = { val: row, fill: row.closest(".sim-alloc-row").querySelector(".sim-alloc-bar i") };
    });

    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest && e.target.closest("[data-sim]");
      if (!el) return;
      var act = el.getAttribute("data-sim");

      // you cannot move a real market with a button; say so rather than pretend
      if (live.on && (act === "sell" || act === "hype")) {
        feed("signal", "Price is live. Nothing on this page moves a real book.");
        return;
      }

      if (act === "sell") {
        S.impulse -= 1.15;
        S.volume += 2.4;
        feed("signal", "Sell pressure into the book. The doctrine calls this an opportunity.");
        play();
      } else if (act === "hype") {
        S.impulse += 0.8;
        S.volume += 2.0;
        feed("signal", "Attention arriving. Volume up, fees with it.");
        play();
      } else if (act === "toggle") {
        playing ? pause() : play();
      } else if (act === "speed") {
        speed = speed === 1 ? 4 : speed === 4 ? 16 : 1;
        el.querySelector(".sim-btn-k").textContent = "Speed ×" + speed;
      } else if (act === "reset") {
        pause();
        speed = 1;
        els.speed.querySelector(".sim-btn-k").textContent = "Speed ×1";
        reset();
        if (MOTION) play(); // a reset that sits still reads as a broken button
      }
    });

    // the hero and nav links promise a running simulation; deliver one
    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest && e.target.closest("[data-sim-start]");
      if (el) setTimeout(play, 700);
    });

    // run only while on screen, and never behind a hidden tab
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { if (MOTION) play(); }
          else if (playing) { pause(); }
        });
      }, { threshold: 0.25 });
      io.observe($("#watch"));
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && playing) pause();
    });

    reset();
    startFeed();
    if (!MOTION) els.toggle.querySelector(".sim-btn-k").textContent = "Run";
  }

  build();
})();
