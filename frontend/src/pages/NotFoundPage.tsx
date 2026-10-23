import { Card } from '../components/ui/Card';
import { LinkButton } from '../components/ui/Button';
import styles from './pages.module.css';

export function NotFoundPage() {
  return (
    <div className={styles.stack}>
      <header className={styles.pageHeader}>
        <h1>Page not found</h1>
        <p className={styles.lead}>
          The page you asked for does not exist in this application.
        </p>
      </header>
      <Card title="Go back">
        <p className={styles.placeholder}>
          Use the navigation above, or return to the dashboard to start again.
        </p>
        <LinkButton to="/" variant="secondary" size="sm">
          Back to dashboard
        </LinkButton>
      </Card>
    </div>
  );
}
