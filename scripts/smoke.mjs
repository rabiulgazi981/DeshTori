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

r = await call('s', 'GET', '/admin/sms/status');
check('owner sees SMS gateway status (dev: console, no key leaked)', r.status === 200 && r.json?.provider === 'console' && r.json?.live === false && !JSON.stringify(r.json).match(/key/i), r);
r = await call('s', 'POST', '/admin/sms/test', { phone: '01712345678' });
check('owner test SMS', r.status === 200 && r.json?.ok === true, r);
r = await call('c', 'GET', '/admin/sms/status');
check('customer blocked from SMS settings', r.status === 401 || r.status === 403, r);

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

// ───────── invoice (snapshot) ─────────
r = await call('s', 'POST', '/admin/invoices', { orderCodes: [order.code], kind: 'DELIVERY' });
check('invoice created', r.status === 201 && r.json.code?.startsWith('INV-') && r.json.totalPaisa - r.json.paidPaisa === 91200, r);
const inv = r.json;
r = await call('c', 'GET', `/invoices/${inv?.code}`);
check('customer opens invoice, fixed caption, no rate', r.status === 200 && r.json.signatureCaption === 'অনুমোদনকারী, DeshTori' && r.json.duePaisa === 91200 && !JSON.stringify(r.json).includes('cnyRate'), r);

// ───────── wallet pay with refund money ─────────
r = await call('s', 'GET', '/admin/customers?q=01712345678');
const cust = r.json?.[0];
check('admin customer search', r.status === 200 && cust?.phone === '+8801712345678', r);
r = await call('s', 'POST', `/admin/customers/${cust?.id}/wallet`, { amount: 50000, note: 'test credit' });
check('wallet credit by accounts', r.status === 201 && r.json.balancePaisa === 50000, r);
r = await call('c', 'POST', '/payments/wallet', { orderCode: order.code, amount: 60000 });
check('wallet pay rejects more than balance', r.status === 400, r);
r = await call('c', 'POST', '/payments/wallet', { orderCode: order.code, amount: 40000 });
check('wallet pay', r.status === 201, r);
r = await call('c', 'GET', `/orders/${order.code}`);
check('due reduced by wallet', r.json?.bill?.due === 51200, r.json?.bill);

// ───────── mock gateway ─────────
r = await call('c', 'GET', '/gateway/methods');
check('gateway methods (no secrets)', r.status === 200 && r.json.MOCK === true && r.json.BKASH_GATEWAY === false, r);
r = await call('c', 'POST', '/gateway/init', { orderCode: order.code, method: 'BKASH_GATEWAY', amount: 1000 });
check('unconfigured gateway refused', r.status === 400, r);
r = await call('c', 'POST', '/gateway/init', { orderCode: order.code, method: 'MOCK', amount: 51200 });
check('mock gateway init', r.status === 201 && r.json.redirectUrl.includes('/gateway/mock/pay'), r);
{
  const res = await fetch(r.json.redirectUrl, { redirect: 'manual' });
  check('mock gateway redirects to result', res.status === 302 && res.headers.get('location')?.includes('ok=1'), res.status);
  const again = await fetch(r.json.redirectUrl, { redirect: 'manual' });
  check('double callback does not pay twice', again.status === 302, again.status);
}
r = await call('c', 'GET', `/orders/${order.code}`);
check('fully paid after gateway', r.json?.bill?.due === 0, r.json?.bill);

