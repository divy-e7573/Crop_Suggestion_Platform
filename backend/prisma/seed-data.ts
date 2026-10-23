/**
 * Deterministic demo seed data.
 *
 * Every value here is invented for demonstration. Nothing in this file is a
 * real mandi price, a real coordinate, or a real advisory (PRD section 14,
 * AGENTS.md section 3). Every record therefore carries `dataStatus: 'DEMO'` and
 * `source: 'demo-seed'` so it can never be presented as live data.
 *
 * The module is pure: it imports nothing and touches no database, so the
 * invariants in `seed-data.test.ts` can be checked without a connection.
 */

/** Source string attached to every seeded row. */
export const DEMO_SOURCE = 'demo-seed';

/** Fixed observation window. Deliberately absolute so re-seeding never drifts. */
export const OBSERVED_DATES = [
  '2026-01-05',
  '2026-01-06',
  '2026-01-07',
  '2026-01-08',
  '2026-01-09',
  '2026-01-10',
  '2026-01-11',
] as const;

/** Day-by-day multiplier applied to the base modal price. Fixed, not random. */
const DAY_FACTORS = [1, 1.01, 0.99, 1.02, 1.03, 1.01, 1.04] as const;

/** Fraction of modal price used for the low and high of the day's range. */
const MIN_FACTOR = 0.92;
const MAX_FACTOR = 1.08;

export type SeedCrop = {
  name: string;
  slug: string;
  aliases: string[];
  category: 'CEREAL' | 'PULSE' | 'OILSEED' | 'VEGETABLE' | 'FRUIT' | 'CASH' | 'SPICE' | 'OTHER';
  /** Modal demo price in INR per quintal, used as the observation base. */
  baseModalPrice: number;
};

export type SeedMarket = {
  name: string;
  slug: string;
  state: string;
  district: string;
  locality: string | null;
  /** Per-market price offset applied to the crop base price. */
  priceFactor: number;
};

export type SeedObservation = {
  cropSlug: string;
  marketSlug: string;
  observedAt: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: 'RUPEES_PER_QUINTAL';
  source: string;
  dataStatus: 'DEMO';
  fetchedAt: null;
};

export const CROPS: readonly SeedCrop[] = [
  { name: 'Wheat', slug: 'wheat', aliases: ['Gehun'], category: 'CEREAL', baseModalPrice: 2275 },
  { name: 'Rice', slug: 'rice', aliases: ['Paddy', 'Dhan'], category: 'CEREAL', baseModalPrice: 2300 },
  { name: 'Cotton', slug: 'cotton', aliases: ['Kapas'], category: 'CASH', baseModalPrice: 7100 },
  { name: 'Soybean', slug: 'soybean', aliases: ['Soyabean'], category: 'OILSEED', baseModalPrice: 4600 },
  { name: 'Onion', slug: 'onion', aliases: ['Pyaz'], category: 'VEGETABLE', baseModalPrice: 1800 },
  { name: 'Tomato', slug: 'tomato', aliases: ['Tamatar'], category: 'VEGETABLE', baseModalPrice: 2200 },
] as const;

export const MARKETS: readonly SeedMarket[] = [
  {
    name: 'Nashik APMC',
    slug: 'nashik-apmc-maharashtra',
    state: 'Maharashtra',
    district: 'Nashik',
    locality: 'Pimpalgaon',
    priceFactor: 1,
  },
  {
    name: 'Lasalgaon APMC',
    slug: 'lasalgaon-apmc-maharashtra',
    state: 'Maharashtra',
    district: 'Nashik',
    locality: 'Lasalgaon',
    priceFactor: 1.04,
  },
  {
    name: 'Kolhapur APMC',
    slug: 'kolhapur-apmc-maharashtra',
    state: 'Maharashtra',
    district: 'Kolhapur',
    locality: null,
    priceFactor: 0.97,
  },
  {
    name: 'Ludhiana Mandi',
    slug: 'ludhiana-mandi-punjab',
    state: 'Punjab',
    district: 'Ludhiana',
    locality: null,
    priceFactor: 1.02,
  },
  {
    name: 'Anantapur Market',
    slug: 'anantapur-market-andhra-pradesh',
    state: 'Andhra Pradesh',
    district: 'Anantapur',
    locality: null,
    priceFactor: 1.06,
  },
  {
    name: 'Bengaluru APMC',
    slug: 'bengaluru-apmc-karnataka',
    state: 'Karnataka',
    district: 'Bengaluru',
    locality: 'Yeshwanthpur',
    priceFactor: 1.01,
  },
] as const;

/** Rounds to two decimals without floating-point drift such as 2274.9999. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Expands the fixed base table into a full observation set.
 *
 * The same inputs always produce the same rows, which is what makes repeated
 * seeding safe: `seed.ts` upserts on (cropId, marketId, observedAt).
 */
export function buildObservations(): SeedObservation[] {
  const rows: SeedObservation[] = [];

  for (const crop of CROPS) {
    for (const market of MARKETS) {
      const base = crop.baseModalPrice * market.priceFactor;

      OBSERVED_DATES.forEach((observedAt, index) => {
        const modal = round2(base * DAY_FACTORS[index]!);
        rows.push({
          cropSlug: crop.slug,
          marketSlug: market.slug,
          observedAt,
          minPrice: round2(modal * MIN_FACTOR),
          maxPrice: round2(modal * MAX_FACTOR),
          modalPrice: modal,
          unit: 'RUPEES_PER_QUINTAL',
          source: DEMO_SOURCE,
          dataStatus: 'DEMO',
          fetchedAt: null,
        });
      });
    }
  }

  return rows;
}

