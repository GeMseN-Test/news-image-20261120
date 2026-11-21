// V2 — Friday 20 November 2026 in one image.
// A 1024x1024 broadsheet: 58 date-checked stories, 15 drawn panels,
// a pinned world map, a UTC timeline and a DATE CHECK box.
// Written fresh in this session. Node stdlib only (fs, zlib).
// Runs with: node main.ts   (MAKEFUN_OUTPUT_DIR=out for a local run)
// Writes /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png).
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

// ---------- deterministic PRNG (mulberry32) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261120);

// ---------- colour helpers ----------
function rgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}
const PAPER = rgb(0xf6f1e5);
const PAPER2 = rgb(0xefe7d3);
const PANEL = rgb(0xfffdf4);
const INK = rgb(0x1b1b18);
const INK2 = rgb(0x3d3a33);
const GREY = rgb(0x6e6a5e);
const LINE = rgb(0x8a8271);
const RED = rgb(0xb3261e);
const REDD = rgb(0x8c1d16);
const NAVY = rgb(0x16324f);
const BLUE = rgb(0x1d4e89);
const TEAL = rgb(0x0f766e);
const GOLD = rgb(0xc9a227);
const GREEN = rgb(0x2e7d32);
const ORANGE = rgb(0xd97706);
const SKY = rgb(0x9fc3e0);
const SEA = rgb(0x7fb3d5);
const LAND = rgb(0xd9c9a3);
const LAND2 = rgb(0xcbb98e);
const WHITE = rgb(0xffffff);
const CREAM = rgb(0xf3ead2);

function setPx(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function fillRect(x, y, w, h, c) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; i += 3;
    }
  }
}
function hline(x, y, w, c) { fillRect(x, y, w, 1, c); }
function vline(x, y, h, c) { fillRect(x, y, 1, h, c); }
function rect(x, y, w, h, c) {
  hline(x, y, w, c); hline(x, y + h - 1, w, c);
  vline(x, y, h, c); vline(x + w - 1, y, h, c);
}
function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let n = 0; n < 4000; n++) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function circle(cx, cy, r, c, fill) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (fill ? d <= r * r : d <= r * r && d >= (r - 1) * (r - 1)) setPx(cx + x, cy + y, c);
    }
  }
}
function poly(points, c, fill) {
  // points: [[x,y],...] — scanline fill or outline
  if (fill) {
    let minY = 1e9, maxY = -1e9;
    for (const p of points) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) setPx(x, y, c);
      }
    }
  } else {
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c);
    }
  }
}
function dashedLine(x0, y0, x1, y1, c, dash, gap) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(len));
  let on = true, run = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    if (on) setPx(x, y, c);
    run++;
    if (run >= (on ? dash : gap)) { on = !on; run = 0; }
  }
}
function starburst(cx, cy, r, c) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    line(cx, cy, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c);
  }
  circle(cx, cy, Math.max(2, Math.round(r / 3)), c, true);
}

