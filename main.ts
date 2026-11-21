// 20 November 2026 in one image — world news broadsheet, drawn from scratch.
// Node stdlib only. Deterministic: same bytes on every run (fixed seed, no clock).
// Output: $MAKEFUN_OUTPUT_DIR/entry.png (default ./out/entry.png), 1024x1024 PNG.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const W = 1024, H = 1024;

// ---------------------------------------------------------------- palette ---
const PAPER: RGB = [247, 241, 227];
const PAPER2: RGB = [238, 230, 210];
const INK: RGB = [26, 26, 26];
const RED: RGB = [176, 30, 36];
const RED_DK: RGB = [128, 18, 24];
const NAVY: RGB = [22, 50, 79];
const NAVY2: RGB = [38, 74, 110];
const TEAL: RGB = [18, 110, 105];
const OCHRE: RGB = [198, 138, 32];
const SKY: RGB = [126, 178, 214];
const SKY_DK: RGB = [70, 120, 165];
const SEA: RGB = [168, 203, 224];
const LAND: RGB = [226, 205, 158];
const LAND2: RGB = [205, 186, 138];
const GREEN: RGB = [64, 128, 74];
const CREAM: RGB = [255, 250, 238];
const GREY: RGB = [110, 108, 100];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [10, 10, 10];

type RGB = [number, number, number];

// ------------------------------------------------------------- deterministic
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ canvas --
class Canvas {
  buf: Uint8Array;
  constructor() { this.buf = new Uint8Array(W * H * 3); }
  px(x: number, y: number, c: RGB) {
    // round here: a float index into a Uint8Array silently writes nowhere
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2];
  }
  get(x: number, y: number): RGB {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return [0, 0, 0];
    const i = (y * W + x) * 3;
    return [this.buf[i], this.buf[i + 1], this.buf[i + 2]];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) this.px(xx, yy, c);
  }
  // vertical gradient rect
  vgrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB) {
    for (let yy = 0; yy < h; yy++) {
      const t = h <= 1 ? 0 : yy / (h - 1);
      const c: RGB = [
        Math.round(top[0] + (bot[0] - top[0]) * t),
        Math.round(top[1] + (bot[1] - top[1]) * t),
        Math.round(top[2] + (bot[2] - top[2]) * t)];
      this.rect(x, y + yy, w, 1, c);
    }
  }
  hgrad(x: number, y: number, w: number, h: number, l: RGB, r: RGB) {
    for (let xx = 0; xx < w; xx++) {
      const t = w <= 1 ? 0 : xx / (w - 1);
      const c: RGB = [
        Math.round(l[0] + (r[0] - l[0]) * t),
        Math.round(l[1] + (r[1] - l[1]) * t),
        Math.round(l[2] + (r[2] - l[2]) * t)];
      this.rect(x + xx, y, 1, h, c);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, th = 1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + dx * i / n), y = Math.round(y0 + dy * i / n);
      for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) this.px(x + a, y + b, c);
    }
  }
  // dashed line (dash px on, gap px off)
  dash(x0: number, y0: number, x1: number, y1: number, c: RGB, dash = 5, gap = 4) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= n; i++) {
      if (Math.floor(i / (dash + gap)) % 2 === 0 && i % (dash + gap) < dash)
        this.px(Math.round(x0 + dx * i / n), Math.round(y0 + dy * i / n), c);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c);
  }
  ring(cx: number, cy: number, r: number, c: RGB, th = 1) {
    for (let a = 0; a < 360; a += 1) {
      const rad = a * Math.PI / 180;
      for (let t = 0; t < th; t++)
        this.px(Math.round(cx + (r + t) * Math.cos(rad)), Math.round(cy + (r + t) * Math.sin(rad)), c);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, c);
  }
  // filled polygon, scanline
  poly(pts: [number, number][], c: RGB) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.ceil(minY); y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k]); x <= xs[k + 1]; x++) this.px(x, y, c);
    }
  }
  // soft glow: concentric circles fading out (drawn as rings of blended colour)
  glow(cx: number, cy: number, r: number, c: RGB, steps = 5) {
    for (let s = steps; s >= 1; s--) {
      const rr = Math.round(r * s / steps);
      const bg = this.get(cx, cy);
      const t = 0.35 * (1 - s / steps) + 0.12;
      const mix: RGB = [
        Math.round(c[0] * t + bg[0] * (1 - t)),
        Math.round(c[1] * t + bg[1] * (1 - t)),
        Math.round(c[2] * t + bg[2] * (1 - t))];
      this.circle(cx, cy, rr, mix);
    }
    this.circle(cx, cy, Math.max(2, Math.round(r * 0.35)), c);
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, th = 1) {
    this.rect(x, y, w, th, c); this.rect(x, y + h - th, w, th, c);
    this.rect(x, y, th, h, c); this.rect(x + w - th, y, th, h, c);
  }
}

