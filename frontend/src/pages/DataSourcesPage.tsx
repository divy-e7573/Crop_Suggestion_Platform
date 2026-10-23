import { useState } from 'react';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StateMessage } from '../components/ui/StateMessage';
import { StatusBadge } from '../components/ui/StatusBadge';
import { API_BASE_URL } from '../lib/apiConfig';
import styles from './pages.module.css';

const STATUS_NOTES = [
  { status: 'live', meaning: 'Fetched from a verified provider during this session.' },
  { status: 'recent', meaning: 'A real observation recorded earlier, with its date shown.' },
  { status: 'demo', meaning: 'Seeded demonstration record. Not a real market price.' },
  { status: 'unavailable', meaning: 'No data could be resolved for this request.' },
] as const;

export function DataSourcesPage() {
  const [attempt, setAttempt] = useState(1);

  return (
    <div className={styles.stack}>
      <header className={styles.pageHeader}>
        <h1>Data sources and about</h1>
        <p className={styles.lead}>
          This page explains where data comes from, how it is labelled, and how the two
          applications fit together.
        </p>
      </header>

      <Card
        title="Data status labels"
        description="Every price record carries one of these labels. Seeded data is never shown as live."
      >
        <dl className={styles.definition}>
          {STATUS_NOTES.map((note) => (
            <div key={note.status}>
              <dt className={styles.definitionTerm}>
                <StatusBadge status={note.status} />
              </dt>
              <dd className={styles.definitionValue}>{note.meaning}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card
        title="Reusable states"
        description="The loading, empty, and error components every data view will reuse."
        aside={<span className={styles.phaseTag}>Retry attempt {attempt}</span>}
      >
        <StateMessage
          kind="loading"
          title="Loading records"
          detail="Placeholder shown while a request is in flight."
        />
        <StateMessage
          kind="empty"
          title="Nothing matched your filters"
          detail="Shown when a request succeeds but returns no records."
        />
        <StateMessage
          kind="error"
          title="Could not reach the backend"
          detail="Shown when a request fails. The retry button below really does retry."
          onRetry={() => setAttempt((value) => value + 1)}
        />
        <Button variant="ghost" size="sm" onClick={() => setAttempt(1)}>
          Reset retry counter
        </Button>
      </Card>

      <Card title="How the two applications fit together">
        <ul className={styles.list}>
          <li>
            <strong>frontend/</strong> - React, Vite, and TypeScript. This is the only
            user interface.
          </li>
          <li>
            <strong>backend/</strong> - Next.js, used mainly for the HTTP API, plus a
            small set of Next.js pages that demonstrate Server Components, SSG, and SSR
            for the course requirement.
          </li>
          <li>
            The frontend calls the backend over HTTP using the base URL{' '}
            <code>{API_BASE_URL}</code>. It never imports database code and never
            receives a private key.
          </li>
        </ul>
      </Card>

      <Card title="Forecast honesty">
        <p className={styles.placeholder}>
          A future price range appears only when enough historical observations exist
          under a documented rule. When that threshold is not met, the interface shows
          <strong> Not enough data to estimate</strong> instead of a number. Forecasts
          are explainable calculations, not guaranteed outcomes.
        </p>
      </Card>
    </div>
  );
}