// ---------- 5x9 bitmap font ----------
// Each glyph: 9 rows of 5 chars, joined with "/". "#" = ink.
// Capitals/digits use rows 1-7; lowercase x-height rows 3-7, descenders to 8.
const FONT = {
  "0": "...../.###./#...#/#..##/#.#.#/##..#/#...#/.###./.....",
  "1": "...../..#../.##../..#../..#../..#../..#../.###./.....",
  "2": "...../.###./#...#/....#/...#./..#../.#.../#####/.....",
  "3": "...../.###./#...#/....#/.###./....#/#...#/.###./.....",
  "4": "...../...#./..##./.#.#./#..#./#####/...#./...#./.....",
  "5": "...../#####/#..../####./....#/....#/#...#/.###./.....",
  "6": "...../.###./#..../#..../####./#...#/#...#/.###./.....",
  "7": "...../#####/....#/...#./..#../..#../..#../..#../.....",
  "8": "...../.###./#...#/#...#/.###./#...#/#...#/.###./.....",
  "9": "...../.###./#...#/#...#/.####/....#/....#/.###./.....",
  "A": "...../.###./#...#/#...#/#####/#...#/#...#/#...#/.....",
  "B": "...../####./#...#/#...#/####./#...#/#...#/####./.....",
  "C": "...../.###./#...#/#..../#..../#..../#...#/.###./.....",
  "D": "...../###../#..#./#...#/#...#/#...#/#..#./###../.....",
  "E": "...../#####/#..../#..../####./#..../#..../#####/.....",
  "F": "...../#####/#..../#..../####./#..../#..../#..../.....",
  "G": "...../.###./#...#/#..../#.###/#...#/#...#/.###./.....",
  "H": "...../#...#/#...#/#...#/#####/#...#/#...#/#...#/.....",
  "I": "...../.###./..#../..#../..#../..#../..#../.###./.....",
  "J": "...../..###/...#./...#./...#./...#./#..#./.##../.....",
  "K": "...../#...#/#..#./#.#../##.../#.#../#..#./#...#/.....",
  "L": "...../#..../#..../#..../#..../#..../#..../#####/.....",
  "M": "...../#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#/.....",
  "N": "...../#...#/#...#/##..#/#.#.#/#..##/#...#/#...#/.....",
  "O": "...../.###./#...#/#...#/#...#/#...#/#...#/.###./.....",
  "P": "...../####./#...#/#...#/####./#..../#..../#..../.....",
  "Q": "...../.###./#...#/#...#/#...#/#.#.#/#..#./.##.#/.....",
  "R": "...../####./#...#/#...#/####./#.#../#..#./#...#/.....",
  "S": "...../.####/#...#/#..../.###./....#/#...#/.###./.....",
  "T": "...../#####/..#../..#../..#../..#../..#../..#../.....",
  "U": "...../#...#/#...#/#...#/#...#/#...#/#...#/.###./.....",
  "V": "...../#...#/#...#/#...#/#...#/#...#/.#.#./..#../.....",
  "W": "...../#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#/.....",
  "X": "...../#...#/#...#/.#.#./..#../.#.#./#...#/#...#/.....",
  "Y": "...../#...#/#...#/#...#/.#.#./..#../..#../..#../.....",
  "Z": "...../#####/....#/....#/...#./..#../.#.../#####/.....",
  "a": "...../...../...../.###./....#/.####/#...#/.###./.....",
  "b": "...../#..../#..../####./#...#/#...#/#...#/####./.....",
  "c": "...../...../...../.###./#..../#..../#..../.###./.....",
  "d": "...../...#./...#./.####/#...#/#...#/#...#/.###./.....",
  "e": "...../...../...../.###./#...#/#####/#..../.###./.....",
  "f": "...../.##../.#.../.#.../####./.#.../.#.../.#.../.....",
  "g": "...../...../...../.####/#...#/#...#/.####/....#/.###.",
  "h": "...../#..../#..../####./#...#/#...#/#...#/#...#/.....",
  "i": "...../..#../...../.##../..#../..#../..#../.###./.....",
  "j": "...../..#../...../..#../..#../..#../..#../#.#../.##..",
  "k": "...../#..../#..../#..#./#.#../##.../#.#../#..#./.....",
  "l": "...../.##../..#../..#../..#../..#../..#../.###./.....",
  "m": "...../...../...../##.#./#.#.#/#.#.#/#.#.#/#.#.#/.....",
  "n": "...../...../...../####./#...#/#...#/#...#/#...#/.....",
  "o": "...../...../...../.###./#...#/#...#/#...#/.###./.....",
  "p": "...../...../...../####./#...#/#...#/####./#..../#....",
  "q": "...../...../...../.####/#...#/#...#/.####/....#/....#",
  "r": "...../...../...../#.##./##..#/#..../#..../#..../.....",
  "s": "...../...../...../.####/#..../.###./....#/####./.....",
  "t": "...../.#.../.#.../####./.#.../.#.../.#.../..##./.....",
  "u": "...../...../...../#...#/#...#/#...#/#...#/.###./.....",
  "v": "...../...../...../#...#/#...#/#...#/.#.#./..#../.....",
  "w": "...../...../...../#...#/#...#/#.#.#/#.#.#/.#.#./.....",
  "x": "...../...../...../#...#/.#.#./..#../.#.#./#...#/.....",
  "y": "...../...../...../#...#/#...#/#...#/.####/....#/.###.",
  "z": "...../...../...../#####/....#/...#./..#../#####/.....",
  " ": "...../...../...../...../...../...../...../...../.....",
  ".": "...../...../...../...../...../...../...../..#../..#..",
  ",": "...../...../...../...../...../...../...../..#../.#...",
  ":": "...../...../...../..#../...../..#../...../...../.....",
  ";": "...../...../...../..#../...../..#../..#../.#.../.....",
  "!": "...../..#../..#../..#../..#../..#../...../..#../.....",
  "?": "...../.###./#...#/....#/...#./..#../...../..#../.....",
  "'": "...../..#../..#../...../...../...../...../...../.....",
  "’": "...../..#../..#../...../...../...../...../...../.....",
  "‘": "...../..#../..#../...../...../...../...../...../.....",
  "\"": "...../.#.#./.#.#./...../...../...../...../...../.....",
  "“": "...../.#.#./.#.#./...../...../...../...../...../.....",
  "”": "...../.#.#./.#.#./...../...../...../...../...../.....",
  "-": "...../...../...../...../#####/...../...../...../.....",
  "–": "...../...../...../...../#####/...../...../...../.....",
  "—": "...../...../...../...../#####/...../...../...../.....",
  "(": "...../...#./..#../.#.../.#.../.#.../..#../...#./.....",
  ")": "...../.#.../..#../...#./...#./...#./..#../.#.../.....",
  "/": "...../....#/....#/....#/..#../.#.../.#.../#..../.....",
  "%": "...../#...#/#..#./...#./..#../.#.../#..#./#...#/.....",
  "+": "...../...../...../..#../.###./..#../...../...../.....",
  "=": "...../...../...../#####/...../#####/...../...../.....",
  "&": "...../.###./#...#/#...#/.#.../#.#.#/#..#./.##.#/.....",
  "*": "...../#.#.#/.###./#.#.#/...../...../...../...../.....",
  "#": "...../...../.#.#./.#.#./#####/.#.#./.#.#./...../.....",
  "@": "...../.###./#...#/#.###/#.#.#/#.###/#..../.###./.....",
  "_": "...../...../...../...../...../...../...../...../#####",
  "$": "...../..#../.####/#.#../.###./..#.#/####./..#../.....",
  "°": "...../.###./#...#/.###./...../...../...../...../.....",
  "·": "...../...../...../...../..#../...../...../...../.....",
  "…": "...../...../...../...../...../...../...../#.#.#/.....",
  "£": "...../..##./.#.../#..../####./#..../.#.../####./.....",
};
const FONT_ROWS = {};
for (const ch of Object.keys(FONT)) FONT_ROWS[ch] = FONT[ch].split("/");

function glyphWidth(s) { return 6 * s; }
function textWidth(str, s) {
  let w = 0;
  for (const ch of str) w += glyphWidth(s);
  return w - s; // no trailing gap
}
function drawGlyph(ch, x, y, s, c, bold) {
  const rows = FONT_ROWS[ch] || FONT_ROWS["?"];
  for (let r = 0; r < 9; r++) {
    const row = rows[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "#") {
        fillRect(x + col * s, y + r * s, s, s, c);
        if (bold) fillRect(x + col * s + 1, y + r * s, s, s, c);
      }
    }
  }
}
function drawText(str, x, y, s, c, bold) {
  let cx = x;
  for (const ch of str) {
    drawGlyph(ch, cx, y, s, c, !!bold);
    cx += glyphWidth(s);
  }
  return cx;
}
function drawTextCentered(str, cx, y, s, c, bold) {
  drawText(str, Math.round(cx - textWidth(str, s) / 2), y, s, c, bold);
}
function wrapText(str, maxW, s) {
  const words = str.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, s) <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(str, x, y, maxW, s, c, lh, bold) {
  const lines = wrapText(str, maxW, s);
  for (let i = 0; i < lines.length; i++) drawText(lines[i], x, y + i * lh, s, c, bold);
  return lines.length;
}

// ---------- PNG writer (hand-rolled, deterministic) ----------
const CRC_TABLE = [];
(function () {
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
  }
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function writePNG(outPath) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  return png.length;
}

