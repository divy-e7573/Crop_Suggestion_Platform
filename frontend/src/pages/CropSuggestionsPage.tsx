import { Card } from '../components/ui/Card';
import { LinkButton } from '../components/ui/Button';
import { StateMessage } from '../components/ui/StateMessage';
import styles from './pages.module.css';

/**
 * Crop suggestion section.
 *
 * The suggestions themselves are the Phase 8 rule engine, which reads the
 * farmer profile saved in Phase 6. Until that engine exists the page says so
 * plainly and points at the profile form, instead of showing a sample ranking
 * that a farmer could mistake for a real result.
 */
export function CropSuggestionsPage() {
  return (
    <div className={styles.stack}>
      <header className={styles.pageHeader}>
        <h1>Crop suggestions</h1>
        <p className={styles.lead}>
          Suggestions come from a documented rule set matched against your location,
          soil type, season, land area, and irrigation. Every suggestion shows the
          reason behind it, and nothing is guaranteed.
        </p>
      </header>

      <Card
        title="Suggestions"
        description="Ranked crops with the reasons behind each one"
        aside={<span className={styles.phaseTag}>Phase 8</span>}
      >
        <StateMessage
          kind="empty"
          title="No suggestions yet"
          detail="The crop suitability rules arrive in Phase 8. Until then nothing is ranked, because an empty list would look like a verdict on your farm. Save your profile first, and the ranked suggestions will use it."
        />
        <p className={styles.placeholder}>
          <LinkButton to="/" variant="secondary" size="sm">
            Go to your farm profile
          </LinkButton>
        </p>
      </Card>

      <Card title="What a suggestion will explain" description="Set in the PRD">
        <ul className={styles.list}>
          <li>Which of your inputs influenced the ranking, and how.</li>
          <li>Which rules did not apply, and why that information is missing.</li>
          <li>That a suggestion is guidance, not a promise of a crop or a profit.</li>
        </ul>
      </Card>
    </div>
  );
}