// -------------------------------------------------------------------- font --
// 5x7 bitmap font, drawn fresh for this broadsheet. Each glyph = 7 rows of 5 bits.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10001", "10000", "10001", "01110"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01000", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "00000", "01111", "10001", "10001", "01111", "00001"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "00010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "11110", "10001", "10001", "11110", "10000"],
  q: ["00000", "00000", "01111", "10001", "10001", "01111", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["00100", "00100", "11110", "00100", "00100", "00100", "00010"],
  u: ["00000", "00000", "10001", "10001", "10001", "10001", "01111"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10001", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01010", "00100", "00100"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "°": ["01100", "10010", "01100", "00000", "00000", "00000", "00000"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "·": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "@": ["01110", "10001", "10111", "10101", "10110", "10000", "01110"],
};

const CHAR_ADV = 6; // pixels per char at scale 1 (5 + 1 spacing)
function textW(s: string, sc: number): number {
  let w = 0;
  for (const ch of s) w += (GLYPHS[ch] ? CHAR_ADV : CHAR_ADV);
  return w * sc - sc;
}
function drawText(cv: Canvas, s: string, x: number, y: number, sc: number, c: RGB) {
  let cx = Math.round(x);
  const yy = Math.round(y);
  for (const ch of s) {
    const g = GLYPHS[ch];
    if (g) {
      for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
        if (g[r][col] === "1") cv.rect(cx + col * sc, yy + r * sc, sc, sc, c);
    }
    cx += CHAR_ADV * sc;
  }
}
// wrap text into lines fitting maxW px at scale sc
function wrap(s: string, maxW: number, sc: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textW(t, sc) <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(cv: Canvas, s: string, x: number, y: number, maxW: number, sc: number, c: RGB, lh?: number): number {
  const lines = wrap(s, maxW, sc);
  const step = lh ?? (8 * sc + 1);
  lines.forEach((ln, i) => drawText(cv, ln, x, y + i * step, sc, c));
  return lines.length;
}
// centered text
function drawCenter(cv: Canvas, s: string, cx: number, y: number, sc: number, c: RGB) {
  drawText(cv, s, cx - textW(s, sc) / 2, y, sc, c);
}

// -------------------------------------------------------------------- png ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(cv: Canvas): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter None
    raw.set(cv.buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- scene helpers
function stars(cv: Canvas, x: number, y: number, w: number, h: number, n: number, seed: number) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const sx = x + Math.floor(rnd() * w), sy = y + Math.floor(rnd() * h);
    const s = rnd();
    cv.px(sx, sy, s > 0.7 ? WHITE : [200, 210, 225]);
    if (s > 0.92) { cv.px(sx + 1, sy, WHITE); cv.px(sx, sy + 1, WHITE); }
  }
}
function buildingRow(cv: Canvas, x: number, yBase: number, w: number, hMin: number, hMax: number, seed: number, c: RGB, lit: RGB) {
  const rnd = mulberry32(seed);
  let bx = x;
  while (bx < x + w - 8) {
    const bw = 10 + Math.floor(rnd() * 18);
    const bh = hMin + Math.floor(rnd() * (hMax - hMin));
    cv.rect(bx, yBase - bh, bw, bh, c);
    // lit windows
    for (let wy = yBase - bh + 4; wy < yBase - 4; wy += 7)
      for (let wx = bx + 3; wx < bx + bw - 3; wx += 6)
        if (rnd() > 0.55) cv.rect(wx, wy, 2, 3, lit);
    bx += bw + 2;
  }
}
// ------------------------------------------------------------- lead scenes --
function sceneKyiv(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.vgrad(x, y, w, h, [16, 28, 52], [52, 68, 110]);
  stars(cv, x, y, w, Math.floor(h * 0.55), 46, 11);
  // moon
  cv.circle(x + w - 34, y + 22, 12, [240, 232, 200]);
  cv.circle(x + w - 38, y + 19, 10, [16, 28, 52]);
  // missile trails (dashed arcs) + warheads
  const trails: [number, number, number, number][] = [
    [x + 8, y + h - 40, x + w * 0.42, y + 18],
    [x + w * 0.3, y + h - 26, x + w * 0.62, y + 30],
    [x + w * 0.55, y + h - 34, x + w * 0.9, y + 12],
  ];
  for (const [x0, y0, x1, y1] of trails) {
    const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 26;
    for (let t = 0; t <= 20; t++) {
      const u = t / 20;
      const px = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1;
      const py = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1;
      if (t % 3 < 2) cv.px(Math.round(px), Math.round(py), [255, 214, 130]);
    }
    cv.glow(x1, y1, 5, [255, 170, 60]);
  }
  // river
  cv.rect(x, y + h - 22, w, 22, [28, 58, 92]);
  for (let i = 0; i < 26; i++) {
    const rx = x + 6 + i * 13, ry = y + h - 18 + (i % 3) * 6;
    cv.line(rx, ry, rx + 8, ry, [90, 140, 185]);
  }
  // three bridges over the river
  const by = y + h - 22;
  for (let b = 0; b < 3; b++) {
    const bx = x + 14 + b * (w / 3);
    const bw = w / 3 - 26;
    cv.rect(bx, by - 10, bw, 4, [20, 20, 24]);
    for (let p = 0; p <= 4; p++) {
      const px = bx + (bw * p) / 4;
      cv.line(px, by - 10, px, by - 22 - (p === 2 ? 8 : 0), [20, 20, 24], 2);
    }
    cv.line(bx, by - 10, bx + bw / 2, by - 30, [20, 20, 24], 2);
    cv.line(bx + bw, by - 10, bx + bw / 2, by - 30, [20, 20, 24], 2);
  }
  // city silhouette + fires
  buildingRow(cv, x, by - 10, w, 22, 52, 21, [12, 16, 30], [255, 190, 90]);
  cv.glow(x + w * 0.22, by - 26, 7, [255, 140, 40]);
  cv.glow(x + w * 0.66, by - 18, 6, [255, 120, 30]);
  cv.glow(x + w * 0.86, by - 34, 5, [255, 160, 60]);
  // smoke
  cv.ellipse(x + w * 0.24, by - 52, 16, 7, [90, 90, 96]);
  cv.ellipse(x + w * 0.68, by - 44, 13, 6, [90, 90, 96]);
}
function sceneAkvan(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.vgrad(x, y, w, h, [150, 196, 222], [214, 232, 238]);
  // Bay of Bengal coast (stylised): land left/bottom, sea right
  cv.poly([
    [x, y], [x + w * 0.52, y], [x + w * 0.42, y + h * 0.42],
    [x + w * 0.58, y + h * 0.62], [x + w * 0.34, y + h], [x, y + h],
  ], [232, 214, 170]);
  cv.poly([
    [x + w * 0.52, y], [x + w, y], [x + w, y + h * 0.3],
    [x + w * 0.72, y + h * 0.5], [x + w * 0.58, y + h * 0.62],
    [x + w * 0.42, y + h * 0.42],
  ], [206, 188, 140]);
  // cyclone spiral over the sea
  const cx = x + w * 0.68, cy = y + h * 0.46;
  for (let r = 8; r <= 46; r += 7) {
    for (let a = 0; a < 300; a += 4) {
      const rad = (a + r * 9) * Math.PI / 180;
      cv.px(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad) * 0.9), WHITE);
    }
  }
  cv.circle(cx, cy, 7, [250, 250, 245]);
  cv.ring(cx, cy, 12, [255, 255, 255], 2);
  // landfall arrow + red dot at Gopalpur
  const gx = x + w * 0.5, gy = y + h * 0.52;
  cv.line(gx + 26, gy - 6, gx + 6, gy + 2, RED, 2);
  cv.poly([[gx + 6, gy + 2], [gx + 14, gy - 2], [gx + 13, gy + 7]], RED);
  cv.circle(gx, gy, 5, RED);
  cv.ring(gx, gy, 8, RED, 2);
  // rain streaks
  const rnd = mulberry32(31);
  for (let i = 0; i < 60; i++) {
    const rx = x + Math.floor(rnd() * w), ry = y + Math.floor(rnd() * h);
    cv.line(rx, ry, rx - 3, ry + 8, [255, 255, 255]);
  }
  // shelter dots along the coast
  for (let i = 0; i < 6; i++) {
    const sx = x + w * 0.36 + i * 9, sy = y + h * 0.66 + (i % 2) * 8;
    cv.rect(sx, sy, 5, 4, NAVY);
    cv.poly([[sx, sy], [sx + 2, sy - 3], [sx + 5, sy]], RED);
  }
}
function sceneSelloff(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.vgrad(x, y, w, h, [18, 32, 56], [44, 66, 96]);
  // grid (above the city table only)
  for (let gy = y + 12; gy < y + h - 56; gy += 14) cv.line(x + 6, gy, x + w - 6, gy, [70, 96, 128]);
  for (let gx = x + 14; gx < x + w - 6; gx += 22) cv.line(gx, y + 6, gx, y + h - 56, [70, 96, 128]);
  // candlesticks falling (kept above the table)
  const rnd = mulberry32(41);
  for (let i = 0; i < 9; i++) {
    const px = x + 14 + i * 36;
    const cy = y + 16 + Math.round(i * 4.5);
    const bh = 8 + Math.floor(rnd() * 7);
    cv.rect(px, cy, 12, bh, [214, 52, 48]);
    cv.line(px + 6, cy - 4, px + 6, cy + bh + 4, [214, 52, 48]);
  }
  // plunging red line (ends above the table)
  const pts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    pts.push([x + 10 + (w - 20) * i / 10, y + 14 + (h - 84) * (i / 10) * (i / 10) + i * 1.2]);
  }
  for (let i = 0; i + 1 < pts.length; i++) cv.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], [255, 84, 66], 3);
  // arrow head
  const [ex, ey] = pts[pts.length - 1];
  cv.poly([[ex, ey], [ex - 12, ey - 5], [ex - 12, ey + 3]], [255, 84, 66]);
  // city table at bottom
  const rows: [string, string][] = [["Taipei", "-6.2%"], ["Seoul", "-5.2%"], ["Tokyo", "-5.1%"], ["Hong Kong", "-1.9%"]];
  const ty = y + h - 52;
  cv.rect(x, ty, w, 52, [12, 22, 38]);
  rows.forEach(([city, v], i) => {
    const ry = ty + 4 + i * 12;
    drawText(cv, city, x + 8, ry, 1, [220, 228, 236]);
    drawText(cv, v, x + w - 8 - textW(v, 1), ry, 1, [255, 110, 90]);
  });
}