// ---------- DATA: 58 stories, Friday 20 November 2026 ----------
// art: which mini-illustration to draw. label: CONFIRMED / REPORTED.
// Regions: Europe, Asia, Middle East, Africa, Americas, Oceania, Global.
const LEADS = [
  {
    n: 1, place: "KYIV, UKRAINE", field: "WAR", art: "kyiv", label: "CONFIRMED",
    src: "Kyiv Independent, BBC",
    kicker: "KYIV", big: "3 bridges hit",
    head: "Russian missiles hit three Kyiv bridges",
    body: "An overnight barrage of about 110 missiles and 400 drones killed at least nine people across Ukraine and cut power and water in the capital.",
  },
  {
    n: 2, place: "ODISHA, INDIA", field: "CYCLONE", art: "akvan", label: "CONFIRMED",
    src: "IMD, The Hindu",
    kicker: "CYCLONE AKVAN", big: "Landfall · 8 am",
    head: "Cyclone Akvan comes ashore in eastern India",
    body: "The storm crossed the coast near Gopalpur from about 8 am after more than 300,000 people were moved to shelters. No deaths were reported.",
  },
  {
    n: 3, place: "TAIPEI · SEOUL · TOKYO", field: "MARKETS", art: "selloff", label: "CONFIRMED",
    src: "Reuters, Al Jazeera",
    kicker: "AI SELL-OFF", big: "Asia, Friday's close",
    head: "AI sell-off sinks Asia's stock markets",
    body: "Taiwan's index fell 6.2% to end its worst week since 1991. Seoul lost 5.2% and Tokyo 5.1% as chipmakers led the slide.",
  },
];
const PANELS = [
  { n: 4, place: "BRUSSELS", field: "DIPLOMACY", art: "ukeu", label: "CONFIRMED", src: "Reuters",
    kicker: "UK-EU DEAL", head: "UK and EU seal a \"reset\" deal",
    body: "Food trade, youth visas, carbon link." },
  { n: 5, place: "ANTALYA", field: "CLIMATE", art: "cop", label: "CONFIRMED", src: "UN News",
    kicker: "COP31: NO DEAL", head: "COP31 reaches its last day with no deal",
    body: "The draft text leaves out fossil fuels." },
  { n: 6, place: "EASTERN POLAND", field: "SECURITY", art: "poland", label: "CONFIRMED", src: "Reuters",
    kicker: "POLAND: MISSILE", head: "Russian cruise missile lands in Poland",
    body: "It fell in a field; no one was hurt." },
  { n: 7, place: "CENTRAL IRAQ", field: "SECURITY", art: "iraq", label: "REPORTED", src: "Reuters",
    kicker: "IRAQ: ARMY IN", head: "Iraqi army enters a militia stronghold",
    body: "Troops deploy to Jurf al-Sakhar." },
  { n: 8, place: "ITALY", field: "LABOUR", art: "italy", label: "REPORTED", src: "Reuters",
    kicker: "ITALY: STRIKE", head: "General strike over Italy's budget",
    body: "Workers and students march." },
  { n: 9, place: "TOKYO", field: "ECONOMY", art: "japan", label: "CONFIRMED", src: "Reuters",
    kicker: "JAPAN: +2.3%", head: "Japan's inflation picks up to 2.3%",
    body: "A December rate rise stays in view." },
  { n: 10, place: "SEOUL", field: "POLITICS", art: "seoul", label: "REPORTED", src: "Korea Herald",
    kicker: "SEOUL: IMPEACH", head: "Korea's ruling party to impeach top judge",
    body: "It follows an overturned conviction." },
  { n: 11, place: "TURKANA, KENYA", field: "ENERGY", art: "kenya", label: "CONFIRMED", src: "allAfrica",
    kicker: "KENYA: OIL", head: "Kenya starts drilling its first oil well",
    body: "First crude is due on 1 December." },
  { n: 12, place: "SAN SALVADOR", field: "POLITICS", art: "bukele", label: "CONFIRMED", src: "AP",
    kicker: "BUKELE: 3RD BID", head: "Bukele files to run for a third term",
    body: "The vote is on 28 February 2027." },
  { n: 13, place: "WELLINGTON", field: "CRICKET", art: "cricket", label: "CONFIRMED", src: "ICC",
    kicker: "PHILLIPS: 118", head: "Phillips hits 118 against India",
    body: "Hundreds v India in all three formats." },
  { n: 14, place: "HORMUZ", field: "SHIPPING", art: "tanker", label: "CONFIRMED", src: "UKMTO",
    kicker: "TANKER ABLAZE", head: "Tanker set ablaze off Oman near Hormuz",
    body: "No casualties; Iran's Guards blame a mine." },
  { n: 15, place: "NEW DELHI", field: "DIPLOMACY", art: "delhi", label: "REPORTED", src: "PTI, Dawn",
    kicker: "PAKISTAN VISITS", head: "Pakistani minister visits New Delhi",
    body: "First since the May 2025 clash." },
];
const BRIEFS = [
  [16, "Lviv", "railway station strike kills two", "BBC", "Europe"],
  [17, "Estonia", "to shut Russia border 1 Dec", "Reuters", "Europe"],
  [18, "Berlin", "pupils strike over service", "Al Jazeera", "Europe"],
  [19, "London", "UK runs cyber attacks abroad", "Sky News", "Europe"],
  [20, "Beijing", "holds loan rates an 18th month", "Xinhua", "Asia"],
  [21, "Tokyo", "SoftBank shares fall 14%+", "Al Jazeera", "Asia"],
  [22, "Seoul", "Kospi index falls 5.2%", "Reuters", "Asia"],
  [23, "Ganjam", "209 mm of rain as Akvan crosses", "PTI", "Asia"],
  [24, "Lebanon", "Israeli strikes hit south", "Anadolu", "Middle East"],
  [25, "Yemen", "gunmen fire on a cargo ship", "UKMTO", "Middle East"],
  [26, "Abuja", "court bars new evidence", "Channels TV", "Africa"],
  [27, "Kampala", "Ebola rally ban enforced", "allAfrica", "Africa"],
  [28, "Malawi", "fuel crisis, night queues", "Al Jazeera", "Africa"],
  [29, "Africa", "22 states in debt distress", "allAfrica", "Africa"],
  [30, "Las Vegas", "Russell fastest in wet GP", "Autosport", "Americas"],
  [31, "New York", "Nasdaq futures down 1.6%", "24/7 Wall St", "Americas"],
  [32, "Washington", "Dems query free work", "Al Jazeera", "Americas"],
  [33, "Wellington", "Nicholls 175 in 216-run stand", "ICC", "Oceania"],
  [34, "Sydney", "shares fall 1.8% in sell-off", "Reuters", "Oceania"],
  [35, "Antalya", "EU calls draft unacceptable", "RTE", "Europe"],
  [36, "Turin", "ATP: player pay past $350m", "Anadolu", "Europe"],
  [37, "Mercury", "BepiColombo arrives", "ESA, BBC", "Global"],
  [38, "Brazil", "Lula meets Chief Raoni", "Al Jazeera", "Americas"],
  [39, "Bougainville", "Rio Tinto pledges $370m", "Reuters", "Oceania"],
  [40, "Canberra", "AUKUS sub sales warning", "Reuters", "Oceania"],
  [41, "Florida", "St Johns River hits record 18.3 ft", "AP", "Americas"],
  [42, "Iowa", "Army to detonate 68 barrels", "AP", "Americas"],
  [43, "Sudan", "army gains in W. Kordofan", "Reuters", "Africa"],
  [44, "Pentagon", "US war cost vs Iran: $4.38bn", "Reuters", "Americas"],
  [45, "London", "UK, Norway fund Ukrainian ships", "BBC", "Europe"],
  [46, "Myanmar", "govt calls ruling unfair", "Al Jazeera", "Asia"],
  [47, "Jakarta", "asset-forfeiture bill passes", "Reuters", "Asia"],
  [48, "Senegal", "Faye enacts budget by decree", "AFP", "Africa"],
  [49, "Hormuz", "four ship attacks in 96 hours", "UKMTO", "Middle East"],
  [50, "New Delhi", "Pakistan to lead SCO team", "The Hindu", "Asia"],
  [51, "Qatar", "U17: Australia stun Argentina 2-0", "FIFA", "Middle East"],
  [52, "S. Africa", "Harmer spins Proteas to win", "ICC", "Africa"],
  [53, "Hong Kong", "Badminton Open reaches semis", "BWF", "Asia"],
  [54, "Taiwan", "short-sell curbs take effect", "Reuters", "Asia"],
  [55, "Turin", "ATP Finals groups close", "ATP", "Europe"],
  [56, "Los Angeles", "Thomas Markle fit for trial", "BBC", "Americas"],
  [57, "UN", "marks World Children's Day", "UN News", "Global"],
  [58, "Gaza", "strikes kill 6 despite truce", "Al Jazeera", "Middle East"],
];
const BIGNUMS = [
  ["3", "bridges damaged in Kyiv"],
  ["300,000+", "people moved to shelters before Akvan"],
  ["-6.2%", "Taiwan's share index, Friday's close"],
  ["100,000", "youth visas a year in the UK-EU deal"],
  ["2.3%", "Japan consumer inflation in October"],
  ["118", "runs by Glenn Phillips against India"],
];
const TIMELINE = [
  ["00:00", "Kyiv hit"],
  ["02:00", "Akvan landfall"],
  ["05:30", "Missile in Poland"],
  ["06:00", "Tokyo -5.1%"],
  ["15:00", "COP31 no deal"],
  ["19:15", "Nvidia probe"],
  ["21:00", "S&P -3.7%"],
];
const DATE_LEFT = "World Court ruling on Myanmar · Shenzhen declaration · Anthropic $83 IPO · GTA VI launch · $190.4m Van Gogh · Voyager 1 light-day · Senate Iran vote · Fiona the hippo · Tonga drought · Denmark Greenland vote";
const DATE_NOTYET = "BepiColombo orbit entry · final COP31 text · ATP Finals final";

