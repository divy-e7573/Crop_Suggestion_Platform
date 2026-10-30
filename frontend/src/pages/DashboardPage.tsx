import { Card } from '../components/ui/Card';
import { LinkButton } from '../components/ui/Button';
import { DataSourceStatus } from '../components/dashboard/DataSourceStatus';
import { FarmProfileForm } from '../components/farm-profile/FarmProfileForm';
import { API_BASE_URL } from '../lib/apiConfig';
import styles from './pages.module.css';

/**
 * Dashboard landing page.
 *
 * The dashboard is the entry point of the farmer journey (PRD section 6): the
 * farmer profile form lives here, and the rest of the pages read the results
 * once the next phases add them.
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

      <DataSourceStatus />

      <div className={styles.grid}>
        <Card title="Mandi prices" description="Compare prices across markets">
          <p className={styles.placeholder}>
            The price provider is connected. The price dashboard and filters arrive in
            Phase 7, so no price is shown here yet.
          </p>
        </Card>

        <Card title="Crop suggestions" description="Ranked by season and soil type">
          <p className={styles.placeholder}>
            Your profile is validated and saved. The rule engine that ranks crops
            arrives in Phase 8, and every suggestion will include its reasons.
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
        title="Your farm profile"
        description="Tell us about your farm so the app can match markets and crops to it."
        aside={<span className={styles.phaseTag}>Phase 6</span>}
      >
        <p className={styles.placeholder}>
          Only the details the app needs are collected: no name, no phone number, and
          no precise location. Your profile is checked in the browser and again on the
          server before it is stored.
        </p>
        <FarmProfileForm />
        <p className={styles.placeholder}>
          <LinkButton to="/data-sources" variant="secondary" size="sm">
            Read how this app labels its data
          </LinkButton>
        </p>
      </Card>

      <Card title="Application status" description="Current build of the platform">
        <dl className={styles.definition}>
          <dt className={styles.definitionTerm}>Frontend</dt>
          <dd className={styles.definitionValue}>React + Vite running on port 5173</dd>
          <dt className={styles.definitionTerm}>Backend API</dt>
          <dd className={styles.definitionValue}>
            Next.js configured at {API_BASE_URL}
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