export type SeedRule = {
  cropSlug: string;
  ruleVersion: string;
  soilTypes: SeedSoilType[];
  seasons: SeedSeason[];
  irrigationTypes: SeedIrrigationType[];
  applicableStates: string[];
  minLandAreaAcre: number | null;
  maxLandAreaAcre: number | null;
  explanation: string;
  isActive: boolean;
  source: string;
  dataStatus: 'DEMO';
};

export type SeedSoilType =
  | 'ALLUVIAL'
  | 'BLACK'
  | 'RED'
  | 'LATERITE'
  | 'SANDY'
  | 'OTHER';

export type SeedSeason = 'KHARIF' | 'RABI' | 'ZAID' | 'WHOLE_YEAR';

export type SeedIrrigationType =
  | 'RAINFED'
  | 'DRIP'
  | 'SPRINKLER'
  | 'FLOOD'
  | 'CANAL'
  | 'WELL'
  | 'OTHER';

/**
 * Demonstration suitability rules.
 *
 * These are plausible textbook statements, not an agronomy result, and the
 * wording never promises a yield or a profit (PRD FR-06). Phase 8 turns them
 * into a ranked, tested recommendation engine.
 */
export const SUITABILITY_RULES: readonly SeedRule[] = [
  {
    cropSlug: 'wheat',
    ruleVersion: 'demo-v1',
    soilTypes: ['ALLUVIAL', 'BLACK'],
    seasons: ['RABI'],
    irrigationTypes: ['CANAL', 'WELL', 'SPRINKLER'],
    applicableStates: [],
    minLandAreaAcre: 0.5,
    maxLandAreaAcre: null,
    explanation:
      'Wheat is widely grown in the rabi season on alluvial and black soils where irrigation is available. Confirm local sowing dates, seed supply, and water availability before planting.',
    isActive: true,
    source: DEMO_SOURCE,
    dataStatus: 'DEMO',
  },
  {
    cropSlug: 'rice',
    ruleVersion: 'demo-v1',
    soilTypes: ['ALLUVIAL', 'BLACK'],
    seasons: ['KHARIF'],
    irrigationTypes: ['FLOOD', 'CANAL', 'WELL'],
    applicableStates: [],
    minLandAreaAcre: 0.25,
    maxLandAreaAcre: 10,
    explanation:
      'Rice is normally a kharif crop on alluvial or clay soil that can hold standing water. Verify the local monsoon window and your irrigation source.',
    isActive: true,
    source: DEMO_SOURCE,
    dataStatus: 'DEMO',
  },
  {
    cropSlug: 'soybean',
    ruleVersion: 'demo-v1',
    soilTypes: ['BLACK', 'ALLUVIAL'],
    seasons: ['KHARIF'],
    irrigationTypes: ['RAINFED', 'DRIP', 'SPRINKLER'],
    applicableStates: [],
    minLandAreaAcre: 1,
    maxLandAreaAcre: null,
    explanation:
      'Soybean is mainly a kharif oilseed on black or alluvial soil and is often grown rainfed. Check rainfall reliability and pod-shatter risk in your area.',
    isActive: true,
    source: DEMO_SOURCE,
    dataStatus: 'DEMO',
  },
  {
    cropSlug: 'cotton',
    ruleVersion: 'demo-v1',
    soilTypes: ['BLACK', 'RED'],
    seasons: ['KHARIF', 'ZAID'],
    irrigationTypes: ['RAINFED', 'DRIP', 'WELL'],
    applicableStates: [],
    minLandAreaAcre: 1,
    maxLandAreaAcre: null,
    explanation:
      'Cotton is a kharif cash crop on black or red soil in much of central and western India. Pest pressure and picking labour are the main local factors to confirm.',
    isActive: true,
    source: DEMO_SOURCE,
    dataStatus: 'DEMO',
  },
  {
    cropSlug: 'onion',
    ruleVersion: 'demo-v1',
    soilTypes: ['BLACK', 'ALLUVIAL', 'RED'],
    seasons: ['RABI', 'KHARIF'],
    irrigationTypes: ['SPRINKLER', 'DRIP', 'FLOOD'],
    applicableStates: [],
    minLandAreaAcre: 0.25,
    maxLandAreaAcre: 5,
    explanation:
      'Onion needs well-drained soil and a steady water supply, and storage losses can be high. Check curing facilities and nearby buyers before planting.',
    isActive: true,
    source: DEMO_SOURCE,
    dataStatus: 'DEMO',
  },
  {
    cropSlug: 'tomato',
    ruleVersion: 'demo-v1',
    soilTypes: ['ALLUVIAL', 'RED', 'SANDY'],
    seasons: ['WHOLE_YEAR'],
    irrigationTypes: ['DRIP', 'SPRINKLER', 'FLOOD'],
    applicableStates: [],
    minLandAreaAcre: 0.1,
    maxLandAreaAcre: 5,
    explanation:
      'Tomato can be grown across the year on well-drained soil with irrigation, but it is perishable. Confirm a buyer or market within reach before planting.',
    isActive: true,
    source: DEMO_SOURCE,
    dataStatus: 'DEMO',
  },
] as const;
