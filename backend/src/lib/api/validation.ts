import { z } from 'zod';

import { type ApiErrorDetail, ValidationError } from './errors.ts';

/**
 * Reusable request validation for the API layer.
 *
 * Every route handler parses client input through these helpers so that
 * validation failures always produce the same 400 envelope
 * (PRD FR-02 and FR-09). Frontend validation is never trusted on its own.
 */

function toDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

function fail(source: string, error: z.ZodError): never {
  throw new ValidationError(
    'The ' + source + ' is invalid. Check the highlighted fields and try again.',
    toDetails(error),
  );
}

/** Parses an already-decoded value, such as a JSON body. */
export function parseValue<T>(schema: z.ZodType<T>, value: unknown, source = 'request'): T {
  const result = schema.safeParse(value);
  if (!result.success) fail(source, result.error);
  return result.data;
}

/**
 * Parses URL query parameters into a typed, bounded object.
 *
 * A repeated key is rejected rather than silently taking the first value, so a
 * caller cannot smuggle a second, conflicting filter past the validator.
 */
export function parseQuery<T>(schema: z.ZodType<T>, request: Request, source = 'query'): T {
  const params = new URL(request.url).searchParams;
  const raw: Record<string, string> = {};

  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length > 1) {
      throw new ValidationError(
        'The ' + source + ' parameter "' + key + '" was supplied more than once.',
        [{ field: key, message: 'Supply this parameter at most once.', code: 'duplicate' }],
      );
    }
    raw[key] = values[0] ?? '';
  }

  return parseValue(schema, raw, source);
}

const MAX_BODY_BYTES = 64 * 1024;

/** Parses and validates a JSON request body, refusing oversized payloads. */
export async function parseJsonBody<T>(schema: z.ZodType<T>, request: Request): Promise<T> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new ValidationError('The request body is too large.', [
      {
        field: '(body)',
        message: 'Keep the body under ' + MAX_BODY_BYTES + ' bytes.',
        code: 'too_big',
      },
    ]);
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ValidationError('The request body could not be read.');
  }

  if (text.trim() === '') {
    throw new ValidationError('A JSON request body is required.', [
      { field: '(body)', message: 'Send a JSON object.', code: 'invalid_type' },
    ]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError('The request body is not valid JSON.', [
      { field: '(body)', message: 'Send syntactically valid JSON.', code: 'invalid_json' },
    ]);
  }

  return parseValue(schema, parsed, 'body');
}

/**
 * Builds a bounded positive-integer query schema.
 *
 * Shared by the paginated endpoints planned for Phase 5 so every list route
 * caps its result count in the same way (PRD section 11).
 */
export function boundedIntQuery(options: {
  defaultValue: number;
  min: number;
  max: number;
}) {
  const { defaultValue, min, max } = options;
  return z.string().optional().transform((raw, ctx) => {
    if (raw === undefined || raw === '') return defaultValue;

    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
      ctx.addIssue({ code: 'custom', message: 'Expected a whole number.' });
      return z.NEVER;
    }
    if (parsed < min || parsed > max) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be between ' + min + ' and ' + max + '.',
      });
      return z.NEVER;
    }
    return parsed;
  });
}
