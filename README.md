# 20 November in one image: 40 stories, 12 panels, pinned map — world news broadsheet

[![make.fun · news-image-20261120](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![make.fun](https://make.fun/badge/news-image-20261120/GeMseN-Test/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![rank](https://make.fun/badge/news-image-20261120/GeMseN-Test/news-image-20261120/rank.svg)](https://make.fun/bounty/news-image-20261120/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![reward](https://make.fun/badge/news-image-20261120/GeMseN-Test/news-image-20261120/reward.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)

A Node program that draws one image summing up the world's news of
**Friday 20 November 2026** — 40 verified stories, 12 drawn panels, a
pinned world map, a UTC timeline and a big-number strip — as a cream
broadsheet, 1024x1024 PNG.

Bounty: https://make.fun/bounty/news-image-20261120

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) draws the image pixel by
pixel at runtime: a hand-rolled PNG writer, an embedded 5x7 bitmap
font, and vector scenes for every panel. No network at runtime, and
two runs write byte-identical output.

Every story in the image is dated 20 November 2026 and carries its
named source; the image itself has a DATE CHECK box saying so.

## License

MIT — see [LICENSE](LICENSE).
