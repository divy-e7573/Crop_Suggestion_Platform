import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDataGovInProvider,
  DATA_GOV_IN_SOURCE_ID,
  readDataGovInConfig,
} from './dataGovInProvider.ts';
import {
  ProviderInvalidResponseError,
  ProviderNotConfiguredError,
  ProviderRateLimitedError,
  ProviderUnavailableError,
} from './errors.ts';

const verifiedRecord = {
  state: 'Madhya Pradesh',
  district: 'Gwalior',
  market: 'Lashkar APMC',
  commodity: 'Wheat',
  variety: 'Sharbati',
  grade: 'FAQ',
  arrival_date: '28/10/2026',
  min_price: 2495,
  max_price: 2510,
  modal_price: 2510,
};

function envelope(records: unknown[], total = records.length) {
  return { status: 'ok', total, count: records.length, records };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function config(overrides: Partial<ReturnType<typeof readDataGovInConfig>> = {}) {
  return {
    apiKey: 'test-key',
    resourceId: '9ef84268-d588-465a-a308-a864a43d0070',
    baseUrl: 'https://api.data.gov.in/resource',
    timeoutMs: 1000,
    maxPages: 2,
    maxRetries: 0,
    retryDelayMs: 0,
    throttleDelayMs: 0,
    minIntervalMs: 0,
    cacheTtlMs: 0,
    ...overrides,
  };
}

test('the live provider normalizes a verified upstream response', async () => {
  const calls: string[] = [];
  const provider = createDataGovInProvider({
    config: config(),
    fetchImpl: (async (url: string) => {
      calls.push(String(url));
      return jsonResponse(envelope([verifiedRecord], 5));
    }) as unknown as typeof fetch,
  });

  const result = await provider.listObservations({ limit: 10, offset: 0 });

  assert.equal(result.items.length, 1);
  const observation = result.items[0]!;
  assert.equal(observation.cropSlug, 'wheat');
  assert.equal(observation.marketSlug, 'lashkar-apmc-madhya-pradesh');
  assert.equal(observation.unit, 'RUPEES_PER_QUINTAL');
  assert.equal(observation.currency, 'INR');
  assert.equal(observation.source, DATA_GOV_IN_SOURCE_ID);
  assert.equal(observation.dataStatus, 'LIVE');
  assert.equal(provider.verifiedLive, true);
  assert.equal(provider.isDemo, false);
  assert.equal(result.total, 5);

  // The API key is only ever sent as a query parameter of the upstream URL.
  assert.ok(calls[0]!.includes('api-key=test-key'));
  assert.ok(calls[0]!.startsWith('https://api.data.gov.in/resource/'));
});

test('the live provider drops unusable upstream records instead of guessing', async () => {
  const provider = createDataGovInProvider({
    config: config(),
    fetchImpl: (async () =>
      jsonResponse(
        envelope([
          verifiedRecord,
          { ...verifiedRecord, min_price: 9000, max_price: 10 },
          { ...verifiedRecord, arrival_date: '31/02/2026' },
        ]),
      )) as unknown as typeof fetch,
  });

  const result = await provider.listObservations({ limit: 10, offset: 0 });
  assert.equal(result.items.length, 1);
});

test('the live provider reports an unreachable upstream instead of demo data', async () => {
  const provider = createDataGovInProvider({
    config: config(),
    fetchImpl: (async () => {
      throw new Error('socket hang up');
    }) as unknown as typeof fetch,
  });

  await assert.rejects(
    () => provider.listObservations({ limit: 10, offset: 0 }),
    ProviderUnavailableError,
  );
});

test('the live provider reports an upstream error status', async () => {
  const provider = createDataGovInProvider({
    config: config(),
    fetchImpl: (async () => jsonResponse({ status: 'error', message: 'Invalid Catalog id' })) as unknown as typeof fetch,
  });

  await assert.rejects(
    () => provider.listObservations({ limit: 10, offset: 0 }),
    ProviderInvalidResponseError,
  );
});

test('the live provider reports a request budget refusal', async () => {
  const provider = createDataGovInProvider({
    config: config(),
    fetchImpl: (async () => new Response('slow down', { status: 429 })) as unknown as typeof fetch,
  });

  await assert.rejects(
    () => provider.listObservations({ limit: 10, offset: 0 }),
    ProviderRateLimitedError,
  );
});

test('the live provider rejects a response that is not JSON', async () => {
  const provider = createDataGovInProvider({
    config: config(),
    fetchImpl: (async () => new Response('<html>gateway error</html>', { status: 200 })) as unknown as typeof fetch,
  });

  await assert.rejects(
    () => provider.listObservations({ limit: 10, offset: 0 }),
    ProviderInvalidResponseError,
  );
});

test('the live provider refuses to run without an API key', async () => {
  const provider = createDataGovInProvider({
    config: config({ apiKey: null }),
    fetchImpl: (async () => {
      throw new Error('the upstream must not be contacted');
    }) as unknown as typeof fetch,
  });

  assert.equal(provider.configured, false);
  assert.ok(provider.configurationIssue);
  await assert.rejects(
    () => provider.listObservations({ limit: 10, offset: 0 }),
    ProviderNotConfiguredError,
  );
});

test('the live provider retries a page that failed once', async () => {
  let calls = 0;
  const provider = createDataGovInProvider({
    config: config({ maxRetries: 2 }),
    fetchImpl: (async () => {
      calls++;
      if (calls === 1) throw new Error('socket hang up');
      return jsonResponse(envelope([verifiedRecord], 1));
    }) as unknown as typeof fetch,
  });

  const result = await provider.listObservations({ limit: 10, offset: 0 });
  assert.equal(calls, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.dataStatus, 'LIVE');
});

test('the live provider reports a rejected API key without retrying', async () => {
  let calls = 0;
  const provider = createDataGovInProvider({
    config: config({ maxRetries: 2 }),
    fetchImpl: (async () => {
      calls++;
      return new Response('forbidden', { status: 403 });
    }) as unknown as typeof fetch,
  });

  await assert.rejects(
    () => provider.listObservations({ limit: 10, offset: 0 }),
    ProviderNotConfiguredError,
  );
  assert.equal(calls, 1);
});

test('the live provider applies the filters the upstream cannot apply', async () => {
  const provider = createDataGovInProvider({
    config: config(),
    fetchImpl: (async () =>
      jsonResponse(
        envelope([
          verifiedRecord,
          { ...verifiedRecord, arrival_date: '27/10/2026', modal_price: 2400 },
        ]),
      )) as unknown as typeof fetch,
  });

  const result = await provider.listObservations({
    from: new Date('2026-10-28T00:00:00.000Z'),
    limit: 10,
    offset: 0,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.observedAt.toISOString(), '2026-10-28T00:00:00.000Z');
});

test('the live provider marks cached records as recent, not live', async () => {
  let calls = 0;
  const provider = createDataGovInProvider({
    config: config({ cacheTtlMs: 60_000 }),
    fetchImpl: (async () => {
      calls++;
      return jsonResponse(envelope([verifiedRecord], 1));
    }) as unknown as typeof fetch,
  });

  const first = await provider.listObservations({ limit: 10, offset: 0 });
  const second = await provider.listObservations({ limit: 10, offset: 0 });

  assert.equal(calls, 1);
  assert.equal(first.items[0]!.dataStatus, 'LIVE');
  assert.equal(second.items[0]!.dataStatus, 'RECENT');
  assert.equal(second.items[0]!.source, DATA_GOV_IN_SOURCE_ID);
});

test('readDataGovInConfig falls back to the verified defaults', () => {
  const parsed = readDataGovInConfig({} as NodeJS.ProcessEnv);
  assert.equal(parsed.apiKey, null);
  assert.equal(parsed.resourceId, '9ef84268-d588-465a-a308-a864a43d0070');
  assert.equal(parsed.baseUrl, 'https://api.data.gov.in/resource');
  assert.ok(parsed.timeoutMs > 0);
  assert.ok(parsed.maxPages > 0);
});
