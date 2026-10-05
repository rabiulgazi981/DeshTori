import { Market, ProductProvider, ProviderProduct, ProviderSearchHit, SearchOptions } from './provider';

/**
 * Development provider with deterministic fake data, so the whole site works
 * before the real API (HioBuy / Otapi / …) is chosen. Never used in production.
 */
const seedNum = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export class MockProvider implements ProductProvider {
  readonly name = 'mock';

  async search(query: string, opts: SearchOptions) {
    const page = opts.page ?? 1;
    const base = seedNum(query.toLowerCase());
    const items: ProviderSearchHit[] = Array.from({ length: 20 }, (_, i) => {
      const n = (base + i * 977 + page * 131) % 100000;
      return {
        market: (i % 3 === 0 ? 'TAOBAO' : 'M1688') as Market,
        sourceId: String(600000000000 + n),
        titleEn: `${query} – sample product ${(page - 1) * 20 + i + 1}`,
        image: `https://picsum.photos/seed/${n}/400/400`,
        fen: 500 + (n % 15000),
        soldCount: n % 5000,
      };
    });
    return { items, total: 400 };
  }

  async searchByImage(_imageUrl: string, opts: SearchOptions) {
    return this.search('similar item', opts);
  }

  async detail(market: Market, sourceId: string): Promise<ProviderProduct> {
    const n = seedNum(sourceId);
    const base = 1500 + (n % 9000);
    return {
      market,
      sourceId,
      sourceUrl: market === 'M1688' ? `https://detail.1688.com/offer/${sourceId}.html` : `https://item.taobao.com/item.htm?id=${sourceId}`,
      titleEn: `Sample product ${sourceId.slice(-4)} – Airbag Shockproof Clear Case`,
      images: [1, 2, 3, 4, 5].map((k) => `https://picsum.photos/seed/${sourceId}-${k}/800/800`),
      sellerName: 'Shenzhen Sample Store',
      sellerLocation: 'Guangdong, Shenzhen',
      sellerRatings: { product: 4.5, service: 4.5, delivery: 4.0, level: 4.6 },
      attributes: { Brand: 'OEM', Material: 'Silicone', Origin: 'China' },
      skus: ['Clear', 'Frosted'].flatMap((color, ci) =>
        ['iPhone 16 Pro', 'iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max'].map((model, mi) => ({
          skuId: `${sourceId}-${ci}${mi}`,
          props: { Color: color, Model: model },
          fen: base + ci * 226,
          stock: mi === 3 && ci === 1 ? 0 : 9000 + mi,
        })),
      ),
      priceTiers: [
        { minQty: 1, fen: base },
        { minQty: 20, fen: Math.round(base * 0.96) },
        { minQty: 9999, fen: Math.round(base * 0.63) },
      ],
      weightKg: 0.05,
      soldCount: n % 100000,
    };
  }
}
