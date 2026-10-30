import { useEffect, useState } from 'react';

import { getJson } from '../../lib/apiClient';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './DataSourceStatus.module.css';

/**
 * The data status shown at the top of the dashboard.
 *
 * The dashboard used to carry a hard-coded "Demo data" badge. That was true
 * in Phase 2 and wrong once the data.gov.in provider existed, so the status is
 * now read from the backend, which checks the provider before it answers
 * (PRD FR-01, AGENTS.md section 3). When the backend cannot be reached the
 * app says so rather than guessing.
 */

type DataSourceResponse = {
  provider: { id: string; displayName: string; mode: string; configured: boolean };
  dataStatus: 'LIVE' | 'RECENT' | 'DEMO' | 'UNAVAILABLE';
  label: string;
  notice: string;
};

const BADGE_BY_STATUS: Record<DataSourceResponse['dataStatus'], 'live' | 'recent' | 'demo' | 'unavailable'> =
  {
    LIVE: 'live',
    RECENT: 'recent',
    DEMO: 'demo',
    UNAVAILABLE: 'unavailable',
  };

export function DataSourceStatus() {
  const [source, setSource] = useState<DataSourceResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getJson<DataSourceResponse>('/api/data-sources')
      .then((data) => {
        if (!cancelled) setSource(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div className={styles.row} role="status">
        <StatusBadge status="unavailable" />
        <span className={styles.text}>
          The backend could not be reached, so the data status is unknown. The profile
          form will not be able to save a profile until the API is running.
        </span>
      </div>
    );
  }

  if (!source) {
    return (
      <div className={styles.row} role="status">
        <span className={styles.text}>Checking which data source is answering...</span>
      </div>
    );
  }

  return (
    <div className={styles.row} role="status">
      <StatusBadge status={BADGE_BY_STATUS[source.dataStatus]} />
      <span className={styles.text}>{source.notice}</span>
    </div>
  );
}

