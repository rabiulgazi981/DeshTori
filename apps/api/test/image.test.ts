import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, ImageError, imageSize, mediaIdFromFile, parseImageDataUrl } from '../src/uploads/image';

const png = (w: number, h: number) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};
const jpeg = (w: number, h: number) => {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
  const sof = Buffer.alloc(19);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(h, 5);
  sof.writeUInt16BE(w, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
};
const webpX = (w: number, h: number) => {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'latin1');
  b.write('WEBP', 8, 'latin1');
  b.write('VP8X', 12, 'latin1');
  b.writeUIntLE(w - 1, 24, 3);
  b.writeUIntLE(h - 1, 27, 3);
  return b;
};
const dataUrl = (mime: string, b: Buffer) => `data:${mime};base64,${b.toString('base64')}`;

test('reads pixel size from png / jpeg / webp headers', () => {
  assert.deepEqual(imageSize('image/png', png(1200, 400)), { width: 1200, height: 400 });
  assert.deepEqual(imageSize('image/jpeg', jpeg(1920, 640)), { width: 1920, height: 640 });
  assert.deepEqual(imageSize('image/webp', webpX(800, 600)), { width: 800, height: 600 });
  assert.equal(imageSize('image/png', Buffer.from([0x89, 0x50])), null);
});

test('data URLs: type, magic bytes and size are checked', () => {
  assert.equal(parseImageDataUrl(dataUrl('image/png', png(10, 10))).ext, 'png');
  assert.equal(parseImageDataUrl(dataUrl('image/webp', webpX(10, 10))).ext, 'webp');
  // a PNG pretending to be a JPEG
  assert.throws(() => parseImageDataUrl(dataUrl('image/jpeg', png(10, 10))), (e: unknown) => e instanceof ImageError && e.code === 'IMAGE_ONLY');
  assert.throws(() => parseImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), (e: unknown) => e instanceof ImageError && e.code === 'IMAGE_ONLY');
  const big = Buffer.alloc(4 * 1024 * 1024 + 1);
  big[0] = 0xff;
  big[1] = 0xd8;
  assert.throws(() => parseImageDataUrl(dataUrl('image/jpeg', big)), (e: unknown) => e instanceof ImageError && e.code === 'IMAGE_TOO_LARGE');
});

test('public file names map to media ids; legacy/odd names do not', () => {
  assert.equal(mediaIdFromFile('mg1abcd1234567890abcdef.webp'), 'mg1abcd1234567890abcdef');
  assert.equal(mediaIdFromFile('lx2-0a1b2c3d4e5f60718.jpg'), null); // old disk file name (has a dash)
  assert.equal(mediaIdFromFile('../etc/passwd'), null);
  assert.equal(cleanName('  banner<1>.jpg ', 'jpg'), 'banner1.jpg');
  assert.equal(cleanName('', 'png'), 'image.png');
});
