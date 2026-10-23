import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Builds the PostgreSQL driver adapter used by the Prisma client.
 *
 * Prisma 7 connects either through a driver adapter or through Prisma
 * Accelerate; there is no plain `datasourceUrl` option any more. This factory
 * is the single place the connection string is read, so both the application
 * client and the seed script build the adapter the same way.
 *
 * The URL is read from the environment only. It is never returned to a
 * client, logged, or committed (AGENTS.md section 5).
 */
export function createPrismaAdapter(): PrismaPg {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env.local and ' +
        'set DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/krishi_mandi?schema=public".',
    );
  }

  return new PrismaPg({ connectionString });
}
