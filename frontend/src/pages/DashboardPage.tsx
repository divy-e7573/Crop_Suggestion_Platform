import { Card } from '../components/ui/Card';
import { LinkButton } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { API_BASE_URL } from '../lib/apiConfig';
import styles from './pages.module.css';

/**
 * Dashboard landing page.
 *
 * In this phase the dashboard explains what the product will do and links to the
 * other sections. Real mandi prices, crop suggestions, and forecasts are added in
 * later phases, so nothing here presents fabricated numbers.
 */
export function DashboardPage() {
  return (
    <div className={styles.stack}>
      <header className={styles.pageHeader}>
        <h1>Make informed crop and selling decisions</h1>
        <p className={styles.lead}>
          Enter your farm details to compare mandi prices, review price trends, and see
          which crops suit your land and season. Every figure shown in this MVP is
          labelled with its source and freshness so you know what you are looking at.
        </p>
      </header>

      <div className={styles.metaRow}>
        <StatusBadge status="demo" />
        <span className={styles.placeholder}>
          Live mandi data is not connected yet. Demo records are clearly marked.
        </span>
      </div>

      <div className={styles.grid}>
        <Card title="Mandi prices" description="Compare prices across markets">
          <p className={styles.placeholder}>
            The price provider and dashboard arrive in Phase 5 and Phase 7. The empty
            state is already in place so it can be reused.
          </p>
        </Card>

        <Card title="Crop suggestions" description="Ranked by season and soil type">
          <p className={styles.placeholder}>
            The farmer profile form and rule engine arrive in Phase 6 and Phase 8.
            Suggestions always include the reasons behind them.
          </p>
        </Card>

        <Card title="Selling-period insights" description="Trend and forecast evidence">
          <p className={styles.placeholder}>
            A price range appears only when enough history exists. Otherwise the app
            shows <strong>Not enough data to estimate</strong>.
          </p>
        </Card>
      </div>

      <Card
        title="Start here"
        description="The farmer profile form is the entry point once the backend is connected."
        aside={<span className={styles.phaseTag}>Phase 6</span>}
      >
        <p className={styles.placeholder}>
          The form is intentionally not active yet. It will be enabled only when the
          backend can validate and store the analysis request.
        </p>
        <LinkButton to="/data-sources" variant="secondary" size="sm">
          Read how this app labels its data
        </LinkButton>
      </Card>

      <Card title="Application status" description="Current build of the platform">
        <dl className={styles.definition}>
          <dt className={styles.definitionTerm}>Frontend</dt>
          <dd className={styles.definitionValue}>React + Vite running on port 5173</dd>
          <dt className={styles.definitionTerm}>Backend API</dt>
          <dd className={styles.definitionValue}>
            Next.js configured at {API_BASE_URL} (API routes arrive in Phase 3)
          </dd>
          <dt className={styles.definitionTerm}>Database</dt>
          <dd className={styles.definitionValue}>
            PostgreSQL with Prisma, added in Phase 4
          </dd>
        </dl>
      </Card>
    </div>
  );
}
