import styles from './Disclaimer.module.css';

/**
 * The persistent informational disclaimer required by PRD section 13.
 * The wording is fixed so it cannot be weakened by future edits.
 */
export function Disclaimer() {
  return (
    <aside className={styles.disclaimer} aria-label="Important information">
      <strong className={styles.lead}>Please read before making decisions.</strong>{' '}
      These estimates are informational, depend on available data, and are not
      guaranteed outcomes. Verify local conditions and official market information
      before making decisions.
    </aside>
  );
}
