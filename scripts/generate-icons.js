import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, color) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(2, 9); // color type 2 (Truecolor RGB)
  ihdr.writeUInt8(0, 10); // compression method 0
  ihdr.writeUInt8(0, 11); // filter method 0
  ihdr.writeUInt8(0, 12); // interlace method 0

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = data.length;
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(len, 0);

    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    const crc = crc32(combined);
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([lenBuf, combined, crcBuf]);
  }

  function crc32(buf) {
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // Raw image scanlines: filter byte (0) + width * 3 bytes
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);

  const [r, g, b] = color;
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 3;
      // Draw border & calendar inner icon
      const isMargin = x < 8 || x >= width - 8 || y < 8 || y >= height - 8;
      const isAccent = (x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.35);
      const isGrid = (x % 32 < 4) || (y % 32 < 4);
      if (isMargin) {
        rawData[pxOffset] = 0x6b;
        rawData[pxOffset + 1] = 0x7c;
        rawData[pxOffset + 2] = 0xff;
      } else if (isAccent) {
        rawData[pxOffset] = 0xeb;
        rawData[pxOffset + 1] = 0xe4;
        rawData[pxOffset + 2] = 0xd8;
      } else if (isGrid) {
        rawData[pxOffset] = 0x2e;
        rawData[pxOffset + 1] = 0x32;
        rawData[pxOffset + 2] = 0x3a;
      } else {
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressedData);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const pub = path.resolve('public');
if (!fs.existsSync(pub)) fs.mkdirSync(pub, { recursive: true });

const bg = [0x1d, 0x1f, 0x24]; // #1d1f24
fs.writeFileSync(path.join(pub, 'pwa-192x192.png'), createPNG(192, 192, bg));
fs.writeFileSync(path.join(pub, 'pwa-512x512.png'), createPNG(512, 512, bg));
fs.writeFileSync(path.join(pub, 'pwa-maskable-512x512.png'), createPNG(512, 512, bg));
fs.writeFileSync(path.join(pub, 'apple-touch-icon.png'), createPNG(180, 180, bg));
console.log('PWA PNG icons generated successfully.');
