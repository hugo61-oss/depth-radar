# depth-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/hugo61-oss/depth-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/hugo61-oss/depth-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Depth Radar is a token launch radar that ranks pre-token protocols by liquidity depth — TVL per chain — instead of raw size. A protocol with $200M of TVL spread thin across eight chains has shallow pools everywhere; the same TVL concentrated on one or two chains is deep liquidity a token launch can actually lean on. The board covers the snapshot's whole watchlist and adds up to 160 early finds chosen by implied value under the depth model, each with a concrete farm plan that names its cost and time. Live-token protocols are shown apart, at the market's own values, never ranked with the pre-token board.

Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## The model

```
depth       = TVL / chains
depthMult   = 0.75 + 0.50 * clamp(log10(depth / $1M), 0, 2) / 2
breadthMult = 1 + 0.05 * min(chains - 1, 4)
growthMult  = 1 + clamp(change_7d, -60, 120) / 100 * 0.5
tenureMult  = 0.70 + 0.30 * min(age_days, 1095) / 1095
implied     = TVL * 0.25 * depthMult * breadthMult * growthMult * tenureMult
```

Every input is a snapshot figure. No protocol name is special-cased. The dashboard's model sandbox re-runs this exact formula in the page when a reader moves the depth or growth sliders.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` (Node 22, standard library only) reads the sealed snapshot, writes the ranked board to `out/board.json`, the dashboard data to `out/data.js`, copies `dashboard/` and `screenshots/` to `out/`, and writes `out/dossier.json` with the vendored make.fun library.

## Layout

- `main.ts` — entrypoint: snapshot in, board + dashboard + dossier out
- `lib/depth.ts` — the depth model, farm plans, board validation
- `dashboard/` — the static page (index.html, app.css, app.js), no network
- `screenshots/` — board, detail view, filtered view
- `vendor/makefun-board.ts` — make.fun's dossier library

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
