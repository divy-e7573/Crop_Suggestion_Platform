/**
 * Normalization of upstream records into the provider contract.
 *
 * Everything here is pure so it can be unit tested without a network or a
 * database. The rules are deliberately strict: a record that is missing a
 * field, carries an impossible price, or has an unreadable date is rejected
 * rather than repaired. A rejected record is dropped, never guessed at.
 */
import { z } from 'zod';

import { ProviderInvalidResponseError } from './errors.ts';
import type { DataStatusValue, PriceUnitValue, ProviderObservation } from './types.ts';

/**
 * The price unit applied to upstream records that do not publish one.
 *
 * The verified data.gov.in mandi resource publishes `min_price`, `max_price`
 * and `modal_price` but no unit column. The dataset is the daily mandi price
 * feed published by the Directorate of Marketing and Inspection, whose portal
 * presents these values per quintal, so the unit is applied by this adapter
 * and stated in every API response. It is never inferred from the numbers.
 */
export const DEFAULT_PRICE_UNIT: PriceUnitValue = 'RUPEES_PER_QUINTAL';

/** Turns a name into a stable, URL-safe key. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    // Parenthetical qualifiers such as 'Bajra(Pearl Millet/Cumbu)' are noise
    // for a lookup key, so they are dropped before the name is slugified.
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Builds the stable key for a market: its name plus the state it sits in. */
export function buildMarketSlug(marketName: string, state: string): string {
  const name = slugify(marketName);
  const statePart = slugify(state);
  return statePart ? name + '-' + statePart : name;
}

/**
 * Reads a date published by a data source.
 *
 * `dd/MM/yyyy` is the format the verified data.gov.in resource uses; ISO
 * `yyyy-mm-dd` and full ISO timestamps are accepted as well. The result is
 * always UTC midnight of the calendar day, so a date never shifts when a
 * server in another timezone formats it.
 */
export function parseProviderDate(raw: string): Date | null {
  const value = raw.trim();
  if (value === '') return null;

  const dayFirst = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = Number(dayFirst[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    // Rejects impossible dates such as 31/02/2026.
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
    if (date.getUTCDate() !== day) return null;
    return date;
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

/**
 * Reads a price published by a data source.
 *
 * Numbers and numeric strings are accepted, including strings with thousands
 * separators. Anything else, and any negative amount, is rejected.
 */
export function parsePrice(raw: unknown): number | null {
  let parsed: number;

  if (typeof raw === 'number') {
    parsed = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim().replace(/,/g, '');
    if (trimmed === '') return null;
    parsed = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/** Trims a source string and turns an empty string into null. */
export function optionalText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/** The loose shape of one record in the verified data.gov.in response. */
export const dataGovInRecordSchema = z.object({
  state: z.string().optional(),
  district: z.string().optional(),
  market: z.string().optional(),
  commodity: z.string().optional(),
  variety: z.string().optional(),
  grade: z.string().optional(),
  arrival_date: z.string().optional(),
  min_price: z.union([z.number(), z.string()]).optional(),
  max_price: z.union([z.number(), z.string()]).optional(),
  modal_price: z.union([z.number(), z.string()]).optional(),
});

/** The envelope of the verified data.gov.in response. */
export const dataGovInEnvelopeSchema = z.object({
  status: z.string().optional(),
  message: z.string().optional(),
  total: z.union([z.number(), z.string()]).optional(),
  count: z.union([z.number(), z.string()]).optional(),
  records: z.array(z.unknown()).optional(),
});

export type DataGovInEnvelope = {
  records: unknown[];
  total: number;
};

/** Reads the record count the source reports, which may arrive as a string. */
function readTotal(raw: number | string | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/**
 * Validates the envelope of a data.gov.in response.
 *
 * Returns the raw record array and the source-reported total. Throws
 * `ProviderInvalidResponseError` when the payload is not the documented
 * shape, so a broken upstream can never be mistaken for 'no data'.
 */
export function parseDataGovInEnvelope(payload: unknown): DataGovInEnvelope {
  const parsed = dataGovInEnvelopeSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ProviderInvalidResponseError(
      'The data provider returned a response that does not match the expected format.',
    );
  }

  const status = parsed.data.status?.trim().toLowerCase();
  if (status !== undefined && status !== 'ok') {
    throw new ProviderInvalidResponseError(
      'The data provider reported an error status: ' + (parsed.data.message ?? status),
    );
  }

  if (!Array.isArray(parsed.data.records)) {
    throw new ProviderInvalidResponseError(
      'The data provider response did not contain a record list.',
    );
  }

  return { records: parsed.data.records, total: readTotal(parsed.data.total) };
}

export type NormalizeOptions = {
  /** The source id written onto every record. */
  source: string;
  /** The freshness status written onto every record. */
  dataStatus: DataStatusValue;
  /** When the payload was retrieved. */
  fetchedAt: Date;
};

/**
 * Normalizes one upstream record.
 *
 * Returns `null` when the record cannot be trusted. A caller drops those
 * records and reports how many were skipped, rather than filling the gaps
 * with invented prices.
 */
export function normalizeDataGovInRecord(
  raw: unknown,
  options: NormalizeOptions,
): ProviderObservation | null {
  const parsed = dataGovInRecordSchema.safeParse(raw);
  if (!parsed.success) return null;

  const record = parsed.data;

  const state = optionalText(record.state);
  const district = optionalText(record.district);
  const marketName = optionalText(record.market);
  const commodity = optionalText(record.commodity);
  if (!state || !district || !marketName || !commodity) return null;

  if (!record.arrival_date) return null;
  const observedAt = parseProviderDate(record.arrival_date);
  if (!observedAt) return null;

  const minPrice = parsePrice(record.min_price);
  const maxPrice = parsePrice(record.max_price);
  const modalPrice = parsePrice(record.modal_price);
  if (minPrice === null || maxPrice === null || modalPrice === null) return null;

  // A minimum above the maximum is impossible, so the record is not usable.
  if (minPrice > maxPrice) return null;

  return {
    cropSlug: slugify(commodity),
    cropName: commodity,
    cropVariety: optionalText(record.variety),
    cropGrade: optionalText(record.grade),
    marketSlug: buildMarketSlug(marketName, state),
    marketName,
    state,
    district,
    locality: null,
    observedAt,
    minPrice,
    maxPrice,
    modalPrice,
    unit: DEFAULT_PRICE_UNIT,
    currency: 'INR',
    source: options.source,
    dataStatus: options.dataStatus,
    fetchedAt: options.fetchedAt,
  };
}

/** Formats a date as the `yyyy-mm-dd` string used in API responses. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
