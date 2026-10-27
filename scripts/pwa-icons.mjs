// Draws the home-screen icons from public/hofng-logo.svg: the navy logo
// centred on white. No dependencies — the logo is a tracing made only of
// straight lines (M / l / z), so it's filled here directly and anti-aliased
// by sampling each pixel row 16 times.
//
//   node scripts/pwa-icons.mjs
//
// Writes public/icons/icon-192.png, icon-512.png, icon-maskable-512.png and
// apple-180.png (the apple-touch-icon, linked from app/layout.js), plus the
// admin console's set (admin-*.png, app/admin/layout.js), plus the iOS launch
// images (public/splash/*.png and lib/startup-images.js, which lists them for
// app/layout.js). Re-run it if the logo file or the splash logo size changes.
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

// The member app: navy logo on white. The admin app is the reverse (white logo
// on the console's deep navy) so the two icons can't be mixed up on a home screen.
const MEMBER = { ink: fill, bg: [255, 255, 255] };
const ADMIN = { ink: [255, 255, 255], bg: [0x10, 0x2a, 0x4e] };

const outputs = [
  ["public/icons/icon-192.png", framed(192), MEMBER],
  ["public/icons/icon-512.png", framed(512), MEMBER],
  ["public/icons/icon-maskable-512.png", maskable(512), MEMBER],
  ["public/icons/apple-180.png", framed(180), MEMBER],
  ["public/icons/admin-192.png", framed(192), ADMIN],
  ["public/icons/admin-512.png", framed(512), ADMIN],
  ["public/icons/admin-maskable-512.png", maskable(512), ADMIN],
  ["public/icons/admin-apple-180.png", framed(180), ADMIN],
];

mkdirSync("public/icons", { recursive: true });
for (const [file, { size, scale }, colours] of outputs) {
  writeFileSync(file, encodePng(size, size, draw(size, size, scale, colours)));
  console.log(`${file}  ${size}x${size}`);
}

// iOS launch images. Without one for the exact screen, an installed app opens
// on plain white. Each is the splash's first frame (components/splash/): white,
// the logo clamp(190px, 56vw, 290px) wide, its 208x146 box centred in the page.
// The page starts under the status bar ("default" style), so its centre sits
// half a status bar below the screen's.
//   [width pt, height pt, pixel ratio, status bar pt]
const PHONES = [
  [440, 956, 3, 62], [402, 874, 3, 62], // 16 Pro Max, 16 Pro
  [430, 932, 3, 59], [393, 852, 3, 59], // 14 Pro Max / 15 Plus / 16 Plus, 14 Pro / 15 / 16
  [428, 926, 3, 47], [390, 844, 3, 47], // 12-13 Pro Max / 14 Plus, 12-14
  [414, 896, 3, 44], [375, 812, 3, 44], // XS Max / 11 Pro Max, X / XS / 11 Pro / minis
  [414, 896, 2, 48], // XR / 11
  [414, 736, 3, 20], [375, 667, 2, 20], [320, 568, 2, 20], // Plus, 8 / SE 2-3, SE 1
];
// iPads open in either orientation (the app is reviewed in landscape).
const IPADS = [[1032, 1376], [1024, 1366], [834, 1210], [834, 1194], [820, 1180], [810, 1080], [768, 1024], [744, 1133]];
const screens = [
  ...PHONES.map(([w, h, dpr, bar]) => ({ w, h, dpr, bar, orientation: "portrait", dw: w, dh: h })),
  ...IPADS.flatMap(([w, h]) => [
    { w, h, dpr: 2, bar: 24, orientation: "portrait", dw: w, dh: h },
    { w: h, h: w, dpr: 2, bar: 24, orientation: "landscape", dw: w, dh: h },
  ]),
];

mkdirSync("public/splash", { recursive: true });
const startup = [];
for (const { w, h, dpr, bar, orientation, dw, dh } of screens) {
  const [pw, ph] = [w * dpr, h * dpr];
  const logoWidth = Math.min(290, Math.max(190, w * 0.56));
  const at = [pw / 2, ((h + bar) / 2) * dpr];
  const file = `apple-${pw}x${ph}.png`;
  writeFileSync(`public/splash/${file}`, encodePng(pw, ph, draw(pw, ph, (logoWidth * dpr) / 208, MEMBER, [104, 73], at)));
  startup.push({
    url: `/splash/${file}`,
    media: `(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`,
  });
  console.log(`public/splash/${file}  ${pw}x${ph}`);
}
writeFileSync(
  "lib/startup-images.js",
  `// Generated by scripts/pwa-icons.mjs — don't edit by hand.\n// iOS launch images for app/layout.js (metadata.appleWebApp.startupImage).\nexport const STARTUP_IMAGES = ${JSON.stringify(startup, null, 2)};\n`
);
console.log(`lib/startup-images.js  ${startup.length} images`);

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

/**
 * RGB pixels, w x h: the background colour, with each shape filled (even-odd)
 * in the ink colour. The logo point `anchor` lands on pixel `at`.
 */
function draw(w, h, scale, { ink: inkColour, bg }, anchor = centre, at = [w / 2, h / 2]) {
  const toPixel = ([x, y]) => [at[0] + (x - anchor[0]) * scale, at[1] + (y - anchor[1]) * scale];
  const clear = new Float32Array(w * h).fill(1); // how much white shows through
  const SAMPLES = 16;
  // Only the rows the logo covers need scanning (most of a launch image is blank).
  const firstRow = Math.max(0, Math.floor(toPixel([0, bounds.minY])[1]));
  const lastRow = Math.min(h - 1, Math.ceil(toPixel([0, bounds.maxY])[1]));

  for (const subpaths of shapes) {
    const edges = [];
    for (const sub of subpaths) {
      const pts = sub.map(toPixel);
      for (let i = 0; i < pts.length; i++) edges.push([pts[i], pts[(i + 1) % pts.length]]);
    }
    const cover = new Float32Array(w * h);
    for (let row = firstRow; row <= lastRow; row++) {
      for (let s = 0; s < SAMPLES; s++) {
        const sy = row + (s + 0.5) / SAMPLES;
        const xs = [];
        for (const [[x0, y0], [x1, y1]] of edges) {
          if ((y0 <= sy && sy < y1) || (y1 <= sy && sy < y0)) xs.push(x0 + ((sy - y0) * (x1 - x0)) / (y1 - y0));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) addSpan(cover, row * w, w, xs[k], xs[k + 1], 1 / SAMPLES);
      }
    }
    for (let i = 0; i < clear.length; i++) clear[i] *= 1 - Math.min(1, cover[i]);
  }

  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < clear.length; i++) {
    const ink = 1 - clear[i];
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(bg[c] + (inkColour[c] - bg[c]) * ink);
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
function encodePng(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
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
