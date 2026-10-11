import { Logger } from '@nestjs/common';
import { Market, ProductProvider, ProviderProduct, ProviderSearchHit, SearchOptions } from './provider';
import { DetailShapeError, mapDetail, mapImageSearch, mapSearch, RawDetail, RawSearch } from './taobao-datahub.map';

export { mapSearch, mapDetail, mapImageSearch, yuanToFen } from './taobao-datahub.map';

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

/**
 * Image search ("Item Search 【by Image】" in the DataHub endpoint list).
 * Path and image parameter name are not confirmed against a live response yet, so both can be
 * changed without a code edit: TAOBAO_IMAGE_SEARCH_PATH / TAOBAO_IMAGE_SEARCH_PARAM.
 * The image URL must be publicly reachable by RapidAPI (uploads are served at PUBLIC_API_URL/uploads/<name>).
 */
export const IMAGE_SEARCH = {
  path: () => process.env.TAOBAO_IMAGE_SEARCH_PATH || '/item_search_image',
  param: () => process.env.TAOBAO_IMAGE_SEARCH_PARAM || 'imgUrl',
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
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`taobao-datahub ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
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

  async searchByImage(imageUrl: string, opts: SearchOptions): Promise<{ items: ProviderSearchHit[]; total: number }> {
    if (opts.market === 'M1688') return { items: [], total: 0 };
    const path = IMAGE_SEARCH.path();
    const params: Record<string, string> = { [IMAGE_SEARCH.param()]: imageUrl, page: String(opts.page ?? 1), pageSize: '20' };
    const raw = await this.get(path, this.withLocale(params));
    const r = mapImageSearch(raw);
    if (r.unknownShape) this.log.warn(`image search ${path}: unknown response shape (${r.unknownShape}) — send this log line to the developer`);
    return { items: r.items, total: r.total };
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
