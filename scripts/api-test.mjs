#!/usr/bin/env node
// DeshTori — product API connection test.
// Run from the repo root:  node scripts/api-test.mjs            (Taobao search + detail)
//                          node scripts/api-test.mjs "phone case" 742458759019
// Reads RAPIDAPI_KEY / RAPIDAPI_HOST / RAPIDAPI_LOCALE from apps/api/.env (key is never printed).
// Saves the raw responses to api-test-output/ so the developer can match the detail format.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';

const env = {};
if (existsSync('apps/api/.env')) {
  for (const line of readFileSync('apps/api/.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const KEY = process.env.RAPIDAPI_KEY || env.RAPIDAPI_KEY;
const HOST = process.env.RAPIDAPI_HOST || env.RAPIDAPI_HOST || 'taobao-datahub.p.rapidapi.com';
const LOCALE = process.env.RAPIDAPI_LOCALE || env.RAPIDAPI_LOCALE || '';
const query = process.argv[2] || '手机壳';
let itemId = process.argv[3] || '';

const out = 'api-test-output';
mkdirSync(out, { recursive: true });
const ok = (s) => console.log('  ✅ ' + s);
const bad = (s) => console.log('  ❌ ' + s);

if (!KEY) {
  bad('RAPIDAPI_KEY পাওয়া যায়নি। apps/api/.env ফাইলে RAPIDAPI_KEY=... লিখুন।');
  process.exit(1);
}
console.log(`\nহোস্ট: ${HOST}   key: ****${KEY.slice(-4)}   locale: ${LOCALE || '(চীনা)'}\n`);

async function call(path, params) {
  const t = Date.now();
  const res = await fetch(`https://${HOST}${path}?${new URLSearchParams({ ...params, ...(LOCALE ? { locale: LOCALE } : {}) })}`, {
    headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': KEY },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { http: res.status, ms: Date.now() - t, json, text, quota: res.headers.get('x-ratelimit-requests-remaining') };
}

let failed = 0;
console.log(`১) সার্চ: "${query}"`);
const s = await call('/item_search', { q: query, page: '1', pageSize: '5', sort: 'default' });
writeFileSync(`${out}/search.json`, s.text);
if (s.http !== 200) { bad(`HTTP ${s.http} — ${s.text.slice(0, 200)}`); failed++; }
else {
  const r = s.json?.result;
  const code = r?.status?.code;
  if (code !== 200) { bad(`API কোড ${code}: ${JSON.stringify(r?.status?.msg ?? '')}`); failed++; }
  else {
    ok(`কাজ করছে (${s.ms}ms), মোট ${r.base?.totalResults} পণ্য` + (s.quota ? `, এই মাসে বাকি রিকোয়েস্ট ${s.quota}` : ''));
    for (const x of (r.resultList ?? []).slice(0, 3)) console.log(`     • ${x.item?.itemId}  ¥${x.item?.sku?.def?.price}  ${String(x.item?.title).slice(0, 50)}`);
    itemId = itemId || r.resultList?.[0]?.item?.itemId || '';
  }
}

console.log(`\n২) পণ্যের বিস্তারিত: ${itemId || '(id নেই)'}`);
if (!itemId) { bad('সার্চ থেকে কোনো id পাওয়া যায়নি'); failed++; }
else {
  const d = await call('/item_detail', { itemId });
  writeFileSync(`${out}/detail.json`, d.text);
  if (d.http !== 200) { bad(`HTTP ${d.http} — ${d.text.slice(0, 200)}`); failed++; }
  else {
    const r = d.json?.result;
    const code = r?.status?.code;
    if (code !== 200) { bad(`API কোড ${code}: ${JSON.stringify(r?.status?.msg ?? '')}`); failed++; }
    else {
      const it = r.item ?? {};
      ok(`কাজ করছে (${d.ms}ms): ${String(it.title).slice(0, 60)}`);
      const sku = it.sku ?? {};
      const checks = [
        ['result.item', !!r.item],
        ['item.images', Array.isArray(it.images) && it.images.length > 0],
        ['sku.def.price', !!sku.def?.price],
        ['sku.base (ভেরিয়েন্ট)', Array.isArray(sku.base)],
        ['sku.props (ভেরিয়েন্টের নাম)', Array.isArray(sku.props)],
        ['base[0].propMap/propPath', !sku.base?.length || !!(sku.base[0].propMap ?? sku.base[0].propPath)],
        ['base[0].quantity (স্টক)', !sku.base?.length || sku.base[0].quantity !== undefined],
      ];
      for (const [name, pass] of checks) (pass ? ok : bad)(`ফিল্ড ${name}`);
      if (checks.some(([, p]) => !p)) { failed++; console.log(`     item-এর ফিল্ড: ${Object.keys(it).join(', ')}`); console.log(`     sku-এর ফিল্ড: ${Object.keys(sku).join(', ')}`); }
      else console.log(`     ভেরিয়েন্ট ${sku.base?.length ?? 0}টা, ছবি ${it.images.length}টা`);
    }
  }
}

console.log(`\n৩) 1688: এই API-তে 1688-এর ডেটা নেই — আলাদা প্রোভাইডার লাগবে।`);
console.log(failed ? `\n⚠️  ${failed}টা সমস্যা। ${out}/ ফোল্ডারের search.json আর detail.json ডেভেলপারকে পাঠান।\n` : `\n🎉 সব ঠিক আছে। ${out}/ ফোল্ডারে আসল রেসপন্স সেভ হয়েছে।\n`);
process.exit(failed ? 1 : 0);
