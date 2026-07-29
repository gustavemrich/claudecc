# ORACLE

A one-page site for a memecoin run by an autonomous operator: a single public
wallet collects creator fees, and every unit that arrives is redeployed into
the coin according to a fixed doctrine. Buybacks, burns, liquidity, reserve,
attention — nothing is withdrawn as profit.

Static. No build step, no dependencies, no external requests. Open
`index.html` or serve the folder.

```
python3 -m http.server 8000
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `assets/style.css` | All styling |
| `assets/app.js` | Data layer, chart, directive log, clipboard |
| `config.js` | **Everything you need to edit** |

## Configuring

`config.js` drives the whole page — entity name, ticker, chain, wallet
address, explorer, doctrine weights, and the laws list. Change it and reload;
nothing else needs touching.

The one field to get right before you deploy:

```js
wallet: {
  address: "your-real-treasury-address",
  explorer: "https://solscan.io/account/",
}
```

`doctrine[].weight` values should sum to 100 — they drive the percentages, the
progress bars, and how the simulated directive log allocates each batch.

## Data modes

`config.data.mode` selects where the numbers come from.

**`"simulated"` (default).** A deterministic local model: fee inflow accrues on
a 20-minute batch cadence from a fixed genesis date, splits by doctrine weight,
and generates a plausible directive log. Same numbers on every machine, and
they grow over time. The hero carries a visible **"Simulated telemetry"** label
in this mode — leave that label intact for as long as the mode is on. Presenting
modelled treasury figures as a real balance is the one thing this page must
never do.

**`"live"`.** `app.js` polls `config.data.endpoint` every `refreshMs` and
renders whatever comes back. Any missing field degrades to zero rather than
blanking the page. Expected shape:

```jsonc
{
  "feesTotal": 412.8,                       // ◎ collected, all time
  "deployed": {                             // keyed by doctrine[].key
    "buyback": 198.4, "liquidity": 99.2,
    "warchest": 59.5, "signal": 39.7
  },
  "burned": 47200000,                       // tokens removed from supply
  "idle": 16.0,                             // in the wallet, not yet deployed
  "batches": 1204,                          // directives executed, all time
  "nextBatchAt": 1767830400000,             // epoch ms of the next deployment
  "series": [                               // oldest → newest, ~72 points
    { "t": 1767744000000, "fees": 380.1, "deployed": 372.0 }
  ],
  "directives": [                           // newest first
    { "t": 1767830000000, "kind": "buyback", "msg": "Bid placed into thin books." }
  ]
}
```

`kind` should be a doctrine key, `burn`, or `observe` — those are the values
the log has colours for. `msg` is inserted as HTML so the entity can emphasise
a clause with `<em>`; only emit it from a source you control.

Point `endpoint` at whatever indexes the wallet. The front end has no keys, no
signing, and no write path — it reads and renders, nothing more.

## Before going live

- Replace the placeholder wallet address in `config.js`.
- Switch `data.mode` to `"live"` and stand up the endpoint, or keep the
  simulated label visible.
- Keep the footer disclaimer. It is accurate.
