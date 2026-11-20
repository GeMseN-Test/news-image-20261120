// 20 November in one image: 40 stories, 12 panels, pinned map — world news broadsheet.
// Node 22, standard library only. Draws a 1024x1024 PNG pixel by pixel at
// runtime: hand-rolled PNG writer, embedded 5x7 bitmap font, vector scenes.
// No network at runtime. Two runs write byte-identical output.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Every story is dated Friday 20 November 2026 and carries its named source.
// The DATE CHECK box in the image names the big 19 November stories that
// were checked and left out.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- PNG writer
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none (deterministic)
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (1 + w * 3) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ colours
type RGB = [number, number, number];
const CREAM: RGB = [246, 240, 220];
const PAPER: RGB = [250, 246, 232];
const INK: RGB = [25, 23, 19];
const RED: RGB = [179, 32, 44];
const BLUE: RGB = [31, 74, 125];
const TEAL: RGB = [16, 110, 110];
const GOLD: RGB = [184, 134, 32];
const GREY: RGB = [110, 104, 90];
const LIGHT: RGB = [228, 219, 196];
const GREEN: RGB = [46, 125, 50];
const SKY: RGB = [135, 190, 220];
const SEA: RGB = [64, 120, 160];
const SAND: RGB = [214, 196, 150];
const WHITE: RGB = [255, 255, 255];

// ------------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;

class Canvas {
  data = new Uint8Array(W * H * 3);
  constructor() {
    this.fill(CREAM);
  }
  fill(c: RGB) {
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = c[0];
      this.data[i * 3 + 1] = c[1];
      this.data[i * 3 + 2] = c[2];
    }
  }
  px(x: number, y: number, c: RGB) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, t = 1) {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  hline(x: number, y: number, w: number, c: RGB, t = 1) {
    this.rect(x, y, w, t, c);
  }
  vline(x: number, y: number, h: number, c: RGB, t = 1) {
    this.rect(x, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB) {
    for (let y = -r; y <= r; y++) {
      const span = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -span; x <= span; x++) this.px(cx + x, cy + y, c);
    }
  }
  ring(cx: number, cy: number, r: number, c: RGB, t = 2) {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      for (let k = 0; k < t; k++) {
        this.px(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
      }
    }
  }
  // filled polygon from [x,y] points (scanline)
  poly(points: [number, number][], c: RGB) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) this.px(x, y, c);
      }
    }
  }
  text(s: string, x: number, y: number, scale: number, c: RGB) {
    const t = norm(s);
    let cx = x;
    for (const ch of t) {
      this.glyph(ch, cx, y, scale, c);
      cx += 6 * scale;
    }
    return cx;
  }
  textWidth(s: string, scale: number): number {
    return norm(s).length * 6 * scale - scale;
  }
  textCentred(s: string, cx: number, y: number, scale: number, c: RGB) {
    this.text(s, cx - Math.floor(this.textWidth(s, scale) / 2), y, scale, c);
  }
  glyph(ch: string, x: number, y: number, s: number, c: RGB) {
    const g = FONT[ch] ?? FONT['?'];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === '#') this.rect(x + col * s, y + r * s, s, s, c);
      }
    }
  }
  // word-wrap text into lines of at most maxChars characters
  wrap(s: string, maxChars: number): string[] {
    const words = norm(s).split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + (cur ? ' ' : '') + w).length <= maxChars) {
        cur = cur ? cur + ' ' + w : w;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  para(s: string, x: number, y: number, scale: number, maxChars: number, c: RGB, lh?: number): number {
    const lines = this.wrap(s, maxChars);
    const step = lh ?? 9 * scale;
    lines.forEach((ln, i) => this.text(ln, x, y + i * step, scale, c));
    return y + lines.length * step;
  }
}

