import assert from 'node:assert/strict';
import test from 'node:test';

import { CORS_ENV_VAR, isOriginAllowed, isValidOrigin, resolveCorsConfig } from './env.ts';

test('isValidOrigin accepts full http(s) origins', () => {
  assert.equal(isValidOrigin('http://localhost:5173'), true);
  assert.equal(isValidOrigin('https://app.example.com'), true);
  assert.equal(isValidOrigin('http://localhost:5173/'), true);
});

test('isValidOrigin rejects wildcards, opaque and non-origin values', () => {
  assert.equal(isValidOrigin('*'), false);
  assert.equal(isValidOrigin('null'), false);
  assert.equal(isValidOrigin('localhost:5173'), false);
  assert.equal(isValidOrigin('file://'), false);
  assert.equal(isValidOrigin('http://localhost:5173/app'), false);
  assert.equal(isValidOrigin('http://localhost:5173?x=1'), false);
  assert.equal(isValidOrigin(''), false);
});

test('resolveCorsConfig parses, trims and de-duplicates a valid list', () => {
  const config = resolveCorsConfig(
    ' http://localhost:5173 , https://app.example.com/ ,http://localhost:5173 ',
    true,
  );
  assert.deepEqual(config.allowedOrigins, ['http://localhost:5173', 'https://app.example.com']);
  assert.equal(config.issues.length, 0);
  assert.equal(config.usingFallback, false);
});

test('resolveCorsConfig drops invalid entries and records why', () => {
  const config = resolveCorsConfig('http://localhost:5173,*,file://', true);
  assert.deepEqual(config.allowedOrigins, ['http://localhost:5173']);
  assert.equal(config.issues.length, 2);
});

test('resolveCorsConfig falls back to localhost:5173 in development only', () => {
  const dev = resolveCorsConfig(undefined, false);
  assert.deepEqual(dev.allowedOrigins, ['http://localhost:5173']);
  assert.equal(dev.usingFallback, true);
  assert.ok(dev.issues.length > 0);

  const prod = resolveCorsConfig(undefined, true);
  assert.deepEqual(prod.allowedOrigins, []);
  assert.equal(prod.usingFallback, false);
});

test('resolveCorsConfig fails closed when every entry is invalid in production', () => {
  const config = resolveCorsConfig('not-an-origin', true);
  assert.deepEqual(config.allowedOrigins, []);
  assert.ok(config.issues.length > 0);
});

test('isOriginAllowed matches case-insensitively and rejects everything else', () => {
  const config = resolveCorsConfig('http://localhost:5173', true);
  assert.equal(isOriginAllowed('http://localhost:5173', config), true);
  assert.equal(isOriginAllowed('HTTP://LOCALHOST:5173', config), true);
  assert.equal(isOriginAllowed('http://evil.example.com', config), false);
  assert.equal(isOriginAllowed(null, config), false);
});

test('the documented environment variable name is stable', () => {
  assert.equal(CORS_ENV_VAR, 'CORS_ALLOWED_ORIGINS');
});
