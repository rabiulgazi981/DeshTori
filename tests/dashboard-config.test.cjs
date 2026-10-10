const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt } = require('../apps/api/dist/integrations/crypto');
const { IntegrationsService } = require('../apps/api/dist/integrations/integrations.service');
const { SettingsService } = require('../apps/api/dist/settings/settings.service');
const { ConfigController } = require('../apps/api/dist/admin/config.controller');
const { ROLES_KEY } = require('../apps/api/dist/auth/guards');
const key = 'test-only-encryption-key-32-characters';
function fixture() {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = key;
  const records = new Map(); const logs = []; let invalidations = 0;
  const prisma = { setting: {
    findUnique: async ({ where }) => records.get(where.key) || null,
    findMany: async ({ where }) => [...records.values()].filter(r => where.key.in.includes(r.key)),
    upsert: async ({ where, create, update }) => { const row = records.has(where.key) ? { ...records.get(where.key), ...update } : create; records.set(where.key, row); return row; },
  }, product: { updateMany: async () => { invalidations++; } } };
  const audit = { log: async v => logs.push(v) };
  return { service: new IntegrationsService(prisma, audit), prisma, audit, records, logs, invalidations: () => invalidations };
}
test('credentials are encrypted, authenticated and use random IVs', () => {
  const value = { apiKey: 'example-secret' }; const a = encrypt(value, key), b = encrypt(value, key);
  assert.notEqual(a, b); assert.equal(a.includes(value.apiKey), false); assert.deepEqual(decrypt(a, key), value);
  assert.throws(() => decrypt(a, 'wrong-key-32-characters-0000000000'));
  assert.throws(() => encrypt(value, 'short'));
});
test('owner responses and audit records never return credentials', async () => {
  const f = fixture(); const r = await f.service.save('products', { provider: 'alibaba-1688', apiKey: 'example-secret', cacheMinutes: '90' }, [], 'owner');
  assert.equal(r.configured.apiKey, true); assert.equal(r.values.apiKey, undefined);
  assert.equal(JSON.stringify(r).includes('example-secret'), false);
  assert.equal(JSON.stringify(f.logs).includes('example-secret'), false);
  assert.equal(JSON.stringify([...f.records.values()]).includes('example-secret'), false);
  assert.equal((await f.service.resolve('products')).apiKey, 'example-secret'); assert.equal(f.invalidations(), 1);
});
test('blank input keeps credentials, explicit clear overrides env fallback', async () => {
  const f = fixture(); const old = process.env.RAPIDAPI_KEY; process.env.RAPIDAPI_KEY = 'environment-key';
  try {
    await f.service.save('products', { apiKey: 'saved-key' }, [], 'owner');
    await f.service.save('products', { apiKey: '', cacheMinutes: '120' }, [], 'owner');
    assert.equal((await f.service.resolve('products')).apiKey, 'saved-key');
    await f.service.save('products', {}, ['apiKey'], 'owner');
    assert.equal((await f.service.resolve('products')).apiKey, '');
  } finally { if (old === undefined) delete process.env.RAPIDAPI_KEY; else process.env.RAPIDAPI_KEY = old; }
});
test('provider changes take effect without a service restart', async () => {
  const f = fixture(); await f.service.save('products', { provider: 'mock' }, [], 'owner');
  assert.equal((await f.service.resolve('products')).provider, 'mock');
  await f.service.save('products', { provider: 'alibaba-1688', apiKey: 'new-key' }, [], 'owner');
  assert.equal((await f.service.resolve('products')).provider, 'alibaba-1688');
});
test('unknown fields, invalid provider, cache limits and gateway environments are rejected', async () => {
  const f = fixture();
  for (const values of [{ url: 'http://127.0.0.1' }, { provider: 'arbitrary' }, { cacheMinutes: '0' }, { cacheMinutes: '10081' }]) await assert.rejects(() => f.service.save('products', values, [], 'owner'));
  await assert.rejects(() => f.service.save('bkash', { environment: 'http://localhost' }, [], 'owner'));
  await assert.rejects(() => f.service.save('products', {}, ['provider'], 'owner'));
});
test('general settings never include encrypted integrations', async () => {
  const f = fixture(); await f.service.save('products', { apiKey: 'example-secret' }, [], 'owner');
  const cache = { get: async () => null, set: async () => {} };
  const settings = await new SettingsService(f.prisma, cache, f.audit).get();
  assert.equal(Object.keys(settings).some(k => k.startsWith('private.')), false);
});
test('all admin config endpoints enforce OWNER role', () => {
  for (const method of ['list', 'save', 'test', 'saveAppearance']) assert.deepEqual(Reflect.getMetadata(ROLES_KEY, ConfigController.prototype[method]), ['OWNER']);
  assert.equal(Reflect.getMetadata(ROLES_KEY, ConfigController.prototype.appearance), undefined);
});
test('appearance persists public fields and rejects unsafe logo URLs', async () => {
  const f = fixture(); const controller = new ConfigController(f.service, {}, f.prisma, f.audit);
  const value = { primary: '#112233', accent: '#CCAA44', secondary: '#116644', background: '#FFFFFF', defaultTheme: 'system', headerLogo: '/brand/logo-header.png', footerLogo: 'https://example.com/logo.png', showImageSearch: false, showShipping: false, showMobileNav: true };
  await controller.saveAppearance({ user: { id: 'owner' } }, value);
  assert.deepEqual(await controller.appearance(), value);
  for (const url of ['javascript:alert(1)', '//example.com/logo.png', 'http://example.com/logo.png']) await assert.rejects(() => controller.saveAppearance({ user: { id: 'owner' } }, { ...value, headerLogo: url }));
});
