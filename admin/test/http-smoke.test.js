import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.DB_PASSWORD ||= 'http-smoke-test-only';
process.env.JWT_SECRET ||= 'http-smoke-jwt-secret-for-tests';

const { default: app } = await import('../src/app.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health endpoint is available and Express version header is disabled', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.status, 'ok');
  assert.equal(response.headers.has('x-powered-by'), false);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-site');
});

test('protected learning details reject missing credentials before database access', async () => {
  const response = await fetch(`${baseUrl}/api/learning/papers/1`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.code, 401);
});

test('unknown API paths return the documented 404 envelope', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.code, 404);
});

test('malformed and oversized JSON return sanitized client errors', async () => {
  const malformed = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"username":'
  });
  const malformedBody = await malformed.json();
  assert.equal(malformed.status, 400);
  assert.equal(malformedBody.error, 'invalid_json');
  assert.doesNotMatch(malformedBody.message, /Unexpected|JSON.parse|stack/i);

  const oversized = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ padding: 'x'.repeat(1024 * 1024) })
  });
  const oversizedBody = await oversized.json();
  assert.equal(oversized.status, 413);
  assert.equal(oversizedBody.error, 'payload_too_large');
})