// ---------------------------------------------------------- small scenes ----
function flagUK(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w, h, [28, 54, 110]);
  cv.line(x, y, x + w, y + h, WHITE, 2); cv.line(x + w, y, x, y + h, WHITE, 2);
  cv.line(x, y, x + w, y + h, RED, 1); cv.line(x + w, y, x, y + h, RED, 1);
  cv.rect(x + w / 2 - 2, y, 4, h, WHITE); cv.rect(x, y + h / 2 - 2, w, 4, WHITE);
  cv.rect(x + w / 2 - 1, y, 2, h, RED); cv.rect(x, y + h / 2 - 1, w, 2, RED);
}
function flagEU(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w, h, [0, 51, 153]);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6 - Math.PI / 2;
    cv.circle(x + w / 2 + Math.round(Math.cos(a) * w * 0.28), y + h / 2 + Math.round(Math.sin(a) * h * 0.3), 2, [255, 210, 0]);
  }
}
function flagIT(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w / 3, h, GREEN); cv.rect(x + w / 3, y, w / 3, h, WHITE); cv.rect(x + 2 * w / 3, y, w / 3, h, RED);
}
function flagIN(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w, h / 3, [255, 153, 51]); cv.rect(x, y + h / 3, w, h / 3, WHITE); cv.rect(x, y + 2 * h / 3, w, h / 3, [19, 136, 8]);
  cv.ring(x + w / 2, y + h / 2, 4, NAVY, 1);
}
function flagPK(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w / 4, h, WHITE); cv.rect(x + w / 4, y, 3 * w / 4, h, [0, 102, 0]);
  cv.circle(x + w * 0.58, y + h / 2, 5, WHITE); cv.circle(x + w * 0.62, y + h / 2, 4, [0, 102, 0]);
}
function miniGlobe(cv: Canvas, cx: number, cy: number, r: number) {
  cv.circle(cx, cy, r, SKY);
  cv.ellipse(cx - r * 0.3, cy - r * 0.2, r * 0.45, r * 0.3, GREEN);
  cv.ellipse(cx + r * 0.35, cy + r * 0.3, r * 0.4, r * 0.28, [120, 170, 90]);
  cv.ring(cx, cy, r, NAVY, 1);
  cv.ellipse(cx, cy - r, r * 0.5, r * 0.22, WHITE);
}
function sceneSmall(cv: Canvas, key: string, x: number, y: number, w: number, h: number) {
  switch (key) {
    case "ukeu": {
      cv.vgrad(x, y, w, h, [240, 236, 222], [214, 206, 186]);
      flagUK(cv, x + 8, y + 8, 44, 30);
      flagEU(cv, x + w - 52, y + 8, 44, 30);
      // handshake arc
      cv.line(x + 56, y + 30, x + w / 2, y + 14, INK, 2);
      cv.line(x + w / 2, y + 14, x + w - 56, y + 30, INK, 2);
      cv.circle(x + w / 2, y + 16, 4, RED);
      drawText(cv, "DEAL DONE", x + w / 2 - textW("DEAL DONE", 1) / 2, y + h - 12, 1, RED_DK);
      break;
    }
    case "cop31": {
      cv.vgrad(x, y, w, h, [250, 238, 210], [232, 206, 160]);
      miniGlobe(cv, x + 34, y + h / 2 + 2, 20);
      // thermometer (kept clear of the NO DEAL text)
      cv.rect(x + w - 12, y + 8, 6, h - 18, WHITE);
      cv.frame(x + w - 12, y + 8, 6, h - 18, INK, 1);
      cv.rect(x + w - 11, y + h - 20, 4, 10, RED);
      cv.circle(x + w - 9, y + h - 12, 5, RED);
      drawText(cv, "NO", x + w - 64, y + 12, 2, RED);
      drawText(cv, "DEAL", x + w - 64, y + 28, 2, RED);
      break;
    }
    case "poland": {
      cv.vgrad(x, y, w, h, [168, 200, 228], [226, 232, 220]);
      // field
      cv.rect(x, y + h - 16, w, 16, [120, 160, 90]);
      cv.line(x, y + h - 16, x + w, y + h - 16, GREEN, 2);
      // missile silhouette falling
      cv.poly([[x + w / 2 - 4, y + 6], [x + w / 2 + 4, y + 6], [x + w / 2 + 2, y + 26], [x + w / 2 - 2, y + 26]], [60, 60, 66]);
      cv.poly([[x + w / 2 - 2, y + 26], [x + w / 2 + 2, y + 26], [x + w / 2, y + 32]], [60, 60, 66]);
      cv.dash(x + w / 2, y + 34, x + w / 2, y + h - 20, GREY, 3, 3);
      // crater + smoke
      cv.ellipse(x + w / 2, y + h - 14, 14, 4, [70, 60, 50]);
      cv.ellipse(x + w / 2, y + h - 26, 10, 6, [140, 140, 140]);
      // polish flag
      cv.rect(x + 6, y + 6, 22, 7, WHITE); cv.rect(x + 6, y + 13, 22, 7, RED);
      break;
    }
    case "iraq": {
      cv.vgrad(x, y, w, h, [246, 214, 150], [220, 170, 100]);
      cv.circle(x + w - 24, y + 14, 10, [255, 220, 120]);
      // palms
      for (const px of [x + 16, x + 34]) {
        cv.line(px, y + h - 8, px, y + 12, [90, 60, 30], 2);
        for (let a = 0; a < 5; a++) {
          const ang = (-160 + a * 35) * Math.PI / 180;
          cv.line(px, y + 12, px + Math.round(Math.cos(ang) * 12), y + 12 + Math.round(Math.sin(ang) * 8), GREEN, 2);
        }
      }
      // convoy
      for (let i = 0; i < 3; i++) {
        const tx = x + 58 + i * 34;
        cv.rect(tx, y + h - 26, 26, 12, [74, 92, 60]);
        cv.rect(tx + 4, y + h - 34, 14, 8, [74, 92, 60]);
        cv.circle(tx + 7, y + h - 12, 4, BLACK); cv.circle(tx + 19, y + h - 12, 4, BLACK);
      }
      break;
    }
    case "italy": {
      cv.vgrad(x, y, w, h, [250, 240, 220], [228, 214, 190]);
      flagIT(cv, x + 6, y + 6, 30, 20);
      // marchers: heads + placards
      const rnd = mulberry32(51);
      for (let i = 0; i < 9; i++) {
        const hx = x + 44 + i * 12 + Math.floor(rnd() * 4);
        const hy = y + 22 + Math.floor(rnd() * 6);
        cv.circle(hx, hy, 4, [200 + Math.floor(rnd() * 40), 170, 140]);
        cv.rect(hx - 4, hy + 4, 8, 12, i % 2 ? NAVY : RED);
        if (i % 3 === 0) { cv.rect(hx - 7, hy - 12, 14, 8, WHITE); cv.frame(hx - 7, hy - 12, 14, 8, INK, 1); }
      }
      cv.rect(x + 44, y + h - 8, w - 52, 4, INK);
      break;
    }
    case "japan": {
      cv.vgrad(x, y, w, h, [255, 246, 230], [250, 220, 190]);
      cv.circle(x + 30, y + 20, 14, RED);
      // rising bars
      const vals = [10, 16, 14, 22, 28];
      vals.forEach((v, i) => {
        const bx = x + 58 + i * 18;
        cv.rect(bx, y + h - 10 - v, 12, v, i === 4 ? RED : NAVY);
      });
      cv.line(x + 54, y + h - 10, x + w - 8, y + h - 10, INK, 1);
      drawText(cv, "+2.3%", x + w - 52, y + 6, 1, RED_DK);
      break;
    }
    case "seoul": {
      cv.vgrad(x, y, w, h, [232, 238, 246], [200, 210, 224]);
      // courthouse columns
      const bx = x + 14;
      cv.rect(bx, y + 8, w - 28, 6, NAVY);
      cv.poly([[bx - 4, y + 8], [bx + (w - 28) / 2, y - 2], [bx + w - 24, y + 8]], NAVY);
      for (let i = 0; i < 4; i++) {
        const cxp = bx + 10 + i * ((w - 48) / 3);
        cv.rect(cxp, y + 14, 6, h - 26, [220, 224, 230]);
        cv.frame(cxp, y + 14, 6, h - 26, NAVY, 1);
      }
      cv.rect(bx, y + h - 12, w - 28, 4, NAVY);
      // gavel
      cv.line(x + w - 34, y + h - 18, x + w - 14, y + h - 34, [120, 80, 40], 3);
      cv.rect(x + w - 26, y + h - 40, 16, 6, [120, 80, 40]);
      break;
    }
    case "kenya": {
      cv.vgrad(x, y, w, h, [255, 214, 140], [240, 170, 90]);
      cv.circle(x + w - 26, y + 16, 12, [255, 240, 180]);
      // savanna
      cv.rect(x, y + h - 14, w, 14, [150, 120, 60]);
      // oil derrick
      const dx = x + 18;
      cv.line(dx, y + h - 14, dx + 10, y + 6, INK, 2);
      cv.line(dx + 20, y + h - 14, dx + 10, y + 6, INK, 2);
      cv.line(dx, y + h - 14, dx + 20, y + h - 14, INK, 2);
      cv.line(dx + 4, y + h - 22, dx + 16, y + h - 22, INK, 1);
      cv.line(dx + 7, y + h - 30, dx + 13, y + h - 30, INK, 1);
      // flame
      cv.glow(dx + 34, y + h - 22, 5, [255, 150, 40]);
      // acacia
      cv.line(x + w - 52, y + h - 14, x + w - 52, y + h - 30, [90, 60, 30], 2);
      cv.ellipse(x + w - 52, y + h - 32, 16, 4, GREEN);
      break;
    }
    case "bukele": {
      cv.vgrad(x, y, w, h, [230, 238, 250], [200, 214, 232]);
      // ballot box
      cv.rect(x + 14, y + 18, 46, 26, [240, 240, 236]);
      cv.frame(x + 14, y + 18, 46, 26, NAVY, 2);
      cv.rect(x + 30, y + 14, 14, 6, NAVY);
      // ballot going in with big check
      cv.rect(x + 26, y + 2, 22, 12, WHITE);
      cv.frame(x + 26, y + 2, 22, 12, INK, 1);
      drawText(cv, "3rd", x + 30, y + 4, 1, RED);
      drawText(cv, "TERM", x + w - 62, y + 8, 2, NAVY);
      drawText(cv, "28 FEB 2027", x + w - 62, y + 26, 1, INK);
      // check mark
      cv.line(x + 70, y + h - 12, x + 80, y + h - 4, GREEN, 3);
      cv.line(x + 80, y + h - 4, x + 100, y + h - 22, GREEN, 3);
      break;
    }
    case "cricket": {
      cv.vgrad(x, y, w, h, [120, 190, 120], [70, 140, 80]);
      // pitch
      cv.rect(x, y + h - 18, w, 18, [210, 190, 150]);
      // stumps
      for (let i = 0; i < 3; i++) cv.rect(x + 22 + i * 5, y + h - 34, 3, 16, [240, 220, 140]);
      // bat + ball
      cv.line(x + w - 40, y + 12, x + w - 22, y + h - 22, [220, 180, 120], 5);
      cv.circle(x + w - 52, y + 16, 5, RED);
      cv.circle(x + w - 52, y + 16, 2, WHITE);
      // scoreboard
      cv.rect(x + 8, y + 6, 52, 14, NAVY);
      drawText(cv, "118", x + 12, y + 8, 2, WHITE);
      drawText(cv, "PHILLIPS", x + 64, y + h - 14, 1, WHITE);
      break;
    }
    case "hormuz": {
      cv.vgrad(x, y, w, h, [140, 180, 210], [210, 225, 235]);
      // tanker
      cv.rect(x + 12, y + h - 30, w - 24, 14, [120, 40, 36]);
      cv.rect(x + w - 40, y + h - 44, 26, 14, WHITE);
      cv.frame(x + w - 40, y + h - 44, 26, 14, NAVY, 1);
      cv.rect(x + w - 30, y + h - 54, 6, 10, [120, 40, 36]);
      // flames + smoke
      cv.glow(x + w / 2 - 10, y + h - 34, 7, [255, 140, 30]);
      cv.glow(x + w / 2 + 8, y + h - 32, 5, [255, 180, 60]);
      cv.ellipse(x + w / 2, y + h - 52, 12, 6, [90, 90, 96]);
      // waves
      for (let i = 0; i < 5; i++) {
        const wx = x + 6 + i * 30;
        cv.line(wx, y + h - 6, wx + 12, y + h - 6, WHITE, 2);
      }
      break;
    }
    case "delhi": {
      cv.vgrad(x, y, w, h, [250, 238, 210], [232, 210, 170]);
      flagIN(cv, x + 8, y + 8, 44, 28);
      flagPK(cv, x + w - 52, y + 8, 44, 28);
      // domed building
      const bx = x + w / 2 - 22;
      cv.rect(bx, y + h - 22, 44, 12, [190, 150, 110]);
      cv.ellipse(bx + 22, y + h - 22, 14, 10, [150, 110, 70]);
      cv.rect(bx + 20, y + h - 34, 4, 6, [150, 110, 70]);
      break;
    }
    default: {
      cv.vgrad(x, y, w, h, PAPER2, PAPER);
      break;
    }
  }
}

