import { Fen, Paisa, ceilToTaka, percentOf, sum } from './money';

/** Admin-editable pricing settings (stored in DB, cached). */
export interface PricingSettings {
  /** BDT per 1 CNY, e.g. 19.90 */
  cnyRate: number;
  /** Product margin in percent, e.g. 0 or 2.5 */
  marginPct: number;
}

/**
 * Convert a supplier CNY price (in fen) to the BDT price shown to customers (in paisa).
 * Formula (agreed): BDT = CNY × rate × (1 + margin%).  Rounded UP to a whole taka per unit.
 */
export const cnyToBdt = (fen: Fen, s: PricingSettings): Paisa => {
  const paisa = (fen * s.cnyRate * (100 + s.marginPct)) / 100; // fen*rate = paisa; × (1+m)
  return ceilToTaka(Math.round(paisa));
};

/** Quantity price tiers as returned by 1688 ("20+ pcs → ¥30"). */
export interface PriceTier {
  minQty: number;
  fen: Fen;
}

/** Pick the tier that applies to a total quantity (tiers may be unsorted). */
export const pickTier = (tiers: PriceTier[], totalQty: number): PriceTier | undefined => {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let hit: PriceTier | undefined;
  for (const t of sorted) if (totalQty >= t.minQty) hit = t;
  return hit ?? sorted[0];
};

/** "Buy N more to save X%" hint for the product page. */
export const nextTierHint = (tiers: PriceTier[], totalQty: number): { needMore: number; savePct: number } | null => {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const current = pickTier(sorted, totalQty);
  const next = sorted.find((t) => t.minQty > totalQty);
  if (!current || !next) return null;
  const base = sorted[0].fen;
  return { needMore: next.minQty - totalQty, savePct: Math.round(((base - next.fen) / base) * 100) };
};

/** Advance payment plans. Discount applies to PRODUCT price only. */
export interface AdvancePlan {
  percent: 60 | 80 | 100 | number;
  discountPct: number;
}
export const DEFAULT_ADVANCE_PLANS: AdvancePlan[] = [
  { percent: 60, discountPct: 0 },
  { percent: 80, discountPct: 2 },
  { percent: 100, discountPct: 3 },
];

export interface Coupon {
  code: string;
  type: 'PERCENT' | 'FLAT';
  /** percent (e.g. 10) or flat amount in paisa */
  value: number;
  minOrderPaisa?: Paisa;
  maxDiscountPaisa?: Paisa;
}

export interface CheckoutLine {
  unitPaisa: Paisa;
  qty: number;
}

export interface CheckoutQuote {
  itemCount: number;
  subtotal: Paisa;
  advanceDiscount: Paisa;
  couponDiscount: Paisa;
  /** product total after discounts */
  net: Paisa;
  payNow: Paisa;
  payOnArrival: Paisa;
  plan: AdvancePlan;
  couponError?: string;
}

export const couponDiscount = (subtotal: Paisa, c?: Coupon): { amount: Paisa; error?: string } => {
  if (!c) return { amount: 0 };
  if (c.minOrderPaisa && subtotal < c.minOrderPaisa) return { amount: 0, error: 'MIN_ORDER_NOT_MET' };
  let amount = c.type === 'PERCENT' ? percentOf(subtotal, c.value) : c.value;
  if (c.maxDiscountPaisa) amount = Math.min(amount, c.maxDiscountPaisa);
  return { amount: Math.min(amount, subtotal) };
};

/**
 * Checkout quote for the PRODUCT part of an order.
 * Freight, China local courier and BD courier are billed later (after weighing).
 */
export const quoteCheckout = (lines: CheckoutLine[], plan: AdvancePlan, coupon?: Coupon): CheckoutQuote => {
  const subtotal = sum(lines.map((l) => l.unitPaisa * l.qty));
  const itemCount = sum(lines.map((l) => l.qty));
  const advanceDiscount = percentOf(subtotal, plan.discountPct);
  const c = couponDiscount(subtotal, coupon);
  const net = Math.max(0, subtotal - advanceDiscount - c.amount);
  const payNow = Math.round((net * plan.percent) / 100);
  return { itemCount, subtotal, advanceDiscount, couponDiscount: c.amount, net, payNow, payOnArrival: net - payNow, plan, couponError: c.error };
};

/** Freight rate table (admin-editable). */
export type ShipMode = 'AIR' | 'SEA';
export interface FreightRate {
  category: string; // A, B, C...
  mode: ShipMode;
  perKgPaisa: Paisa;
  /** Minimum chargeable weight in kg (e.g. 0.5) */
  minKg?: number;
}

export const freightCharge = (weightKg: number, rate: FreightRate): Paisa => {
  const kg = Math.max(weightKg, rate.minKg ?? 0);
  return Math.round(kg * rate.perKgPaisa);
};

/** One line of a customer bill / invoice. */
export interface BillLine {
  code:
    | 'PRODUCT'
    | 'ADVANCE_DISCOUNT'
    | 'COUPON'
    | 'CN_LOCAL_COURIER'
    | 'PACKAGING'
    | 'FREIGHT'
    | 'EXTRA_SERVICE'
    | 'BD_COURIER'
    | 'ADJUSTMENT';
  label: string;
  amount: Paisa; // negative for discounts
}

export interface BillSummary {
  lines: BillLine[];
  total: Paisa;
  paid: Paisa;
  due: Paisa;
}

export const summarizeBill = (lines: BillLine[], paid: Paisa): BillSummary => {
  const total = sum(lines.map((l) => l.amount));
  return { lines, total, paid, due: total - paid };
};