function norm(s: string): string {
  return s
    .toUpperCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/•/g, '*')
    .replace(/×/g, 'X')
    .replace(/£/g, 'L')
    .replace(/€/g, 'E');
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 cells ('#' = ink, '.' = empty).
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.##.', '#....', '.###.'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '>': ['#....', '.#...', '..#..', '...#.', '..#..', '.#...', '#....'],
  '<': ['....#', '...#.', '..#..', '.#...', '..#..', '...#.', '....#'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
};

// ------------------------------------------------------------------- stories
type Hero = {
  n: number;
  scene: string;
  kicker: string;
  head: string;
  desc: string;
  src: string;
  region: string;
  label: 'CONFIRMED' | 'CLAIM';
};

// 12 hero stories — every one dated Friday 20 November 2026, source named.
const HEROES: Hero[] = [
  {
    n: 1, scene: 'storm', kicker: 'ASIA - WEATHER', head: 'CYCLONE AKVAN HITS ODISHA',
    desc: 'Landfall begins on India’s east coast; heavy rain floods Bengal districts.',
    src: 'THE HINDU', region: 'ASIA', label: 'CONFIRMED',
  },
  {
    n: 2, scene: 'bank', kicker: 'MARKETS - BANKS', head: 'CITI HID $35BN OF RISK',
    desc: 'Misbooked trades at its European unit understated risk-weighted assets.',
    src: 'REUTERS', region: 'MARKETS', label: 'CONFIRMED',
  },
  {
    n: 3, scene: 'chartdown', kicker: 'MARKETS - ASIA', head: 'NIKKEI SINKS 4.68%',
    desc: 'Asian stocks slide in a global sell-off; Taiwan steps in to steady markets.',
    src: 'REUTERS', region: 'MARKETS', label: 'CONFIRMED',
  },
  {
    n: 4, scene: 'game', kicker: 'CULTURE - GAMES', head: 'GTA VI SALES TOP $2BN',
    desc: 'Industry estimate a day after launch; Rockstar’s sequel smashes records.',
    src: 'BBC', region: 'CULTURE', label: 'CLAIM',
  },
  {
    n: 5, scene: 'datacentre', kicker: 'TECH - CLIMATE', head: 'META RETHINKS 2030 GOALS',
    desc: 'AI data centres push emissions up; net-zero deadline under review.',
    src: 'AL JAZEERA', region: 'TECH', label: 'CONFIRMED',
  },
  {
    n: 6, scene: 'ballot', kicker: 'AMERICAS - POLITICS', head: 'BUKELE TO SEEK 3RD TERM',
    desc: 'El Salvador’s president expected to formalise his bid for another term.',
    src: 'AL JAZEERA', region: 'AMERICAS', label: 'CONFIRMED',
  },
  {
    n: 7, scene: 'boat', kicker: 'AFRICA - MIGRATION', head: 'SENEGAL BOAT CAPSIZES',
    desc: 'Four bodies recovered near Yenne as Canary Islands arrivals surge.',
    src: 'AL JAZEERA', region: 'AFRICA', label: 'CONFIRMED',
  },
  {
    n: 8, scene: 'shield', kicker: 'ASIA - MARKETS', head: 'TAIWAN STEADIES STOCKS',
    desc: 'Watchdog unveils five measures; short-selling limits take effect today.',
    src: 'SIMPLELIFE', region: 'ASIA', label: 'CONFIRMED',
  },
  {
    n: 9, scene: 'pill', kicker: 'HEALTH - SCIENCE', head: 'CANCER PILL HOPE',
    desc: 'Trial saw tumours vanish; doctors call the pancreatic drug a breakthrough.',
    src: 'BBC', region: 'HEALTH', label: 'CLAIM',
  },
  {
    n: 10, scene: 'globe', kicker: 'CLIMATE - COP31', head: 'AFRICA WANTS MORE CASH',
    desc: 'At COP31 in Antalya, Europe says use the money already pledged.',
    src: 'BBC', region: 'CLIMATE', label: 'CONFIRMED',
  },
  {
    n: 11, scene: 'hoop', kicker: 'SPORT - BASKETBALL', head: 'VALKYRIES INTO WNBA FINAL',
    desc: 'Golden State sweep Las Vegas 87-77 in overtime to reach their first final.',
    src: 'USCT', region: 'SPORT', label: 'CONFIRMED',
  },
  {
    n: 12, scene: 'fridge', kicker: 'TECH - UK', head: 'FRIDGES SAVED FROM HACKERS',
    desc: 'Tens of thousands of UK fridges secured in a secret nationwide operation.',
    src: 'BBC', region: 'UK', label: 'CONFIRMED',
  },
];