// ------------------------------------------------------------------ map -----
const NA = [[-168, 66], [-140, 70], [-125, 72], [-110, 68], [-95, 80], [-80, 73], [-65, 60], [-55, 47], [-70, 42], [-75, 35], [-80, 26], [-90, 21], [-97, 16], [-105, 20], [-115, 28], [-125, 40], [-125, 49], [-140, 60], [-155, 58], [-165, 60]];
const SA = [[-80, 10], [-72, 12], [-60, 8], [-50, 0], [-35, -8], [-40, -20], [-48, -28], [-58, -35], [-65, -45], [-70, -55], [-73, -40], [-72, -20], [-80, -5], [-81, 5]];
const EU = [[-10, 36], [-9, 43], [0, 44], [-2, 49], [2, 51], [8, 54], [8, 57], [12, 56], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [24, 66], [18, 69], [12, 65], [5, 60], [5, 58], [0, 50], [-5, 48], [-9, 43]];
const AF = [[-17, 15], [-10, 30], [0, 36], [10, 37], [20, 32], [30, 31], [35, 28], [43, 12], [51, 11], [48, 0], [40, -10], [35, -20], [30, -30], [20, -35], [15, -30], [12, -18], [9, -2], [9, 4], [-8, 5], [-13, 8], [-17, 12]];
const AS = [[30, 62], [40, 68], [60, 70], [80, 73], [100, 76], [120, 73], [140, 72], [160, 70], [178, 66], [170, 60], [162, 55], [158, 50], [142, 45], [135, 43], [130, 35], [127, 33], [122, 30], [120, 25], [110, 20], [105, 10], [100, 8], [95, 15], [90, 22], [85, 20], [80, 10], [77, 8], [72, 20], [65, 25], [58, 25], [52, 28], [48, 30], [43, 32], [36, 36], [30, 36]];
const OC = [[113, -22], [114, -30], [120, -34], [130, -32], [140, -38], [150, -37], [153, -27], [150, -22], [146, -19], [142, -11], [135, -12], [130, -13], [126, -14], [122, -17], [114, -22]];
const NZ: [number, number][] = [[167, -45], [174, -41], [178, -38], [174, -37], [168, -44]];
const PINS: [number, number, number][] = [
  [1, 50.45, 30.52], [2, 19.27, 84.92], [3, 25.03, 121.56], [4, 50.85, 4.35],
  [5, 36.9, 30.7], [6, 53.5, 20.8], [7, 32.9, 44.2], [8, 41.9, 12.5],
  [9, 35.68, 139.69], [10, 37.57, 126.98], [11, 3.5, 35.8], [12, 13.7, -89.2],
  [13, -41.29, 174.78], [14, 26.6, 56.3], [15, 28.6, 77.2],
];
function drawMap(cv: Canvas, x: number, y: number, w: number, h: number) {
  cv.rect(x, y, w, h, SEA);
  // faint lat/long grid
  for (let gx = x + Math.round(w / 12); gx < x + w; gx += Math.round(w / 12))
    cv.line(gx, y, gx, y + h, [190, 212, 228]);
  for (let gy = y + Math.round(h / 6); gy < y + h; gy += Math.round(h / 6))
    cv.line(x, gy, x + w, gy, [190, 212, 228]);
  const proj = (lon: number, lat: number): [number, number] => [
    x + Math.round((lon + 180) / 360 * w),
    y + Math.round((75 - lat) / 130 * h),
  ];
  for (const cont of [NA, SA, EU, AF, AS, OC, NZ]) {
    const pts = cont.map(([lo, la]) => proj(lo, la));
    cv.poly(pts, LAND);
    // edge shading
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      cv.line(x0, y0, x1, y1, LAND2, 1);
    }
  }
  // pins
  for (const [n, lat, lon] of PINS) {
    const [px, py] = proj(lon, lat);
    cv.circle(px, py, 7, RED);
    cv.ring(px, py, 7, WHITE, 1);
    const s = String(n);
    drawText(cv, s, px - textW(s, 1) / 2, py - 3, 1, WHITE);
  }
}

