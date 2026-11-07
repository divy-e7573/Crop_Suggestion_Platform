import { ProfileAnalysisView } from '../components/analysis/ProfileAnalysisView';
import { LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StateMessage } from '../components/ui/StateMessage';
import { useSavedAnalysis } from '../lib/useSavedAnalysis';
import styles from './pages.module.css';

/**
 * The crop suggestions page.
 *
 * It shows the analysis of the profile this browser saved, worked out by
 * the backend rule engine. Nothing on this page is a hardcoded sample: if
 * this browser has no saved profile, or the backend cannot be reached, the
 * page says so and offers a way to fix it (PRD FR-06, FR-07).
 *
 * The analysis is read with the access token that was handed out when the
 * profile was saved, so no farmer's details are shown to another visitor
 * (Phase 9 privacy review).
 */
export function CropSuggestionsPage() {
  const { data, error, hasNoProfile, loading, retry } = useSavedAnalysis();

  const hasProfile = data !== null;

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

        {!loading && !error && hasNoProfile ? (
          <StateMessage
            kind="empty"
            title="No farm profile saved yet"
            detail={
              'This browser has no farm profile that this page can read. Save your ' +
              'profile and the suggestions, the price trend, and the selling guidance ' +
              'will be worked out from it.'
            }
          />
        ) : null}

        {!loading && !error && hasProfile ? (
          <>
            {/*
              A polite live region, so a screen reader says that the
              suggestions are ready once they arrive. The content itself is
              read normally; only this short sentence is announced.
            */}
            <p className="visually-hidden" role="status">
              Your saved crop suggestions and selling insights are ready.
            </p>
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