// Region counts, computed from the story tables (must sum to 58).
const REGION_ORDER = ["Europe", "Asia", "Middle East", "Africa", "Americas", "Oceania", "Global"];
const REGION_COLOR = {
  Europe: rgb(0x1d4e89), Asia: rgb(0xb3261e), "Middle East": rgb(0xc9a227),
  Africa: rgb(0x2e7d32), Americas: rgb(0x6d28a8), Oceania: rgb(0x0f766e), Global: rgb(0x4a4a44),
};
const REGION_OF = {
  1: "Europe", 2: "Asia", 3: "Global", 4: "Europe", 5: "Global", 6: "Europe",
  7: "Middle East", 8: "Europe", 9: "Asia", 10: "Asia", 11: "Africa",
  12: "Americas", 13: "Oceania", 14: "Middle East", 15: "Asia",
};
function regionCounts() {
  const c = {};
  for (const r of REGION_ORDER) c[r] = 0;
  for (const p of [...LEADS, ...PANELS]) c[REGION_OF[p.n]]++;
  for (const b of BRIEFS) c[b[4]]++;
  return c;
}

// ---------- mini illustrations (drawn fresh, procedural) ----------
function art(x, y, w, h, kind) {
  const X = (f) => Math.round(x + f * w);
  const Y = (f) => Math.round(y + f * h);
  if (kind === "kyiv") {
    // Night sky, skyline, river, three bridges, explosions, missile trails.
    for (let i = 0; i < 10; i++) fillRect(x, y + Math.round(i * h / 10), w, Math.ceil(h / 10) + 1, rgb(0x0d1b33 + i * 0x020208));
    for (let i = 0; i < 40; i++) setPx(X(rnd()), Y(rnd() * 0.4), WHITE);
    const base = Y(0.72);
    const towers = [[0.02, 0.42], [0.10, 0.30], [0.20, 0.48], [0.30, 0.26], [0.42, 0.40], [0.55, 0.34], [0.66, 0.46], [0.78, 0.30], [0.88, 0.44]];
    for (const [fx, fh] of towers) {
      fillRect(X(fx), Y(0.72 - fh), Math.round(w * 0.09), Math.round(h * fh), rgb(0x0a1424));
      for (let wy = 0; wy < 4; wy++) for (let wx = 0; wx < 3; wx++)
        if (rnd() > 0.5) fillRect(X(fx) + 3 + wx * 7, Y(0.72 - fh) + 4 + wy * 9, 3, 4, GOLD);
    }
    fillRect(x, base, w, h - (base - y), rgb(0x14406b)); // river
    for (let i = 0; i < 24; i++) hline(X(rnd()), base + 4 + Math.round(rnd() * (h - (base - y) - 8)), 8 + Math.round(rnd() * 18), rgb(0x2a5d8f));
    for (const fx of [0.18, 0.5, 0.82]) { // three bridges
      line(X(fx - 0.09), base, X(fx), base - Math.round(h * 0.12), WHITE);
      line(X(fx), base - Math.round(h * 0.12), X(fx + 0.09), base, WHITE);
      hline(X(fx - 0.09), base, Math.round(w * 0.18), WHITE);
    }
    for (const [fx, fy] of [[0.18, 0.55], [0.5, 0.5], [0.82, 0.58]]) {
      starburst(X(fx), Y(fy), Math.round(h * 0.16), ORANGE);
      starburst(X(fx), Y(fy), Math.round(h * 0.09), GOLD);
    }
    dashedLine(X(0.06), Y(0.10), X(0.18), Y(0.52), GOLD, 4, 3);
    dashedLine(X(0.94), Y(0.08), X(0.82), Y(0.55), GOLD, 4, 3);
  } else if (kind === "akvan") {
    fillRect(x, y, w, h, rgb(0x2f6da3)); // Bay of Bengal
    for (let i = 0; i < 30; i++) hline(X(rnd()), Y(0.1 + rnd() * 0.8), 10 + Math.round(rnd() * 20), rgb(0x4a86b8));
    poly([[X(0.02), Y(0.02)], [X(0.42), Y(0.02)], [X(0.55), Y(0.35)], [X(0.48), Y(0.75)], [X(0.30), Y(0.98)], [X(0.02), Y(0.98)]], LAND, true); // India coast
    poly([[X(0.02), Y(0.02)], [X(0.42), Y(0.02)], [X(0.55), Y(0.35)], [X(0.48), Y(0.75)], [X(0.30), Y(0.98)], [X(0.02), Y(0.98)]], rgb(0x9a8a68), false);
    const cx = X(0.62), cy = Y(0.45);
    for (let r = 8; r <= Math.round(h * 0.42); r += 7) {
      for (let a = 0; a < Math.PI * 2; a += 0.08) {
        const rr = r * (1 + 0.12 * Math.sin(a * 2));
        setPx(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.9), WHITE);
      }
    }
    circle(cx, cy, 5, WHITE, true);
    circle(X(0.44), Y(0.42), 5, RED, true); // Gopalpur
    circle(X(0.44), Y(0.42), 8, RED, false);
    for (let i = 0; i < 26; i++) line(X(0.55 + rnd() * 0.4), Y(0.1 + rnd() * 0.8), X(0.53 + rnd() * 0.4), Y(0.16 + rnd() * 0.8), rgb(0xbcd8ee));
  } else if (kind === "selloff") {
    fillRect(x, y, w, h, rgb(0x101c2e));
    for (let i = 1; i < 5; i++) hline(x, y + Math.round(i * h / 5), w, rgb(0x22344d));
    for (let i = 1; i < 6; i++) vline(x + Math.round(i * w / 6), y, h, rgb(0x22344d));
    const pts = [[0.04, 0.10], [0.18, 0.16], [0.32, 0.14], [0.46, 0.26], [0.60, 0.24], [0.74, 0.38], [0.88, 0.48], [0.97, 0.52]];
    for (let i = 0; i + 1 < pts.length; i++)
      line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), rgb(0xff5a4d));
    for (const p of pts) circle(X(p[0]), Y(p[1]), 3, rgb(0xff5a4d), true);
    const rows = [["Taipei", "-6.2%"], ["Seoul", "-5.2%"], ["Tokyo", "-5.1%"], ["Hong Kong", "-1.9%"]];
    for (let i = 0; i < rows.length; i++) {
      const gx = i % 2 === 0 ? 0.05 : 0.52, gy = 0.58 + Math.floor(i / 2) * 0.14;
      drawText(rows[i][0], X(gx), Y(gy), 1, rgb(0xcfe0f2), false);
      drawText(rows[i][1], X(gx + 0.30), Y(gy), 1, rgb(0xff8a80), true);
    }
  } else if (kind === "ukeu") {
    fillRect(x, y, w, h, PANEL);
    // Union Jack (simplified)
    fillRect(X(0.04), Y(0.10), Math.round(w * 0.40), Math.round(h * 0.62), BLUE);
    line(X(0.04), Y(0.10), X(0.44), Y(0.72), WHITE); line(X(0.44), Y(0.10), X(0.04), Y(0.72), WHITE);
    fillRect(X(0.21), Y(0.10), Math.round(w * 0.06), Math.round(h * 0.62), WHITE);
    fillRect(X(0.04), Y(0.36), Math.round(w * 0.40), Math.round(h * 0.10), WHITE);
    fillRect(X(0.225), Y(0.10), Math.round(w * 0.03), Math.round(h * 0.62), RED);
    fillRect(X(0.04), Y(0.385), Math.round(w * 0.40), Math.round(h * 0.05), RED);
    // EU flag
    fillRect(X(0.56), Y(0.10), Math.round(w * 0.40), Math.round(h * 0.62), BLUE);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 - Math.PI / 2;
      circle(Math.round(X(0.76) + Math.cos(a) * w * 0.13), Math.round(Y(0.41) + Math.sin(a) * h * 0.20), 2, GOLD, true);
    }
    line(X(0.47), Y(0.41), X(0.53), Y(0.41), INK);
    line(X(0.50), Y(0.36), X(0.53), Y(0.41), INK);
    line(X(0.50), Y(0.46), X(0.53), Y(0.41), INK);
    drawText("FOOD · CARBON · VISAS", X(0.04), Y(0.80), 1, INK2, true);
  } else if (kind === "cop") {
    fillRect(x, y, w, h, rgb(0xdfe9e4));
    circle(X(0.30), Y(0.45), Math.round(h * 0.34), BLUE, true);
    poly([[X(0.16), Y(0.30)], [X(0.28), Y(0.28)], [X(0.34), Y(0.40)], [X(0.26), Y(0.50)], [X(0.18), Y(0.46)]], GREEN, true);
    poly([[X(0.34), Y(0.52)], [X(0.44), Y(0.50)], [X(0.46), Y(0.62)], [X(0.36), Y(0.64)]], GREEN, true);
    circle(X(0.30), Y(0.45), Math.round(h * 0.34), INK, false);
    // thermometer
    fillRect(X(0.72), Y(0.12), Math.round(w * 0.08), Math.round(h * 0.55), WHITE);
    rect(X(0.72), Y(0.12), Math.round(w * 0.08), Math.round(h * 0.55), INK);
    fillRect(X(0.72) + 2, Y(0.40), Math.round(w * 0.08) - 4, Math.round(h * 0.27) - 2, RED);
    circle(X(0.76), Y(0.72), Math.round(h * 0.10), RED, true);
    fillRect(X(0.06), Y(0.84), Math.round(w * 0.88), 12, RED);
    drawText("NO DEAL", X(0.10), Y(0.84) + 2, 1, WHITE, true);
  } else if (kind === "poland") {
    fillRect(x, y, w, h, rgb(0x9dbb7a));
    fillRect(x, Y(0.62), w, h - Math.round(h * 0.62), rgb(0x7da05e));
    dashedLine(X(0.06), Y(0.18), X(0.94), Y(0.30), RED, 5, 4);
    drawText("KH-101", X(0.08), Y(0.06), 1, REDD, true);
    poly([[X(0.42), Y(0.42)], [X(0.58), Y(0.46)], [X(0.62), Y(0.52)], [X(0.44), Y(0.52)]], rgb(0x5a5a55), true); // missile body
    line(X(0.62), Y(0.49), X(0.72), Y(0.44), rgb(0x5a5a55));
    circle(X(0.52), Y(0.60), 4, rgb(0x3d3a33), true);
    for (const fx of [0.12, 0.85]) {
      poly([[X(fx), Y(0.42)], [X(fx + 0.04), Y(0.30)], [X(fx + 0.08), Y(0.42)]], GREEN, true);
      fillRect(X(fx + 0.03), Y(0.42), 3, Math.round(h * 0.18), rgb(0x6b4a2a));
    }
    starburst(X(0.52), Y(0.52), 6, ORANGE);
  } else if (kind === "iraq") {
    fillRect(x, y, w, h, rgb(0xe8d9a8));
    circle(X(0.80), Y(0.20), Math.round(h * 0.12), GOLD, true);
    fillRect(x, Y(0.70), w, h - Math.round(h * 0.70), rgb(0xcbb27a));
    for (let i = 0; i < 3; i++) {
      const bx = X(0.10 + i * 0.28);
      fillRect(bx, Y(0.58), Math.round(w * 0.20), Math.round(h * 0.12), rgb(0x4a5d23));
      fillRect(bx + 6, Y(0.50), Math.round(w * 0.10), Math.round(h * 0.08), rgb(0x4a5d23));
      line(bx + Math.round(w * 0.16), Y(0.52), bx + Math.round(w * 0.26), Y(0.48), rgb(0x2e3a16));
      for (let k = 0; k < 4; k++) circle(bx + 6 + k * 9, Y(0.70), 3, rgb(0x2e3a16), true);
    }
    for (const fx of [0.86]) {
      fillRect(X(fx), Y(0.42), 3, Math.round(h * 0.28), rgb(0x6b4a2a));
      for (let k = 0; k < 5; k++) line(X(fx), Y(0.42), X(fx - 0.08 + k * 0.04), Y(0.34), GREEN);
    }
  } else if (kind === "italy") {
    fillRect(x, y, w, h, rgb(0xe8e2d2));
    for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) {
      const hx = X(0.06 + i * 0.12), hy = Y(0.55 + r * 0.14);
      circle(hx, hy, 4, r === 1 ? RED : INK, true);
      fillRect(hx - 4, hy + 4, 8, Math.round(h * 0.10), r === 1 ? RED : INK2);
    }
    for (const fx of [0.16, 0.50, 0.84]) {
      vline(X(fx), Y(0.22), Math.round(h * 0.26), INK);
      fillRect(X(fx - 0.07), Y(0.20), Math.round(w * 0.14), 12, WHITE);
      rect(X(fx - 0.07), Y(0.20), Math.round(w * 0.14), 12, INK);
    }
    drawText("SCIOPERO", X(0.06), Y(0.86), 1, REDD, true);
  } else if (kind === "japan") {
    fillRect(x, y, w, h, rgb(0xf3ead2));
    circle(X(0.30), Y(0.32), Math.round(h * 0.22), RED, true);
    const bars = [0.25, 0.35, 0.30, 0.45, 0.62];
    for (let i = 0; i < bars.length; i++)
      fillRect(X(0.12 + i * 0.17), Y(0.85 - bars[i]), Math.round(w * 0.11), Math.round(h * bars[i]), i === 4 ? RED : NAVY);
    drawText("CPI", X(0.70), Y(0.12), 1, INK2, true);
  } else if (kind === "seoul") {
    fillRect(x, y, w, h, rgb(0xdfe6ee));
    fillRect(X(0.10), Y(0.30), Math.round(w * 0.80), Math.round(h * 0.12), NAVY);
    poly([[X(0.10), Y(0.30)], [X(0.50), Y(0.12)], [X(0.90), Y(0.30)]], NAVY, true);
    for (let i = 0; i < 5; i++) fillRect(X(0.16 + i * 0.16), Y(0.42), 5, Math.round(h * 0.34), WHITE);
    fillRect(X(0.08), Y(0.76), Math.round(w * 0.84), Math.round(h * 0.08), NAVY);
  } else if (kind === "kenya") {
    fillRect(x, y, w, h, rgb(0xf6e3b4));
    circle(X(0.78), Y(0.22), Math.round(h * 0.14), ORANGE, true);
    poly([[X(0.30), Y(0.85)], [X(0.50), Y(0.15)], [X(0.70), Y(0.85)]], rgb(0x3d3a33), false);
    line(X(0.36), Y(0.68), X(0.64), Y(0.68), rgb(0x3d3a33));
    line(X(0.42), Y(0.48), X(0.58), Y(0.48), rgb(0x3d3a33));
    line(X(0.50), Y(0.15), X(0.50), Y(0.05), rgb(0x3d3a33));
    fillRect(x, Y(0.85), w, h - Math.round(h * 0.85), rgb(0x8a6b3d));
  } else if (kind === "bukele") {
    fillRect(x, y, w, h, rgb(0xdde8f0));
    fillRect(X(0.28), Y(0.42), Math.round(w * 0.44), Math.round(h * 0.40), NAVY);
    fillRect(X(0.38), Y(0.36), Math.round(w * 0.24), 5, INK);
    line(X(0.36), Y(0.62), X(0.46), Y(0.72), WHITE);
    line(X(0.46), Y(0.72), X(0.66), Y(0.48), WHITE);
    drawText("2027", X(0.68), Y(0.12), 1, INK2, true);
  } else if (kind === "cricket") {
    fillRect(x, y, w, h, rgb(0x7fb069));
    fillRect(X(0.30), Y(0.10), Math.round(w * 0.40), h, rgb(0xd9c08a));
    for (let i = 0; i < 3; i++) fillRect(X(0.46 + i * 0.05), Y(0.14), 3, Math.round(h * 0.16), GOLD);
    line(X(0.55), Y(0.55), X(0.72), Y(0.82), rgb(0x8a6b3d));
    fillRect(X(0.70), Y(0.80), Math.round(w * 0.10), 5, rgb(0x8a6b3d));
    circle(X(0.24), Y(0.30), 5, RED, true);
    drawText("118", X(0.06), Y(0.78), 2, INK, true);
  } else if (kind === "tanker") {
    fillRect(x, y, w, h, rgb(0x2f6da3));
    for (let i = 0; i < 20; i++) hline(X(rnd()), Y(0.15 + rnd() * 0.7), 10 + Math.round(rnd() * 16), rgb(0x4a86b8));
    fillRect(X(0.06), Y(0.55), Math.round(w * 0.88), Math.round(h * 0.16), rgb(0x8c2f26));
    fillRect(X(0.10), Y(0.44), Math.round(w * 0.20), Math.round(h * 0.11), rgb(0x2e7d32));
    fillRect(X(0.34), Y(0.44), Math.round(w * 0.20), Math.round(h * 0.11), GOLD);
    fillRect(X(0.58), Y(0.44), Math.round(w * 0.20), Math.round(h * 0.11), rgb(0xdddddd));
    fillRect(X(0.80), Y(0.38), Math.round(w * 0.10), Math.round(h * 0.17), WHITE);
    for (const fx of [0.30, 0.48, 0.66]) {
      poly([[X(fx), Y(0.44)], [X(fx + 0.03), Y(0.24)], [X(fx + 0.07), Y(0.44)]], ORANGE, true);
      poly([[X(fx + 0.02), Y(0.44)], [X(fx + 0.04), Y(0.32)], [X(fx + 0.06), Y(0.44)]], GOLD, true);
    }
  } else if (kind === "delhi") {
    fillRect(x, y, w, h, rgb(0xf0e2c8));
    fillRect(X(0.30), Y(0.30), Math.round(w * 0.40), Math.round(h * 0.55), rgb(0xb08d57));
    poly([[X(0.30), Y(0.30)], [X(0.38), Y(0.16)], [X(0.62), Y(0.16)], [X(0.70), Y(0.30)]], rgb(0xb08d57), true);
    fillRect(X(0.44), Y(0.42), Math.round(w * 0.12), Math.round(h * 0.43), rgb(0x5a3d1e));
    circle(X(0.50), Y(0.42), Math.round(w * 0.06), rgb(0x5a3d1e), true);
    fillRect(X(0.12), Y(0.36), 4, Math.round(h * 0.30), rgb(0x2e7d32));
    fillRect(X(0.12), Y(0.36), Math.round(w * 0.10), 6, rgb(0xff9933));
    fillRect(X(0.12), Y(0.42), Math.round(w * 0.10), 6, WHITE);
    fillRect(X(0.12), Y(0.48), Math.round(w * 0.10), 6, rgb(0x138808));
    fillRect(X(0.84), Y(0.36), 4, Math.round(h * 0.30), rgb(0x2e7d32));
    fillRect(X(0.84), Y(0.36), Math.round(w * 0.10), 6, rgb(0x1d4e89));
    fillRect(X(0.84), Y(0.42), Math.round(w * 0.10), 6, WHITE);
    fillRect(X(0.84), Y(0.48), Math.round(w * 0.10), 6, GOLD);
  }
}

