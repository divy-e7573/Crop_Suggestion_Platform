/**
 * The one place that knows how a land area is converted.
 *
 * The rule limits are stored in acres while a farmer may enter hectares
 * (PRD FR-02), so the profile service and the crop suitability engine both
 * need the same conversion. Keeping it here means the two can never disagree
 * about how big a farm is.
 */

/** Hectares to acres. */
export const ACRES_PER_HECTARE = 2.47105;

/** Converts a land area into acres, rounded to two decimal places. */
export function toAcres(landArea: number, unit: string): number {
  const acres = unit === 'HECTARE' ? landArea * ACRES_PER_HECTARE : landArea;
  return Math.round(acres * 100) / 100;
}
