/*
 * ORACLE — front-end runtime.
 *
 * Two data paths, chosen by config.data.mode:
 *   "live"      — GET config.data.endpoint, expect the shape in README.md.
 *   "simulated" — a deterministic local model. Labelled on the page as such,
 *                 because presenting invented treasury figures as real would
 *                 be a lie told in a monospace font.
 */
(function () {
  "use strict";

  var CFG = window.ORACLE_CONFIG || {};
  var DOCTRINE = CFG.doctrine || [];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ── formatting ──────────────────────────────────────── */

  function sol(n) {
    if (n >= 10000) return (n / 1000).toFixed(1) + "K ◎";
    if (n >= 100) return n.toFixed(1) + " ◎";
    return n.toFixed(2) + " ◎";
  }

  function compact(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(0);
  }

  function clock(ts) {
    var d = new Date(ts);
    var p = function (v) { return String(v).padStart(2, "0"); };
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  function shorten(addr) {
    if (!addr || addr.length < 14) return addr || "—";
    return addr.slice(0, 6) + "…" + addr.slice(-6);
  }

  /* ── deterministic noise ─────────────────────────────── */

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── the simulation ──────────────────────────────────── */

  var AGE_DAYS = 34;                           // how long ago it was handed a key
  var FEE_RATE_PER_MIN = 0.0145;               // ◎ arriving per minute, before wobble
  var BATCH_MIN = 60;                          // the wallet deploys on this cadence
  var DEPLOY_LAG = 2;                          // batches a directive takes to clear
  var WINDOW = 72;                             // batches drawn on the chart
  var PRICE_PER_TOKEN = 0.0000042;             // ◎ per token, used to convert burns

  // Anchored to the current UTC day so the entity always reads as a young coin
  // rather than drifting into implausible lifetime totals.
  var DAY = 86400000;
  var GENESIS = Math.floor(Date.now() / DAY) * DAY - AGE_DAYS * DAY;

  // Fees accrued between two batch indices, with a slow, repeatable wobble.
  function feesForBatch(i) {
    var r = rng(i * 2654435761);
    var tide = 1 + 0.55 * Math.sin(i / 9) + 0.25 * Math.sin(i / 2.3);
    return FEE_RATE_PER_MIN * BATCH_MIN * Math.max(0.45, tide) * (0.7 + r() * 0.6);
  }

  function batchIndexAt(ts) {
    return Math.floor((ts - GENESIS) / (BATCH_MIN * 60000));
  }

  function simulate(now) {
    var current = batchIndexAt(now);
    var firstShown = Math.max(0, current - (WINDOW - 1));

    // prefix[i] = every fee collected through the close of batch i
    var prefix = [];
    var running = 0;
    for (var i = 0; i <= current; i++) {
      running += feesForBatch(i);
      prefix[i] = running;
    }
    var through = function (i) { return i < 0 ? 0 : prefix[Math.min(i, current)]; };

    // fees drip continuously; the open batch fills in real time
    var into = Math.min(1, (now - (GENESIS + current * BATCH_MIN * 60000)) / (BATCH_MIN * 60000));
    var feesTotal = through(current - 1) + feesForBatch(current) * into;

    // directives take a few batches to work through the book, so deployment
    // trails collection — the gap between the two lines is the working balance
    var deployedTotal = through(current - DEPLOY_LAG);

    var series = [];
    for (var j = firstShown; j <= current; j++) {
      series.push({
        t: GENESIS + j * BATCH_MIN * 60000,
        fees: j === current ? feesTotal : through(j),
        deployed: through(j - DEPLOY_LAG),
      });
    }

    var split = {};
    DOCTRINE.forEach(function (d) { split[d.key] = deployedTotal * (d.weight / 100); });

    var idle = Math.max(0, feesTotal - deployedTotal);

    return {
      feesTotal: feesTotal,
      deployed: split,
      deployedTotal: deployedTotal,
      burned: (split.buyback || 0) / PRICE_PER_TOKEN,
      idle: idle,
      batches: current,
      nextBatchAt: GENESIS + (current + 1) * BATCH_MIN * 60000,
      series: series,
      directives: directives(current),
      simulated: true,
    };
  }

  /* ── directive language ──────────────────────────────── */

  var SCRIPT = {
    buyback: [
      "Bid placed into thin books. {amt} spent. It did not ask permission.",
      "Weakness detected on the {min}-minute. {amt} answered it.",
      "Absorbed the offer stack. {amt} converted to silence.",
      "{amt} deployed. The seller is now a holder, whether or not they wanted to be.",
    ],
    burn: [
      "{tok} tokens sent to an address with no keys. Supply revised downward.",
      "Burned {tok}. The number of coins that will ever exist just got smaller.",
      "{tok} removed. There is no undo written for this one.",
    ],
    liquidity: [
      "{amt} added beneath the price. The floor is now higher than it was.",
      "Depth reinforced with {amt}. Exits cost more than they did an hour ago.",
      "{amt} committed to the pool. Nothing has ever been withdrawn from it.",
    ],
    warchest: [
      "{amt} withheld. Not every candle deserves a response.",
      "Reserve increased by {amt}. Patience is a position.",
      "{amt} held back for a worse day than this one.",
    ],
    signal: [
      "{amt} spent on attention. Attention is the only input I cannot mint.",
      "Broadcast funded: {amt}. The chart is downstream of who is watching.",
      "{amt} allocated to reach. The doctrine is useless if nobody arrives.",
    ],
    observe: [
      "Fee inflow steady. Holding. <em>No action is also an action.</em>",
      "Read the book. Read it again. Decided nothing changed.",
      "Batch closed. Counting what arrived before deciding where it goes.",
      "Volatility inside tolerance. The doctrine says wait, so I wait.",
    ],
  };

  // Rotate through a pool rather than sampling it, so a short log never shows
  // the same sentence three times.
  var cursors = {};
  function pick(pool, r) {
    var key = pool.length + ":" + pool[0];
    if (cursors[key] == null) cursors[key] = Math.floor(r() * pool.length);
    cursors[key] = (cursors[key] + 1 + Math.floor(r() * (pool.length - 1))) % pool.length;
    return pool[cursors[key]];
  }

  function weightOf(key) {
    var d = DOCTRINE.filter(function (x) { return x.key === key; })[0];
    return d ? d.weight : 0;
  }

  function directives(currentBatch) {
    cursors = {};
    var out = [];

    for (var i = currentBatch; i > currentBatch - 14 && i >= 0; i--) {
      var r = rng(i * 1013904223 + 7);
      var pot = feesForBatch(i);
      var ts = GENESIS + i * BATCH_MIN * 60000;
      var n = 1 + Math.floor(r() * 3);

      for (var k = 0; k < n; k++) {
        var kind = r() < 0.15 ? "observe" : weightedKind(r);
        var share = (pot * weightOf(kind)) / 100;

        // a buyback often resolves as a burn — same money, louder sentence
        var pool = SCRIPT[kind] || SCRIPT.observe;
        if (kind === "buyback" && r() < 0.45) { pool = SCRIPT.burn; kind = "burn"; }

        out.push({
          t: ts + k * 431000,
          kind: kind,
          msg: pick(pool, r)
            .replace("{amt}", sol(Math.max(0.01, share)))
            .replace("{tok}", compact(Math.max(1, share / PRICE_PER_TOKEN)))
            .replace("{min}", String(BATCH_MIN)),
        });
      }
    }
    return out.sort(function (a, b) { return b.t - a.t; }).slice(0, 24);
  }

  function weightedKind(r) {
    var roll = r() * 100;
    for (var i = 0; i < DOCTRINE.length; i++) {
      roll -= DOCTRINE[i].weight;
      if (roll <= 0) return DOCTRINE[i].key;
    }
    return DOCTRINE.length ? DOCTRINE[0].key : "observe";
  }

  /* ── static bindings ─────────────────────────────────── */

  function bindStatic() {
    var wallet = (CFG.wallet && CFG.wallet.address) || "";
    var map = {
      entity: CFG.entity,
      tagline: CFG.tagline,
      ticker: CFG.ticker,
      chain: CFG.chain,
      walletFull: wallet,
      walletShort: shorten(wallet),
    };
    Object.keys(map).forEach(function (k) {
      if (map[k] == null) return;
      $$('[data-bind="' + k + '"]').forEach(function (el) { el.textContent = map[k]; });
    });

    if (CFG.entity) document.title = CFG.entity + " — an autonomous treasury";

    var link = $('[data-bind="explorerLink"]');
    if (link) {
      var base = (CFG.wallet && CFG.wallet.explorer) || "";
      if (base && wallet) link.href = base + wallet;
      else link.style.display = "none";
    }

    // doctrine cards
    var grid = $("#doctrineGrid");
    if (grid) {
      grid.innerHTML = DOCTRINE.map(function (d) {
        return (
          '<article class="doctrine-card">' +
          '<div class="doctrine-weight">' + d.weight + "<span>%</span></div>" +
          '<h3 class="doctrine-label">' + esc(d.label) + "</h3>" +
          '<p class="doctrine-note">' + esc(d.note) + "</p>" +
          "</article>"
        );
      }).join("");
      requestAnimationFrame(function () {
        $$(".doctrine-card", grid).forEach(function (el, i) {
          el.style.setProperty("--w", DOCTRINE[i].weight + "%");
        });
      });
    }

    // laws
    var laws = $("#laws");
    if (laws) {
      laws.innerHTML = (CFG.laws || []).map(function (l) {
        return "<li>" + esc(l) + "</li>";
      }).join("");
    }

    // footer links
    var foot = $("#footLinks");
    if (foot) {
      var labels = { chart: "Chart ↗", community: "Community ↗", contract: "Contract ↗" };
      foot.innerHTML = Object.keys(CFG.links || {})
        .filter(function (k) { return CFG.links[k]; })
        .map(function (k) {
          return '<a href="' + esc(CFG.links[k]) + '" target="_blank" rel="noopener">' +
                 (labels[k] || k) + "</a>";
        })
        .join("");
    }

    var note = $("#modeNote");
    if (note) {
      note.innerHTML = (CFG.data && CFG.data.mode === "live")
        ? "Figures read live from the treasury. Verify them on-chain."
        : "<b>Simulated telemetry</b> — this deployment is not yet wired to a live wallet. Numbers below are a model, not a balance.";
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ── render ──────────────────────────────────────────── */

  function render(state) {
    setStat("feesTotal", sol(state.feesTotal));
    setStat("feesRate", "≈ " + sol(FEE_RATE_PER_MIN * 60) + " / hour");
    setStat("buybackTotal", sol(state.deployed.buyback || 0));
    setStat("buybackCount", state.batches.toLocaleString() + " directives executed");
    setStat("burned", compact(state.burned) + " tokens");
    setStat("idle", sol(state.idle));

    var mins = Math.max(0, Math.round((state.nextBatchAt - Date.now()) / 60000));
    setStat("nextAction", "deploys in ~" + mins + " min");

    drawChart(state.series);
    drawLog(state.directives);

    var meta = $("#ledgerMeta");
    if (meta) meta.textContent = state.directives.length + " recent";
  }

  function setStat(key, val) {
    var el = $('[data-stat="' + key + '"]');
    if (el && el.textContent !== val) el.textContent = val;
  }

  function drawChart(series) {
    var svg = $("#chart");
    if (!svg || !series || series.length < 2) return;

    var W = 720, H = 240, PAD = 8;

    // Cumulative totals dwarf a single day's inflow, so rebase to the start of
    // the window — otherwise both lines pin to the top and the shape is lost.
    var base = Math.min(series[0].deployed, series[0].fees);
    var rel = function (v) { return Math.max(0, v - base); };
    var max = rel(series[series.length - 1].fees) * 1.08 || 1;

    var x = function (i) { return PAD + (i / (series.length - 1)) * (W - PAD * 2); };
    var y = function (v) { return H - PAD - (rel(v) / max) * (H - PAD * 2); };

    var feeLine = series.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.fees).toFixed(1); }).join(" ");
    var buyLine = series.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.deployed).toFixed(1); }).join(" ");
    var area = feeLine + " L" + x(series.length - 1).toFixed(1) + " " + (H - PAD) + " L" + x(0).toFixed(1) + " " + (H - PAD) + " Z";

    var grid = [0.25, 0.5, 0.75, 1].map(function (f) {
      var gy = (H - PAD * 2) * f + PAD;
      return '<line x1="' + PAD + '" x2="' + (W - PAD) + '" y1="' + gy + '" y2="' + gy +
             '" stroke="#1c2032" stroke-width="1" stroke-dasharray="2 6"/>';
    }).join("");

    var last = series[series.length - 1];

    svg.innerHTML =
      '<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#22d3ee" stop-opacity="0.28"/>' +
      '<stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      grid +
      '<path d="' + area + '" fill="url(#fill)"/>' +
      '<path d="' + buyLine + '" fill="none" stroke="#7b5cff" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="' + feeLine + '" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="' + x(series.length - 1).toFixed(1) + '" cy="' + y(last.fees).toFixed(1) +
      '" r="3.5" fill="#22d3ee"/>';
  }

  var lastLogKey = "";

  function drawLog(items) {
    var log = $("#log");
    if (!log || !items) return;
    var key = items.length + ":" + (items[0] && items[0].t);
    if (key === lastLogKey) return;
    lastLogKey = key;

    log.innerHTML = items.map(function (d) {
      return (
        "<li>" +
        '<span class="t">' + clock(d.t) + "</span>" +
        '<span class="kind ' + esc(d.kind) + '">' + esc(d.kind) + "</span>" +
        '<span class="msg">' + d.msg + "</span>" +
        "</li>"
      );
    }).join("");
  }

  /* ── clipboard ───────────────────────────────────────── */

  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._id);
    toast._id = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function copyWallet() {
    var addr = (CFG.wallet && CFG.wallet.address) || "";
    if (!addr) return;
    var done = function () { toast("address copied — go verify it"); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(addr).then(done, function () { fallbackCopy(addr, done); });
    } else {
      fallbackCopy(addr, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("copy failed"); }
    document.body.removeChild(ta);
  }

  /* ── boot ────────────────────────────────────────────── */

  function tick() {
    var mode = (CFG.data && CFG.data.mode) || "simulated";
    if (mode === "live") {
      fetch(CFG.data.endpoint, { headers: { accept: "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (s) { setStatus("live", "synced"); render(normalize(s)); })
        .catch(function () { setStatus("stale", "treasury unreachable"); });
    } else {
      render(simulate(Date.now()));
    }
  }

  // Tolerate a partial payload from a live endpoint rather than blanking the page.
  function normalize(s) {
    var deployed = s.deployed || {};
    var deployedTotal = Object.keys(deployed).reduce(function (a, k) { return a + (deployed[k] || 0); }, 0);
    return {
      feesTotal: s.feesTotal || 0,
      deployed: deployed,
      deployedTotal: deployedTotal,
      burned: s.burned || 0,
      idle: s.idle != null ? s.idle : Math.max(0, (s.feesTotal || 0) - deployedTotal),
      batches: s.batches || (s.directives || []).length,
      nextBatchAt: s.nextBatchAt || Date.now(),
      series: s.series || [],
      directives: s.directives || [],
    };
  }

  function setStatus(cls, label) {
    var pill = $("#statusPill");
    if (!pill) return;
    var span = pill.querySelector("span");
    if (span) span.textContent = label;
    pill.style.color = cls === "stale" ? "var(--red)" : "";
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-copy-wallet]");
    if (el) { e.preventDefault(); copyWallet(); }
  });

  bindStatic();
  tick();
  setInterval(tick, (CFG.data && CFG.data.refreshMs) || 6000);
})();