// ---------- world map ----------
const MAP_PINS = [
  [1, 30.5, 50.4], [2, 84.9, 19.3], [3, 121, 25], [4, 4.35, 50.85], [5, 30.7, 36.9],
  [6, 22.7, 50.6], [7, 44.2, 32.8], [8, 12.5, 41.9], [9, 139.7, 35.7], [10, 127, 37.5],
  [11, 36, 3.5], [12, -89.2, 13.7], [13, 174.8, -41.3], [14, 56.5, 26.5], [15, 77.2, 28.6],
];
function drawMap(mx, my, mw, mh) {
  const px = (lon) => mx + ((lon + 180) / 360) * mw;
  const py = (lat) => my + ((90 - lat) / 180) * mh;
  const P = (arr) => arr.map(([lo, la]) => [px(lo), py(la)]);
  fillRect(mx, my, mw, mh, rgb(0xe9f0f4));
  // graticule
  for (let lo = -150; lo <= 150; lo += 30) vline(Math.round(px(lo)), my, mh, rgb(0xd5e2ea));
  for (let la = -60; la <= 60; la += 30) hline(mx, Math.round(py(la)), mw, rgb(0xd5e2ea));
  const NA = [[-168, 66], [-140, 70], [-125, 71], [-110, 68], [-95, 69], [-85, 66], [-75, 62], [-65, 60], [-55, 52], [-60, 47], [-70, 44], [-75, 39], [-80, 32], [-84, 30], [-90, 21], [-97, 16], [-105, 20], [-110, 24], [-117, 33], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 60]];
  const SA = [[-78, 7], [-62, 9], [-52, 5], [-50, 0], [-44, -3], [-38, -5], [-35, -8], [-40, -20], [-48, -28], [-58, -35], [-65, -41], [-70, -50], [-73, -53], [-70, -40], [-72, -30], [-80, -18], [-81, -6], [-80, 2]];
  const AF = [[-17, 15], [-16, 20], [-10, 31], [-5, 35], [10, 37], [20, 32], [30, 31], [35, 28], [43, 12], [51, 11], [48, 2], [40, -5], [40, -15], [35, -20], [32, -29], [20, -35], [16, -28], [12, -18], [9, -1], [9, 4], [-8, 5], [-13, 8], [-17, 12]];
  const EU = [[-10, 36], [-9, 43], [-2, 48], [-4, 50], [0, 50], [3, 52], [8, 57], [10, 59], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [32, 70], [25, 71], [18, 69], [12, 65], [5, 60], [5, 58], [8, 55], [10, 54], [8, 48], [12, 45], [19, 45], [23, 40], [26, 38], [22, 37], [15, 38], [12, 42], [7, 44], [3, 43], [-1, 38]];
  const AS = [[30, 70], [45, 68], [60, 69], [75, 72], [90, 75], [105, 77], [120, 73], [135, 72], [150, 70], [162, 66], [178, 65], [170, 60], [158, 53], [142, 50], [140, 40], [130, 38], [127, 35], [122, 31], [120, 28], [110, 20], [105, 9], [100, 6], [98, 10], [92, 16], [88, 22], [80, 13], [77, 8], [75, 15], [70, 20], [62, 25], [58, 26], [52, 28], [48, 30], [44, 29], [38, 31], [35, 36], [30, 36], [27, 38], [30, 45], [28, 48], [30, 55], [32, 62]];
  const AU = [[113, -22], [114, -30], [115, -35], [120, -34], [124, -33], [130, -32], [135, -35], [140, -38], [146, -39], [150, -37], [153, -32], [153, -27], [146, -19], [142, -11], [137, -12], [132, -11], [126, -14], [120, -20], [114, -22]];
  const GL = [[-45, 76], [-32, 76], [-22, 76], [-20, 70], [-25, 68], [-40, 70], [-52, 72], [-58, 74], [-55, 78], [-50, 80], [-45, 80]];
  for (const cont of [NA, SA, AF, EU, AS, AU, GL]) {
    poly(P(cont), LAND, true);
    poly(P(cont), rgb(0x9a8a68), false);
  }
  // pins 1-15
  for (const [n, lo, la] of MAP_PINS) {
    const cx = Math.round(px(lo)), cy = Math.round(py(la));
    const s = String(n);
    circle(cx, cy, 8, RED, true);
    circle(cx, cy, 8, WHITE, false);
    drawText(s, cx - Math.round(textWidth(s, 1) / 2), cy - 4, 1, WHITE, true);
  }
}

