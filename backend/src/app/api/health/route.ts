import { jsonOk, toErrorResponse } from '@/lib/api/response';

/** Service name reported to monitoring tools. Kept in sync with package.json. */
const SERVICE_NAME = 'krishi-mandi-backend';

/**
 * `GET /api/health` - liveness of the API process itself.
 *
 * This reports ONLY that the Next.js server is running and able to answer.
 * It deliberately says nothing about PostgreSQL, mandi providers, or AI:
 * those are Phase 4 and later, so claiming them healthy would be false
 * (PRD section 11, AGENTS.md section 3).
 */
export async function GET(): Promise<Response> {
  try {
    return jsonOk({
      status: 'ok',
      service: SERVICE_NAME,
      apiVersion: 'v1',
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime() * 1000) / 1000,
      scope: 'api-process-only',
      notConnected: ['database', 'mandiDataProvider', 'aiProvider'],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
