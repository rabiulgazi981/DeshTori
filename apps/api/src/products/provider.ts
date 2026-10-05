/**
 * Adapter interface for 1688 / Taobao product-data APIs.
 * Each new provider (HioBuy, Otapi, …) is written once as a class implementing this.
 * All prices are supplier CNY in fen. Conversion to BDT happens in ProductsService.
 */
export type Market = 'M1688' | 'TAOBAO' | 'TMALL';

export interface ProviderSku {
  skuId: string;
  props: Record<string, string>; // { Color: 'Clear', Model: 'iPhone 17 Pro' }
  fen: number;
  promoFen?: number;
  stock: number;
  image?: string;
}

export interface ProviderProduct {
  market: Market;
  sourceId: string;
  sourceUrl: string;
  titleEn: string;
  titleZh?: string;
  images: string[];
  sellerName?: string;
  sellerLocation?: string;
  sellerRatings?: Record<string, number>;
  attributes?: Record<string, string>;
  skus: ProviderSku[];
  priceTiers?: { minQty: number; fen: number }[];
  weightKg?: number;
  soldCount?: number;
}

export interface ProviderSearchHit {
  market: Market;
  sourceId: string;
  titleEn: string;
  image: string;
  fen: number;
  promoFen?: number;
  soldCount?: number;
}

export interface SearchOptions {
  page?: number;
  market?: Market | 'ALL';
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'sales';
}

export interface ProductProvider {
  readonly name: string;
  search(query: string, opts: SearchOptions): Promise<{ items: ProviderSearchHit[]; total: number }>;
  searchByImage(imageUrl: string, opts: SearchOptions): Promise<{ items: ProviderSearchHit[]; total: number }>;
  detail(market: Market, sourceId: string): Promise<ProviderProduct | null>;
}

/** Parse a pasted 1688 / Taobao / Tmall link into market + id. */
export const parseProductLink = (url: string): { market: Market; sourceId: string } | null => {
  try {
    const u = new URL(url.trim());
    const host = u.hostname;
    if (host.includes('1688.com')) {
      const m = u.pathname.match(/offer\/(\d+)\.html/);
      if (m) return { market: 'M1688', sourceId: m[1] };
    }
    if (host.includes('taobao.com') || host.includes('tmall.com')) {
      const id = u.searchParams.get('id');
      if (id && /^\d+$/.test(id)) return { market: host.includes('tmall') ? 'TMALL' : 'TAOBAO', sourceId: id };
    }
    return null;
  } catch {
    return null;
  }
};
