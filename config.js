/*
 * ODYSSEUS — operator configuration
 * ------------------------------------------------------------------
 * Everything the site displays is driven from this file.
 * Drop in your real values before deploying.
 */
window.ORACLE_CONFIG = {
  /* ---- identity ---- */
  entity: "ODYSSEUS",
  tagline: "An autonomous treasury, bound to the mast.",
  ticker: "$ODYSSEUS",
  chain: "Solana",

  /* ---- the coin ----
   * The mint. This is the only contract address; anything else claiming to
   * be $ODYSSEUS is not.
   *
   * Leave `mint` empty until it is live and the page switches itself to a
   * "coming soon" state: the CA slots stop offering a copy, the explorer links
   * hide, and the primary button points at X instead. Fill it in and every one
   * of those flips back on its own — nothing else to edit. */
  token: {
    mint: "RYoYXquMLJh74SnJ4aNETFsZeQnEUu9ydW1xxt2pump",
    pending: "coming soon",
    explorer: "https://solscan.io/token/",
  },

  /* ---- where the drop gets announced ---- */
  social: {
    x: "https://x.com/odysseuspf",
    handle: "@odysseuspf",
  },

  /* ---- the wallet ----
   * The deployer. Creator fees land here, every directive is executed from
   * here, and anyone can audit it. */
  wallet: {
    address: "EmDetxFGdpypii4ZgGQcLCeaAFGwgTPMRvF6uzu1sFxC",
    explorer: "https://solscan.io/account/",
  },

  /* ---- where the numbers come from ----
   * mode: "simulated" -> deterministic local model, clearly labelled as such.
   * mode: "live"      -> app.js GETs `endpoint` and expects the JSON shape
   *                      documented in README.md.
   * Never ship "simulated" while presenting the figures as real. */
  data: {
    mode: "simulated",
    endpoint: "/api/state",
    refreshMs: 6000,
  },

  /* ---- live market feed (optional) ----
   * The "Watch It Work" simulator runs as a labelled sandbox until this is
   * switched on. Set mode to "live" and give it an endpoint that returns the
   * token's price as JSON, and the price line is driven by the real market
   * instead of the model — the doctrine overlay (floor, burns, reserve) stays
   * modelled, and the page says so.
   *
   * Defaults below are the Dexscreener shape for a Solana mint:
   *   https://api.dexscreener.com/latest/dex/tokens/<mint>  ->  pairs[0].priceUsd
   * `pricePath` is a dot-path into the response; array indexes are numbers.
   * The provider must allow browser requests — this page has no backend. */
  market: {
    mode: "live",
    feed: "https://api.dexscreener.com/latest/dex/tokens/{mint}",
    pricePath: "pairs.0.priceUsd",
    pollMs: 20000,
  },

  /* ---- the doctrine ----
   * How every unit of creator fee is deployed. Must sum to 100. */
  doctrine: [
    {
      key: "buyback",
      label: "Buyback & Burn",
      weight: 50,
      note: "Fees become bids. Bids become fewer coins. Supply only moves one way.",
    },
    {
      key: "liquidity",
      label: "Liquidity Floor",
      weight: 25,
      note: "Depth added beneath the price, never above it. The floor rises; it does not fall.",
    },
    {
      key: "warchest",
      label: "War Chest",
      weight: 15,
      note: "Held in reserve for the moments the chart forgets itself.",
    },
    {
      key: "signal",
      label: "Signal",
      weight: 10,
      note: "Attention is a commodity. It is purchased like any other.",
    },
  ],

  /* ---- laws the entity will not break ---- */
  laws: [
    "I am tied to the mast. The doctrine was set before the voyage and does not change mid-passage.",
    "The wallet is public. Every directive is on-chain before it is announced.",
    "No creator fee ever leaves the treasury as profit.",
    "Buybacks execute into weakness, never into euphoria.",
    "Liquidity is added, never removed.",
    "No promise is made about price. Only about process.",
  ],

  /* ---- optional links; empty strings are hidden ----
   * Leave chart/contract empty while the mint is pending — app.js derives both
   * from the mint automatically once it is set. */
  links: {
    chart: "",
    community: "",
    contract: "",
  },
};
