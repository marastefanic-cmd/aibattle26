// Generates assets/icon.png and assets/icon.ico (a terracotta die) with no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 256;

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Draw: rounded terracotta square, five white pips (a die showing 5).
const img = Buffer.alloc(SIZE * SIZE * 4);
const radius = 48, pad = 8;
const pips = [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]].map(([x, y]) => [x * SIZE, y * SIZE]);
const pipR = 22;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    // rounded rect coverage
    const cx = Math.min(Math.max(x, pad + radius), SIZE - pad - radius);
    const cy = Math.min(Math.max(y, pad + radius), SIZE - pad - radius);
    const d = Math.hypot(x - cx, y - cy);
    const cover = Math.min(1, Math.max(0, radius - d + 0.5));
    if (cover <= 0) continue;
    let r = 181, g = 72, b = 47; // --game terracotta
    let white = 0;
    for (const [px, py] of pips) {
      const pd = Math.hypot(x + 0.5 - px, y + 0.5 - py);
      white = Math.max(white, Math.min(1, Math.max(0, pipR - pd + 0.5)));
    }
    r = Math.round(r + (255 - r) * white); g = Math.round(g + (255 - g) * white); b = Math.round(b + (255 - b) * white);
    img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = Math.round(255 * cover);
  }
}

const pngBuf = png(SIZE, SIZE, img);
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets', 'icon.png'), pngBuf);

// ICO container with a single PNG-compressed 256x256 entry (supported since Windows Vista).
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = 0; entry[1] = 0; entry[2] = 0; entry[3] = 0; // 256 encoded as 0
entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(pngBuf.length, 8); entry.writeUInt32LE(22, 12);
fs.writeFileSync(path.join(root, 'assets', 'icon.ico'), Buffer.concat([header, entry, pngBuf]));
console.log('wrote assets/icon.png and assets/icon.ico');
