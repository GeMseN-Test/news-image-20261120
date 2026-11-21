# Friday 20 November 2026 in one image — V3

[![make.fun](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120)
[![make.fun](https://make.fun/badge/news-image-20261120/GeMseN-Test/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120)
[![make.fun](https://make.fun/badge/news-image-20261120/GeMseN-Test/news-image-20261120/rank.svg)](https://make.fun/bounty/news-image-20261120)
[![make.fun](https://make.fun/badge/news-image-20261120/GeMseN-Test/news-image-20261120/reward.svg)](https://make.fun/bounty/news-image-20261120)

Entry for the [make.fun bounty "Sum up 20 November's world news in one image"](https://make.fun/bounty/news-image-20261120) — a rebuild (V3, final slot) of the V2 entry, drawn from scratch in this session.

## What it is

One 1024×1024 broadsheet that sums up Friday 20 November 2026:

- **58 stories**, every one dated Friday 20 November 2026 — 3 lead panels, 12 small panels, 43 numbered briefs
- A big-number strip (3 Kyiv bridges · 300,000+ evacuated · Taiwan −6.2% · 100,000 youth visas · Japan 2.3% CPI · Phillips 118)
- A UTC timeline of the day (Kyiv 00:00 → S&P 500 21:00)
- A pinned world map ("Where it happened", pins 1–15)
- A **DATE CHECK** box: 10 stories from Thursday 19 November left out on purpose, plus 3 "not yet happened" items (incl. BepiColombo's orbit entry, due Saturday)
- Every panel carries a CONFIRMED / REPORTED label and its named source
- Rich procedural illustrations in all 15 panels, plus paper grain — 733,585 bytes

## How it is made

`main.ts` (Node, standard library only) draws the whole page procedurally — a hand-rolled 5×7 bitmap font, 15 mini-illustrations, a simplified world map — and writes a deterministic PNG. Two runs produce byte-identical output.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# -> out/entry.png (1024x1024, ≤ 1 MiB)
```

Research notes (story list with dates and sources) live in `RESEARCH.md` in the
workspace, next to the build log `FINISH.md`.

## License

MIT — see `LICENSE`.
