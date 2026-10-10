import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSearch, yuanToFen } from '../src/products/taobao-datahub.map';

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

// ───────── detail ─────────
import { mapDetail, parsePropMap, DetailShapeError } from '../src/products/taobao-datahub.map';

const detail = (item: unknown, extra: Record<string, unknown> = {}) => ({ result: { status: { code: 200 }, item, ...extra } });
const caseItem = {
  itemId: 742458759019,
  title: 'FIVI 手机壳',
  itemUrl: '//detail.tmall.com/item.htm?id=742458759019',
  images: ['//img.alicdn.com/1.jpg', 'https://img.alicdn.com/2.jpg'],
  sales: '1200',
  properties: { list: [{ name: '品牌', value: 'FIVI' }, { name: '材质', value: '皮' }] },
  sku: {
    def: { price: '39.90', promotionPrice: '29.90', quantity: '500' },
    props: [
      { pid: 1627207, name: '颜色分类', values: [{ vid: 1, name: '黑色', image: '//img.alicdn.com/black.jpg' }, { vid: 2, name: '棕色' }] },
      { pid: 20509, name: '适用型号', values: [{ vid: 11, name: 'Mate 60 Pro' }, { vid: 12, name: 'Mate 70' }] },
    ],
    base: [
      { skuId: 5001, propMap: '1627207:1;20509:11', price: '39.90', promotionPrice: '29.90', quantity: '120' },
      { skuId: 5002, propPath: '1627207:2;20509:12', price: '42.00', promotionPrice: '42.00', quantity: 0 },
      { skuId: 5003, propMap: '1627207:1;20509:12', price: '', quantity: undefined },
    ],
  },
};

test('propMap parsing', () => {
  assert.deepEqual(parsePropMap('1627207:1;20509:11'), [['1627207', '1'], ['20509', '11']]);
  assert.deepEqual(parsePropMap('bad;;x:'), []);
  assert.deepEqual(parsePropMap(undefined), []);
});

test('detail maps variants, names, stock, images, seller and attributes', () => {
  const d = mapDetail(detail(caseItem, { seller: { storeTitle: 'FIVI旗舰店' }, delivery: { areaFrom: ['广东', '深圳'] } }), '742458759019')!;
  assert.equal(d.market, 'TMALL');
  assert.equal(d.sourceId, '742458759019');
  assert.equal(d.sourceUrl, 'https://detail.tmall.com/item.htm?id=742458759019');
  assert.deepEqual(d.images, ['https://img.alicdn.com/1.jpg', 'https://img.alicdn.com/2.jpg']);
  assert.equal(d.sellerName, 'FIVI旗舰店');
  assert.equal(d.sellerLocation, '广东 深圳');
  assert.deepEqual(d.attributes, { 品牌: 'FIVI', 材质: '皮' });
  assert.equal(d.soldCount, 1200);
  assert.equal(d.skus.length, 3);
  assert.deepEqual(d.skus[0], { skuId: '5001', props: { 颜色分类: '黑色', 适用型号: 'Mate 60 Pro' }, fen: 3990, promoFen: 2990, stock: 120, image: 'https://img.alicdn.com/black.jpg' });
  assert.deepEqual(d.skus[1].props, { 颜色分类: '棕色', 适用型号: 'Mate 70' }); // propPath accepted
  assert.equal(d.skus[1].stock, 0);
  assert.equal(d.skus[1].promoFen, undefined); // promo not below price
  assert.equal(d.skus[2].fen, 3990); // missing SKU price falls back to item price
  assert.equal(d.skus[2].stock, 999); // unknown stock → available
});

test('item without variants gets one default SKU; taobao market', () => {
  const d = mapDetail(detail({ itemId: '1', title: 't', itemUrl: '//item.taobao.com/item.htm?id=1', images: [], sku: { def: { price: '5.50', quantity: '7' } } }), '1')!;
  assert.equal(d.market, 'TAOBAO');
  assert.deepEqual(d.skus, [{ skuId: '1', props: { Option: 'Standard' }, fen: 550, stock: 7 }]);
});

test('detail: not found → null, unknown shape → DetailShapeError with keys, error code → throws', () => {
  assert.equal(mapDetail({ result: { status: { code: 205 } } }, '1'), null);
  assert.throws(() => mapDetail({ result: { status: { code: 200 } } }, '1'), DetailShapeError);
  try {
    mapDetail(detail({ itemId: '1', title: 't', skuList: [] }), '1');
    assert.fail('should throw');
  } catch (e) {
    assert.ok(e instanceof DetailShapeError);
    assert.match((e as Error).message, /skuList/);
  }
  assert.throws(() => mapDetail({ result: { status: { code: 500, msg: 'quota' } } }, '1'), /quota/);
});