// ------------------------------------------------------------------- data ---
type Panel = { n: number; region: string; scene: string; tag: string; head: string; sum: string; src: string; conf: string };
const LEADS: Panel[] = [
  { n: 1, region: "Europe", scene: "kyiv", tag: "1 - KYIV, UKRAINE - WAR",
    head: "Russian missiles hit three Kyiv bridges",
    sum: "An overnight barrage of about 110 missiles and 400 drones killed at least nine people across Ukraine and cut power and water in the capital.",
    src: "Kyiv Independent, BBC", conf: "CONFIRMED" },
  { n: 2, region: "Asia", scene: "akvan", tag: "2 - ODISHA, INDIA - CYCLONE",
    head: "Cyclone Akvan comes ashore in eastern India",
    sum: "The storm crossed the coast near Gopalpur from about 8 am after more than 300,000 people were moved to shelters. No deaths were reported.",
    src: "IMD, Deccan Herald", conf: "CONFIRMED" },
  { n: 3, region: "Global", scene: "selloff", tag: "3 - TAIPEI - SEOUL - TOKYO - MARKETS",
    head: "AI sell-off sinks Asia's stock markets",
    sum: "Taiwan's index fell 6.2% to end its worst week since 1991. Seoul lost 5.2% and Tokyo 5.1% as chipmakers led the slide.",
    src: "Al Jazeera, Anadolu", conf: "CONFIRMED" },
];
const SMALL: Panel[] = [
  { n: 4, region: "Europe", scene: "ukeu", tag: "4 - BRUSSELS - DIPLOMACY",
    head: "UK and EU seal a \"reset\" deal", sum: "Food trade, youth visas, carbon link.", src: "Reuters", conf: "CONFIRMED" },
  { n: 5, region: "Global", scene: "cop31", tag: "5 - ANTALYA - CLIMATE",
    head: "COP31 reaches its last day with no deal", sum: "The draft text leaves out fossil fuels.", src: "UN News", conf: "CONFIRMED" },
  { n: 6, region: "Europe", scene: "poland", tag: "6 - POLAND - SECURITY",
    head: "Two Russian missiles land in Poland", sum: "One in a field; NATO calls it grave.", src: "Reuters", conf: "CONFIRMED" },
  { n: 7, region: "Middle East", scene: "iraq", tag: "7 - CENTRAL IRAQ - SECURITY",
    head: "Iraqi army enters a militia stronghold", sum: "Troops deploy to Jurf al-Sakhar.", src: "Reuters", conf: "REPORTED" },
  { n: 8, region: "Europe", scene: "italy", tag: "8 - ITALY - LABOUR",
    head: "General strike over Italy's budget", sum: "Workers and students march.", src: "Reuters", conf: "REPORTED" },
  { n: 9, region: "Asia", scene: "japan", tag: "9 - TOKYO - ECONOMY",
    head: "Japan's inflation picks up to 2.3%", sum: "A December rate rise stays in view.", src: "Reuters", conf: "CONFIRMED" },
  { n: 10, region: "Asia", scene: "seoul", tag: "10 - SEOUL - POLITICS",
    head: "Korea's ruling party to impeach top judge", sum: "It follows an overturned conviction.", src: "Korea Herald", conf: "REPORTED" },
  { n: 11, region: "Africa", scene: "kenya", tag: "11 - TURKANA, KENYA - ENERGY",
    head: "Kenya starts drilling its first oil well", sum: "First crude is due on 1 December.", src: "allAfrica", conf: "CONFIRMED" },
  { n: 12, region: "Americas", scene: "bukele", tag: "12 - EL SALVADOR - POLITICS",
    head: "Bukele files to run for a third term", sum: "The vote is on 28 February 2027.", src: "AP", conf: "CONFIRMED" },
  { n: 13, region: "Oceania", scene: "cricket", tag: "13 - WELLINGTON - CRICKET",
    head: "Phillips hits 118 against India", sum: "Nicholls made 175 in the same innings.", src: "ICC", conf: "CONFIRMED" },
  { n: 14, region: "Middle East", scene: "hormuz", tag: "14 - HORMUZ - SHIPPING",
    head: "Tanker set ablaze off Oman", sum: "No casualties; a fourth attack in days.", src: "UKMTO", conf: "CONFIRMED" },
  { n: 15, region: "Asia", scene: "delhi", tag: "15 - NEW DELHI - DIPLOMACY",
    head: "Pakistani minister visits New Delhi", sum: "First visit since the May 2025 clash.", src: "PTI", conf: "REPORTED" },
];
type Brief = { n: number; region: string; text: string };
const BRIEFS: Brief[] = [
  { n: 16, region: "Europe", text: "Lviv: strike on station kills two (BBC)" },
  { n: 17, region: "Europe", text: "Estonia: to shut Russia border on 1 Dec (Reuters)" },
  { n: 18, region: "Europe", text: "Berlin: pupils strike over service (Al Jazeera)" },
  { n: 19, region: "Europe", text: "London: UK runs cyber attacks abroad (Sky News)" },
  { n: 20, region: "Asia", text: "Beijing: China holds loan rates 18th month (Xinhua)" },
  { n: 21, region: "Asia", text: "Tokyo: SoftBank shares fall over 14% (Al Jazeera)" },
  { n: 22, region: "Asia", text: "Seoul: Kospi falls 5.2% in the sell-off (Reuters)" },
  { n: 23, region: "Asia", text: "Ganjam: 209 mm of rain as Akvan crosses (PTI)" },
  { n: 24, region: "Middle East", text: "Lebanon: Israeli strikes hit south, east (Anadolu)" },
  { n: 25, region: "Middle East", text: "Yemen: gunmen fire on cargo ship off coast (UKMTO)" },
  { n: 26, region: "Africa", text: "Abuja: court bars evidence vs Tinubu (Channels TV)" },
  { n: 27, region: "Africa", text: "Kampala: police enforce Ebola rally ban (allAfrica)" },
  { n: 28, region: "Africa", text: "Malawi: fuel crisis brings night queues (Al Jazeera)" },
  { n: 29, region: "Africa", text: "Africa: 22 countries in debt distress (allAfrica)" },
  { n: 30, region: "Americas", text: "Las Vegas: Russell tops wet practice (Autosport)" },
  { n: 31, region: "Americas", text: "New York: Nasdaq futures fall 1.6% (24/7 Wall St)" },
  { n: 32, region: "Americas", text: "Washington: Democrats query free work (Al Jazeera)" },
  { n: 33, region: "Oceania", text: "Wellington: Nicholls 175 in 216-run stand (ICC)" },
  { n: 34, region: "Oceania", text: "Sydney: Australian shares fall 1.8% (Reuters)" },
  { n: 35, region: "Europe", text: "Antalya: EU calls climate draft unacceptable (RTE)" },
  { n: 36, region: "Global", text: "Turin: ATP backs pay plan past $350m (Anadolu)" },
  { n: 37, region: "Americas", text: "New York: Anthropic falls 11% after debut (Reuters)" },
  { n: 38, region: "Americas", text: "Brazil: Lula meets Chief Raoni (Al Jazeera)" },
  { n: 39, region: "Oceania", text: "Bougainville: Rio Tinto pledges $370m (Reuters)" },
  { n: 40, region: "Oceania", text: "Canberra: AUKUS sales may shrink US fleet (Reuters)" },
  { n: 41, region: "Americas", text: "Florida: St Johns River hits record 18.3 ft (AP)" },
  { n: 42, region: "Americas", text: "Iowa: Army to blast 68 unstable barrels (AP)" },
  { n: 43, region: "Africa", text: "Sudan: army claims gains in W. Kordofan (Reuters)" },
  { n: 44, region: "Americas", text: "Pentagon: US war cost vs Iran at $4.38bn (Reuters)" },
  { n: 45, region: "Europe", text: "London: UK, Norway fund 100m+ naval ships (BBC)" },
  { n: 46, region: "Asia", text: "Myanmar: govt calls ruling unfair (Al Jazeera)" },
  { n: 47, region: "Asia", text: "Jakarta: parliament passes asset bill (Reuters)" },
  { n: 48, region: "Africa", text: "Senegal: Faye enacts budget by decree (AFP)" },
  { n: 49, region: "Middle East", text: "Hormuz: four vessel attacks in 96 hours (UKMTO)" },
  { n: 50, region: "Oceania", text: "Cook Islands: emergency ahead of Xavier (Reuters)" },
  { n: 51, region: "Middle East", text: "Qatar: U17 WC - Australia stun Argentina 2-0 (FIFA)" },
  { n: 52, region: "Africa", text: "South Africa: Harmer spins Proteas to win (ICC)" },
  { n: 53, region: "Asia", text: "Hong Kong: Badminton Open reaches semis (BWF)" },
  { n: 54, region: "Asia", text: "Taiwan: curbs in; Russian bombers tracked (Reuters)" },
  { n: 55, region: "Europe", text: "Turin: Alcaraz-Cobolli close ATP groups (ATP)" },
  { n: 56, region: "Americas", text: "Los Angeles: Thomas Markle fit for trial (BBC)" },
  { n: 57, region: "Global", text: "UN: marks World Children's Day worldwide (UN News)" },
  { n: 58, region: "Middle East", text: "Gaza: strikes kill 6 despite truce (Al Jazeera)" },
];
const STATS: [string, string][] = [
  ["3", "bridges over the Dnipro damaged in Kyiv"],
  ["300,000+", "people moved to shelters before Akvan"],
  ["-6.2%", "Taiwan's share index, Friday's close"],
  ["100,000", "youth visas a year in the UK-EU deal"],
  ["2.3%", "Japan consumer inflation in October"],
  ["118", "runs by Glenn Phillips against India"],
];
const TIMELINE: [string, string][] = [
  ["00:00", "Kyiv bridges hit"], ["02:00", "Akvan landfall"], ["05:30", "Missiles in Poland"],
  ["06:00", "Nikkei -5.1%"], ["15:00", "COP31 overtime"], ["19:15", "Nvidia SEC probe"],
  ["21:00", "S&P 500 -3.7%"],
];
const REGION_ORDER = ["Europe", "Asia", "Middle East", "Africa", "Americas", "Oceania", "Global"];
const REGION_COLOR: Record<string, RGB> = {
  Europe: NAVY, Asia: RED, "Middle East": OCHRE, Africa: GREEN,
  Americas: TEAL, Oceania: SKY_DK, Global: GREY,
};
const DATECHECK_LEFT = "Left out as Thursday 19 November's news: World Court ruling on Myanmar; Shenzhen declaration; Anthropic's $83 IPO; GTA VI launch; $190.4m Van Gogh sale; Voyager 1 one light-day; US Senate Iran vote; Fiona the hippo; Tonga drought; Denmark Greenland vote.";
const DATECHECK_NOTYET = "Not yet happened, so not shown: BepiColombo's orbit entry round Mercury; any final COP31 text; the ATP Finals final.";

