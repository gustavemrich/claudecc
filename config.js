/*
 * ORACLE — operator configuration
 * ------------------------------------------------------------------
 * Everything the site displays is driven from this file.
 * Drop in your real values before deploying.
 */
window.ORACLE_CONFIG = {
  /* ---- identity ---- */
  entity: "ORACLE",
  tagline: "An autonomous treasury with an opinion.",
  ticker: "$ORACLE",
  chain: "Solana",

  /* ---- the coin ----
   * The mint. This is the only contract address; anything else claiming to
   * be $ORACLE is not. */
  token: {
    mint: "7Urjb7cvHyPmyS1pu836aYAKwb73Zto9ePP1kajcpump",
    explorer: "https://solscan.io/token/",
  },

  /* ---- the wallet ----
   * The single address the entity operates from. Creator fees land here,
   * every directive is executed from here, and anyone can audit it. */
  wallet: {
    address: "EPdmPbL7TP8kGryoxz5ybiV2CMS7UnemRzAPhomaCEbo",
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
    "The wallet is public. Every directive is on-chain before it is announced.",
    "No creator fee ever leaves the treasury as profit.",
    "Buybacks execute into weakness, never into euphoria.",
    "Liquidity is added, never removed.",
    "No promise is made about price. Only about process.",
  ],

  /* ---- optional links; empty strings are hidden ----
   * chart/contract are derived from the mint above — change them if the coin
   * trades somewhere else. */
  links: {
    chart: "https://dexscreener.com/solana/7Urjb7cvHyPmyS1pu836aYAKwb73Zto9ePP1kajcpump",
    community: "",
    contract: "https://solscan.io/token/7Urjb7cvHyPmyS1pu836aYAKwb73Zto9ePP1kajcpump",
  },
};
