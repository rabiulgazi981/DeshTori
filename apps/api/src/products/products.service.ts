import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cnyToBdt, PricingSettings } from '@deshtori/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../prisma/redis.service';
import { SettingsService } from '../settings/settings.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { Alibaba1688Provider } from './alibaba-1688.provider';
import { TaobaoDatahubProvider } from './taobao-datahub.provider';
import { MockProvider } from './mock.provider';
import { Market, parseProductLink, ProductProvider, ProviderProduct, SearchOptions } from './provider';

@Injectable()
export class ProductsService {

  constructor(private prisma: PrismaService, private cache: CacheService, private settings: SettingsService, private integrations: IntegrationsService) {}

  private async providerConfig() {
    const c = await this.integrations.resolve('products');
    const provider: ProductProvider = c.provider === 'alibaba-1688' ? new Alibaba1688Provider(c.apiKey ?? '') : c.provider === 'taobao-datahub' ? new TaobaoDatahubProvider(c.apiKey ?? '') : new MockProvider();
    return { provider, cacheMin: Number(c.cacheMinutes), revision: createHash('sha256').update(JSON.stringify(c)).digest('hex').slice(0, 16) };
  }

  private async blocked(): Promise<string[]> {
    const hit = await this.cache.get<string[]>('blocked:keywords');
    if (hit) return hit;
    const rows = await this.prisma.blockedKeyword.findMany();
    const list = rows.map((r) => r.keyword.toLowerCase());
    await this.cache.set('blocked:keywords', list, 600);
    return list;
  }

  private isBlocked(text: string, list: string[]) {
    const t = text.toLowerCase();
    return list.some((k) => t.includes(k));
  }

  private price(fen: number, promoFen: number | undefined, s: PricingSettings, useOriginal: boolean) {
    return cnyToBdt(useOriginal || !promoFen ? fen : promoFen, s);
  }

  async search(query: string, opts: SearchOptions) {
    const { provider, cacheMin, revision } = await this.providerConfig();
    const q = query.trim();
    if (q.length < 2) throw new BadRequestException('QUERY_TOO_SHORT');
    const list = await this.blocked();
    if (this.isBlocked(q, list)) return { items: [], total: 0, blocked: true };

    const key = `search:${provider.name}:${revision}:${q.toLowerCase()}:${opts.page ?? 1}:${opts.market ?? 'ALL'}:${opts.sort ?? 'relevance'}`;
    let raw = await this.cache.get<Awaited<ReturnType<ProductProvider['search']>>>(key);
    if (!raw) {
      raw = await provider.search(q, opts);
      await this.cache.set(key, raw, cacheMin * 60);
    }
    const s = await this.settings.get();
    const items = raw.items
      .filter((i) => !this.isBlocked(i.titleEn, list))
      .map((i) => ({ market: i.market, id: i.sourceId, title: i.titleEn, image: i.image, soldCount: i.soldCount, pricePaisa: this.price(i.fen, i.promoFen, s.pricing, s.useOriginalPrice) }));
    return { items, total: raw.total, blocked: false };
  }

  async searchByImage(imageUrl: string, opts: SearchOptions) {
    const { provider } = await this.providerConfig();
    const list = await this.blocked();
    const raw = await provider.searchByImage(imageUrl, opts);
    const s = await this.settings.get();
    const items = raw.items
      .filter((i) => !this.isBlocked(i.titleEn, list))
      .map((i) => ({ market: i.market, id: i.sourceId, title: i.titleEn, image: i.image, soldCount: i.soldCount, pricePaisa: this.price(i.fen, i.promoFen, s.pricing, s.useOriginalPrice) }));
    return { items, total: raw.total, blocked: false };
  }

  /** Product page data in BDT only (supplier CNY never leaves the server). */
  async detail(market: Market, sourceId: string) {
    const p = await this.fetchAndStore(market, sourceId);
    const s = await this.settings.get();
    const list = await this.blocked();
    if (this.isBlocked(p.titleEn, list)) throw new NotFoundException('PRODUCT_NOT_ALLOWED');
    return {
      id: p.id,
      market,
      sourceId,
      title: p.titleEn,
      images: p.images,
      seller: { name: p.sellerName, location: p.sellerLocation },
      attributes: p.attributes,
      soldCount: p.soldCount,
      weightKg: p.weightKg,
      freightCategory: p.freightCategory,
      skus: (p.skus as unknown as ProviderProduct['skus']).map((k) => ({
        skuId: k.skuId,
        props: k.props,
        stock: k.stock,
        pricePaisa: this.price(k.fen, k.promoFen, s.pricing, s.useOriginalPrice),
      })),
      priceTiers: ((p.priceTiers ?? []) as { minQty: number; fen: number }[]).map((t) => ({ minQty: t.minQty, pricePaisa: cnyToBdt(t.fen, s.pricing) })),
    };
  }

  async fromLink(url: string) {
    const parsed = parseProductLink(url);
    if (!parsed) throw new BadRequestException('UNSUPPORTED_LINK');
    return parsed;
  }

  /** Cached detail: DB row is reused until it is older than the cache window. */
  async fetchAndStore(market: Market, sourceId: string) {
    const { provider, cacheMin } = await this.providerConfig();
    const existing = await this.prisma.product.findUnique({ where: { marketplace_sourceId: { marketplace: market, sourceId } } });
    const fresh = existing && Date.now() - existing.fetchedAt.getTime() < cacheMin * 60_000;
    if (existing && fresh) return existing;
    const d = await provider.detail(market, sourceId);
    if (!d) {
      if (existing) return existing;
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }
    const data = {
      sourceUrl: d.sourceUrl,
      titleEn: d.titleEn,
      titleZh: d.titleZh,
      images: d.images,
      sellerName: d.sellerName,
      sellerLocation: d.sellerLocation,
      attributes: (d.attributes ?? {}) as Prisma.InputJsonValue,
      skus: d.skus as unknown as Prisma.InputJsonValue,
      priceTiers: (d.priceTiers ?? []) as unknown as Prisma.InputJsonValue,
      weightKg: d.weightKg,
      soldCount: d.soldCount,
      fetchedAt: new Date(),
    };
    return this.prisma.product.upsert({
      where: { marketplace_sourceId: { marketplace: market, sourceId } },
      create: { marketplace: market, sourceId, ...data },
      update: data,
    });
  }
}
