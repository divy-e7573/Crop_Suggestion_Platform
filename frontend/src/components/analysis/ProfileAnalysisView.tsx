import type { ProfileAnalysisBlock } from '../../lib/farmProfileApi';
import { StateMessage } from '../ui/StateMessage';
import { CropSuggestionList } from './CropSuggestionList';
import { PriceInsightPanel } from './PriceInsightPanel';
import styles from './ProfileAnalysisView.module.css';

export type ProfileAnalysisViewProps = {
  /** The analysis block returned by the API. */
  analysis: ProfileAnalysisBlock;
};

/**
 * The crop suggestions and the selling insights, together.
 *
 * Both parts are optional, because the backend reports honestly when it
 * could not read the rules or the price records. Nothing here invents a
 * result that the API did not send.
 */
export function ProfileAnalysisView({ analysis }: ProfileAnalysisViewProps) {
  return (
    <div className={styles.stack}>
      <p className={styles.message}>{analysis.message}</p>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Suggested crops for your farm</h4>
        {analysis.cropSuggestions ? (
          <CropSuggestionList suggestions={analysis.cropSuggestions} />
        ) : (
          <StateMessage
            kind="empty"
            title="No crop suggestions could be produced"
            detail="The suitability rules could not be read. Save your profile again in a moment, and the suggestions will appear."
          />
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Mandi prices and selling period</h4>
        {analysis.sellingInsights ? (
          <PriceInsightPanel insights={analysis.sellingInsights} />
        ) : (
          <StateMessage
            kind="empty"
            title="No market information yet"
            detail="No price observations were found for this crop in your area, so there is nothing to compare."
          />
        )}
      </section>
    </div>
  );
}
