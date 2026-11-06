/*
 * The supported-crop catalogue used by the dashboard filters.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import type { MandiPriceProvider } from '../providers/types.ts';
import { listSupportedCrops, type CropCatalogue } from './cropService.ts';

const provider: MandiPriceProvider = {
  id: 'demo-seed',
  displayName: 'Seeded demonstration data',
  mode: 'demo',
  dataStatus: 'DEMO',
  isDemo: true,
  verifiedLive: false,
  configured: true,
  configurationIssue: null,
  sourceUrl: null,
  attribution: 'Demonstration records.',
  async listObservations() {
    return { items: [], total: 0, truncated: false };
  },
  async listMarkets() {
    return { items: [], total: 0, truncated: false };
  },
};

const catalogue: CropCatalogue = {
  async listCrops() {
    return [
      {
        slug: 'wheat',
        name: 'Wheat',
        aliases: ['Gehun'],
        category: 'CEREAL',
        dataStatus: 'DEMO',
      },
      {
        slug: 'onion',
        name: 'Onion',
        aliases: ['Pyaz'],
        category: 'VEGETABLE',
        dataStatus: 'DEMO',
      },
    ];
  },
};

test('the catalogue lists the crops with their aliases', async () => {
  const result = await listSupportedCrops(provider, catalogue);

  assert.equal(result.crops.length, 2);
  assert.equal(result.crops[0]?.name, 'Wheat');
  assert.deepEqual(result.crops[0]?.aliases, ['Gehun']);
  assert.equal(result.crops[0]?.dataStatus, 'DEMO');
});

test('the catalogue is labelled as reference data', async () => {
  const result = await listSupportedCrops(provider, catalogue);

  assert.equal(result.catalogue.isReferenceData, true);
  assert.equal(result.catalogue.available, true);
  assert.equal(result.catalogue.dataStatus, 'DEMO');
  assert.ok(result.catalogue.notice.toLowerCase().includes('typed'));
});

test('the catalogue names the provider that answers price requests', async () => {
  const result = await listSupportedCrops(provider, catalogue);

  assert.equal(result.provider.id, 'demo-seed');
  assert.equal(result.provider.mode, 'demo');
  assert.equal(result.provider.configured, true);
});

test('a catalogue that cannot be read is reported, not hidden', async () => {
  const broken: CropCatalogue = {
    async listCrops() {
      throw new Error('the database is unreachable');
    },
  };

  const result = await listSupportedCrops(provider, broken);

  assert.deepEqual(result.crops, []);
  assert.equal(result.catalogue.available, false);
  assert.ok(result.catalogue.notice.toLowerCase().includes('could not be read'));
});

