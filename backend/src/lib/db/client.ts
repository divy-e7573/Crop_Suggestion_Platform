import { PrismaClient } from '../../../generated/prisma/client.ts';

import { createPrismaAdapter } from './adapter.ts';

/**
 * The single Prisma client for the backend process.
 *
 * Next.js reloads modules on every edit in development. Caching the instance
 * on `globalThis` stops each reload from opening a fresh pool of connections,
 * which would otherwise leak until PostgreSQL refuses new ones
 * (Prisma's documented singleton pattern).
 *
 * This module is SERVER ONLY. It must never be imported from client
 * components: `DATABASE_URL` and the generated client must not reach the
 * browser bundle (AGENTS.md section 5).
 */
const globalForPrisma = globalThis as unknown as {
 krishiPrisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.krishiPrisma ?? new PrismaClient({ adapter: createPrismaAdapter() });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.krishiPrisma = prisma;
}

export default prisma;
