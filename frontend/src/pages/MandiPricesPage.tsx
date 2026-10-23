import { Card } from '../components/ui/Card';
import { StateMessage } from '../components/ui/StateMessage';
import { StatusBadge } from '../components/ui/StatusBadge';
import styles from './pages.module.css';

/**
 * Mandi price section.
 *
 * No price provider is connected in this phase, so the page deliberately shows
 * the empty state instead of invented prices (PRD section 12, FR-03).
 */
export function MandiPricesPage() {
  return (
    <div className={styles.stack}>
      <header className={styles.pageHeader}>
        <h1>Mandi prices</h1>
        <p className={styles.lead}>
          Compare recent prices across mandis, review how they moved over time, and see
          which markets are relevant to your district. Prices are always shown with the
          observation date, unit, and source.
        </p>
      </header>

      <div className={styles.metaRow}>
        <StatusBadge status="unavailable" />
        <span className={styles.placeholder}>
          No provider is configured, so no price records exist yet.
        </span>
      </div>

      <Card title="Price observations" description="Recent mandi records for your area">
        <StateMessage
          kind="empty"
          title="No price records available"
          detail="A deterministic demo data provider is built in Phase 5 and the price dashboard is connected in Phase 7. Until then this section stays empty rather than showing made-up numbers."
        />
      </Card>

      <Card
        title="What this section will show"
        description="Planned capabilities, not yet implemented"
        aside={<span className={styles.phaseTag}>Phase 5 - 7</span>}
      >
        <ul className={styles.list}>
          <li>Crop, state or district, market, and date filters.</li>
          <li>Minimum, maximum, and modal price with an explicit INR per quintal unit.</li>
          <li>A historical trend chart for a selected crop and market.</li>
          <li>Relevant markets, with distance shown only when coordinates are verified.</li>
          <li>A visible data-status label on every record: Live, Recent, or Demo data.</li>
        </ul>
      </Card>
    </div>
  );
}
