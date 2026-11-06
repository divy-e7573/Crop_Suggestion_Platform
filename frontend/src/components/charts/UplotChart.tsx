import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import type { ChartPoint } from '../../lib/priceAnalytics';
import styles from './UplotChart.module.css';

/**
 * A small time-series chart.
 *
 * The library is uPlot: about 50 kB minified with no dependencies, which
 * keeps the bundle small next to a charting framework that ships its own
 * state manager. The chart is decorative for a screen reader, so the same
 * numbers are repeated in a table that only screen readers can see, and the
 * figure carries a label that says what is plotted (FR-12).
 */

export type UplotChartProps = {
  /** The heading of the figure. */
  title: string;
  /** One line under the heading, such as the metric and the unit. */
  description: string;
  /** The label of the vertical axis. */
  yLabel: string;
  /** The name of the plotted series. */
  seriesLabel: string;
  /** The points to draw, already ordered oldest first. */
  points: ChartPoint[];
  /** What a screen reader reads for the chart image. */
  ariaLabel: string;
  /** The height of the plot area in pixels. */
  height?: number;
};

/** Formats a unix timestamp in seconds as a day, in UTC. */
function formatUtcDay(seconds: number): string {
  const date = new Date(seconds * 1000);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Formats a value for the vertical axis, without the currency symbol. */
function formatAxisValue(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

export function UplotChart({
  title,
  description,
  yLabel,
  seriesLabel,
  points,
  ariaLabel,
  height = 240,
}: UplotChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || points.length === 0) return;

    const width = Math.max(280, Math.floor(container.getBoundingClientRect().width) || 560);

    const options: uPlot.Options = {
      width,
      height,
      legend: { show: false },
      cursor: { drag: { x: false, y: false } },
      scales: { x: { time: true } },
      series: [
        {},
        {
          label: seriesLabel,
          stroke: '#185530',
          width: 2,
          fill: 'rgba(24, 85, 48, 0.10)',
          points: { show: false },
        },
      ],
      axes: [
        {
          stroke: '#55605a',
          grid: { stroke: '#eceeec', width: 1 },
          ticks: { stroke: '#d7dcd7', width: 1 },
          font: '11px system-ui, sans-serif',
          size: 54,
          values: (_self, splits) => splits.map((value) => formatUtcDay(value)),
        },
        {
          stroke: '#55605a',
          grid: { stroke: '#eceeec', width: 1 },
          ticks: { stroke: '#d7dcd7', width: 1 },
          font: '11px system-ui, sans-serif',
          size: 64,
          label: yLabel,
          values: (_self, splits) => splits.map((value) => formatAxisValue(value)),
        },
      ],
    };

    const data: uPlot.AlignedData = [
      points.map((point) => point.x),
      points.map((point) => point.y),
    ];

    const plot = new uPlot(options, data, container);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.max(280, Math.floor(entry.contentRect.width));
      plot.setSize({ width: nextWidth, height });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      plot.destroy();
    };
  }, [height, points, seriesLabel, yLabel]);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className={styles.title}>{title}</span>
        <span className={styles.description}>{description}</span>
      </figcaption>

      <div className={styles.plot} ref={containerRef} role="img" aria-label={ariaLabel} />

      <table className="visually-hidden">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Observation date</th>
            <th scope="col">{seriesLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.observedAt}>
              <th scope="row">{point.observedAt}</th>
              <td>{point.y}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
