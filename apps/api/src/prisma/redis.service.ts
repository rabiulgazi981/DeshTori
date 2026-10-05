import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/** Small JSON cache on top of Redis. Falls back to in-memory if Redis is down (dev). */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly log = new Logger('Cache');
  private redis?: Redis;
  private mem = new Map<string, { v: string; exp: number }>();

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1 });
      this.redis.on('error', (e) => this.log.warn(`redis: ${e.message}`));
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = this.redis ? await this.redis.get(key) : this.memGet(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      const raw = this.memGet(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    try {
      if (this.redis) await this.redis.set(key, raw, 'EX', ttlSeconds);
      else this.mem.set(key, { v: raw, exp: Date.now() + ttlSeconds * 1000 });
    } catch {
      this.mem.set(key, { v: raw, exp: Date.now() + ttlSeconds * 1000 });
    }
  }

  async del(key: string): Promise<void> {
    this.mem.delete(key);
    try {
      await this.redis?.del(key);
    } catch {
      /* ignore */
    }
  }

  /** Increment a counter with expiry (rate limits). Returns the new value. */
  async incr(key: string, ttlSeconds: number): Promise<number> {
    if (this.redis) {
      try {
        const n = await this.redis.incr(key);
        if (n === 1) await this.redis.expire(key, ttlSeconds);
        return n;
      } catch {
        /* fall through */
      }
    }
    const cur = this.memGet(key);
    const n = (cur ? Number(JSON.parse(cur)) : 0) + 1;
    this.mem.set(key, { v: JSON.stringify(n), exp: Date.now() + ttlSeconds * 1000 });
    return n;
  }

  private memGet(key: string): string | null {
    const e = this.mem.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) {
      this.mem.delete(key);
      return null;
    }
    return e.v;
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }
}
