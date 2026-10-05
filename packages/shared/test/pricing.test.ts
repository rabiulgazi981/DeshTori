import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cnyToBdt, pickTier, nextTierHint, quoteCheckout, DEFAULT_ADVANCE_PLANS, freightCharge, summarizeBill, couponDiscount } from '../src/pricing';
import { toFen, toPaisa } from '../src/money';
import { formatBdt, groupIndian, toBanglaDigits } from '../src/bangla';
import { canTransition } from '../src/status';
import { normalizeBdPhone, maskPhone } from '../src/phone';

const S = { cnyRate: 19.9, marginPct: 0 };

test('CNY → BDT uses rate × (1+margin) and rounds up to whole taka', () => {
  assert.equal(cnyToBdt(toFen(31.24), S), toPaisa(622)); // 621.676 → 622
  assert.equal(cnyToBdt(toFen(10), S), toPaisa(199));
  assert.equal(cnyToBdt(toFen(10), { cnyRate: 19.9, marginPct: 2 }), toPaisa(203)); // 202.98 → 203
});

test('quantity tiers', () => {
  const tiers = [{ minQty: 20, fen: 3000 }, { minQty: 1, fen: 3124 }, { minQty: 9999, fen: 1968 }];
  assert.equal(pickTier(tiers, 5)!.fen, 3124);
  assert.equal(pickTier(tiers, 20)!.fen, 3000);
  assert.equal(pickTier(tiers, 10000)!.fen, 1968);
  assert.deepEqual(nextTierHint(tiers, 15), { needMore: 5, savePct: 4 });
  assert.equal(nextTierHint(tiers, 10000), null);
});

test('checkout quote: advance discount on product only, coupon, pay now / later', () => {
  const lines = [{ unitPaisa: toPaisa(622), qty: 10 }, { unitPaisa: toPaisa(667), qty: 5 }];
  const q = quoteCheckout(lines, DEFAULT_ADVANCE_PLANS[1]); // 80%, 2%
  assert.equal(q.subtotal, toPaisa(9555));
  assert.equal(q.advanceDiscount, toPaisa(191.1));
  assert.equal(q.net, toPaisa(9363.9));
  assert.equal(q.payNow, toPaisa(7491.12));
  assert.equal(q.payNow + q.payOnArrival, q.net);
  const q2 = quoteCheckout(lines, DEFAULT_ADVANCE_PLANS[2], { code: 'WELCOME200', type: 'FLAT', value: toPaisa(200) });
  assert.equal(q2.couponDiscount, toPaisa(200));
  assert.equal(q2.payOnArrival, 0);
});

test('coupon rules', () => {
  assert.equal(couponDiscount(toPaisa(1000), { code: 'X', type: 'PERCENT', value: 10, maxDiscountPaisa: toPaisa(50) }).amount, toPaisa(50));
  assert.equal(couponDiscount(toPaisa(1000), { code: 'X', type: 'FLAT', value: toPaisa(200), minOrderPaisa: toPaisa(2000) }).error, 'MIN_ORDER_NOT_MET');
});

test('freight and bill summary', () => {
  assert.equal(freightCharge(1.2, { category: 'A', mode: 'AIR', perKgPaisa: toPaisa(760) }), toPaisa(912));
  assert.equal(freightCharge(0.2, { category: 'A', mode: 'AIR', perKgPaisa: toPaisa(760), minKg: 0.5 }), toPaisa(380));
  const b = summarizeBill([
    { code: 'PRODUCT', label: 'p', amount: toPaisa(11858) },
    { code: 'ADVANCE_DISCOUNT', label: 'd', amount: -toPaisa(356) },
    { code: 'COUPON', label: 'c', amount: -toPaisa(200) },
    { code: 'CN_LOCAL_COURIER', label: 'l', amount: toPaisa(160) },
    { code: 'PACKAGING', label: 'pk', amount: toPaisa(100) },
    { code: 'FREIGHT', label: 'f', amount: toPaisa(1520) },
    { code: 'EXTRA_SERVICE', label: 'x', amount: toPaisa(300) },
    { code: 'BD_COURIER', label: 'bd', amount: toPaisa(120) },
  ], toPaisa(11994));
  assert.equal(b.total, toPaisa(13502));
  assert.equal(b.due, toPaisa(1508));
});

test('Bangla formatting', () => {
  assert.equal(groupIndian(12345678), '1,23,45,678');
  assert.equal(toBanglaDigits('19.90'), '১৯.৯০');
  assert.equal(formatBdt(toPaisa(11858)), '৳১১,৮৫৮');
  assert.equal(formatBdt(-toPaisa(356), { bangla: false }), '− ৳356');
});

test('status transitions respect roles', () => {
  assert.equal(canTransition('PURCHASING', 'NEEDS_DECISION', 'CN_PURCHASE'), true);
  assert.equal(canTransition('PURCHASING', 'NEEDS_DECISION', 'ACCOUNTS'), false);
  assert.equal(canTransition('DELIVERED', 'NEW', 'OWNER'), false);
  assert.equal(canTransition('SHIPPED', 'ARRIVED_BD', 'OWNER'), true);
});

test('BD phone normalisation', () => {
  assert.equal(normalizeBdPhone('01938-273878'), '+8801938273878');
  assert.equal(normalizeBdPhone('+880 1938 273878'), '+8801938273878');
  assert.equal(normalizeBdPhone('0123'), null);
  assert.equal(maskPhone('+8801938273878'), '+88019XXXXXX78');
});
