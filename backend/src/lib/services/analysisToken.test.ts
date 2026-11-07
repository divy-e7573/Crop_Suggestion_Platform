/*
 * Tests for the access token that authorises reading a saved profile back.
 *
 * The token is the whole privacy control that replaced the old global
 * "latest profile" endpoint, so the rules about its shape, its hashing,
 * and its uniqueness are checked here.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ANALYSIS_TOKEN_HEADER,
  ANALYSIS_TOKEN_LENGTH,
  createAnalysisToken,
  hashAnalysisToken,
  isAnalysisToken,
} from './analysisToken.ts';

test('a new token is unguessable and has the expected shape', () => {
  const token = createAnalysisToken();
  assert.equal(token.length, ANALYSIS_TOKEN_LENGTH);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(isAnalysisToken(token));
});

test('two tokens are never the same', () => {
  const tokens = new Set<string>();
  for (let index = 0; index < 200; index += 1) {
    tokens.add(createAnalysisToken());
  }
  assert.equal(tokens.size, 200);
});

test('the hash is stable, is not the token, and does not reveal it', () => {
  const token = createAnalysisToken();
  const hash = hashAnalysisToken(token);

  assert.equal(hash, hashAnalysisToken(token), 'the same token hashes the same way');
  assert.notEqual(hash, token, 'the stored value is not the token itself');
  assert.equal(hash.length, 64, 'the hash is a SHA-256 hex digest');
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes(token), 'the hash does not contain the token');
});

test('two different tokens never share a hash', () => {
  assert.notEqual(
    hashAnalysisToken(createAnalysisToken()),
    hashAnalysisToken(createAnalysisToken()),
  );
});

test('a malformed or missing token is rejected before it is looked up', () => {
  assert.equal(isAnalysisToken(null), false);
  assert.equal(isAnalysisToken(undefined), false);
  assert.equal(isAnalysisToken(''), false);
  assert.equal(isAnalysisToken('too-short'), false);
  assert.equal(isAnalysisToken('a'.repeat(44)), false);
  assert.equal(isAnalysisToken('a'.repeat(42)), false);
  assert.equal(isAnalysisToken('a'.repeat(42) + '!'), false);
  assert.equal(isAnalysisToken('a'.repeat(42) + ' '), false);
  assert.equal(isAnalysisToken('a'.repeat(43)), true);
});

test('the token travels in a header, not in the query string', () => {
  assert.equal(ANALYSIS_TOKEN_HEADER, 'x-analysis-token');
});
