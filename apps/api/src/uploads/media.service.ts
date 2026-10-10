import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { cleanName, IMAGE_TYPES, ImageError, imageSize, parseImageDataUrl } from './image';

export type MediaScope = 'LIBRARY' | 'UPLOAD';

const publicBase = () => process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api`;
export const mediaUrl = (m: { id: string; mime: string }) => `${publicBase()}/uploads/${m.id}.${IMAGE_TYPES[m.mime] ?? 'jpg'}`;

/** Small in-memory LRU so hot images (banners, category tiles) don't hit Postgres on every request. */
const CACHE_MAX = 32 * 1024 * 1024;
const cache = new Map<string, { mime: string; bytes: Buffer }>();
let cacheBytes = 0;

export const MEDIA_SELECT = { id: true, name: true, mime: true, size: true, width: true, height: true, scope: true, uploadedById: true, createdAt: true } as const;

/**
 * Image storage in Postgres. Render's free disk is wiped on every deploy, so files written
 * to disk vanish; rows in the Media table don't.
 */
@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  async save(dataUrl: string, opts: { name?: string; scope: MediaScope; userId?: string }) {
    let img: ReturnType<typeof parseImageDataUrl>;
    try {
      img = parseImageDataUrl(dataUrl);
    } catch (e) {
      if (e instanceof ImageError) throw new BadRequestException(e.code);
      throw e;
    }
    const dim = imageSize(img.mime, img.buf);
    // time prefix keeps ids roughly sortable; 10 random bytes keep them unguessable (payment screenshots live here too)
    const id = `${Date.now().toString(36)}${randomBytes(10).toString('hex')}`;
    const m = await this.prisma.media.create({
      data: { id, name: cleanName(opts.name, img.ext), mime: img.mime, bytes: img.buf, size: img.buf.length, width: dim?.width, height: dim?.height, scope: opts.scope, uploadedById: opts.userId },
      select: MEDIA_SELECT,
    });
    return { ...m, url: mediaUrl(m) };
  }

  async read(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
    const hit = cache.get(id);
    if (hit) {
      cache.delete(id);
      cache.set(id, hit);
      return hit;
    }
    const row = await this.prisma.media.findUnique({ where: { id }, select: { mime: true, bytes: true } });
    if (!row) return null;
    const v = { mime: row.mime, bytes: Buffer.from(row.bytes) };
    if (v.bytes.length < CACHE_MAX / 4) {
      cache.set(id, v);
      cacheBytes += v.bytes.length;
      for (const [k, old] of cache) {
        if (cacheBytes <= CACHE_MAX) break;
        cache.delete(k);
        cacheBytes -= old.bytes.length;
      }
    }
    return v;
  }

  forget(id: string) {
    const hit = cache.get(id);
    if (!hit) return;
    cache.delete(id);
    cacheBytes -= hit.bytes.length;
  }
}
