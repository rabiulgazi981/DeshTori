import test from 'node:test';
import assert from 'node:assert/strict';
import { alphaBody, alphaNumber, parseAlpha, AlphaSmsError, AlphaSms } from '../src/notify/alpha-sms';

test('numbers become 8801XXXXXXXXX', () => {
  assert.equal(alphaNumber('+8801938273878'), '8801938273878');
  assert.equal(alphaNumber('01938-273878'), '8801938273878');
  assert.equal(alphaNumber('8801938273878'), '8801938273878');
});

test('POST body carries key, number, message; sender_id only when set', () => {
  const b = alphaBody('KEY', '+8801938273878', 'DeshTori কোড: 123456');
  assert.equal(b.get('api_key'), 'KEY');
  assert.equal(b.get('to'), '8801938273878');
  assert.equal(b.get('msg'), 'DeshTori কোড: 123456');
  assert.equal(b.has('sender_id'), false);
  assert.equal(alphaBody('KEY', '01938273878', 'x', 'DeshTori').get('sender_id'), 'DeshTori');
});

test('responses: success, documented errors, non-JSON', () => {
  assert.deepEqual(parseAlpha(200, '{"error":0,"msg":"Request successfully submitted","data":{"request_id":42}}'), { requestId: 42 });
  assert.throws(() => parseAlpha(200, '{"error":417,"msg":"Insufficient balance"}'), (e: unknown) => e instanceof AlphaSmsError && e.code === 417 && /ব্যালেন্স/.test(e.message));
  assert.throws(() => parseAlpha(200, '{"error":403,"msg":"Invalid api key"}'), /API key/);
  assert.throws(() => parseAlpha(502, '<html>bad gateway</html>'), (e: unknown) => e instanceof AlphaSmsError && e.code === 502);
});

test('send() posts form data to /sendsms and never puts the key in the URL', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response('{"error":0,"msg":"ok","data":{"request_id":1}}', { status: 200 });
  }) as typeof fetch;
  try {
    await new AlphaSms('SECRET', undefined, 'https://example.test').send('+8801712345678', 'hi');
  } finally {
    globalThis.fetch = orig;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.test/sendsms');
  assert.equal(calls[0].init.method, 'POST');
  assert.ok(!calls[0].url.includes('SECRET'));
  assert.equal(new URLSearchParams(String(calls[0].init.body)).get('to'), '8801712345678');
  assert.throws(() => new AlphaSms(''), /SMS_API_KEY/);
});
