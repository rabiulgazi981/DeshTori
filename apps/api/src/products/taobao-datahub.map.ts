/**
 * Pure mapping functions for the RapidAPI "Taobao DataHub" responses (no Nest imports → easy to test).
 * Prices arrive as CNY yuan strings ("629.00") and are converted to integer fen here.
 *
 * The detail mapper is written defensively: field names that vary between API versions
 * (propMap / propPath, quantity as string or number, properties as list or object) are all accepted.
 * If the shape is not recognised it throws a DetailShapeError that lists the keys it saw,
 * so the server log shows exactly what to adjust.
 */
import type { Market, ProviderProduct, ProviderSearchHit, ProviderSku } from './provider';

export const yuanToFen = (v: string | number | undefined | null): number => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '');
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};
export const https = (u?: string | null) => (!u ? '' : u.startsWith('//') ? `https:${u}` : u);
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};

// ───────── search ─────────

interface RawItem {
  item?: { itemId?: string; title?: string; sales?: string; image?: string; sku?: { def?: { price?: string; promotionPrice?: string } } };
  seller?: { storeType?: string };
}
export interface RawSearch {
  result?: { status?: { code?: number; msg?: unknown }; base?: { totalResults?: number }; resultList?: RawItem[] };
}

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

// ───────── detail ─────────

interface RawPropValue { vid?: string | number; name?: string; image?: string }
interface RawProp { pid?: string | number; name?: string; values?: RawPropValue[] }
interface RawSkuBase {
  skuId?: string | number;
  propMap?: string;
  propPath?: string;
  price?: string | number;
  promotionPrice?: string | number;
  quantity?: string | number;
}
interface RawDetailItem {
  itemId?: string | number;
  title?: string;
  itemUrl?: string;
  images?: string[];
  mainImages?: string[];
  sales?: string | number;
  properties?: { list?: { name?: string; value?: string }[] } | { name?: string; value?: string }[];
  sku?: { def?: { price?: string | number; promotionPrice?: string | number; quantity?: string | number }; base?: RawSkuBase[]; props?: RawProp[] };
}
export interface RawDetail {
  result?: {
    status?: { code?: number; msg?: unknown };
    item?: RawDetailItem;
    seller?: { storeType?: string; storeTitle?: string; sellerTitle?: string; shopTitle?: string; sellerNick?: string; city?: string; location?: string; storeScore?: unknown };
    delivery?: { from?: string; areaFrom?: string | string[]; shippingFrom?: string };
  };
}

export class DetailShapeError extends Error {
  constructor(reason: string, public seen: string[]) {
    super(`taobao-datahub detail: ${reason} (keys seen: ${seen.join(', ') || 'none'})`);
  }
}

/** "1627207:28320;20509:28315" → [['1627207','28320'], ['20509','28315']] */
export const parsePropMap = (s?: string): [string, string][] =>
  (s ?? '')
    .split(';')
    .map((p) => p.split(':'))
    .filter((p): p is [string, string] => p.length === 2 && !!p[0] && !!p[1]);

/** Unknown stock is treated as available — the China team confirms when buying. */
const UNKNOWN_STOCK = 999;

export const mapDetail = (raw: RawDetail, requestedId: string): ProviderProduct | null => {
  const r = raw.result;
  if (r?.status?.code === 205 || r?.status?.code === 404) return null;
  if (r?.status?.code !== 200) throw new Error(`taobao-datahub detail failed: ${JSON.stringify(r?.status?.msg ?? r?.status?.code ?? 'no response')}`);
  const it = r.item;
  if (!it) throw new DetailShapeError('no result.item', Object.keys(r ?? {}));

  const sourceId = String(it.itemId ?? requestedId);
  const isTmall = r.seller?.storeType === 'tmall' || /tmall\.com/.test(it.itemUrl ?? '');
  const market: Market = isTmall ? 'TMALL' : 'TAOBAO';

  // property names: pid → name, "pid:vid" → value name / image
  const propName = new Map<string, string>();
  const valueName = new Map<string, { name: string; image?: string }>();
  for (const p of it.sku?.props ?? []) {
    const pid = String(p.pid ?? '');
    if (!pid) continue;
    propName.set(pid, p.name ?? pid);
    for (const v of p.values ?? []) valueName.set(`${pid}:${v.vid}`, { name: v.name ?? String(v.vid), image: v.image ? https(v.image) : undefined });
  }

  const def = it.sku?.def;
  const defFen = yuanToFen(def?.price);
  const defPromo = yuanToFen(def?.promotionPrice);
  const skus: ProviderSku[] = [];
  for (const b of it.sku?.base ?? []) {
    const fen = yuanToFen(b.price) || defFen;
    if (!fen || b.skuId === undefined) continue;
    const props: Record<string, string> = {};
    let image: string | undefined;
    for (const [pid, vid] of parsePropMap(b.propMap ?? b.propPath)) {
      const v = valueName.get(`${pid}:${vid}`);
      props[propName.get(pid) ?? pid] = v?.name ?? vid;
      image = image ?? v?.image;
    }
    const promo = yuanToFen(b.promotionPrice);
    const stock = num(b.quantity);
    skus.push({
      skuId: String(b.skuId),
      props: Object.keys(props).length ? props : { Option: String(b.skuId) },
      fen,
      ...(promo && promo < fen ? { promoFen: promo } : {}),
      stock: stock === undefined ? UNKNOWN_STOCK : Math.max(0, Math.trunc(stock)),
      ...(image ? { image } : {}),
    });
  }
  // item without variants → one default SKU from the item price
  if (!skus.length && defFen) {
    const stock = num(def?.quantity);
    skus.push({
      skuId: sourceId,
      props: { Option: 'Standard' },
      fen: defFen,
      ...(defPromo && defPromo < defFen ? { promoFen: defPromo } : {}),
      stock: stock === undefined ? UNKNOWN_STOCK : Math.max(0, Math.trunc(stock)),
    });
  }
  if (!skus.length) throw new DetailShapeError('no priced SKUs', [...Object.keys(it), ...Object.keys(it.sku ?? {}).map((k) => `sku.${k}`)]);

  const propList = Array.isArray(it.properties) ? it.properties : it.properties?.list ?? [];
  const attributes: Record<string, string> = {};
  for (const p of propList) if (p.name && p.value) attributes[p.name] = p.value;

  const images = (it.images ?? it.mainImages ?? []).map(https).filter(Boolean);
  const from = r.delivery?.areaFrom;
  const sales = num(it.sales);

  return {
    market,
    sourceId,
    sourceUrl: isTmall ? `https://detail.tmall.com/item.htm?id=${sourceId}` : `https://item.taobao.com/item.htm?id=${sourceId}`,
    titleEn: it.title ?? '',
    titleZh: it.title,
    images: images.length ? images : skus.map((s) => s.image).filter((x): x is string => !!x).slice(0, 5),
    sellerName: r.seller?.storeTitle ?? r.seller?.shopTitle ?? r.seller?.sellerTitle ?? r.seller?.sellerNick,
    sellerLocation: (Array.isArray(from) ? from.join(' ') : from) ?? r.delivery?.from ?? r.delivery?.shippingFrom ?? r.seller?.city ?? r.seller?.location,
    attributes,
    skus,
    ...(sales && sales > 0 ? { soldCount: Math.trunc(sales) } : {}),
  };
};