// ───────── second order: decision + weight + shipment ─────────
r = await call('c', 'POST', '/cart', { productId: product.id, skuId: sku.skuId, qty: 5, shipMode: 'AIR' });
r = await call('c', 'POST', '/checkout', { advancePercent: 100, addressId, deliveryMethod: 'COURIER_HOME' });
const order2 = r.json?.orders?.[0];
check('second order', r.status === 201 && !!order2, r);
r = await call('c', 'POST', '/gateway/init', { orderCode: order2.code, method: 'MOCK', amount: order2.payNowPaisa });
await fetch(r.json.redirectUrl, { redirect: 'manual' });
r = await call('c', 'GET', `/orders/${order2.code}`);
check('gateway moves order to NEW', r.json?.status === 'NEW', r.json?.status);
r = await call('s', 'PATCH', `/admin/orders/${order2.code}/status`, { status: 'PURCHASING' });
r = await call('s', 'GET', `/admin/orders/${order2.code}`);
check('staff order detail has supplier price', r.status === 200 && r.json.items[0].unitFen > 0 && r.json.cnyRate > 0, r);
const itemId = r.json?.items?.[0]?.id;
r = await call('s', 'POST', `/admin/orders/${order2.code}/decisions`, { itemId, issue: 'দাম বেড়েছে', proposal: 'প্রতি পিস ৳১০ বেশি', diffPaisa: 5000 });
check('decision asked', r.status === 201 && r.json.token, r);
const token = r.json?.token;
r = await call('c', 'GET', `/orders/${order2.code}`);
check('order NEEDS_DECISION', r.json?.status === 'NEEDS_DECISION', r.json?.status);
r = await call('anon', 'GET', `/decisions/${token}`);
check('public decision page', r.status === 200 && r.json.answer === 'PENDING' && !JSON.stringify(r.json).includes('Fen'), r);
r = await call('anon', 'POST', `/decisions/${token}`, { answer: 'YES' });
check('answer YES', r.status === 201, r);
r = await call('anon', 'POST', `/decisions/${token}`, { answer: 'NO' });
check('cannot answer twice', r.status === 400, r);
r = await call('c', 'GET', `/orders/${order2.code}`);
check('back to PURCHASING with +৳50 adjustment', r.json?.status === 'PURCHASING' && r.json.bill.due === 5000, { s: r.json?.status, b: r.json?.bill });
r = await call('s', 'PATCH', `/admin/orders/${order2.code}/items/${itemId}`, { actualFen: 900, purchasedQty: 5 });
check('purchase item update', r.status === 200, r);
r = await call('s', 'PATCH', `/admin/orders/${order2.code}/status`, { status: 'AT_CN_WAREHOUSE' });
r = await call('s', 'POST', `/admin/orders/${order2.code}/weight`, { weightKg: 2, category: 'A' });
check('weight → freight 2kg × ৳760', r.status === 201 && r.json.amount === 152000, r);
r = await call('s', 'POST', `/admin/orders/${order2.code}/weight`, { weightKg: 1.5, category: 'A' });
r = await call('c', 'GET', `/orders/${order2.code}`);
check('re-weigh replaces freight', r.json?.bill?.due === 5000 + 114000, r.json?.bill);

// ───────── ship for me ─────────
r = await call('c', 'POST', '/ship-requests', { warehouse: 'GZ_AIR', trackingNo: 'SF123456', cartons: 3, totalPieces: 120, description: 'T-shirt', category: 'A', extraService: 'NONE' });
check('ship-for-me request', r.status === 201 && r.json.code.startsWith('SHP-') && r.json.shippingMark.startsWith('DT-'), r);
const shp = r.json;
r = await call('s', 'PATCH', `/admin/ship-requests/${shp.code}`, { status: 'RECEIVED', receivedCartons: 3, receivedPieces: 120, weightKg: 18 });
check('warehouse receives parcel', r.status === 200, r);

r = await call('s', 'POST', '/admin/shipments', { mode: 'AIR', route: 'GZ_AIR', carrier: 'CZ', orderCodes: [order2.code], shipRequestCodes: [shp.code], costPaisa: 1000000 });
check('shipment created', r.status === 201 && r.json.code.startsWith('SHIP-'), r);
const ship = r.json;
r = await call('c', 'GET', `/orders/${order2.code}`);
check('order SHIPPED via shipment', r.json?.status === 'SHIPPED', r.json?.status);
r = await call('s', 'PATCH', `/admin/shipments/${ship.code}`, { status: 'ARRIVED_BD' });
check('shipment arrived', r.status === 200, r);
r = await call('c', 'GET', '/ship-requests');
check('parcel ARRIVED_BD with freight bill 18kg × ৳760', r.json?.[0]?.status === 'ARRIVED_BD' && r.json[0].chargePaisa === 1368000, r.json?.[0]);
r = await call('c', 'GET', `/orders/${order2.code}`);
check('order ARRIVED_BD', r.json?.status === 'ARRIVED_BD', r.json?.status);

// ───────── support ─────────
r = await call('c', 'POST', '/tickets', { subject: 'ডেলিভারি কবে?', text: 'কবে পাবো?' });
check('ticket opened', r.status === 201, r);
r = await call('s', 'POST', `/admin/tickets/${r.json?.code}/reply`, { text: 'আগামীকাল' });
check('staff reply', r.status === 201 && r.json.status === 'ANSWERED', r);
r = await call('c', 'POST', '/complaints', { orderCode: order2.code, kind: 'DAMAGED', qty: 1, wants: 'REFUND', details: 'ভাঙা' });
check('complaint', r.status === 201, r);
r = await call('s', 'PATCH', `/admin/complaints/${r.json?.code}`, { status: 'RESOLVED', resolution: '১ পিস ফেরত', refundPaisa: 2000 });
check('complaint resolved with wallet refund', r.status === 200, r);
r = await call('c', 'GET', '/account/wallet');
check('wallet shows refund', r.json?.balancePaisa === 10000 + 2000, r.json);
r = await call('c', 'POST', '/account/withdrawals', { method: 'BKASH', account: '01712345678', amount: 12000 });
check('withdrawal holds money', r.status === 201, r);
r = await call('s', 'PATCH', `/admin/withdrawals/${r.json?.id}`, { status: 'REJECTED' });
r = await call('c', 'GET', '/account/wallet');
check('rejected withdrawal returns money', r.json?.balancePaisa === 12000, r.json);

