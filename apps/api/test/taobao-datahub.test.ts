import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSearch, yuanToFen } from '../src/products/taobao-datahub.provider';

const ok = (list: unknown[], total = 4034) => ({ result: { status: { code: 200 }, base: { totalResults: total }, resultList: list } });
const item = (id: string, price: string, promo: string, type = 'tmall') => ({
  item: { itemId: id, title: 'Case', sales: '0', image: '//img.alicdn.com/a.jpg', sku: { def: { price, promotionPrice: promo } } },
  seller: { storeType: type },
});

test('yuan strings become integer fen', () => {
  assert.equal(yuanToFen('629.00'), 62900);
  assert.equal(yuanToFen('7.84'), 784);
  assert.equal(yuanToFen('0.29'), 29);
  assert.equal(yuanToFen(undefined), 0);
  assert.equal(yuanToFen('abc'), 0);
});

test('search maps market, https image, promo and total', () => {
  const r = mapSearch(ok([item('tok1', '356.00', '178.00'), item('tok2', '10.90', '10.90', 'taobao')]));
  assert.equal(r.total, 4034);
  assert.deepEqual(r.items[0], { market: 'TMALL', sourceId: 'tok1', titleEn: 'Case', image: 'https://img.alicdn.com/a.jpg', fen: 35600, promoFen: 17800 });
  assert.equal(r.items[1].market, 'TAOBAO');
  assert.equal(r.items[1].promoFen, undefined);
});

test('items without id or price are skipped; code 205 is empty; other codes throw', () => {
  assert.equal(mapSearch(ok([item('', '5.00', '5.00'), item('t', '0', '0')])).items.length, 0);
  assert.deepEqual(mapSearch({ result: { status: { code: 205 } } }), { items: [], total: 0 });
  assert.throws(() => mapSearch({ result: { status: { code: 500, msg: 'x' } } }));
});

test('real Bellroy result: numeric id, fen with decimals, promo below price', () => {
  const r = mapSearch(ok([item('709942285014', '629.00', '198.55')]));
  assert.equal(r.items[0].sourceId, '709942285014');
  assert.equal(r.items[0].fen, 62900);
  assert.equal(r.items[0].promoFen, 19855);
});
