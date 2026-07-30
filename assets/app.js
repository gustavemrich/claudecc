/*
 * ODYSSEUS — front-end runtime.
 *
 * Binds config to the page, and fills the directive log from one of two
 * sources chosen by config.data.mode:
 *   "live"      — GET config.data.endpoint, expect the shape in README.md.
 *   "simulated" — a deterministic local model, labelled as such on the page.
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
    return { directives: directives(batchIndexAt(now)), simulated: true };
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
    var mint = (CFG.token && CFG.token.mint) || "";
    var map = {
      entity: CFG.entity,
      tagline: CFG.tagline,
      ticker: CFG.ticker,
      chain: CFG.chain,
      walletFull: wallet,
      walletShort: shorten(wallet),
      mintFull: mint,
      mintShort: shorten(mint),
    };
    Object.keys(map).forEach(function (k) {
      if (map[k] == null) return;
      $$('[data-bind="' + k + '"]').forEach(function (el) { el.textContent = map[k]; });
    });

    if (CFG.entity) document.title = CFG.entity + " — an autonomous treasury";

    explorerLink("explorerLink", (CFG.wallet && CFG.wallet.explorer) || "", wallet);
    explorerLink("mintLink", (CFG.token && CFG.token.explorer) || "", mint);

    // laws — note the id, not #laws: that one belongs to the <section>
    var laws = $("#lawsList");
    if (laws) {
      laws.innerHTML = (CFG.laws || []).map(function (l, i) {
        return '<li style="--i:' + i + '">' + esc(l) + "</li>";
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
        ? "Directives read live from the treasury. Verify them on-chain."
        : "<b>Modelled</b> — the addresses above are real and checkable. The stream, the ledger and the simulator are a model of the process, not a record of one.";
    }
  }

  function explorerLink(bind, base, id) {
    var el = $('[data-bind="' + bind + '"]');
    if (!el) return;
    if (base && id) el.href = base + id;
    else el.style.display = "none";
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ── render ──────────────────────────────────────────── */

  function render(state) {
    drawLog(state.directives);
    var meta = $("#ledgerMeta");
    if (meta) meta.textContent = state.directives.length + " recent";
  }


  var lastLogKey = "";

  function drawLog(items) {
    var log = $("#log");
    if (!log || !items) return;
    var key = items.length + ":" + (items[0] && items[0].t);
    if (key === lastLogKey) return;
    lastLogKey = key;

    log.innerHTML = items.map(function (d, i) {
      return (
        '<li style="--i:' + Math.min(i, 14) + '">' +
        '<span class="t">' + clock(d.t) + "</span>" +
        '<span class="kind ' + esc(d.kind) + '">' + esc(d.kind) + "</span>" +
        '<span class="msg">' + d.msg + "</span>" +
        "</li>"
      );
    }).join("");
  }

  /* ── marquee copy ───────────────────────────────────── */

  function marquee() {
    if (!window.ORACLE_FX || !ORACLE_FX.marquee) return;
    var mint = (CFG.token && CFG.token.mint) || "";
    ORACLE_FX.marquee([
      "<b>" + esc(CFG.entity || "ODYSSEUS") + "</b> is listening",
      "treasury <b>online</b>",
      "ca <b>" + esc(shorten(mint)) + "</b>",
      "every fee routed to the doctrine",
      "<b>nothing</b> withdrawn",
      "liquidity added, never removed",
      "bound to the mast",
    ]);
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

  function copy(what) {
    var value = what === "mint"
      ? (CFG.token && CFG.token.mint) || ""
      : (CFG.wallet && CFG.wallet.address) || "";
    if (!value) return;

    var done = function () {
      toast(what === "mint" ? "contract copied — check it matches" : "wallet copied — go verify it");
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(done, function () { fallbackCopy(value, done); });
    } else {
      fallbackCopy(value, done);
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
    return { directives: s.directives || [] };
  }

  function setStatus(cls, label) {
    var pill = $("#statusPill");
    if (!pill) return;
    var span = pill.querySelector("span");
    if (span) span.textContent = label;
    pill.style.color = cls === "stale" ? "var(--red)" : "";
  }

  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest && e.target.closest("[data-copy]");
    if (el) { e.preventDefault(); copy(el.getAttribute("data-copy")); }
  });

  // the CA bar is a div, so it needs the keyboard affordance a button gets free
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var el = e.target && e.target.closest && e.target.closest('.ca-bar[data-copy]');
    if (el) { e.preventDefault(); copy(el.getAttribute("data-copy")); }
  });

  bindStatic();
  marquee();
  tick();
  if (window.ORACLE_FX) ORACLE_FX.start();
  setInterval(tick, (CFG.data && CFG.data.refreshMs) || 6000);
})();
