import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const res = path.join(root, "android", "app", "src", "main", "res");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function icon(size) {
  const px = Buffer.alloc(size * size * 4);
  const blue = [0, 155, 255, 255];
  const white = [255, 255, 255, 255];
  const navy = [11, 31, 51, 255];
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const outer = size * 0.36;
  const inner = size * 0.24;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      let color = blue;
      if (dist <= outer && dist >= inner) color = white;
      else if (dist < inner) {
        const up = dy < 0 && Math.abs(dx) < -dy * 0.42 && dy > -outer * 0.7;
        const down = dy > size * 0.02 && Math.abs(dx) < dy * 0.22 && dy < outer * 0.45;
        color = up ? navy : down ? white : blue;
      }
      const i = (y * size + x) * 4;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = color[3];
    }
  }
  return png(size, size, px);
}

const sizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

if (!fs.existsSync(res)) {
  console.error("Android res folder is missing. Run npx cap add android first.");
  process.exit(1);
}

for (const [folder, size] of Object.entries(sizes)) {
  const dir = path.join(res, folder);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of [
    "ic_launcher.webp",
    "ic_launcher_round.webp",
    "ic_launcher_foreground.webp",
    "ic_launcher_foreground.png",
  ]) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  const bytes = icon(size);
  fs.writeFileSync(path.join(dir, "ic_launcher.png"), bytes);
  fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), bytes);
}

const v24 = path.join(res, "drawable-v24", "ic_launcher_foreground.xml");
if (fs.existsSync(v24)) fs.unlinkSync(v24);

const drawable = path.join(res, "drawable");
fs.mkdirSync(drawable, { recursive: true });
fs.writeFileSync(
  path.join(drawable, "ic_launcher_foreground.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="#FFFFFF" android:pathData="M54,30a24,24 0 1,1 0,48a24,24 0 1,1 0,-48z"/>
    <path android:fillColor="#009BFF" android:pathData="M54,40a14,14 0 1,1 0,28a14,14 0 1,1 0,-28z"/>
    <path android:fillColor="#0B1F33" android:pathData="M54,34 L60,54 L54,49 L48,54 Z"/>
</vector>
`,
);

const anydpi = path.join(res, "mipmap-anydpi-v26");
fs.mkdirSync(anydpi, { recursive: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.writeFileSync(path.join(anydpi, "ic_launcher.xml"), adaptive);
fs.writeFileSync(path.join(anydpi, "ic_launcher_round.xml"), adaptive);

console.log("Wrote Buildesk Compass launcher icons.");
