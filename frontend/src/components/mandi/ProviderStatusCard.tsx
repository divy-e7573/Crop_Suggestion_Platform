import type { DataSourcesDto } from '../../lib/mandiApi';
import { StateMessage } from '../ui/StateMessage';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './ProviderStatusCard.module.css';

/**
 * Which data source answered, and what its records mean.
 *
 * The card reports the provider, the DEMO or LIVE status, the attribution,
 * and the freshness of the check. A provider that could not be reached is
 * reported as unavailable and is never replaced with demo records
 * (PRD FR-01, FR-11).
 */

export type ProviderStatusCardProps = {
  dataSources: DataSourcesDto | null;
  error: string | null;
  onRetry: () => void;
};

function badgeFor(dataSources: DataSourcesDto): 'live' | 'recent' | 'demo' | 'unavailable' {
  switch (dataSources.dataStatus) {
    case 'LIVE':
      return 'live';
    case 'RECENT':
      return 'recent';
    case 'DEMO':
      return 'demo';
    default:
      return 'unavailable';
  }
}

export function ProviderStatusCard({
  dataSources,
  error,
  onRetry,
}: ProviderStatusCardProps) {
  if (error) {
    return (
      <StateMessage
        kind="error"
        title="Could not check the data source"
        detail={error}
        onRetry={onRetry}
      />
    );
  }

  if (!dataSources) {
    return (
      <StateMessage
        kind="loading"
        title="Checking the data source"
        detail="The backend reports which provider is answering and whether it is healthy."
      />
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <StatusBadge status={badgeFor(dataSources)} />
        <span className={styles.provider}>{dataSources.provider.displayName}</span>
      </div>

      <p className={styles.notice}>{dataSources.notice}</p>

      <dl className={styles.definition}>
        <dt>Mode</dt>
        <dd>{dataSources.provider.mode === 'demo' ? 'Demo data' : 'Live data'}</dd>

        <dt>Attribution</dt>
        <dd>{dataSources.source.attribution}</dd>

        <dt>Checked</dt>
        <dd>{new Date(dataSources.checkedAt).toLocaleString()}</dd>

        <dt>Upstream check</dt>
        <dd>{dataSources.upstream.message}</dd>
      </dl>
    </div>
  );
}
