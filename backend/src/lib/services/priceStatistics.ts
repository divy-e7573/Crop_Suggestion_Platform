/**
 * The small amount of statistics the trend and forecast modules share.
 *
 * These are plain functions over plain numbers, with no database, no
 * network, and no dates of their own. Keeping them in one place means the
 * observed trend and the forecast are fitted by exactly the same maths, and
 * both can be unit tested on their own (PRD FR-07).
 */

/** One point of a series: a position on the x axis and a price on the y axis. */
export type SeriesPoint = {
  x: number;
  y: number;
};

/** The result of fitting a straight line to a series. */
export type LinearFit = {
  /** The change in y for one unit of x. */
  slope: number;
  /** The value of y where the line crosses x = 0. */
  intercept: number;
  /** How much of the variation the line explains, from 0 to 1. */
  rSquared: number;
  /**
   * The spread of the points around the line. It is zero when there are
   * fewer than three points, because there is not enough data to estimate it.
   */
  residualStandardError: number;
  /** How many points were fitted. */
  count: number;
};

/** Rounds a number to a fixed number of decimal places. */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** The arithmetic mean of a list of numbers. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

/**
 * Fits a straight line to a series by ordinary least squares.
 *
 * This is the whole forecasting method: the simplest explainable model
 * there is. It is used for the observed trend and for the baseline forecast,
 * so the two never disagree about what the data looks like.
 */
export function leastSquares(points: SeriesPoint[]): LinearFit {
  const count = points.length;

  if (count === 0) {
    return { slope: 0, intercept: 0, rSquared: 0, residualStandardError: 0, count: 0 };
  }

  const meanX = mean(points.map((point) => point.x));
  const meanY = mean(points.map((point) => point.y));

  let sumXX = 0;
  let sumXY = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    sumXX += dx * dx;
    sumXY += dx * (point.y - meanY);
  }

  // Every point sits at the same x, so there is no line to fit and the only
  // honest answer is a flat line through the mean.
  const slope = sumXX === 0 ? 0 : sumXY / sumXX;
  const intercept = meanY - slope * meanX;

  let sumTotalSquares = 0;
  let sumResidualSquares = 0;
  for (const point of points) {
    const predicted = slope * point.x + intercept;
    const difference = point.y - meanY;
    sumTotalSquares += difference * difference;
    const residual = point.y - predicted;
    sumResidualSquares += residual * residual;
  }

  const rSquared =
    sumTotalSquares === 0 ? 0 : roundTo(1 - sumResidualSquares / sumTotalSquares, 4);

  const residualStandardError = count > 2 ? Math.sqrt(sumResidualSquares / (count - 2)) : 0;

  return {
    slope,
    intercept,
    rSquared,
    residualStandardError,
    count,
  };
}