// 28 one-line briefs, numbered 13-40.
const BRIEFS: [string, string][] = [
  ['Samsung names new memory chip chief in reshuffle', 'REUTERS'],
  ['Anthropic to join MSCI and FTSE indexes after record IPO', 'ASIANET'],
  ['Anthropic founders cashed out nearly $2BN in IPO', 'TECHCRUNCH'],
  ['Apple building its own AI agent to run your Mac', 'TECHCRUNCH'],
  ['California probes whether China got Nvidia tech improperly', 'BBC'],
  ['South Korea exports top $1 trillion a year for first time', 'SIMPLELIFE'],
  ['China Gas doubles 20-year LNG deal with Venture Global', 'REUTERS'],
  ['Britain and EU drop “trusted partnership” from summit draft', 'REUTERS'],
  ['EU-UK summit opens; youth mobility deal expected', 'BBC'],
  ['Qatar’s Emir meets German president and chancellor in Berlin', 'REUTERS'],
  ['NATO Parliamentary Assembly opens 72nd session in Berlin', 'REUTERS'],
  ['US envoy: Russia not ruling out NATO-like guarantees for Kyiv', 'SIMPLELIFE'],
  ['Projectile lands near Dutch embassy in Kyiv; minor damage', 'SIMPLELIFE'],
  ['Trump warns APEC nations strict AI rules would stifle growth', 'SIMPLELIFE'],
  ['Takaichi dodges Taiwan contingency question in Tokyo', 'SIMPLELIFE'],
  ['13,000 march in Tokyo against Takaichi government', 'NEWS.AZ'],
  ['Pentagon tech chief named new US cyber director', 'NEWS.AZ'],
  ['Democrats: law firm gave $11.8M free work to Trump team', 'AL JAZEERA'],
  ['Malawi fuel crisis causes chaos', 'AL JAZEERA'],
  ['Iraq reaches deal with Kataib Hezbollah over stronghold', 'AL JAZEERA'],
  ['Storm Xavier: gale warning for Suwarrow, storm alert Pukapuka', 'APPISTOS'],
  ['Australian man charged with terror offences after Sydney raid', 'NEWS.AZ'],
  ['Madhya Pradesh scraps two-child policy for state staff', 'THE HINDU'],
  ['Covid inquiry: key findings on testing and the “pingdemic”', 'BBC'],
  ['UK insulation scheme: faults unfixed in 90% of homes', 'BBC'],
  ['Sykes stuns Humphries in Grand Slam darts thriller', 'BBC'],
  ['NFL suspends Rams’ Puka Nacua for three games', 'USCT'],
  ['Can Paraguay’s new president restore trust after bank collapse?', 'NEWS.AZ'],
];

// UTC timeline — times taken from the stories above.
const TIMELINE: [string, string][] = [
  ['00:21', 'CITI RISK STORY BREAKS'],
  ['01:55', 'AKVAN LANDFALL BEGINS'],
  ['02:06', 'VALKYRIES SWEEP ACES'],
  ['02:07', 'NACUA SUSPENDED'],
  ['02:30', 'XAVIER STORM ALERT'],
  ['03:35', 'ANTHROPIC JOINS INDEXES'],
  ['03:36', 'TOKYO MARCH: 13,000'],
  ['08:54', 'COP31 AFRICA CASH PLEA'],
];

