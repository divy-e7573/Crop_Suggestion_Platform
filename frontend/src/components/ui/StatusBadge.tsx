import styles from './StatusBadge.module.css';

/**
 * Data-status vocabulary defined in PRD section 12.
 *
 * `demo` must be used for seeded records. Seeded data is never presented as
 * live or real-time (AGENTS.md section 3).
 */
export type DataStatus = 'live' | 'recent' | 'demo' | 'unavailable';

const LABELS: Record<DataStatus, string> = {
  live: 'Live',
  recent: 'Recent',
  demo: 'Demo data',
  unavailable: 'Unavailable',
};

export type StatusBadgeProps = {
  status: DataStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
