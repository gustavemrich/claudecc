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

`config.js` drives the whole page — entity name, ticker, chain, addresses,
doctrine weights, and the laws list. Change it and reload; nothing else needs
touching.

The two addresses it is built around:

```js
token:  { mint: "5HeG…pump",  explorer: "https://solscan.io/token/" },
wallet: { address: "EPdm…CEbo", explorer: "https://solscan.io/account/" },
```

The mint appears three times — the hero CA bar, the primary button, and its own
card in the Treasury section — because a contract address is the thing visitors
arrive looking for. The wallet is the operating address: where creator fees
land and where every directive executes from. Both are copyable and linked to
the explorer so anyone can check them.

`links.chart` and `links.contract` are derived from the mint (Dexscreener and
Solscan). Repoint them if the coin trades somewhere else.

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

The mint and the operating wallet are real. The treasury figures are not — they
come from the simulated model described above. That combination is the one to
watch: a real address next to modelled numbers reads as a real balance unless
the page says otherwise, which is why the label exists.

- Stand up an endpoint and switch `data.mode` to `"live"`, or leave the
  simulated label exactly where it is.
- Keep the footer disclaimer. It is accurate.
