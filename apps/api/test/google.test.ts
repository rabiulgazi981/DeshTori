import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyGoogleIdToken } from '../src/auth/google';

const realFetch = globalThis.fetch;
const reply = (body: object, status = 200) => {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
};
const good = { aud: 'CID', iss: 'https://accounts.google.com', sub: '123', email: 'A@Gmail.com', email_verified: 'true', name: 'Rabiul', exp: String(Math.floor(Date.now() / 1000) + 600) };

test.afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GOOGLE_CLIENT_ID;
});

test('accepts a token issued for our client id', async () => {
  process.env.GOOGLE_CLIENT_ID = 'CID';
  reply(good);
  assert.deepEqual(await verifyGoogleIdToken('tok'), { sub: '123', email: 'a@gmail.com', name: 'Rabiul' });
});

test('rejects another app’s token, a wrong issuer, an expired token or a Google error', async () => {
  process.env.GOOGLE_CLIENT_ID = 'CID';
  reply({ ...good, aud: 'OTHER' });
  assert.equal(await verifyGoogleIdToken('tok'), null);
  reply({ ...good, iss: 'evil.example' });
  assert.equal(await verifyGoogleIdToken('tok'), null);
  reply({ ...good, exp: '1' });
  assert.equal(await verifyGoogleIdToken('tok'), null);
  reply({ error: 'invalid_token' }, 400);
  assert.equal(await verifyGoogleIdToken('tok'), null);
});

test('drops an unverified email and refuses when no client id is set', async () => {
  process.env.GOOGLE_CLIENT_ID = 'CID';
  reply({ ...good, email_verified: 'false' });
  assert.equal((await verifyGoogleIdToken('tok'))?.email, undefined);
  delete process.env.GOOGLE_CLIENT_ID;
  assert.equal(await verifyGoogleIdToken('tok'), null);
});
