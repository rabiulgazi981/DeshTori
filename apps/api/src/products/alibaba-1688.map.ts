/**
 * Pure mapping for the RapidAPI "Alibaba 1688 API" (dataapiman, host alibaba-1688-api.p.rapidapi.com).
 * Verified against live responses on 2026-10-05 (fixtures in test/fixtures/alibaba-1688.json).
 *
 * What this API gives: search (60 offers/page, title, image, price, quantity tiers, sales, shop)
 * and detail (images, tiers, total stock, MOQ, attributes, shop, ship-from city, unit weight).
 * What it does NOT give: the per-variant list (skuCore is always null). So every 1688 product
 * becomes ONE orderable option; the customer writes colour/model in the order note and the
 * China team buys accordingly. When variants have different prices ("skuPrice"), we use the
 * HIGHEST price so the shop never sells below cost.
 */
import type { ProviderProduct, ProviderSearchHit } from './provider';

const fen = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};
const int = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : undefined;
};
const https = (u?: string) => (!u ? '' : u.startsWith('//') ? `https:${u}` : u);

/** 1688 search titles highlight the keyword with <font> tags. */
export const cleanTitle = (t?: string) =>
  (t ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** "200~499件" → 200, "≥1000件" → 1000, "1~99个" → 1 */
export const tierMin = (q?: string): number | undefined => int((q ?? '').match(/\d+/)?.[0]);

export class Ali1688Error extends Error {}

// ───────── search ─────────

interface RawOffer {
  offerId?: number | string;
  title?: string;
  offerPicUrl?: string;
  bookedCount?: string | number;
  priceInfo?: { price?: string };
  shopAddition?: { quantityPrices?: { quantity?: string; value?: string }[] };
}
export interface RawSearch1688 {
  code?: number;
  message?: string | null;
  data?: { code?: number; data?: { OFFER?: { code?: number; found?: number; items?: { data?: RawOffer }[] } } };
}

export const mapSearch1688 = (raw: RawSearch1688): { items: ProviderSearchHit[]; total: number } => {
  if (raw.code !== 0) throw new Ali1688Error(`alibaba-1688 search failed: ${raw.message ?? raw.code}`);
  const offer = raw.data?.data?.OFFER;
  if (!offer) return { items: [], total: 0 };
  const items: ProviderSearchHit[] = [];
  for (const x of offer.items ?? []) {
    const d = x.data;
    if (!d?.offerId) continue;
    const tiers = (d.shopAddition?.quantityPrices ?? []).map((q) => fen(q.value)).filter(Boolean);
    const price = fen(d.priceInfo?.price) || (tiers.length ? Math.max(...tiers) : 0);
    if (!price) continue;
    const sold = int(d.bookedCount);
    items.push({
      market: 'M1688',
      sourceId: String(d.offerId),
      titleEn: cleanTitle(d.title),
      image: https(d.offerPicUrl),
      fen: price,
      ...(sold && sold > 0 ? { soldCount: sold } : {}),
    });
  }
  return { items, total: offer.found ?? items.length };
};

// ───────── detail ─────────

interface RawRange { price?: string; beginAmount?: string | number }
export interface RawDetail1688 {
  code?: number;
  message?: string | null;
  data?: {
    mainPic?: { offerImgList?: string[]; offerInfoModel?: { price?: string; title?: string } };
    item?: { companyName?: string; price?: string; saledCount?: number; offerTitle?: string; offerId?: string | number; saleOut?: boolean };
    attribute?: { propsList?: { name?: string; value?: string }[] };
    delivery?: { location?: string; unitWeight?: number };
    price?: {
      priceModel?: { priceDisplayType?: string; currentPrices?: RawRange[]; currentPricesWithOnePiece?: RawRange[] };
      alipayIntegralInfo?: { originalOrderPrice?: { canBookedAmount?: number; beginNum?: number; skuParam?: { skuPriceType?: string; skuRangePrices?: RawRange[] } } };
    };
    skuCore?: unknown;
  } | null;
}

export const mapDetail1688 = (raw: RawDetail1688, requestedId: string): ProviderProduct | null => {
  if (raw.code !== 0) throw new Ali1688Error(`alibaba-1688 detail failed: ${raw.message ?? raw.code}`);
  const D = raw.data;
  if (!D || !D.item) return null;

  const order = D.price?.alipayIntegralInfo?.originalOrderPrice;
  const ranges = (order?.skuParam?.skuRangePrices ?? D.price?.priceModel?.currentPricesWithOnePiece ?? D.price?.priceModel?.currentPrices ?? [])
    .map((r) => ({ minQty: int(r.beginAmount) ?? 1, fen: fen(r.price) }))
    .filter((r) => r.fen > 0);
  const variantPriced = (order?.skuParam?.skuPriceType ?? D.price?.priceModel?.priceDisplayType) === 'skuPrice';

  let base: number;
  let priceTiers: { minQty: number; fen: number }[] | undefined;
  if (variantPriced || ranges.length < 2) {
    // one price per variant (or a single price): charge the highest so we never sell below cost
    base = Math.max(0, ...ranges.map((r) => r.fen), fen(D.item.price));
  } else {
    const byQty = new Map<number, number>();
    for (const r of ranges) byQty.set(r.minQty, Math.max(byQty.get(r.minQty) ?? 0, r.fen));
    priceTiers = [...byQty.entries()].sort((a, b) => a[0] - b[0]).map(([minQty, f]) => ({ minQty, fen: f }));
    base = priceTiers[0].fen;
  }
  if (!base) throw new Ali1688Error(`alibaba-1688 detail: no price for ${requestedId}`);

  const sourceId = String(D.item.offerId ?? requestedId);
  const stock = D.item.saleOut ? 0 : order?.canBookedAmount ?? 999;
  const attributes: Record<string, string> = {};
  for (const p of D.attribute?.propsList ?? []) if (p.name && p.value) attributes[p.name] = p.value;
  const weight = D.delivery?.unitWeight;
  const sold = D.item.saledCount;

  return {
    market: 'M1688',
    sourceId,
    sourceUrl: `https://detail.1688.com/offer/${sourceId}.html`,
    titleEn: cleanTitle(D.item.offerTitle ?? D.mainPic?.offerInfoModel?.title),
    titleZh: D.item.offerTitle,
    images: (D.mainPic?.offerImgList ?? []).map(https).filter(Boolean),
    sellerName: D.item.companyName,
    sellerLocation: D.delivery?.location,
    attributes,
    skus: [{ skuId: sourceId, props: { Option: 'Standard' }, fen: base, stock: Math.max(0, Math.trunc(stock)) }],
    ...(priceTiers ? { priceTiers } : {}),
    ...(weight && weight > 0 ? { weightKg: weight } : {}),
    ...(sold && sold > 0 ? { soldCount: sold } : {}),
  };
};
