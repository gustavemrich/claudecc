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
| `assets/app.js` | Config binding, directive log, clipboard |
| `assets/fx.js` | Atmosphere: core, constellation, boot, reveals, cursor |
| `assets/sim.js` | The "Watch It Work" sandbox |
| `assets/agent.js` | "The Mind" — the live cognition stream |
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

## Palette

Three accents on near-black: violet (`--violet`) for the entity's own actions,
cyan (`--cyan`) for what it reads from the market, and ember (`--ember`) for
heat — burns, held reserve, the modelled-data warnings, section numbering, and
the corona around the hero core. Surfaces run `--void` → `--panel` → `--sunk`,
darkest for terminals and input wells.

`--ink-faint` is the floor for readable text at 4.5:1 on every surface; the
small uppercase mono labels use it, so do not darken it without re-checking.
Only `--copy` and the boot hint sit below that, and neither carries meaning.

## Motion

`fx.js` is decoration only — it owns no state the page depends on, so all of it
is safe to drop. It carries the hero core (orbiting particles that lean toward
the pointer), the constellation, the pointer ring, magnetic buttons, card tilt,
word-by-word headings and the travelling edge-light on live panels.

Under `prefers-reduced-motion: reduce` the boot sequence is skipped, the core
and constellation and pointer ring are removed, the edge-lights stop, and every
reveal starts visible. Verify changes in both modes.

The core hangs off the right edge of the hero on purpose. `.hero` uses
`overflow-x: clip` to contain it — `body { overflow-x: hidden }` alone does not
stop the document widening, which is how it first shipped a horizontal
scrollbar on phones.

The boot sequence runs once per session (`sessionStorage`), is click- or
key-skippable, and force-closes after 4.2s so a stalled animation can never
trap a visitor behind it.

## Configuring

`config.js` drives the whole page — entity name, ticker, chain, addresses,
doctrine weights, and the laws list. Change it and reload; nothing else needs
touching.

The two addresses it is built around:

```js
token:  { mint: "", pending: "coming soon", explorer: "https://solscan.io/token/" },
wallet: { address: "EPdm…CEbo", explorer: "https://solscan.io/account/" },
social: { x: "https://x.com/odysseuspf", handle: "@odysseuspf" },
```

The mint appears in the hero CA bar and in its own Treasury card, because a
contract address is the thing visitors arrive looking for. The wallet is the
operating address: where creator fees land and where every directive executes
from.

### Waiting on the mint

`token.mint` is empty until the coin is live, and the page reads that as a
state rather than as missing data:

- both CA slots show `token.pending` in ember and stop offering a copy; the
  hero bar links to X instead and its hint reads "watch X"
- the primary CTA in the hero and the closer becomes **Follow on X**
- the mint's explorer link hides, and the Treasury card explains that the
  address will appear here and on X at the same moment
- the marquee, the hero disclaimer and the agent's `read_book` argument all
  say pending rather than inventing an address

Fill `token.mint` in and every one of those flips back on its own — the copy
buttons return, the explorer link appears, and `links.chart` / `links.contract`
are derived from the mint (Dexscreener and Solscan) unless you set them
yourself. Setting the CA is a one-line change; nothing else needs editing.

`social.x` drives the nav link, the footer, the CTAs and the pending copy. It
is the only place the handle is written down.

`doctrine[].weight` values should sum to 100. They have no section of their
own on the page any more, but they still drive real behaviour: how the
simulated treasury splits each batch, how the directive log allocates, and the
sandbox's allocation bars. Changing a weight changes all three.

## Data modes

`config.data.mode` selects where the numbers come from.

**`"simulated"` (default).** A deterministic local model: fees accrue on an
hourly batch cadence, split by doctrine weight, and generate a plausible
directive log. Genesis is anchored 34 days behind the current UTC day, so the
entity always reads as a young coin. Same log on every machine, moving through
the day. The hero carries a visible **"Modelled"** label in this mode — leave
it intact for as long as the mode is on.

**`"live"`.** `app.js` polls `config.data.endpoint` every `refreshMs` and
fills the directive log from it. A missing field degrades to an empty log
rather than blanking the page. Expected shape:

```jsonc
{
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

The mint and the operating wallet are real and checkable. Everything else —
the cognition stream, the directive log, the sandbox — is a model of the
process, and the hero label says so.

The page deliberately reports **no balances and no totals**. Anyone who wants a
number can open the wallet in an explorer, where it is true. If you add figures
back, add the caveat back with them.

- Stand up an endpoint and switch `data.mode` to `"live"` to make the ledger
  real, or leave the modelled label exactly where it is.
- Keep the footer disclaimer. It is accurate.
