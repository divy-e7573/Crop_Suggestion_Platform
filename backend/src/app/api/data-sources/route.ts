import { jsonOk, toErrorResponse } from '@/lib/api/response';
import { isProviderError } from '@/lib/providers/errors';
import { getMandiProvider } from '@/lib/providers/registry';
import { buildDataSource } from '@/lib/services/mandiService';
import { connection } from 'next/server';

/**
 * `GET /api/data-sources` - which data source is configured, and whether it
 * is serving demo records or a verified external source.
 *
 * The endpoint probes the upstream with one real request when the live
 * provider is selected, because PRD section 11 does not allow an external
 * source to be called healthy unless that was actually checked. A failed
 * probe is reported as a failure, never smoothed over.
 */
export async function GET(): Promise<Response> {
  // The status is built per request, so the route is never prerendered. The
  // call sits outside the try block on purpose: during a build it rejects to
  // tell Next.js to render this route on demand.
  await connection();

  try {
    const provider = getMandiProvider();
    const dataSource = buildDataSource(provider);
    const checkedAt = new Date().toISOString();

    let upstream: {
      checked: boolean;
      reachable: boolean | null;
      status: 'ok' | 'unavailable' | 'not-applicable' | 'not-configured';
      checkedAt: string | null;
      message: string;
    };

    if (provider.isDemo) {
      upstream = {
        checked: false,
        reachable: null,
        status: 'not-applicable',
        checkedAt: null,
        message: 'The demo provider reads seeded records and does not contact an external service.',
      };
    } else if (!provider.configured) {
      upstream = {
        checked: false,
        reachable: null,
        status: 'not-configured',
        checkedAt: null,
        message:
          provider.configurationIssue ?? 'The live data provider is not configured.',
      };
    } else {
      try {
        await provider.listObservations({ limit: 1, offset: 0 });
        upstream = {
          checked: true,
          reachable: true,
          status: 'ok',
          checkedAt: new Date().toISOString(),
          message: 'The provider answered a live request while this status was being built.',
        };
      } catch (error) {
        upstream = {
          checked: true,
          reachable: false,
          status: 'unavailable',
          checkedAt: new Date().toISOString(),
          message: isProviderError(error)
            ? error.message
            : 'The provider did not answer the live check.',
        };
      }
    }

    const liveDataAvailable =
      provider.mode === 'live' && provider.configured && upstream.reachable === true;

    return jsonOk({
      provider: {
        id: provider.id,
        displayName: provider.displayName,
        mode: provider.mode,
        configured: provider.configured,
        configurationIssue: provider.configurationIssue,
        /** True because the upstream was verified during development. */
        verifiedLive: provider.verifiedLive,
      },
      dataStatus: dataSource.dataStatus,
      isDemoData: dataSource.isDemoData,
      isLiveData: dataSource.isLiveData,
      liveDataAvailable,
      demoDataAvailable: provider.isDemo,
      label: dataSource.label,
      notice: dataSource.notice,
      source: dataSource.source,
      upstream,
      checkedAt,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
