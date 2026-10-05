// End-to-end smoke test against a running API (used by CI).
// Flow: register (OTP) → login → search → product → cart → address → checkout → manual payment
//       → staff login (password + OTP) → verify payment → move order through statuses.
const API = process.env.API_URL ?? 'http://localhost:4000/api';
let failures = 0;
const jar = {};
async function call(who, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(jar[who] ? { Cookie: jar[who] } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) jar[who] = set.split(';')[0];
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}
function check(name, cond, extra) {
  if (cond) console.log('✓', name);
  else { failures++; console.log('✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); }
}

const phone = '01712345678';
let r = await call('c', 'GET', '/health');
check('health', r.status === 200, r);

r = await call('c', 'POST', '/auth/check-phone', { phone });
check('check-phone new number', r.status === 200 && r.json.exists === false, r);

r = await call('c', 'POST', '/auth/otp', { phone, purpose: 'REGISTER' });
check('otp sent (dev echo)', r.status === 200 && /^\d{6}$/.test(r.json.devCode), r);
const code = r.json?.devCode;

r = await call('c', 'POST', '/auth/register', { phone, code: code === '000000' ? '111111' : '000000', name: 'Test', password: 'abc12345' });
check('register rejects wrong OTP', r.status === 400, r);

r = await call('c', 'POST', '/auth/register', { phone, code, name: 'Rahim Test', password: 'abc12345', buyerType: 'BUSINESS' });
check('register with OTP', r.status === 201 && r.json.user.customerCode?.startsWith('DT-'), r);

r = await call('c', 'POST', '/auth/check-phone', { phone });
check('check-phone existing → password', r.json?.exists === true, r);

r = await call('x', 'POST', '/auth/login', { phone, password: 'wrongpass1' });
check('wrong password rejected', r.status === 401, r);

r = await call('c', 'POST', '/auth/login', { phone, password: 'abc12345' });
check('password login (no OTP)', r.status === 200 && r.json.user, r);

r = await call('c', 'GET', '/auth/me');
check('me', r.status === 200 && r.json.user.phone === '+8801712345678', r);

r = await call('c', 'GET', '/settings/public');
check('public settings has freight + plans, no rate', r.status === 200 && r.json.freight.length === 3 && !JSON.stringify(r.json).includes('cnyRate'), r);

r = await call('c', 'GET', '/products/search?q=phone%20case');
check('search', r.status === 200 && r.json.items.length > 0 && r.json.items[0].pricePaisa > 0, r);
check('search hides CNY', !JSON.stringify(r.json).includes('fen'), r.json.items?.[0]);

r = await call('c', 'GET', '/products/search?q=sex%20toy');
check('banned search blocked', r.json?.blocked === true, r);

r = await call('c', 'POST', '/products/resolve-link', { url: 'https://detail.1688.com/offer/659022687563.html' });
check('resolve 1688 link', r.json?.market === 'M1688' && r.json?.sourceId === '659022687563', r);

r = await call('c', 'GET', '/products/M1688/659022687563');
check('product detail BDT only', r.status === 200 && r.json.skus.length > 0 && !JSON.stringify(r.json).includes('"fen"'), r);
const product = r.json;
const sku = product.skus.find((s) => s.stock > 0);

r = await call('c', 'POST', '/cart', { productId: product.id, skuId: sku.skuId, qty: 10, shipMode: 'AIR' });
check('add to cart', r.status === 201, r);
r = await call('c', 'GET', '/cart');
check('cart view', r.json?.groups?.[0]?.rows?.[0]?.qty === 10, r);

r = await call('c', 'POST', '/account/addresses', { label: 'বাসা', name: 'Rahim', phone, district: 'ঢাকা', area: 'মিরপুর', line: 'বাড়ি ১২' });
check('add address', r.status === 201, r);
const addressId = r.json?.id;

r = await call('c', 'GET', '/checkout/quote?advancePercent=100');
check('quote', r.status === 200 && r.json.payNow > 0 && r.json.payOnArrival === 0, r);
const expectedPayNow = r.json?.payNow;

r = await call('c', 'POST', '/checkout', { advancePercent: 100, addressId, deliveryMethod: 'COURIER_HOME' });
check('checkout creates order', r.status === 201 && r.json.orders.length === 1 && r.json.payNowTotal === expectedPayNow, r);
const order = r.json?.orders?.[0];

r = await call('c', 'GET', '/cart');
check('cart emptied', r.json?.groups?.length === 0, r);

r = await call('c', 'POST', '/payments/manual', { orderCode: order.code, method: 'MANUAL_BKASH', amount: order.payNowPaisa, trxId: 'TESTTRX123', fromNumber: phone });
check('manual payment submitted', r.status === 201, r);

r = await call('c', 'GET', `/orders/${order.code}`);
check('order in PAYMENT_REVIEW, no supplier rate', r.json?.status === 'PAYMENT_REVIEW' && r.json.cnyRate === undefined, r);

r = await call('c', 'GET', '/admin/orders');
check('customer blocked from admin', r.status === 403, r);

// staff
const owner = process.env.SEED_OWNER_PHONE ?? '+8801938273878';
r = await call('s', 'POST', '/auth/login', { phone: owner, password: process.env.SEED_OWNER_PASSWORD });
check('staff password step → needs OTP', r.json?.needOtp === true && r.json.devCode, r);
r = await call('s', 'POST', '/auth/staff/verify', { phone: owner, code: r.json?.devCode });
check('staff 2FA verify', r.status === 200, r);

r = await call('s', 'GET', '/admin/payments/pending');
const pay = r.json?.find?.((p) => p.order?.code === order.code);
check('pending payment visible to staff', !!pay, r);
r = await call('s', 'POST', `/admin/payments/${pay?.id}/verify`, { ok: true });
check('verify payment', r.status === 201, r);

r = await call('c', 'GET', `/orders/${order.code}`);
check('order NEW and paid', r.json?.status === 'NEW' && r.json.bill.paid === order.payNowPaisa && r.json.bill.due === 0, r);

r = await call('s', 'PATCH', `/admin/orders/${order.code}/status`, { status: 'DELIVERED' });
check('illegal transition rejected', r.status === 403, r);
for (const st of ['PURCHASING', 'AT_CN_WAREHOUSE', 'SHIPPED', 'ARRIVED_BD']) {
  r = await call('s', 'PATCH', `/admin/orders/${order.code}/status`, { status: st });
  check(`status → ${st}`, r.status === 200, r);
}
r = await call('s', 'POST', `/admin/orders/${order.code}/charges`, { code: 'FREIGHT', label: 'ফ্রেইট Air 1.2kg', amount: 91200 });
check('add freight charge', r.status === 201, r);
r = await call('c', 'GET', `/orders/${order.code}`);
check('bill shows due freight', r.json?.bill?.due === 91200, r.json?.bill);

r = await call('c', 'POST', '/auth/logout');
r = await call('c', 'GET', '/auth/me');
check('logout revokes session', r.status === 401, r);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