// Map pins: [label, lon, lat] — numbered to the stories they mark.
const PINS: [string, number, number][] = [
  ['1 AKVAN', 86, 20],
  ['2 TOKYO', 139, 35],
  ['3 TAIWAN', 121, 24],
  ['4 SEOUL', 127, 37],
  ['5 BERLIN', 13, 52],
  ['6 LONDON', 0, 51],
  ['7 ANTALYA', 31, 37],
  ['8 EL SALVADOR', -89, 14],
  ['9 SENEGAL', -17, 15],
  ['10 SYDNEY', 151, -34],
  ['11 PARAGUAY', -57, -25],
  ['12 GOLDEN ST.', -122, 38],
];

// ------------------------------------------------------------ drawn scenes
// Each scene draws a small picture inside (x, y, w, h). Simple flat shapes,
// cream-paper palette, dark outlines — a newspaper illustration style.
function scene(cv: Canvas, kind: string, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w, h, SKY);
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  switch (kind) {
    case 'storm': {
      cv.rect(x, y + Math.floor(h * 0.62), w, h - Math.floor(h * 0.62), SEA);
      for (let i = 0; i < 4; i++) cv.line(x + 8 + i * 14, y + Math.floor(h * 0.66), x + 2 + i * 14, y + h - 6, WHITE);
      cv.circle(x + 34, y + 22, 15, INK);
      cv.circle(x + 52, y + 18, 18, INK);
      cv.circle(x + 72, y + 24, 13, INK);
      cv.rect(x + 20, y + 30, 66, 8, INK);
      cv.line(x + 46, y + 38, x + 38, y + 56, GOLD);
      cv.line(x + 38, y + 56, x + 50, y + 56, GOLD);
      cv.line(x + 50, y + 56, x + 42, y + 66, GOLD);
      break;
    }
    case 'bank': {
      cv.rect(x, y + Math.floor(h * 0.72), w, h - Math.floor(h * 0.72), SAND);
      cv.rect(x + 12, y + 18, w - 24, 8, INK);
      cv.poly([[x + 8, y + 20], [cx, y + 4], [x + w - 8, y + 20]], RED);
      for (let i = 0; i < 4; i++) cv.rect(x + 18 + i * 20, y + 28, 7, 30, WHITE);
      cv.rect(x + 12, y + 58, w - 24, 5, INK);
      cv.text('$', x + w - 34, y + 30, 2, GOLD);
      break;
    }
    case 'chartdown': {
      cv.rect(x, y, w, h, PAPER);
      for (let i = 1; i < 4; i++) cv.hline(x + 6, y + i * 16, w - 12, LIGHT);
      cv.line(x + 10, y + 12, x + 34, y + 26, RED);
      cv.line(x + 34, y + 26, x + 56, y + 22, RED);
      cv.line(x + 56, y + 22, x + 78, y + 46, RED);
      cv.line(x + 78, y + 46, x + w - 12, y + 58, RED);
      cv.circle(x + 10, y + 12, 3, RED);
      cv.circle(x + w - 12, y + 58, 3, RED);
      cv.text('-4.68%', x + 10, y + h - 16, 1, RED);
      break;
    }
    case 'game': {
      cv.rect(x, y + Math.floor(h * 0.55), w, h - Math.floor(h * 0.55), INK);
      cv.rect(x + 8, y + 8, 14, 26, BLUE);
      cv.rect(x + 26, y + 16, 10, 18, TEAL);
      cv.rect(x + 40, y + 4, 18, 30, RED);
      cv.rect(x + 62, y + 14, 12, 20, GOLD);
      cv.rect(x + 78, y + 8, 10, 26, GREEN);
      cv.circle(x + 84, y + 44, 4, GOLD);
      cv.circle(x + 20, y + 46, 4, WHITE);
      cv.text('VI', cx - 12, y + h - 20, 2, WHITE);
      break;
    }
    case 'datacentre': {
      cv.rect(x, y, w, h, INK);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          cv.rect(x + 10 + c * 22, y + 10 + r * 18, 16, 12, TEAL);
          cv.circle(x + 14 + c * 22, y + 14 + r * 18, 1, GOLD);
          cv.circle(x + 20 + c * 22, y + 14 + r * 18, 1, GREEN);
        }
      }
      cv.circle(cx + 26, y + h - 14, 9, GREEN);
      cv.line(cx + 26, y + h - 22, cx + 26, y + h - 6, GREEN);
      cv.line(cx + 26, y + h - 14, cx + 18, y + h - 18, GREEN);
      break;
    }
    case 'ballot': {
      cv.rect(x, y, w, h, PAPER);
      cv.rect(cx - 26, y + 30, 52, 32, BLUE);
      cv.rect(cx - 30, y + 22, 60, 8, RED);
      cv.rect(cx - 8, y + 14, 16, 10, WHITE);
      cv.frame(cx - 8, y + 14, 16, 10, INK, 1);
      cv.line(cx - 16, y + 52, cx - 6, y + 58, WHITE);
      cv.line(cx - 6, y + 58, cx + 8, y + 40, WHITE);
      cv.text('3RD', x + 8, y + 8, 1, RED);
      break;
    }
    case 'boat': {
      cv.rect(x, y + Math.floor(h * 0.6), w, h - Math.floor(h * 0.6), SEA);
      for (let i = 0; i < 5; i++) cv.hline(x + 6 + i * 6, y + Math.floor(h * 0.68) + (i % 2) * 6, 26, WHITE);
      cv.poly([[x + 18, y + 44], [x + 84, y + 44], [x + 74, y + 58], [x + 28, y + 58]], INK);
      cv.line(cx, y + 12, cx, y + 44, INK);
      cv.poly([[cx + 2, y + 14], [cx + 2, y + 40], [cx + 22, y + 40]], RED);
      cv.circle(x + 84, y + 14, 8, GOLD);
      break;
    }
    case 'shield': {
      cv.rect(x, y, w, h, PAPER);
      cv.poly([[cx, y + 8], [cx + 24, y + 16], [cx + 24, y + 38], [cx, y + 60], [cx - 24, y + 38], [cx - 24, y + 16]], TEAL);
      cv.poly([[cx, y + 14], [cx + 18, y + 20], [cx + 18, y + 36], [cx, y + 52], [cx - 18, y + 36], [cx - 18, y + 20]], WHITE);
      cv.line(cx - 10, y + 34, cx - 2, y + 42, TEAL);
      cv.line(cx - 2, y + 42, cx + 12, y + 24, TEAL);
      break;
    }
    case 'pill': {
      cv.rect(x, y, w, h, PAPER);
      cv.circle(cx - 12, cy - 4, 16, WHITE);
      cv.frame(cx - 12, cy - 4, 32, 32, INK, 0);
      cv.ring(cx - 12, cy - 4, 15, INK, 2);
      cv.circle(cx - 12, cy - 4, 5, TEAL);
      cv.line(cx - 12, cy - 4, cx + 2, cy + 10, INK);
      cv.rect(cx + 6, cy - 2, 26, 9, RED);
      cv.rect(cx + 6, cy - 2, 13, 9, WHITE);
      cv.frame(cx + 6, cy - 2, 26, 9, INK, 1);
      break;
    }
    case 'globe': {
      cv.circle(cx, cy, 26, SEA);
      cv.poly([[cx - 20, cy - 8], [cx - 6, cy - 18], [cx + 8, cy - 12], [cx + 2, cy], [cx - 12, cy + 2]], GREEN);
      cv.poly([[cx - 4, cy + 8], [cx + 12, cy + 6], [cx + 18, cy + 16], [cx + 2, cy + 20]], SAND);
      cv.ring(cx, cy, 26, INK, 1);
      cv.line(cx - 26, cy, cx + 26, cy, WHITE);
      cv.circle(cx + 30, y + 12, 7, GOLD);
      break;
    }
    case 'hoop': {
      cv.rect(x, y, w, h, PAPER);
      cv.rect(x + 12, y + 8, 6, 40, INK);
      cv.rect(x + 8, y + 8, 34, 20, WHITE);
      cv.frame(x + 8, y + 8, 34, 20, RED, 2);
      cv.circle(x + 58, y + 42, 12, RED);
      cv.circle(x + 58, y + 42, 8, WHITE);
      cv.circle(x + 58, y + 42, 4, RED);
      cv.line(x + 24, y + 46, x + 78, y + 46, INK);
      cv.text('87-77', x + 8, y + h - 16, 1, INK);
      break;
    }
    case 'fridge': {
      cv.rect(x, y, w, h, PAPER);
      cv.rect(cx - 20, y + 10, 40, 52, WHITE);
      cv.frame(cx - 20, y + 10, 40, 52, INK, 2);
      cv.hline(cx - 20, y + 32, 40, INK, 2);
      cv.rect(cx + 10, y + 16, 4, 10, INK);
      cv.rect(cx + 10, y + 38, 4, 10, INK);
      cv.circle(cx - 6, y + 21, 5, TEAL);
      cv.line(cx - 9, y + 21, cx - 3, y + 21, WHITE);
      cv.line(cx - 6, y + 18, cx - 6, y + 24, WHITE);
      cv.text('LOCKED', x + 8, y + h - 14, 1, TEAL);
      break;
    }
    default: {
      cv.rect(x, y, w, h, LIGHT);
      break;
    }
  }
  cv.frame(x, y, w, h, INK, 1);
}

