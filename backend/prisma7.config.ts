import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration for this workspace.
 *
 * Prisma 7 does not read environment files on its own, so they are loaded
 * explicitly here. `.env.local` is checked first because that is the file the
 * Next.js app and the README already use; `.env` is kept as a fallback for
 * contributors who prefer it. Both are git-ignored.
 *
 * `process.loadEnvFile` is built into Node.js, so no dotenv dependency is
 * needed. Missing files are ignored on purpose: an unset DATABASE_URL should
 * make the CLI explain itself rather than crash on a missing-file error.
 */
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File absent or unreadable; fall through to the next candidate.
  }
}

// Left undefined when unset so that offline commands such as `prisma validate`
// and `prisma migrate diff` still work on a machine with no database. Commands
// that actually open a connection fail on their own with Prisma's own error,
// and the warning below points at the fix.
const datasourceUrl = process.env.DATABASE_URL;

if (!datasourceUrl) {
  console.warn(
    '[prisma] DATABASE_URL is not set. Commands that connect to the database ' +
      '(migrate dev/deploy, db seed) will fail. Set it in backend/.env.local; ' +
      'see backend/.env.example.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    url: datasourceUrl,
  },
});
