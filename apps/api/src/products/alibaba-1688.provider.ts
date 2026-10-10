import { Logger } from '@nestjs/common';
import { Market, ProductProvider, ProviderProduct, ProviderSearchHit, SearchOptions } from './provider';
import { mapDetail1688, mapSearch1688, RawDetail1688, RawSearch1688 } from './alibaba-1688.map';

/**
 * 1688.com via RapidAPI "Alibaba 1688 API" (dataapiman). Only 1688 — Taobao queries return nothing.
 * The API has no paging/sort parameters, so page 2+ returns nothing and sort is ignored.
 * Free plan: 50 requests/month (hard limit) — keep PRODUCT_CACHE_MINUTES high.
 */
export class Alibaba1688Provider implements ProductProvider {
  readonly name = 'alibaba-1688';
  private log = new Logger('Alibaba1688');

  constructor(private key: string, private host = 'alibaba-1688-api.p.rapidapi.com') {
    if (!key) throw new Error('RAPIDAPI_KEY is not set');
  }

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(`https://${this.host}${path}?${new URLSearchParams(params)}`, {
        headers: { 'x-rapidapi-host': this.host, 'x-rapidapi-key': this.key },
        signal: ctl.signal,
      });
      const left = res.headers.get('x-ratelimit-requests-remaining');
      if (left !== null && Number(left) <= 5) this.log.warn(`only ${left} API requests left this period`);
      if (!res.ok) throw new Error(`alibaba-1688 HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async search(query: string, opts: SearchOptions) {
    if (opts.market === 'TAOBAO' || opts.market === 'TMALL' || (opts.page ?? 1) > 1) return { items: [], total: 0 };
    return mapSearch1688((await this.get('/api/1688/search-item-list/v1', { keyword: query })) as RawSearch1688);
  }

  async searchByImage(_imageUrl: string, _opts: SearchOptions): Promise<{ items: ProviderSearchHit[]; total: number }> {
    return { items: [], total: 0 }; // not offered by this API
  }

  async detail(market: Market, sourceId: string): Promise<ProviderProduct | null> {
    if (market !== 'M1688') return null;
    return mapDetail1688((await this.get('/api/1688/get-item-detail/v1', { itemId: sourceId })) as RawDetail1688, sourceId);
  }
}