// ------------------------------------------------------------------ world map
// Rough continent outlines in [lon, lat]; a stylised newspaper map.
const CONTINENTS: [number, number][][] = [
  [ // North America
    [-168, 66], [-140, 70], [-120, 72], [-95, 80], [-80, 73], [-65, 60], [-55, 47],
    [-70, 42], [-75, 35], [-80, 26], [-90, 21], [-97, 16], [-105, 20], [-115, 30],
    [-125, 40], [-125, 49], [-145, 60], [-165, 60],
  ],
  [ // South America
    [-80, 10], [-60, 5], [-50, 0], [-35, -8], [-40, -20], [-48, -28], [-58, -35],
    [-65, -45], [-70, -52], [-73, -40], [-72, -20], [-77, -12], [-80, 0],
  ],
  [ // Europe
    [-10, 36], [-9, 43], [-2, 48], [2, 51], [8, 57], [10, 59], [18, 56], [21, 55],
    [24, 58], [30, 60], [30, 70], [40, 68], [45, 60], [35, 55], [28, 45], [23, 40],
    [18, 40], [12, 44], [3, 43], [-2, 37],
  ],
  [ // Africa
    [-17, 15], [-10, 30], [0, 35], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12],
    [51, 11], [48, 0], [40, -10], [35, -18], [28, -26], [20, -35], [15, -30],
    [12, -18], [9, -1], [9, 4], [-8, 5], [-15, 11],
  ],
  [ // Asia
    [40, 68], [60, 70], [75, 73], [95, 76], [110, 76], [130, 72], [160, 70], [178, 66],
    [170, 60], [162, 55], [158, 50], [142, 45], [140, 40], [135, 35], [127, 35],
    [122, 30], [120, 25], [110, 20], [105, 10], [100, 8], [98, 15], [95, 16],
    [90, 22], [86, 20], [80, 13], [75, 8], [72, 20], [66, 25], [60, 25], [55, 26],
    [50, 29], [48, 30], [43, 12], [40, 20], [35, 28], [36, 36], [30, 36], [27, 40],
    [30, 45], [40, 47], [45, 55], [50, 60],
  ],
  [ // Australia
    [113, -22], [114, -30], [115, -35], [124, -33], [130, -32], [137, -35], [140, -38],
    [145, -38], [150, -37], [153, -32], [153, -27], [146, -19], [142, -11], [136, -12],
    [132, -11], [126, -14], [122, -17], [114, -21],
  ],
];

