import { Logger } from '@nestjs/common';
import { Market, ProductProvider, ProviderProduct, ProviderSearchHit, SearchOptions } from './provider';
import { DetailShapeError, mapDetail, mapSearch, RawDetail, RawSearch } from './taobao-datahub.map';

export { mapSearch, mapDetail, yuanToFen } from './taobao-datahub.map';

/**
 * Taobao / Tmall via RapidAPI "Taobao DataHub" (taobao-datahub.p.rapidapi.com).
 * This API has no 1688 data. Mapping lives in taobao-datahub.map.ts.
 * Uses the plain `item_search` / `item_detail` endpoints (numeric `itemId`).
 * The `*_x` endpoints return `itemIdStr` tokens that change on every call — not usable as ids.
 */
const SORT: Record<NonNullable<SearchOptions['sort']>, string> = {
  relevance: 'default',
  price_asc: 'priceAsc',
  price_desc: 'priceDesc',
  sales: 'salesDesc',
};

export class TaobaoDatahubProvider implements ProductProvider {
  readonly name = 'taobao-datahub';
  private log = new Logger('TaobaoDatahub');

  constructor(private key: string, private host = 'taobao-datahub.p.rapidapi.com', private locale?: string) {
    if (!key) throw new Error('RAPIDAPI_KEY is not set');
  }

  private withLocale(p: Record<string, string>) {
    return this.locale ? { ...p, locale: this.locale } : p;
  }

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(`https://${this.host}${path}?${new URLSearchParams(params)}`, {
        headers: { 'x-rapidapi-host': this.host, 'x-rapidapi-key': this.key },
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`taobao-datahub HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async search(query: string, opts: SearchOptions) {
    if (opts.market === 'M1688') return { items: [], total: 0 };
    const params: Record<string, string> = { q: query, page: String(opts.page ?? 1), pageSize: '20', sort: SORT[opts.sort ?? 'relevance'] };
    if (opts.market === 'TMALL') params.switches = 'tmall';
    return mapSearch((await this.get('/item_search', this.withLocale(params))) as RawSearch);
  }

  async searchByImage(_imageUrl: string, _opts: SearchOptions): Promise<{ items: ProviderSearchHit[]; total: number }> {
    this.log.warn('image search not wired for taobao-datahub yet');
    return { items: [], total: 0 };
  }

  async detail(market: Market, sourceId: string): Promise<ProviderProduct | null> {
    if (market === 'M1688') return null; // this API has no 1688 data
    const raw = (await this.get('/item_detail', this.withLocale({ itemId: sourceId }))) as RawDetail;
    try {
      return mapDetail(raw, sourceId);
    } catch (e) {
      if (e instanceof DetailShapeError) this.log.error(`${e.message} — send this log line to the developer`);
      throw e;
    }
  }
}