// ------------------------------------------------------------------ layout --
function drawBold(cv: Canvas, s: string, x: number, y: number, sc: number, c: RGB) {
  drawText(cv, s, x, y, sc, c);
  drawText(cv, s, x + 1, y, sc, c);
}
function confChip(cv: Canvas, conf: string, x: number, y: number) {
  const w = textW(conf, 1) + 8;
  cv.rect(x, y, w, 11, conf === "CONFIRMED" ? GREEN : OCHRE);
  drawText(cv, conf, x + 4, y + 2, 1, WHITE);
  return w;
}
function render(): Canvas {
  const cv = new Canvas();
  cv.rect(0, 0, W, H, PAPER);
  const MX = 14, CW = 996; // margin, content width
  // kicker
  drawText(cv, "THE WORLD IN ONE DAY", MX, 8, 1, RED);
  const kr = "58 STORIES - 7 REGIONS - EVERY ONE DATED FRIDAY 20 NOVEMBER 2026";
  drawText(cv, kr, MX + CW - textW(kr, 1), 8, 1, INK);
  cv.rect(MX, 20, CW, 2, INK);
  // masthead
  const mast = "Friday 20 November 2026";
  drawBold(cv, mast, MX + CW / 2 - textW(mast, 5) / 2, 26, 5, INK);
  const sub = "Russian missiles hit Kyiv's bridges - Cyclone Akvan strikes India - An AI sell-off sinks Asia's markets - UK and EU seal a deal";
  drawCenter(cv, sub, MX + CW / 2, 66, 1, [60, 58, 52]);
  cv.rect(MX, 80, CW, 1, INK);
  // stat strip
  const sw = (CW - 5 * 4) / 6;
  STATS.forEach(([big, cap], i) => {
    const bx = MX + i * (sw + 4);
    cv.rect(bx, 86, sw, 46, CREAM);
    cv.frame(bx, 86, sw, 46, [200, 192, 172], 1);
    cv.rect(bx, 86, 3, 46, RED);
    drawBold(cv, big, bx + 10, 90, 2, RED_DK);
    drawPara(cv, cap, bx + 10, 110, sw - 16, 1, INK, 9);
  });
  // region bar (counts computed from the story table)
  const all = [...LEADS, ...SMALL, ...BRIEFS];
  const counts: Record<string, number> = {};
  for (const s of all) counts[s.region] = (counts[s.region] || 0) + 1;
  let rx = MX;
  for (const r of REGION_ORDER) {
    const segW = Math.round(CW * counts[r] / all.length);
    cv.rect(rx, 136, segW, 16, REGION_COLOR[r]);
    const label = `${r} ${counts[r]}`;
    if (textW(label, 1) + 6 < segW)
      drawText(cv, label, rx + 4, 140, 1, WHITE);
    rx += segW;
  }
  // 3 leads
  const lw = (CW - 12) / 3;
  LEADS.forEach((p, i) => {
    const lx = MX + i * (lw + 6);
    const ly = 158;
    if (p.scene === "kyiv") sceneKyiv(cv, lx, ly, lw, 126);
    else if (p.scene === "akvan") sceneAkvan(cv, lx, ly, lw, 126);
    else sceneSelloff(cv, lx, ly, lw, 126);
    cv.frame(lx, ly, lw, 126, INK, 1);
    drawText(cv, p.tag, lx, ly + 132, 1, RED);
    drawPara(cv, p.head, lx, ly + 144, lw, 2, INK, 16);
    drawPara(cv, p.sum, lx, ly + 178, lw, 1, [40, 38, 34], 9);
    const chw = confChip(cv, p.conf, lx, ly + 208);
    drawText(cv, p.src, lx + chw + 6, ly + 210, 1, GREY);
  });
  // 12 small panels, 2 rows x 6
  const pw = (CW - 5 * 5) / 6;
  SMALL.forEach((p, i) => {
    const col = i % 6, row = Math.floor(i / 6);
    const px = MX + col * (pw + 5);
    const py = 392 + row * 136;
    sceneSmall(cv, p.scene, px, py, pw, 52);
    cv.frame(px, py, pw, 52, INK, 1);
    drawText(cv, p.tag, px, py + 58, 1, RED);
    drawPara(cv, p.head, px, py + 68, pw, 1, INK, 9);
    drawPara(cv, p.sum, px, py + 88, pw, 1, [40, 38, 34], 9);
    const chw = confChip(cv, p.conf, px, py + 112);
    drawText(cv, p.src, px + chw + 4, py + 114, 1, GREY);
  });
  // timeline UTC
  const ty = 668;
  drawText(cv, "THE DAY IN UTC", MX, ty, 1, RED);
  cv.line(MX, ty + 16, MX + CW, ty + 16, INK, 1);
  TIMELINE.forEach(([t, label], i) => {
    const tx = MX + 150 + i * 120;
    cv.circle(tx, ty + 16, 4, RED);
    cv.ring(tx, ty + 16, 4, WHITE, 1);
    drawBold(cv, t, tx - textW(t, 1) / 2, ty + 2, 1, INK);
    drawText(cv, label, tx - textW(label, 1) / 2, ty + 24, 1, INK);
  });
  // map + briefs header
  const my = 706;
  drawText(cv, "WHERE IT HAPPENED", MX, my, 1, RED);
  drawText(cv, "ALSO ON FRIDAY 20 NOVEMBER - 43 MORE STORIES", 330, my, 1, RED);
  drawMap(cv, MX, my + 14, 300, 214);
  cv.frame(MX, my + 14, 300, 214, INK, 1);
  drawText(cv, "Each number matches that story on this page.", MX, my + 232, 1, GREY);
  // briefs, 2 columns of 22 / 21
  const col0 = BRIEFS.slice(0, 22), col1 = BRIEFS.slice(22);
  [col0, col1].forEach((col, ci) => {
    const bx = 330 + ci * 342;
    col.forEach((b, j) => {
      const by = my + 14 + j * 10;
      drawText(cv, String(b.n), bx, by, 1, RED);
      drawText(cv, b.text, bx + 20, by, 1, INK);
    });
  });
  // DATE CHECK
  const dy = 952;
  cv.rect(MX, dy, CW, 46, [255, 238, 232]);
  cv.frame(MX, dy, CW, 46, RED, 2);
  drawBold(cv, "DATE CHECK", MX + 8, dy + 4, 1, RED);
  drawPara(cv, DATECHECK_LEFT, MX + 8, dy + 14, CW - 16, 1, INK, 9);
  drawPara(cv, DATECHECK_NOTYET, MX + 8, dy + 32, CW - 16, 1, [90, 30, 30], 9);
  // footer
  drawText(cv, "Every story here happened, or was first reported, on Friday 20 November 2026.", MX, 1006, 1, GREY);
  drawText(cv, "Sources named beside each story - original drawings", MX + CW - textW("Sources named beside each story - original drawings", 1), 1004, 1, GREY);
  return cv;
}

// -------------------------------------------------------------------- main --
function grain(cv: Canvas, amp: number, seed: number) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < W * H; i++) {
    const r = cv.buf[i * 3], g = cv.buf[i * 3 + 1], b = cv.buf[i * 3 + 2];
    if (r + g + b < 240) continue; // keep dark text crisp
    const d = Math.round((rnd() - 0.5) * 2 * amp);
    cv.buf[i * 3] = Math.max(0, Math.min(255, r + d));
    cv.buf[i * 3 + 1] = Math.max(0, Math.min(255, g + d));
    cv.buf[i * 3 + 2] = Math.max(0, Math.min(255, b + d));
  }
}
function main() {
  const total = LEADS.length + SMALL.length + BRIEFS.length;
  if (total !== 58) throw new Error(`story count ${total}, expected 58`);
  const amp = Number(process.env.GRAIN_AMP ?? 5);
  const cv = render();
  grain(cv, amp, 20261120);
  const png = encodePNG(cv);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/entry.png`, png);
  console.log(`stories=${total} (${LEADS.length} leads + ${SMALL.length} panels + ${BRIEFS.length} briefs)`);
  console.log(`bytes=${png.length} sha256=${createHash("sha256").update(png).digest("hex")}`);
}
main();
