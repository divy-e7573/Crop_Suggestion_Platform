import { jsonError } from '@/lib/api/response';

/**
 * Catch-all for unmatched `/api/*` paths.
 *
 * Without this, Next.js answers an unknown API path with its default HTML 404
 * page, which would break the single JSON envelope that API clients rely on
 * (Phase 3 checklist: consistent API response/error format).
 *
 * A concrete route such as `/api/health` always wins over this catch-all.
 */
function endpointNotFound(): Response {
  return jsonError(
    404,
    'NOT_FOUND',
    'The requested API endpoint does not exist. See GET /api/health for service status.',
  );
}

export async function GET(): Promise<Response> {
  return endpointNotFound();
}

export async function POST(): Promise<Response> {
  return endpointNotFound();
}

export async function PUT(): Promise<Response> {
  return endpointNotFound();
}

export async function PATCH(): Promise<Response> {
  return endpointNotFound();
}

export async function DELETE(): Promise<Response> {
  return endpointNotFound();
}
