// Screenshots of key pages at phone (390px) and desktop (1280px) width, after the smoke test filled the DB.
// Also fails if any page has horizontal scroll on mobile or shows a CNY/¥ price to a customer.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000/api';
mkdirSync('shots', { recursive: true });

const post = async (path, body) => {
  // auth endpoints are throttled (20/min per IP) and the smoke test just used most of that budget — wait it out
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status !== 429) return r;
    await new Promise((res) => setTimeout(res, 20000));
  }
  throw new Error(`${path} still rate limited`);
};

async function login(phone, password, staff) {
  let r = await post('/auth/login', { phone, password });
  let cookie = r.headers.get('set-cookie');
  if (staff) {
    const j = await r.json();
    r = await post('/auth/staff/verify', { phone, code: j.devCode });
    cookie = r.headers.get('set-cookie');
  }
  if (!cookie) throw new Error(`login failed for ${phone}: HTTP ${r.status}`);
  const [kv] = cookie.split(';');
  const [name, value] = kv.split('=');
  return { name, value, domain: 'localhost', path: '/' };
}

const customer = await login('01712345678', 'abc12345', false);
const owner = await login(process.env.SEED_OWNER_PHONE, process.env.SEED_OWNER_PASSWORD, true);
const orders = await (await fetch(`${API}/orders`, { headers: { Cookie: `${customer.name}=${customer.value}` } })).json();
const inv = await (await fetch(`${API}/invoices`, { headers: { Cookie: `${customer.name}=${customer.value}` } })).json();
const oc = orders[0]?.code;

const pages = [
  ['home', '/', null],
  ['search', '/search?q=phone%20case', null],
  ['product', '/p/M1688/659022687563', null],
  ['rates', '/rates', null],
  ['about', '/about', null],
  ['login', '/login', null],
  ['ship', '/ship', customer],
  ['account', '/account', customer],
  ['order', `/account/orders/${oc}`, customer],
  ['wallet', '/account/wallet', customer],
  ['support', '/support', customer],
  ['invoice', `/invoice/${inv[0]?.code}`, customer],
  ['admin-dashboard', '/admin', owner],
  ['admin-orders', '/admin/orders', owner],
  ['admin-order', `/admin/orders/${oc}`, owner],
  ['admin-content', '/admin/content', owner],
  ['admin-settings', '/admin/settings', owner],
];

const browser = await chromium.launch();
const problems = [];
for (const [w, h, tag] of [[390, 844, 'm'], [1280, 900, 'd']]) {
  for (const [name, path, cookie] of pages) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    if (cookie) await ctx.addCookies([cookie]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(WEB + path, { waitUntil: 'networkidle' }).catch((e) => errors.push(String(e)));
    await page.waitForTimeout(600);
    const info = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, text: document.body.innerText }));
    if (tag === 'm' && info.sw > info.cw + 1) problems.push(`${name}: horizontal scroll on mobile (${info.sw}px > ${info.cw}px)`);
    if (!name.startsWith('admin') && /¥|CNY|人民币/.test(info.text)) problems.push(`${name}: shows CNY to customer`);
    if (/Application error|Unhandled Runtime Error/.test(info.text)) problems.push(`${name}: application error`);
    for (const e of errors) problems.push(`${name}: ${e.slice(0, 200)}`);
    await page.screenshot({ path: `shots/${tag}-${name}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();
writeFileSync('shots/problems.txt', problems.join('\n') || 'none');
console.log(problems.length ? problems.map((p) => '✗ ' + p).join('\n') : 'no layout problems');
process.exit(problems.length ? 1 : 0);
