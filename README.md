# ODYSSEUS

A one-page site for a memecoin run by an autonomous operator: a single public
wallet collects creator fees, and every unit that arrives is redeployed into
the coin according to a fixed doctrine. Buybacks, burns, liquidity, reserve,
attention — nothing is withdrawn as profit. The entity is bound to that
doctrine the way its namesake was bound to the mast.

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
| `assets/fx.js` | Atmosphere: constellation, boot, reveals, scrambles |
| `assets/sim.js` | The "Watch It Work" sandbox |
| `config.js` | **Everything you need to edit** |

## The sandbox

"Watch It Work" (`sim.js`) is a toy model of the doctrine — not a market model,
and explicitly labelled as not live data. Visitors apply sell pressure or hype
and watch the entity respond with the same weights `config.doctrine` defines.

It exists to make two laws visible rather than merely stated:

- **Buybacks execute into weakness.** The further price sits below its own
  moving average, the larger the buyback — funded out of the war chest when the
  dip is deep enough, which you can watch drain and refill.
- **Liquidity is added, never removed.** The floor line beneath the price only
  ever rises, and price cannot settle through it.

It runs only while scrolled into view and never behind a hidden tab. Under
reduced motion it does not auto-start; the toggle reads "Run" and waits.
Since the weights come from `config.doctrine`, the sandbox and the treasury
model cannot drift apart.

Pace is set by `TEMPO` in `sim.js` — roughly one directive every 16 seconds at
×1, with the speed control multiplying on top. Sampling is measured in
sim-seconds, so changing `TEMPO` draws the same chart faster or slower rather
than changing its shape.

### Connecting a real price

`config.market` switches the price line from the model to the real token:

```js
market: {
  mode: "live",                                                   // from "sandbox"
  feed: "https://api.dexscreener.com/latest/dex/tokens/{mint}",   // {mint} is substituted
  pricePath: "pairs.0.priceUsd",                                  // dot-path into the response
  pollMs: 20000,
}
```

The mint comes from `config.token.mint`, so setting the CA in one place is
enough. The defaults match Dexscreener's response shape for a Solana mint;
point `feed`/`pricePath` elsewhere for another provider. There is no backend
here, so the provider must allow browser requests.

Three things hold in live mode, by design:

- The first reading normalises to `1.000` — the chart is an index of movement
  since you loaded it, not a dollar price it would be wrong to imply.
- **Sell pressure** and **Hype it** stop working and say why. A button on a
  webpage does not move a real order book, and pretending otherwise would be
  the dishonest version of this feature.
- The doctrine overlay — floor, burns, reserve — stays modelled, and the label
  under the heading says so. Only the price becomes real.

If the feed fails, it falls back to the sandbox model and relabels itself.

## Motion

`fx.js` is decoration only — it owns no state the page depends on, so all of it
is safe to drop. Under `prefers-reduced-motion: reduce` the boot sequence is
skipped, the canvas is removed, counters jump to their final values, and every
reveal starts visible. Verify changes in both modes.

The boot sequence runs once per session (`sessionStorage`), is click- or
key-skippable, and force-closes after 4.2s so a stalled animation can never
trap a visitor behind it.

## Configuring

`config.js` drives the whole page — entity name, ticker, chain, addresses,
doctrine weights, and the laws list. Change it and reload; nothing else needs
touching.

The two addresses it is built around:

```js
token:  { mint: "7Urj…pump",  explorer: "https://solscan.io/token/" },
wallet: { address: "EPdm…CEbo", explorer: "https://solscan.io/account/" },
```

The mint appears three times — the hero CA bar, the primary button, and its own
card in the Treasury section — because a contract address is the thing visitors
arrive looking for. The wallet is the operating address: where creator fees
land and where every directive executes from. Both are copyable and linked to
the explorer so anyone can check them.

`links.chart` and `links.contract` are derived from the mint (Dexscreener and
Solscan). Repoint them if the coin trades somewhere else.

`doctrine[].weight` values should sum to 100. They have no section of their
own on the page any more, but they still drive real behaviour: how the
simulated treasury splits each batch, how the directive log allocates, and the
sandbox's allocation bars. Changing a weight changes all three.

## Data modes

`config.data.mode` selects where the numbers come from.

**`"simulated"` (default).** A deterministic local model: fee inflow accrues on
an hourly batch cadence, splits by doctrine weight, and generates a plausible
directive log. Genesis is anchored 34 days behind the current UTC day, so the
entity always reads as a young coin instead of drifting into absurd lifetime
totals. Same numbers on every machine, and they move through the day. The hero carries a visible **"Simulated telemetry"** label
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