// ---------- layout ----------
const MX = 24;            // left margin
const CW = 976;           // content width (24..1000)
const RX = MX + CW;       // right edge = 1000

function paperGrain() {
  // Subtle deterministic grain so the sheet is not flat colour.
  for (let i = 0; i < 55000; i++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
    const v = rnd();
    if (v < 0.5) setPx(x, y, rgb(0xefe7d3));
    else setPx(x, y, rgb(0xe9dfc6));
  }
  // faint horizontal rules across the sheet
  for (let y = 40; y < H; y += 96) hline(0, y, W, rgb(0xefe7d3));
}

function topStrip() {
  drawText("THE WORLD IN ONE DAY", MX, 6, 1, RED, true);
  const r = "58 STORIES · 7 REGIONS · EVERY ONE DATED FRIDAY 20 NOVEMBER 2026";
  drawText(r, RX - textWidth(r, 1), 6, 1, INK2, true);
  fillRect(MX, 20, CW, 2, INK);
}

function masthead() {
  const t = "Friday 20 November 2026";
  drawTextCentered(t, 512, 28, 6, INK, true);
  fillRect(MX, 88, CW, 1, INK);
  const sub = "Russian missiles hit Kyiv's bridges · Cyclone Akvan strikes India · An AI sell-off sinks Asia's markets · UK and EU seal a deal";
  drawTextCentered(sub, 512, 96, 1, INK2, true);
  fillRect(MX, 110, CW, 2, INK);
}

