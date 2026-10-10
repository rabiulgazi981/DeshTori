/** Pure helpers for image uploads: data-URL parsing, magic-byte check, pixel size. No I/O. */

export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export class ImageError extends Error {
  constructor(public code: 'IMAGE_ONLY' | 'IMAGE_TOO_LARGE') {
    super(code);
  }
}

/** Magic bytes, so a renamed file can't pass as an image. */
export function magicOk(mime: string, buf: Buffer): boolean {
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50;
  if (mime === 'image/webp') return buf.length > 12 && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  return false;
}

/** data:image/jpeg;base64,... → checked buffer. Throws ImageError. */
export function parseImageDataUrl(dataUrl: string): { mime: string; ext: string; buf: Buffer } {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new ImageError('IMAGE_ONLY');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_IMAGE_BYTES) throw new ImageError('IMAGE_TOO_LARGE');
  if (!magicOk(m[1], buf)) throw new ImageError('IMAGE_ONLY');
  return { mime: m[1], ext: IMAGE_TYPES[m[1]], buf };
}

/** Width/height from the file header (PNG IHDR, JPEG SOFn, WebP VP8/VP8L/VP8X). null if unknown. */
export function imageSize(mime: string, b: Buffer): { width: number; height: number } | null {
  try {
    if (mime === 'image/png') {
      if (b.length < 24 || b.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = b[i + 1];
        if (marker === 0xff) {
          i++;
          continue;
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
          i += 2;
          continue;
        }
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
      return null;
    }
    if (mime === 'image/webp') {
      const chunk = b.subarray(12, 16).toString('latin1');
      if (chunk === 'VP8 ' && b.length >= 30) return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      if (chunk === 'VP8L' && b.length >= 25) {
        const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
        return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
      }
      if (chunk === 'VP8X' && b.length >= 30) return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    }
  } catch {
    /* truncated header */
  }
  return null;
}

/** "<id>.<ext>" → id, or null when the name can't be a DB media id. */
export function mediaIdFromFile(file: string): string | null {
  const m = file.match(/^([a-z0-9]{12,40})\.(jpg|jpeg|png|webp)$/);
  return m ? m[1] : null;
}

/** Keep names short, printable and searchable. */
export function cleanName(name: string | undefined, ext: string): string {
  // eslint-disable-next-line no-control-regex
  const n = (name ?? '').replace(/[\u0000-\u001f<>"\\]/g, '').trim().slice(0, 120);
  return n || `image.${ext}`;
}