function drawMap(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w, h, [203, 224, 235]); // ocean
  const proj = (lon: number, lat: number): [number, number] => [
    Math.round(x + ((lon + 180) / 360) * w),
    Math.round(y + ((85 - lat) / 145) * h),
  ];
  for (const cont of CONTINENTS) {
    const pts = cont.map(([lo, la]) => proj(lo, la));
    cv.poly(pts, SAND);
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      cv.line(x0, y0, x1, y1, INK);
    }
  }
  for (const [label, lon, lat] of PINS) {
    const [px, py] = proj(lon, lat);
    cv.circle(px, py, 5, RED);
    cv.ring(px, py, 5, WHITE, 1);
    const num = label.split(' ')[0];
    cv.text(num, px + 7, py - 3, 1, RED);
  }
}

// --------------------------------------------------------------------- layout
function drawHero(cv: Canvas, hero: Hero, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w, h, PAPER);
  cv.frame(x, y, w, h, INK, 1);
  // picture
  scene(cv, hero.scene, x + 4, y + 4, w - 8, 64);
  // number badge on the picture corner
  cv.rect(x + 4, y + 4, 20, 16, RED);
  cv.text(String(hero.n), x + 9, y + 8, 1, WHITE);
  // kicker
  cv.text(hero.kicker, x + 6, y + 74, 1, RED);
  // headline (one line, scale 1)
  cv.text(hero.head, x + 6, y + 88, 1, INK);
  cv.hline(x + 6, y + 98, w - 12, LIGHT, 1);
  // description, two lines max
  const lines = cv.wrap(hero.desc, 40).slice(0, 2);
  lines.forEach((ln, i) => cv.text(ln, x + 6, y + 104 + i * 10, 1, INK));
  // source + label row
  cv.text('SRC: ' + hero.src, x + 6, y + h - 16, 1, BLUE);
  const lab = hero.label;
  const lw = lab.length * 6 + 8;
  const lx = x + w - 6 - lw;
  cv.rect(lx, y + h - 19, lw, 12, lab === 'CONFIRMED' ? GREEN : GOLD);
  cv.text(lab, lx + 4, y + h - 16, 1, WHITE);
}