function bigNumStrip() {
  const y = 116, cellW = Math.floor(CW / 6);
  for (let i = 0; i < BIGNUMS.length; i++) {
    const cx = MX + i * cellW;
    if (i > 0) vline(cx - 2, y + 2, 48, LINE);
    drawText(BIGNUMS[i][0], cx + 4, y + 2, 3, i === 2 ? RED : INK, true);
    drawPara(BIGNUMS[i][1], cx + 4, y + 32, cellW - 10, 1, INK2, 10, false);
  }
  fillRect(MX, 168, CW, 1, INK);
}

function regionStrip() {
  const counts = regionCounts();
  let total = 0;
  for (const r of REGION_ORDER) total += counts[r];
  // chips, centred
  const chips = REGION_ORDER.map((r) => ({ label: r + " " + counts[r], color: REGION_COLOR[r] }));
  let tw = 0;
  for (const c of chips) tw += textWidth(c.label, 1) + 14;
  tw += (chips.length - 1) * 6;
  let x = Math.round(512 - tw / 2);
  const y = 174;
  for (const c of chips) {
    const w = textWidth(c.label, 1) + 14;
    fillRect(x, y, w, 16, c.color);
    drawText(c.label, x + 7, y + 4, 1, WHITE, true);
    x += w + 6;
  }
  fillRect(MX, 194, CW, 1, INK);
  return total;
}