// ───────── admin config ─────────
r = await call('s', 'GET', '/admin/dashboard');
check('dashboard', r.status === 200 && r.json.customers >= 1, r);
r = await call('s', 'PUT', '/admin/content/videos', { value: [{ title: 'কিভাবে অর্ডার করবেন', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] });
check('save videos', r.status === 200, r);
r = await call('anon', 'GET', '/content/videos');
check('public videos', r.json?.value?.length === 1, r);
r = await call('anon', 'GET', '/content/smsTemplates');
check('private content hidden', r.status === 404, r);
r = await call('s', 'PUT', '/admin/settings/notice', { on: true, textBn: 'নোটিশ', textEn: 'Notice', hotline: '01938-27 38 78', speed: 'fast' });
check('notice saved', r.status === 200 && r.json.notice.textBn === 'নোটিশ', r);
r = await call('s', 'POST', '/admin/staff', { phone: '01811111111', name: 'Karim', roles: ['CN_PURCHASE'], password: 'staff1234' });
check('add staff', r.status === 201, r);
r = await call('s', 'POST', '/admin/coupons', { code: 'eid10', type: 'PERCENT', value: 10, minOrder: 100000 });
check('coupon saved', r.status === 201 && r.json.code === 'EID10', r);
r = await call('s', 'GET', '/admin/ledger');
check('ledger net', r.status === 200 && typeof r.json.netPaisa === 'number', r);
r = await call('s', 'GET', '/admin/audit');
check('audit log', r.status === 200 && r.json.length > 5, r?.json?.length);
r = await call('c', 'POST', '/wishlist', { market: 'M1688', id: '659022687563' });
check('wishlist add (server price)', r.status === 201 && r.json.pricePaisa > 0, r);
r = await call('c', 'POST', '/products/search-image', { imageUrl: 'https://example.com/a.jpg' });
check('image search', r.status === 201 && r.json.items.length > 0, r);
{
  // 1×1 PNG
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  r = await call('c', 'POST', '/uploads', { dataUrl: png });
  check('upload image', r.status === 201 && r.json.url.endsWith('.png'), r);
  const img = await fetch(r.json.url);
  check('uploaded image served', img.status === 200, img.status);
  r = await call('c', 'POST', '/uploads', { dataUrl: 'data:image/png;base64,PHNjcmlwdD4=' });
  check('fake image rejected', r.status === 400, r);
}

// Dashboard controls: ownership, secret redaction, persistence and safe logo URLs.
r = await call('c', 'GET', '/admin/integrations');
check('customer cannot read integrations', r.status === 403, r);
r = await call('x', 'GET', '/admin/integrations');
check('anonymous cannot read integrations', r.status === 401, r);
r = await call('s', 'PUT', '/admin/integrations/products', { values: { provider: 'mock', apiKey: 'ci-example-key', cacheMinutes: '60' } });
check('owner saves integration with secret redacted', r.status === 200 && r.json.configured.apiKey === true && !JSON.stringify(r.json).includes('ci-example-key'), r);
r = await call('s', 'GET', '/admin/settings');
check('general settings exclude integration secrets', r.status === 200 && !Object.keys(r.json).some(k => k.startsWith('private.')), r);
r = await call('s', 'PUT', '/admin/integrations/products', { values: { apiKey: '' } });
check('blank credential preserves stored key', r.status === 200 && r.json.configured.apiKey === true, r);
r = await call('s', 'PUT', '/admin/integrations/products', { values: {}, clearSecrets: ['apiKey'] });
check('explicit clear removes stored key', r.status === 200 && r.json.configured.apiKey === false, r);
r = await call('s', 'POST', '/admin/integrations/products/test');
check('mock provider not reported as live connection', r.status === 201 && r.json.ok === false, r);
const appearance = { primary: '#112233', accent: '#D4A93A', secondary: '#0F6B4F', background: '#F6F2E8', defaultTheme: 'system', headerLogo: '/brand/logo-header.png', footerLogo: '/brand/logo-footer.png', showImageSearch: true, showShipping: true, showMobileNav: true };
r = await call('c', 'PUT', '/admin/appearance', appearance);
check('customer cannot update appearance', r.status === 403, r);
r = await call('s', 'PUT', '/admin/appearance', { ...appearance, headerLogo: 'javascript:alert(1)' });
check('unsafe appearance logo rejected', r.status === 400, r);
r = await call('s', 'PUT', '/admin/appearance', appearance);
check('owner updates appearance', r.status === 200 && r.json.primary === appearance.primary, r);
r = await call('x', 'GET', '/appearance');
check('appearance publicly readable without credentials', r.status === 200 && r.json.defaultTheme === 'system' && !JSON.stringify(r.json).includes('ci-example-key'), r);
r = await call('s', 'GET', '/admin/audit');
check('integration audit redacts credential values', r.status === 200 && !JSON.stringify(r.json).includes('ci-example-key'), r);

r = await call('c', 'POST', '/auth/logout');
r = await call('c', 'GET', '/auth/me');
check('logout revokes session', r.status === 401, r);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