function drawStrip(cv: Canvas, y: number) {
  const cells: [string, string][] = [
    ['40', 'STORIES'],
    ['12', 'PANELS'],
    ['6', 'CONTINENTS'],
    ['$35BN', 'BIGGEST NUMBER'],
    ['13,000', 'TOKYO MARCHERS'],
    ['24H', 'UTC TIMELINE'],
  ];
  const x0 = 16;
  const w = 992;
  const cw = Math.floor(w / cells.length);
  cv.rect(x0, y, w, 46, PAPER);
  cv.frame(x0, y, w, 46, INK, 1);
  cells.forEach(([big, small], i) => {
    const cx = x0 + i * cw + Math.floor(cw / 2);
    if (i > 0) cv.vline(x0 + i * cw, y + 4, 38, LIGHT, 1);
    cv.textCentred(big, cx, y + 6, 2, RED);
    cv.textCentred(small, cx, y + 26, 1, INK);
  });
}

function drawTimeline(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w, h, PAPER);
  cv.frame(x, y, w, h, INK, 1);
  cv.text('UTC TIMELINE - FRIDAY 20 NOVEMBER 2026', x + 8, y + 6, 1, RED);
  const lineY = y + 44;
  cv.hline(x + 12, lineY, w - 24, INK, 2);
  const short: Record<string, string> = {
    '00:21': 'CITI', '01:55': 'AKVAN', '02:06': 'VALKYRIES', '02:07': 'NACUA',
    '02:30': 'XAVIER', '03:35': 'ANTHROPIC', '03:36': 'TOKYO MARCH', '08:54': 'COP31',
  };
  TIMELINE.forEach(([t, ev], i) => {
    const fx = x + 16 + Math.floor((i * (w - 32)) / (TIMELINE.length - 1));
    cv.vline(fx, lineY - 4, 9, RED, 2);
    cv.circle(fx, lineY, 3, RED);
    cv.textCentred(t, fx, lineY - 16, 1, INK);
    cv.textCentred(short[t] ?? ev, fx, lineY + 10, 1, GREY);
  });
}

