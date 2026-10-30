/*
 * The request contract of `POST /api/farm-profile/analyze`.
 *
 * The route handler itself cannot be imported here, because the plain Node
 * test runner cannot resolve the `next/server` subpath export. These tests
 * therefore exercise the exact call the route makes - `parseJsonBody` with
 * the profile schema - against real `Request` objects, which covers the
 * server-side validation rules end to end.
 *
 * The full HTTP behaviour, including the database write, is verified against
 * a running server during the phase verification run.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { ValidationError } from '../api/errors.ts';
import { toErrorResponse } from '../api/response.ts';
import { parseJsonBody } from '../api/validation.ts';
import { farmProfileSchema } from './farmProfileService.ts';

const validBody = {
  state: 'Maharashtra',
  district: 'Nashik',
  soilType: 'BLACK',
  season: 'KHARIF',
  landArea: 2.5,
  landAreaUnit: 'ACRE',
};

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/farm-profile/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function expectFailure(request: Request): Promise<ValidationError> {
  try {
    await parseJsonBody(farmProfileSchema, request);
  } catch (error) {
    assert.ok(error instanceof ValidationError, 'expected a ValidationError');
    return error;
  }
  throw new Error('expected the request to be rejected');
}

test('a valid profile body is accepted and trimmed', async () => {
  const parsed = await parseJsonBody(
    farmProfileSchema,
    jsonRequest({ ...validBody, state: '  Maharashtra ', district: ' Nashik ' }),
  );

  assert.equal(parsed.state, 'Maharashtra');
  assert.equal(parsed.district, 'Nashik');
  assert.equal(parsed.landArea, 2.5);
});

test('the optional fields may be left out entirely', async () => {
  const parsed = await parseJsonBody(farmProfileSchema, jsonRequest(validBody));

  assert.equal(parsed.villageOrPin, undefined);
  assert.equal(parsed.irrigationType, undefined);
  assert.equal(parsed.currentCrop, undefined);
});

test('an invalid body reports the field that caused it', async () => {
  const error = await expectFailure(
    jsonRequest({ ...validBody, soilType: 'PEAT', landArea: -1 }),
  );

  const fields = (error.details ?? []).map((detail) => detail.field).sort();
  assert.deepEqual(fields, ['landArea', 'soilType']);
  assert.equal(error.status, 400);
});

test('a body that is not JSON is rejected', async () => {
  const request = new Request('http://localhost/api/farm-profile/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json at all',
  });

  const error = await expectFailure(request);
  assert.equal(error.details?.[0]?.code, 'invalid_json');
});

test('an empty body is rejected', async () => {
  const request = new Request('http://localhost/api/farm-profile/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '',
  });

  const error = await expectFailure(request);
  assert.equal(error.details?.[0]?.code, 'invalid_type');
});

test('an oversized body is rejected before it is parsed', async () => {
  const request = new Request('http://localhost/api/farm-profile/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'content-length': '200000' },
    body: JSON.stringify(validBody),
  });

  const error = await expectFailure(request);
  assert.equal(error.details?.[0]?.code, 'too_big');
});

test('unknown fields are dropped instead of being stored', async () => {
  const parsed = await parseJsonBody(
    farmProfileSchema,
    jsonRequest({ ...validBody, farmerName: 'Not collected', phone: '9999999999' }),
  );

  assert.equal('farmerName' in parsed, false);
  assert.equal('phone' in parsed, false);
});

test('a rejected body produces the standard error envelope', async () => {
  const error = await expectFailure(jsonRequest({ ...validBody, state: '' }));
  const response = toErrorResponse(error);
  const body = (await response.json()) as {
    success: boolean;
    error: { code: string; details?: { field: string }[] };
  };

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.equal(body.error.details?.[0]?.field, 'state');
});

