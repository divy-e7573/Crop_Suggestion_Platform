import {
  confidenceLabel,
  scoreLabel,
} from '../../lib/analysisPresentation';
import type { CropSuitabilityDto } from '../../lib/farmProfileApi';
import { StateMessage } from '../ui/StateMessage';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './ProfileAnalysisView.module.css';

export type CropSuggestionListProps = {
  /** The ranked suggestions and the method behind them. */
  suggestions: CropSuitabilityDto;
};

/**
 * The ranked crop suggestions (PRD FR-06).
 *
 * Every suggestion shows why it was made, which inputs matched, and which
 * details were missing. A crop that was left out is listed with its reason,
 * so an empty shortlist is never a mystery.
 */
export function CropSuggestionList({ suggestions }: CropSuggestionListProps) {
  if (suggestions.suggestions.length === 0) {
    return (
      <div className={styles.section}>
        <StateMessage
          kind="empty"
          title="No crop in the rule set matched this profile"
          detail="That is not a verdict on your farm. The reasons each crop was left out are listed below."
        />
        {suggestions.notRecommended.length > 0 ? (
          <ul className={styles.excluded}>
            {suggestions.notRecommended.map((item) => (
              <li key={item.crop.slug}>
                <strong>{item.crop.name}</strong>: {item.reason}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <ol className={styles.list}>
        {suggestions.suggestions.map((suggestion) => (
          <li key={suggestion.crop.slug} className={styles.item}>
            <div className={styles.itemHeader}>
              <span className={styles.rank}>{suggestion.rank}</span>
              <div>
                <p className={styles.name}>{suggestion.crop.name}</p>
                <p className={styles.meta}>
                  {scoreLabel(suggestion.score)} &middot;{' '}
                  {confidenceLabel(suggestion.confidence)}
                </p>
              </div>
              {suggestion.isCurrentCrop ? (
                <span className={styles.flag}>Your current crop</span>
              ) : null}
            </div>

            <p className={styles.explanation}>{suggestion.explanation}</p>

            <details className={styles.criteria}>
              <summary className={styles.criteriaSummary}>
                What matched and what is still missing
              </summary>
              <ul className={styles.criteriaList}>
                {suggestion.matchedCriteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
                {suggestion.missingInformation.map((item) => (
                  <li key={item} className={styles.missing}>
                    {item}
                  </li>
                ))}
              </ul>
            </details>

            <p className={styles.guidance}>{suggestion.guidance}</p>

            <p className={styles.ruleNote}>
              Rule set {suggestion.rule.version} &middot; source {suggestion.rule.source}
            </p>
          </li>
        ))}
      </ol>

      {suggestions.missingInformation.length > 0 ? (
        <ul className={styles.caveats}>
          {suggestions.missingInformation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      <p className={styles.method}>
        <StatusBadge status={suggestions.ruleDataStatus === 'DEMO' ? 'demo' : 'live'} />{' '}
        {suggestions.method}
      </p>
    </div>
  );
}
