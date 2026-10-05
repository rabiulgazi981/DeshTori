export type Market = 'M1688' | 'TAOBAO' | 'TMALL';
export interface SearchItem { market: Market; id: string; title: string; image: string; soldCount?: number; pricePaisa: number }
export interface ProductDetail {
  id: string; market: Market; sourceId: string; title: string; images: string[];
  seller: { name?: string; location?: string }; attributes?: Record<string, string>; soldCount?: number;
  weightKg?: number; freightCategory?: string;
  skus: { skuId: string; props: Record<string, string>; stock: number; pricePaisa: number }[];
  priceTiers: { minQty: number; pricePaisa: number }[];
}
export interface FreightCategory { id: string; code: string; nameBn: string; itemsBn: string; airPaisa: number; seaPaisa: number }
export interface PublicSettings {
  advancePlans: { percent: number; discountPct: number }[];
  notice: { on: boolean; textBn: string; textEn: string; hotline: string; link?: string; speed: 'slow' | 'normal' | 'fast' };
  freight: FreightCategory[];
}
export interface Me { id: string; phone: string; name?: string; kind: 'CUSTOMER' | 'STAFF'; roles: string[]; customerCode?: string; walletPaisa: number }
