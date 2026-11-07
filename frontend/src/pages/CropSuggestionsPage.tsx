import { ProfileAnalysisView } from '../components/analysis/ProfileAnalysisView';
import { LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StateMessage } from '../components/ui/StateMessage';
import { useLatestAnalysis } from '../lib/useLatestAnalysis';
import styles from './pages.module.css';

/**
 * The crop suggestions page.
 *
 * It shows the analysis of the profile that was saved most recently, worked
 * out by the backend rule engine. Nothing on this page is a hardcoded
 * sample: if no profile has been saved, or the backend cannot be reached,
 * the page says so and offers a way to fix it (PRD FR-06, FR-07).
 */
export function CropSuggestionsPage() {
  const { data, error, loading, retry } = useLatestAnalysis();

  const hasProfile = data !== null && data.profileId !== null;

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
        title="Your suggestions"
        description="Ranked crops with the reasons behind each one"
      >
        {loading ? (
          <StateMessage
            kind="loading"
            title="Loading your suggestions"
            detail="The rules and the price records for your area are being read."
          />
        ) : null}

        {error ? (
          <StateMessage
            kind="error"
            title="Your suggestions could not be loaded"
            detail={error}
            onRetry={retry}
          />
        ) : null}

        {!loading && !error && data !== null && !hasProfile ? (
          <StateMessage
            kind="empty"
            title="No farm profile saved yet"
            detail={
              data.analysis.message +
              ' Save your profile and the suggestions, the price trend, and the selling ' +
              'guidance will be worked out from it.'
            }
          />
        ) : null}

        {!loading && !error && hasProfile ? (
          <>
            {data.profile ? (
              <p className={styles.selection}>
                Based on your saved profile: {data.profile.district}, {data.profile.state}{' '}
                &middot; {data.profile.soilType.toLowerCase()} soil &middot;{' '}
                {data.profile.season.toLowerCase()} season &middot;{' '}
                {data.profile.landArea} {data.profile.landAreaUnit.toLowerCase()} (
                {data.profile.landAreaInAcres} acres)
              </p>
            ) : null}
            <ProfileAnalysisView analysis={data.analysis} />
          </>
        ) : null}

        {!loading && !error && !hasProfile ? (
          <p className={styles.placeholder}>
            <LinkButton to="/" variant="secondary" size="sm">
              Go to your farm profile
            </LinkButton>
          </p>
        ) : null}
      </Card>

      <Card title="What a suggestion explains" description="Set in the PRD">
        <ul className={styles.list}>
          <li>Which of your inputs matched the rule, and which could not be checked.</li>
          <li>Why a crop was left out, so a short list is never a mystery.</li>
          <li>
            The observed price trend and the estimate, kept apart, with the evidence
            period and the unit.
          </li>
          <li>That a suggestion is guidance, not a promise of a crop or a profit.</li>
        </ul>
      </Card>
    </div>
  );
}
