import assert from 'node:assert/strict';
import test from 'node:test';

import { NotFoundError, ValidationError } from './errors.ts';
import { jsonOk, toErrorResponse } from './response.ts';

test('jsonOk returns the success envelope with the given status', async () => {
  const response = jsonOk({ hello: 'world' }, 201);
  assert.equal(response.status, 201);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  assert.deepEqual(await response.json(), { success: true, data: { hello: 'world' } });
});

test('toErrorResponse preserves a known ApiError', async () => {
  const response = toErrorResponse(new NotFoundError('No such market.'));
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    success: false,
    error: { code: 'NOT_FOUND', message: 'No such market.' },
  });
});

test('toErrorResponse includes validation details in the standard shape', async () => {
  const error = new ValidationError('Bad input.', [
    { field: 'limit', message: 'Too big.', code: 'too_big' },
  ]);
  const response = toErrorResponse(error);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Bad input.',
      details: [{ field: 'limit', message: 'Too big.', code: 'too_big' }],
    },
  });
});

test('toErrorResponse hides stack traces and internal detail for unknown errors', async () => {
  const secret = 'postgresql://user:hunter2@localhost:5432/db';
  const leaky = new Error('connection failed: ' + secret);
  leaky.stack = 'Error: connection failed\n    at secretFunction (/app/db.ts:1:1)';

  // The raw error is logged server-side on purpose; capture it so the test
  // output stays readable and so the logging itself is asserted.
  const logged: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => logged.push(args);
  let response: Response;
  try {
    response = toErrorResponse(leaky);
  } finally {
    console.error = originalError;
  }
  const text = await response.text();

  assert.equal(response.status, 500);
  assert.equal(logged.length, 1, 'the raw error must be logged on the server');
  assert.ok(!text.includes(secret), 'must not leak the connection string');
  assert.ok(!text.includes('secretFunction'), 'must not leak the stack');
  assert.deepEqual(JSON.parse(text), {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'The server could not complete the request. Please try again.',
    },
  });
});
