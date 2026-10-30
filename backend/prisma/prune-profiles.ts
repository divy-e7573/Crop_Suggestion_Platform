/*
 * Removes farmer profiles that are older than the retention window.
 *
 * The platform stores a profile only so the app can match markets and crops
 * to a farm (PRD FR-10). The retention rule is documented in the README and
 * the schema comment: a profile is kept for FARM_PROFILE_RETENTION_DAYS days
 * (90 by default) and then removed.
 *
 * The script never deletes anything on its own. Without the --confirm flag
 * it only reports what would be removed, so no profile can be lost by
 * running the wrong command.
 *
 *   npm run db:prune-profiles                # dry run
 *   npm run db:prune-profiles -- --confirm   # actually remove them
 */
import { PrismaClient } from '../generated/prisma/client.ts';

import { createPrismaAdapter } from '../src/lib/db/adapter.ts';

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Absent file; the URL may still come from the shell environment.
  }
}

/** How long a profile is kept, in days. */
const DEFAULT_RETENTION_DAYS = 90;

function retentionDays(): number {
  const raw = process.env.FARM_PROFILE_RETENTION_DAYS;
  if (!raw) return DEFAULT_RETENTION_DAYS;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      'FARM_PROFILE_RETENTION_DAYS must be a positive whole number of days, but it is: ' + raw,
    );
  }
  return parsed;
}

async function main(): Promise<void> {
  const days = retentionDays();
  const confirmed = process.argv.includes('--confirm');
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

  try {
    const expired = await prisma.farmProfile.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
    });

    console.log('[prune] retention window: ' + days + ' days');
    console.log('[prune] cutoff: ' + cutoff.toISOString());
    console.log('[prune] profiles older than the cutoff: ' + expired.length);

    for (const profile of expired) {
      console.log(
        '[prune]   ' +
          profile.id +
          ' | ' +
          profile.district +
          ', ' +
          profile.state +
          ' | created ' +
          profile.createdAt.toISOString(),
      );
    }

    if (expired.length === 0) {
      console.log('[prune] nothing to remove.');
      return;
    }

    if (!confirmed) {
      console.log('[prune] dry run. Nothing was deleted.');
      console.log('[prune] run again with --confirm to remove these profiles.');
      return;
    }

    const result = await prisma.farmProfile.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    console.log('[prune] removed ' + result.count + ' profiles.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[prune] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

