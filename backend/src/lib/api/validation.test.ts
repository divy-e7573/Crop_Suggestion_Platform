import assert from 'node:assert/strict';
import test from 'node:test';

import { z } from 'zod';

import { ValidationError } from './errors.ts';
import { boundedIntQuery, parseJsonBody, parseQuery, parseValue } from './validation.ts';

// boundedIntQuery returns a schema for one query field, so it is used inside
// an object schema exactly as a real route would use it.
const limitQuery = z.object({
  limit: boundedIntQuery({ defaultValue: 25, min: 1, max: 100 }),
});

function expectValidationError(fn: () => unknown): ValidationError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof ValidationError, 'expected a ValidationError');
    return error;
  }
  throw new Error('expected the call to throw');
}

test('parseValue returns typed data for valid input', () => {
  const schema = z.object({ name: z.string().min(1) });
  assert.deepEqual(parseValue(schema, { name: 'ok' }), { name: 'ok' });
});

test('parseValue rejects with a 400 ValidationError carrying field details', () => {
  const schema = z.object({ name: z.string().min(3) });
  const error = expectValidationError(() => parseValue(schema, { name: '' }, 'body'));
  assert.equal(error.status, 400);
  assert.equal(error.code, 'VALIDATION_ERROR');
  assert.ok(error.message.includes('body'));
  assert.equal(error.details?.[0]?.field, 'name');
});

test('boundedIntQuery applies the default when the parameter is absent or blank', () => {
  assert.equal(parseValue(limitQuery, {}).limit, 25);
  assert.equal(parseValue(limitQuery, { limit: '' }).limit, 25);
});

test('boundedIntQuery coerces valid values and clamps out-of-range ones', () => {
  assert.equal(parseValue(limitQuery, { limit: '10' }).limit, 10);

  const tooLow = expectValidationError(() => parseValue(limitQuery, { limit: '0' }));
  assert.ok(tooLow.details?.[0]?.message?.includes('between 1 and 100'));

  const tooHigh = expectValidationError(() => parseValue(limitQuery, { limit: '5000' }));
  assert.ok(tooHigh.details?.[0]?.message?.includes('between 1 and 100'));

  const notWhole = expectValidationError(() => parseValue(limitQuery, { limit: '1.5' }));
  assert.ok(notWhole.details?.[0]?.message?.includes('whole number'));

  const notNumeric = expectValidationError(() => parseValue(limitQuery, { limit: 'abc' }));
  assert.ok(notNumeric.details?.[0]?.message?.includes('whole number'));
});

test('parseQuery reads the URL and rejects a repeated parameter', () => {
  const ok = parseQuery(limitQuery, new Request('http://localhost:3000/api/x?limit=5'));
  assert.equal(ok.limit, 5);

  const error = expectValidationError(() =>
    parseQuery(limitQuery, new Request('http://localhost:3000/api/x?limit=5&limit=6')),
  );
  assert.equal(error.details?.[0]?.code, 'duplicate');
});

test('parseJsonBody parses valid JSON and maps failures to 400', async () => {
  const schema = z.object({ name: z.string().min(1) });

  const ok = await parseJsonBody(schema, new Request('http://localhost/api', {
    method: 'POST',
    body: JSON.stringify({ name: 'ok' }),
  }));
  assert.deepEqual(ok, { name: 'ok' });

  await assert.rejects(
    () => parseJsonBody(schema, new Request('http://localhost/api', { method: 'POST', body: '{' })),
    (error: unknown) => error instanceof ValidationError && error.details?.[0]?.code === 'invalid_json',
  );

  await assert.rejects(
    () => parseJsonBody(schema, new Request('http://localhost/api', { method: 'POST', body: '' })),
    (error: unknown) => error instanceof ValidationError,
  );

  await assert.rejects(
    () =>
      parseJsonBody(
        schema,
        new Request('http://localhost/api', {
          method: 'POST',
          headers: { 'content-length': '999999' },
          body: JSON.stringify({ name: 'ok' }),
        }),
      ),
    (error: unknown) => error instanceof ValidationError && error.details?.[0]?.code === 'too_big',
  );
});
