/**
 * Chooses the active mandi data provider.
 *
 * The mode comes from `MANDI_DATA_PROVIDER_MODE`:
 *
 * - `demo` (the default) serves the seeded records from PostgreSQL and needs
 *   no credentials.
 * - `live` serves the verified data.gov.in resource and needs
 *   `MANDI_PROVIDER_API_KEY`.
 *
 * An unknown mode never silently falls back to demo data. It produces a
 * provider that reports the problem, so a misconfigured deployment fails
 * loudly instead of quietly showing seeded prices as if they were real.
 */
import { createDataGovInProvider, readDataGovInConfig } from './dataGovInProvider.ts';
import { createDatabaseDemoProvider } from './demoProvider.ts';
import { ProviderNotConfiguredError } from './errors.ts';
import type { MandiPriceProvider, ProviderMarket, ProviderObservation, ProviderResult } from './types.ts';

/** The environment variable that selects the provider. */
export const PROVIDER_MODE_ENV_VAR = 'MANDI_DATA_PROVIDER_MODE';

/** The supported provider modes. */
export const PROVIDER_MODES = ['demo', 'live'] as const;

export type ProviderModeName = (typeof PROVIDER_MODES)[number];

function readMode(env: NodeJS.ProcessEnv): string {
  return (env[PROVIDER_MODE_ENV_VAR] ?? 'demo').trim().toLowerCase();
}

/** A provider that refuses every read and explains why. */
function createUnusableProvider(issue: string): MandiPriceProvider {
  const fail = (): never => {
    throw new ProviderNotConfiguredError(issue);
  };

  return {
    id: 'unconfigured',
    displayName: 'Unconfigured mandi data provider',
    mode: 'demo',
    dataStatus: 'UNAVAILABLE',
    isDemo: false,
    verifiedLive: false,
    configured: false,
    configurationIssue: issue,
    sourceUrl: null,
    attribution: 'No data source is configured.',
    async listObservations(): Promise<ProviderResult<ProviderObservation>> {
      return fail();
    },
    async listMarkets(): Promise<ProviderResult<ProviderMarket>> {
      return fail();
    },
  };
}

/** Builds the provider selected by the environment. */
export function getMandiProvider(env: NodeJS.ProcessEnv = process.env): MandiPriceProvider {
  const mode = readMode(env);

  if (mode === 'demo') return createDatabaseDemoProvider();
  if (mode === 'live') {
    return createDataGovInProvider({ config: readDataGovInConfig(env) });
  }

  return createUnusableProvider(
    PROVIDER_MODE_ENV_VAR +
      ' is set to an unsupported value. Use "demo" or "live".',
  );
}