function timeline() {
  const y = 200;
  fillRect(MX, y, 96, 16, RED);
  drawText("THE DAY IN UTC", MX + 5, y + 4, 1, WHITE, true);
  const startX = MX + 108, avail = RX - startX, step = Math.floor(avail / TIMELINE.length);
  for (let i = 0; i < TIMELINE.length; i++) {
    const ex = startX + i * step;
    drawText(TIMELINE[i][0], ex, y + 1, 1, RED, true);
    drawPara(TIMELINE[i][1], ex, y + 12, step - 8, 1, INK2, 10, false);
  }
  fillRect(MX, 222, CW, 1, INK);
}

function kickerBox(x, y, text, s) {
  const w = textWidth(text, s) + 10;
  fillRect(x, y, w, s === 2 ? 20 : 13, RED);
  drawText(text, x + 5, y + (s === 2 ? 4 : 2), s, WHITE, true);
  return w;
}

function leadPanel(L, x, y) {
  const w = 318, artH = 104;
  rect(x, y, w, 216, INK);
  art(x + 1, y + 1, w - 2, artH, L.art);
  kickerBox(x + 5, y + 5, L.kicker, 2);
  // big label, bottom-right of the art
  const bw = textWidth(L.big, 1) + 10;
  fillRect(x + w - bw - 5, y + artH - 18, bw, 14, WHITE);
  rect(x + w - bw - 5, y + artH - 18, bw, 14, INK);
  drawText(L.big, x + w - bw, y + artH - 15, 1, INK, true);
  // tag bar: label + source
  fillRect(x + 1, y + 106, w - 2, 14, INK);
  drawText(L.label + " · " + L.src, x + 6, y + 109, 1, WHITE, true);
  // place line
  drawText(L.n + "  " + L.place + " · " + L.field, x + 6, y + 126, 1, RED, true);
  // headline
  drawPara(L.head, x + 6, y + 140, w - 12, 2, INK, 20, true);
  // body
  drawPara(L.body, x + 6, y + 184, w - 12, 1, INK2, 10, false);
}

function smallPanel(P, x, y) {
  const w = 160, artH = 46;
  rect(x, y, w, 122, INK);
  art(x + 1, y + 1, w - 2, artH, P.art);
  kickerBox(x + 4, y + 4, P.kicker, 1);
  // tag bar: label + source
  fillRect(x + 1, y + artH + 1, w - 2, 12, INK);
  drawText(P.label + " · " + P.src, x + 5, y + artH + 3, 1, WHITE, false);
  // place line
  drawText(P.n + " " + P.place + " · " + P.field, x + 4, y + 62, 1, RED, true);
  // headline (2 lines)
  drawPara(P.head, x + 4, y + 74, w - 8, 1, INK, 10, true);
  // body (2 lines)
  drawPara(P.body, x + 4, y + 96, w - 8, 1, INK2, 10, false);
}

function mapAndBriefs() {
  const y = 700;
  drawText("WHERE IT HAPPENED", MX, y, 1, RED, true);
  drawText("ALSO ON FRIDAY 20 NOVEMBER — 43 MORE STORIES", 370, y, 1, RED, true);
  rect(MX, y + 14, 330, 200, INK);
  drawMap(MX + 1, y + 15, 328, 198);
  drawText("Each number is with that number on this page.", MX, y + 218, 1, GREY, false);
  // briefs, two columns
  const colX = [370, 690], colW = 306;
  for (let c = 0; c < 2; c++) {
    const items = c === 0 ? BRIEFS.slice(0, 22) : BRIEFS.slice(22);
    for (let i = 0; i < items.length; i++) {
      const b = items[i];
      const yy = y + 16 + i * 10;
      const num = String(b[0]);
      drawText(num, colX[c], yy, 1, RED, true);
      drawText(b[1] + ": " + b[2] + " (" + b[3] + ")", colX[c] + textWidth(num + " ", 1), yy, 1, INK2, false);
    }
  }
}

function dateCheck() {
  const y = 932;
  fillRect(MX, y, CW, 56, rgb(0xfdf3f2));
  rect(MX, y, CW, 56, RED);
  drawText("DATE CHECK · LEFT OUT AS THURSDAY 19 NOVEMBER'S NEWS:", MX + 6, y + 4, 1, REDD, true);
  drawPara(DATE_LEFT, MX + 6, y + 16, CW - 12, 1, INK2, 10, false);
  drawText("NOT YET HAPPENED, SO NOT SHOWN: " + DATE_NOTYET, MX + 6, y + 42, 1, REDD, true);
}

function footer() {
  drawText("Every story here happened, or was first reported, on Friday 20 November 2026. Officials' counts are attributed.", MX, 994, 1, INK2, false);
  drawPara("Sources: Reuters, AP, AFP, BBC, Al Jazeera, Anadolu, IMD, The Hindu, PTI, Xinhua, Korea Herald, allAfrica, UKMTO, ESA, ICC, UN News, Sky News, Channels TV, RTE, Autosport, FIFA, ATP, BWF, 24/7 Wall St · Original drawings", MX, 1006, CW, 1, GREY, 10, false);
}

// ---------- main ----------
function main() {
  fillRect(0, 0, W, H, PAPER);
  paperGrain();
  topStrip();
  masthead();
  bigNumStrip();
  const total = regionStrip();
  timeline();
  // 3 lead panels
  const leadY = 226;
  for (let i = 0; i < LEADS.length; i++) leadPanel(LEADS[i], MX + i * 329, leadY);
  // 12 small panels, 2 rows x 6
  const rowY = [448, 574];
  for (let i = 0; i < PANELS.length; i++) {
    const row = Math.floor(i / 6), col = i % 6;
    smallPanel(PANELS[i], MX + col * 163, rowY[row]);
  }
  mapAndBriefs();
  dateCheck();
  footer();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  const size = writePNG(path.join(outDir, "entry.png"));
  // eslint-disable-next-line no-console
  console.log("wrote entry.png " + size + " bytes, stories=" + total + " (leads 3 + panels 12 + briefs 43)");
}
main();
