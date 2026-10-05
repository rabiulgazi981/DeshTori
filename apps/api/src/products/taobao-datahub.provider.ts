import { Logger } from '@nestjs/common';
import { Market, ProductProvider, ProviderProduct, ProviderSearchHit, SearchOptions } from './provider';

/**
 * Taobao / Tmall via RapidAPI "Taobao DataHub" (taobao-datahub.p.rapidapi.com).
 * This API has no 1688 data. Prices come back as CNY yuan strings ("629.00") — converted to fen here.
 * Uses the plain `item_search` endpoint (numeric `itemId`). The `*_x` endpoints return `itemIdStr` tokens that change on every call — not usable as ids.
 * Search is implemented; detail needs the `item_detail` response shape and is not wired yet.
 */
const SORT: Record<NonNullable<SearchOptions['sort']>, string> = {
  relevance: 'default',
  price_asc: 'priceAsc',
  price_desc: 'priceDesc',
  sales: 'salesDesc',
};

interface RawItem {
  item?: { itemId?: string; title?: string; sales?: string; image?: string; sku?: { def?: { price?: string; promotionPrice?: string } } };
  seller?: { storeType?: string };
}
interface RawSearch {
  result?: { status?: { code?: number; msg?: unknown }; base?: { totalResults?: number }; resultList?: RawItem[] };
}

export const yuanToFen = (v: string | number | undefined): number => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '');
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};
const https = (u?: string) => (!u ? '' : u.startsWith('//') ? `https:${u}` : u);

export const mapSearch = (raw: RawSearch): { items: ProviderSearchHit[]; total: number } => {
  const r = raw.result;
  // 205 = request fine, no results
  if (r?.status?.code === 205) return { items: [], total: 0 };
  if (r?.status?.code !== 200) throw new Error(`taobao-datahub search failed: ${JSON.stringify(r?.status?.msg ?? r?.status?.code ?? 'no response')}`);
  const items: ProviderSearchHit[] = [];
  for (const x of r.resultList ?? []) {
    const id = x.item?.itemId;
    const fen = yuanToFen(x.item?.sku?.def?.price);
    if (!id || !fen) continue;
    const promo = yuanToFen(x.item?.sku?.def?.promotionPrice);
    items.push({
      market: x.seller?.storeType === 'tmall' ? 'TMALL' : 'TAOBAO',
      sourceId: id,
      titleEn: x.item?.title ?? '',
      image: https(x.item?.image),
      fen,
      ...(promo && promo < fen ? { promoFen: promo } : {}),
      ...(Number(x.item?.sales) > 0 ? { soldCount: Number(x.item?.sales) } : {}),
    });
  }
  return { items, total: r.base?.totalResults ?? items.length };
};

export class TaobaoDatahubProvider implements ProductProvider {
  readonly name = 'taobao-datahub';
  private log = new Logger('TaobaoDatahub');

  constructor(private key: string, private host = 'taobao-datahub.p.rapidapi.com') {
    if (!key) throw new Error('RAPIDAPI_KEY is not set');
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
    return mapSearch((await this.get('/item_search', params)) as RawSearch);
  }

  async searchByImage(_imageUrl: string, _opts: SearchOptions): Promise<{ items: ProviderSearchHit[]; total: number }> {
    this.log.warn('image search not wired for taobao-datahub yet');
    return { items: [], total: 0 };
  }

  async detail(_market: Market, _sourceId: string): Promise<ProviderProduct | null> {
    this.log.warn('detail not wired for taobao-datahub yet');
    return null;
  }
}
