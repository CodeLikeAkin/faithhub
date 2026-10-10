// Draws the home-screen icons from public/hofng-logo.svg: the navy logo
// centred on white. No dependencies — the logo is a tracing made only of
// straight lines (M / l / z), so it's filled here directly and anti-aliased
// by sampling each pixel row 16 times.
//
//   node scripts/pwa-icons.mjs
//
// Writes public/icons/icon-192.png, icon-512.png, icon-maskable-512.png and
// app/apple-icon.png (180, which Next links as the apple-touch-icon). Re-run
// it if the logo file ever changes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const svg = readFileSync("public/hofng-logo.svg", "utf8");
const fill = svg.match(/fill="#([0-9a-f]{6})"/i)[1].match(/../g).map((h) => parseInt(h, 16));
const shapes = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => parsePath(m[1]));

const points = shapes.flat(2);
const bounds = {
  minX: Math.min(...points.map((p) => p[0])),
  maxX: Math.max(...points.map((p) => p[0])),
  minY: Math.min(...points.map((p) => p[1])),
  maxY: Math.max(...points.map((p) => p[1])),
};
const centre = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
const width = bounds.maxX - bounds.minX;
// The farthest any ink sits from the centre — what a maskable icon's circle must hold.
const reach = Math.max(...points.map(([x, y]) => Math.hypot(x - centre[0], y - centre[1])));

// "any" icons and the apple-touch-icon: the logo spans 74% of the width, so
// iOS's rounded corners and Android's white plate never touch it.
const framed = (size) => ({ size, scale: (size * 0.74) / width });
// Maskable: launchers may crop to any shape inside the central circle of
// radius 40%; keep every point of the logo inside 38%.
const maskable = (size) => ({ size, scale: (size * 0.38) / reach });

const outputs = [
  ["public/icons/icon-192.png", framed(192)],
  ["public/icons/icon-512.png", framed(512)],
  ["public/icons/icon-maskable-512.png", maskable(512)],
  ["app/apple-icon.png", framed(180)],
];

mkdirSync("public/icons", { recursive: true });
for (const [file, { size, scale }] of outputs) {
  writeFileSync(file, encodePng(size, draw(size, scale)));
  console.log(`${file}  ${size}x${size}`);
}

/** Subpaths of one <path>, as arrays of [x, y]. Only M/m, L/l and Z/z are expected. */
function parsePath(d) {
  const tokens = d.match(/[a-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);
  const subpaths = [];
  let cmd = null;
  let x = 0;
  let y = 0;
  let start = [0, 0];
  let current = null;
  for (let i = 0; i < tokens.length; ) {
    if (/[a-z]/i.test(tokens[i])) {
      cmd = tokens[i++];
      if (cmd === "z" || cmd === "Z") {
        [x, y] = start;
        current = null;
        continue;
      }
      if (!"MmLl".includes(cmd)) throw new Error(`Unsupported path command "${cmd}" — extend parsePath()`);
    }
    const nx = Number(tokens[i++]);
    const ny = Number(tokens[i++]);
    const relative = cmd === "m" || cmd === "l";
    x = relative ? x + nx : nx;
    y = relative ? y + ny : ny;
    if (cmd === "M" || cmd === "m") {
      start = [x, y];
      current = [[x, y]];
      subpaths.push(current);
      cmd = cmd === "m" ? "l" : "L"; // further pairs after a moveto are linetos
    } else {
      current.push([x, y]);
    }
  }
  return subpaths;
}

/** RGB pixels: white, with each shape filled (even-odd) in the logo colour. */
function draw(size, scale) {
  const toPixel = ([x, y]) => [size / 2 + (x - centre[0]) * scale, size / 2 + (y - centre[1]) * scale];
  const clear = new Float32Array(size * size).fill(1); // how much white shows through
  const SAMPLES = 16;

  for (const subpaths of shapes) {
    const edges = [];
    for (const sub of subpaths) {
      const pts = sub.map(toPixel);
      for (let i = 0; i < pts.length; i++) edges.push([pts[i], pts[(i + 1) % pts.length]]);
    }
    const cover = new Float32Array(size * size);
    for (let row = 0; row < size; row++) {
      for (let s = 0; s < SAMPLES; s++) {
        const sy = row + (s + 0.5) / SAMPLES;
        const xs = [];
        for (const [[x0, y0], [x1, y1]] of edges) {
          if ((y0 <= sy && sy < y1) || (y1 <= sy && sy < y0)) xs.push(x0 + ((sy - y0) * (x1 - x0)) / (y1 - y0));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) addSpan(cover, row * size, size, xs[k], xs[k + 1], 1 / SAMPLES);
      }
    }
    for (let i = 0; i < clear.length; i++) clear[i] *= 1 - Math.min(1, cover[i]);
  }

  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0; i < clear.length; i++) {
    const ink = 1 - clear[i];
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(255 + (fill[c] - 255) * ink);
  }
  return rgb;
}

/** Adds `weight` of coverage across [a, b) on one pixel row, with exact partial pixels at the ends. */
function addSpan(cover, offset, size, a, b, weight) {
  a = Math.max(0, a);
  b = Math.min(size, b);
  if (b <= a) return;
  const ia = Math.floor(a);
  const ib = Math.floor(b);
  if (ia === ib) {
    cover[offset + ia] += (b - a) * weight;
    return;
  }
  cover[offset + ia] += (ia + 1 - a) * weight;
  for (let i = ia + 1; i < ib; i++) cover[offset + i] += weight;
  if (ib < size) cover[offset + ib] += (b - ib) * weight;
}

/** A minimal 8-bit RGB PNG. */
function encodePng(size, rgb) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // bit depth 8, colour type RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
