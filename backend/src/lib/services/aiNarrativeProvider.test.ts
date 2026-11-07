/*
 * Tests for the optional AI narrative provider.
 *
 * The important property is that the AI can only ever add wording. It can
 * never state a figure, and the platform works exactly the same when no key
 * is configured.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_NARRATIVE_LENGTH,
  createAiNarrativeProvider,
  isAiNarrativeEnabled,
  sanitiseNarrative,
  type AiNarrativeRequest,
} from './aiNarrativeProvider.ts';

const REQUEST: AiNarrativeRequest = {
  cropName: 'Wheat',
  marketName: 'Nashik APMC',
  direction: 'rising',
  horizonText: 'about a week',
  dataStatusLabel: 'Demo data',
};

test('a normal sentence is accepted', () => {
  assert.equal(
    sanitiseNarrative('  Prices have been moving up here lately.  '),
    'Prices have been moving up here lately.',
  );
});

test('a sentence with a digit is rejected, so it can never state a figure', () => {
  assert.equal(sanitiseNarrative('Prices rose by 12 percent last week.'), null);
  assert.equal(sanitiseNarrative('About 2400 rupees per quintal.'), null);
});

test('an empty, missing, or unreadable answer is rejected', () => {
  assert.equal(sanitiseNarrative(''), null);
  assert.equal(sanitiseNarrative('   '), null);
  assert.equal(sanitiseNarrative(null), null);
  assert.equal(sanitiseNarrative(undefined), null);
  assert.equal(sanitiseNarrative(42), null);
});

test('text that is too long is rejected', () => {
  assert.equal(sanitiseNarrative('a'.repeat(MAX_NARRATIVE_LENGTH + 1)), null);
});

test('control characters are rejected', () => {
  const bell = String.fromCharCode(7);
  assert.equal(sanitiseNarrative('Prices are up' + bell + ' at the market.'), null);
});

test('text without any letters is rejected', () => {
  assert.equal(sanitiseNarrative('- - -'), null);
});

test('the provider is off when there is no key', () => {
  assert.equal(isAiNarrativeEnabled({}), false);
  assert.equal(isAiNarrativeEnabled({ AI_API_KEY: '   ' }), false);
});

test('the provider can be switched off even when a key is present', () => {
  assert.equal(isAiNarrativeEnabled({ AI_API_KEY: 'secret' }), true);
  assert.equal(
    isAiNarrativeEnabled({ AI_API_KEY: 'secret', AI_ENABLE_NARRATIVE: 'false' }),
    false,
  );
  assert.equal(
    isAiNarrativeEnabled({ AI_API_KEY: 'secret', AI_ENABLE_NARRATIVE: 'off' }),
    false,
  );
});

test('without a key the provider produces nothing and the fallback stands', async () => {
  const provider = createAiNarrativeProvider({});

  assert.equal(provider.configured, false);
  assert.equal(await provider.generate(REQUEST), null);
});

test('a provider failure produces no narrative instead of an error', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('the network is down');
  }) as unknown as typeof fetch;

  try {
    const provider = createAiNarrativeProvider({ AI_API_KEY: 'test-key' });
    assert.equal(await provider.generate(REQUEST), null);
  } finally {
    globalThis.fetch = original;
  }
});

test('an error response produces no narrative', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response('nope', { status: 500 })) as unknown as typeof fetch;

  try {
    const provider = createAiNarrativeProvider({ AI_API_KEY: 'test-key' });
    assert.equal(await provider.generate(REQUEST), null);
  } finally {
    globalThis.fetch = original;
  }
});

test('a usable answer is returned, and one with a figure is dropped', async () => {
  const original = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: 'Prices have been moving up in this market.' } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as unknown as typeof fetch;

  try {
    const provider = createAiNarrativeProvider({ AI_API_KEY: 'test-key' });
    assert.equal(
      await provider.generate(REQUEST),
      'Prices have been moving up in this market.',
    );
  } finally {
    globalThis.fetch = original;
  }

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: 'The price will be 2400 next week.' } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as unknown as typeof fetch;

  try {
    const provider = createAiNarrativeProvider({ AI_API_KEY: 'test-key' });
    assert.equal(await provider.generate(REQUEST), null);
  } finally {
    globalThis.fetch = original;
  }
});

test('only the computed facts are sent to the provider', async () => {
  const original = globalThis.fetch;
  let sent = '';

  globalThis.fetch = (async (
    _input: unknown,
    init?: Parameters<typeof fetch>[1],
  ) => {
    sent = String(init?.body ?? '');
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'A short summary.' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;

  try {
    const provider = createAiNarrativeProvider({ AI_API_KEY: 'test-key' });
    await provider.generate(REQUEST);
  } finally {
    globalThis.fetch = original;
  }

  assert.ok(sent.includes('Wheat'));
  assert.ok(sent.includes('Nashik APMC'));
  assert.ok(!sent.includes('PIN'));
  assert.ok(!sent.includes('acre'));
});
