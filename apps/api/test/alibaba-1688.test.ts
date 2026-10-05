import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanTitle, mapDetail1688, mapSearch1688, tierMin, Ali1688Error } from '../src/products/alibaba-1688.map';

// trimmed copies of real responses (2026-10-05)
const fx = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'alibaba-1688.json'), 'utf8'));

test('title cleanup and tier parsing', () => {
  assert.equal(cleanTitle('i<font color=red>Phone</font> 17 <b>case</b>'), 'iPhone 17 case');
  assert.equal(tierMin('200~499件'), 200);
  assert.equal(tierMin('≥1000件'), 1000);
  assert.equal(tierMin(''), undefined);
});

test('live search: 3 offers, cleaned titles, fen, sold, total', () => {
  const r = mapSearch1688(fx.search);
  assert.equal(r.total, 2000);
  assert.equal(r.items.length, 3);
  assert.deepEqual(r.items[1], {
    market: 'M1688',
    sourceId: '971924460373',
    titleEn: 'Mixed Batch phone case for 适用 iPhone 17/18pro/18promax/air',
    image: 'https://cbu01.alicdn.com/img/ibank/O1CN012ACLPL1if7DtHXGeg_!!2214203114439-0-cib.jpg',
    fen: 130,
    soldCount: 677,
  });
  assert.equal(r.items[0].fen, 1150);
  assert.equal(r.items[0].soldCount, undefined); // bookedCount "0"
});

test('live detail, variant-priced: charges the highest variant price, one option, stock, weight', () => {
  const d = mapDetail1688(fx.detail1, '971924460373')!;
  assert.equal(d.market, 'M1688');
  assert.equal(d.sourceUrl, 'https://detail.1688.com/offer/971924460373.html');
  assert.equal(d.images.length, 5);
  assert.equal(d.sellerName, '广州贝尚电子有限公司');
  assert.equal(d.sellerLocation, '广东广州');
  assert.equal(d.weightKg, 0.03);
  assert.equal(d.soldCount, 123182);
  assert.equal(d.attributes!['品牌'], '朵壳');
  assert.deepEqual(d.skus, [{ skuId: '971924460373', props: { Option: 'Standard' }, fen: 150, stock: 187699 }]);
  assert.equal(d.priceTiers, undefined);
});

test('live detail, range-priced: quantity tiers 1/100/10000', () => {
  const d = mapDetail1688(fx.detail2, '946112771221')!;
  assert.deepEqual(d.priceTiers, [
    { minQty: 1, fen: 9500 },
    { minQty: 100, fen: 8500 },
    { minQty: 10000, fen: 6500 },
  ]);
  assert.equal(d.skus[0].fen, 9500);
  assert.equal(d.skus[0].stock, 50595);
  assert.equal(d.weightKg, undefined); // unitWeight 0
});

test('errors: non-zero code throws, empty data → null, sold out → stock 0', () => {
  assert.throws(() => mapSearch1688({ code: 1, message: 'quota' }), Ali1688Error);
  assert.throws(() => mapDetail1688({ code: 500 }, '1'), /alibaba-1688 detail failed/);
  assert.equal(mapDetail1688({ code: 0, data: null }, '1'), null);
  const soldOut = JSON.parse(JSON.stringify(fx.detail2));
  soldOut.data.item.saleOut = true;
  assert.equal(mapDetail1688(soldOut, '946112771221')!.skus[0].stock, 0);
});
