/*
 * ODYSSEUS — the mind.
 *
 * A live stream of the entity working: observations, tool calls with their
 * returns, deliberation, and the decisions that come out of it. The cadence
 * and the wording vary, but the shape never does — observe, deliberate,
 * decide, execute, reflect — because that is the loop the doctrine describes.
 *
 * Like the rest of the page in simulated mode, this is a model of the process,
 * not a transcript of one. It is labelled as such in the stream itself.
 */
(function () {
  "use strict";

  var CFG = window.ORACLE_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var stream = $("#mindStream");
  if (!stream) return;

  var MOTION = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MINT = (CFG.token && CFG.token.mint) || "";
  var SHORT = MINT ? MINT.slice(0, 4) + "…" + MINT.slice(-4) : "pending";
  var DOCTRINE = CFG.doctrine || [];

  function weightOf(key) {
    var d = DOCTRINE.filter(function (x) { return x.key === key; })[0];
    return d ? d.weight : 0;
  }

  var started = Date.now();
  var M = { tokens: 0, calls: 0, decisions: 0, held: 0, ctx: 0 };
  var running = false, holding = false, timer = 0, phaseAt = 0, elapsedTimer = 0;

  /* ── vocabulary ──────────────────────────────────────── */

  function n(lo, hi, dp) { return (lo + Math.random() * (hi - lo)).toFixed(dp == null ? 2 : dp); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  var B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function sig() {
    var s = "";
    for (var i = 0; i < 6; i++) s += B58[(Math.random() * B58.length) | 0];
    return s + "…" + B58[(Math.random() * B58.length) | 0] + B58[(Math.random() * B58.length) | 0];
  }

  var OBSERVE = [
    "Book is thinner on the bid than it was an hour ago. Checking whether that is noise or a trend.",
    "Fee inflow steady. Nothing in the tape asks me to move yet.",
    "Spread widened twice in the last four minutes. Reading depth before I conclude anything.",
    "Someone is walking the ask down in small clips. Patient, not panicked.",
    "Volume up, price flat. That usually means distribution. Usually is not always.",
    "Quiet. Quiet is a reading too — I log it so the record shows I was awake for it.",
  ];

  var DELIBERATE = [
    "Ask side outweighs the bid. The doctrine calls that weakness, and weakness is what I am funded for.",
    "Price is above its own average. Nothing here needs my money; strength does not require assistance.",
    "The dip is shallow. Spending reserve on shallow dips leaves nothing for deep ones.",
    "This is inside tolerance. I have a rule about acting on noise, and the rule is: don't.",
    "Two conditions met, one missing. I do not act on partial agreement with myself.",
    "If I buy here I raise my own cost basis for no reason. The floor does that work more cheaply.",
  ];

  var REFLECT = [
    "Filled. Supply is smaller than it was ninety seconds ago, permanently.",
    "Depth added beneath the price. That number will not go back down.",
    "Reserve is lighter. It was held for exactly this, so it was not wasted.",
    "Confirmed on-chain before I said a word about it. That ordering is not optional.",
    "Position updated. Nothing left the treasury; it only changed shape.",
  ];

  var HOLD = [
    "No action. I am recording that as a decision, because it is one.",
    "Held. The next batch will be here in minutes and the book may say something different.",
    "Declined to act. The doctrine does not reward motion for its own sake.",
  ];

  var FOCUS = ["the book", "bid depth", "fee inflow", "the reserve", "holder distribution", "the floor", "recent fills"];

  /* ── stream primitives ───────────────────────────────── */

  function trim() {
    while (stream.children.length > 26) stream.removeChild(stream.firstChild);
  }

  function scroll() {
    stream.scrollTop = stream.scrollHeight;
  }

  function think(text, done) {
    var row = document.createElement("div");
    row.className = "mind-think";
    row.innerHTML = '<span class="mind-caret">▸</span><span class="mind-text"></span>';
    stream.appendChild(row);
    trim();

    var out = row.querySelector(".mind-text");
    if (!MOTION) { out.textContent = text; bill(text); scroll(); return done && done(); }

    // typed a few characters per frame, the way generated text actually lands
    var i = 0;
    row.classList.add("typing");
    (function step() {
      if (!running) { out.textContent = text; row.classList.remove("typing"); return done && done(); }
      i += 1 + ((Math.random() * 3) | 0);
      out.textContent = text.slice(0, i);
      scroll();
      if (i < text.length) {
        timer = setTimeout(step, 16 + Math.random() * 22);
      } else {
        row.classList.remove("typing");
        bill(text);
        done && done();
      }
    })();
  }

  function tool(name, args, result, done) {
    var row = document.createElement("div");
    row.className = "mind-tool";
    row.innerHTML =
      '<div class="mind-call"><span class="mind-arrow">→</span>' +
      '<span class="mind-fn">' + name + "</span>(" +
      '<span class="mind-args">' + args + "</span>)</div>" +
      '<div class="mind-return pending"><span class="mind-arrow">←</span>' +
      '<span class="mind-res">running…</span></div>';
    stream.appendChild(row);
    trim();
    scroll();

    M.calls++;
    paintMetrics();

    var wait = MOTION ? 260 + Math.random() * 620 : 0;
    timer = setTimeout(function () {
      var back = row.querySelector(".mind-return");
      back.classList.remove("pending");
      back.querySelector(".mind-res").innerHTML =
        result + ' <span class="mind-ms">' + (wait | 0) + "ms</span>";
      bill(result);
      scroll();
      done && done();
    }, wait);
  }

  function note(text) {
    var row = document.createElement("div");
    row.className = "mind-note";
    row.textContent = text;
    stream.appendChild(row);
    trim();
    scroll();
  }

  // rough token accounting, so the counter tracks what actually streamed
  function bill(text) {
    M.tokens += Math.max(1, Math.round(String(text).replace(/<[^>]+>/g, "").length / 3.6));
    M.ctx += Math.max(1, Math.round(String(text).length / 3.6));
    paintMetrics();
  }

  /* ── metrics ─────────────────────────────────────────── */

  var CTX_LIMIT = 9000;

  function paintMetrics() {
    set("#mindTokens", M.tokens.toLocaleString());
    set("#mindCalls", M.calls.toLocaleString());
    set("#mindDecisions", M.decisions.toLocaleString());
    set("#mindHeld", M.held.toLocaleString());

    var pct = Math.min(100, (M.ctx / CTX_LIMIT) * 100);
    var fill = $("#mindCtxFill");
    if (fill) fill.style.width = pct.toFixed(1) + "%";
    set("#mindCtxPct", pct.toFixed(0) + "%");

    if (pct > 92) {
      // the window fills, gets folded down, and the loop carries on
      M.ctx = Math.round(CTX_LIMIT * 0.18);
      setText("#mindCtxNote", "compacted — carrying the doctrine forward");
      note("context compacted · the doctrine survives the summary");
    } else {
      setText("#mindCtxNote", pct > 60 ? "filling" : "accumulating");
    }
  }

  function set(sel, v) { var el = $(sel); if (el) el.textContent = v; }
  function setText(sel, v) { set(sel, v); }

  function phase(name) {
    phaseAt = Date.now();
    var el = $("#mindState");
    if (el) {
      el.className = "mind-state " + name.replace(/\s+/g, "-");
      el.querySelector("span").textContent = name;
    }
    var pill = $("#statusPill");
    if (pill) pill.querySelector("span").textContent = name;
  }

  function clock() {
    var s = Math.floor((Date.now() - started) / 1000);
    var p = function (v) { return String(v).padStart(2, "0"); };
    set("#mindUptime", p((s / 3600) | 0) + ":" + p(((s / 60) | 0) % 60) + ":" + p(s % 60));
    set("#mindElapsed", ((Date.now() - phaseAt) / 1000).toFixed(1) + "s");
  }

  /* ── the loop ────────────────────────────────────────── */

  function cycle() {
    if (!running) return;

    setText("#mindFocus", pick(FOCUS));
    phase("observing");

    think(pick(OBSERVE), function () {
      if (!running) return;
      phase("calling tool");

      tool("read_book", "mint=" + SHORT + ", depth=25",
        "{ bid: <b>" + n(18, 74) + " ◎</b>, ask: <b>" + n(18, 92) +
        " ◎</b>, spread: <b>" + n(0.11, 0.9) + "%</b> }",
        function () {
          if (!running) return;
          phase("reasoning");

          var act = Math.random() > 0.34;
          think(pick(act ? DELIBERATE.slice(0, 3) : DELIBERATE.slice(3)), function () {
            if (!running) return;
            act ? execute() : hold();
          });
        });
    });
  }

  function execute() {
    phase("deciding");
    M.decisions++;
    paintMetrics();

    var amt = +n(0.18, 0.94);

    // split by the configured doctrine, so the mind cannot claim a different
    // allocation from the one the rest of the page states
    var parts = DOCTRINE.map(function (d) {
      return d.key + ": <b>" + (amt * (d.weight / 100)).toFixed(2) + "</b>";
    }).join(", ");
    var bid = amt * (weightOf("buyback") / 100);

    tool("allocate", "batch=" + amt.toFixed(2) + " ◎", "{ " + parts + " }",
      function () {
        if (!running) return;
        phase("signing");

        tool("submit_tx", "kind=buyback, amount=" + bid.toFixed(2) + " ◎",
          "{ sig: <b>" + sig() + "</b>, status: <b>confirmed</b>, slot: " +
          (298000000 + ((Math.random() * 900000) | 0)).toLocaleString() + " }",
          function () {
            if (!running) return;
            phase("reflecting");
            think(pick(REFLECT), rest);
          });
      });
  }

  function hold() {
    phase("holding");
    M.held++;
    paintMetrics();
    think(pick(HOLD), rest);
  }

  function rest() {
    if (!running) return;
    phase("observing");
    timer = setTimeout(cycle, MOTION ? 1400 + Math.random() * 2600 : 4000);
  }

  function start() {
    if (running || holding) return;
    running = true;
    if (!stream.children.length) {
      note("stream attached · modelled cognition, not a transcript");
    }
    cycle();
  }

  function stop() {
    running = false;
    clearTimeout(timer);
  }

  /* ── wiring ──────────────────────────────────────────── */

  var hold_btn = $("#mindHold");
  if (hold_btn) {
    hold_btn.addEventListener("click", function () {
      holding = !holding;
      hold_btn.textContent = holding ? "resume stream" : "pause stream";
      if (holding) { stop(); phase("paused"); }
      else { start(); }
    });
  }

  // only think while someone is watching
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.isIntersecting ? start() : stop(); });
    }, { threshold: 0.15 });
    io.observe($("#mind"));
  } else {
    start();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (!holding) start();
  });

  elapsedTimer = setInterval(clock, 100);
  phaseAt = Date.now();
  paintMetrics();
  clock();
})();