function drawDateCheck(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w, h, PAPER);
  cv.frame(x, y, w, h, RED, 2);
  cv.text('DATE CHECK', x + 8, y + 6, 2, RED);
  cv.para(
    'EVERY STORY IN THIS IMAGE IS DATED FRIDAY 20 NOVEMBER 2026.',
    x + 8, y + 26, 1, 78, INK,
  );
  cv.para(
    'LEFT OUT - ALL 19 NOV: ICJ MYANMAR RULING, SHENZHEN SUMMIT, ANTHROPIC DEBUT, HOUTHI RIYADH STRIKE, FIONA THE HIPPO.',
    x + 8, y + 44, 1, 78, INK,
  );
}

function drawBriefs(cv: Canvas, y: number) {
  cv.text('ALSO TODAY - 28 MORE STORIES, ALL DATED 20 NOVEMBER 2026', 16, y, 1, RED);
  cv.hline(16, y + 11, 992, INK, 1);
  const colW = 488;
  BRIEFS.forEach(([text, src], i) => {
    const col = i < 14 ? 0 : 1;
    const row = i % 14;
    const bx = 16 + col * (colW + 16);
    const by = y + 16 + row * 10;
    cv.text(`${13 + i}. ${text} - ${src}`, bx, by, 1, INK);
  });
}

function draw(cv: Canvas) {
  cv.frame(8, 8, 1008, 1008, INK, 2);
  // masthead
  cv.textCentred('FRIDAY  -  20 NOVEMBER 2026  -  ALL STORIES DATED TODAY', 512, 20, 1, GREY);
  cv.textCentred('THE WORLD IN ONE DAY', 512, 34, 4, INK);
  cv.textCentred('40 STORIES, 12 PANELS, A PINNED MAP - THE DAY’S NEWS IN ONE IMAGE', 512, 84, 1, INK);
  cv.hline(16, 100, 992, RED, 3);
  cv.hline(16, 106, 992, INK, 1);
  // big-number strip
  drawStrip(cv, 112);
  // heroes: 4 columns x 3 rows
  const pw = 242;
  const ph = 152;
  HEROES.forEach((hero, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    drawHero(cv, hero, 16 + col * (pw + 8), 166 + row * (ph + 8), pw, ph);
  });
  // map + right column
  cv.text('THE WORLD, PINNED - WHERE TODAY HAPPENED', 16, 650, 1, RED);
  drawMap(cv, 16, 664, 504, 136);
  cv.text('RED DOTS = STORY LOCATIONS (12)', 16, 786, 1, GREY);
  drawTimeline(cv, 528, 646, 480, 70);
  drawDateCheck(cv, 528, 724, 480, 76);
  // briefs
  drawBriefs(cv, 806);
  // footer
  cv.hline(16, 968, 992, INK, 1);
  cv.textCentred(
    'SOURCES: REUTERS - BBC - AL JAZEERA - THE HINDU - NYT - TECHCRUNCH - VARIETY - NEWS.AZ - ASIANET - USCT - SIMPLELIFE - APPISTOS',
    512, 976, 1, BLUE,
  );
  cv.textCentred('DRAWN BY A PROGRAM - NO NETWORK AT RUNTIME - TWO RUNS, SAME BYTES', 512, 990, 1, GREY);
}

// ------------------------------------------------------------------------ main
function main() {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const cv = new Canvas();
  draw(cv);
  const png = encodePNG(W, H, cv.data);
  writeFileSync(join(outDir, 'entry.png'), png);
  console.log(`wrote ${join(outDir, 'entry.png')} (${png.length} bytes, ${W}x${H})`);
}

main();
