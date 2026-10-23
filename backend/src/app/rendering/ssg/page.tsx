import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Static Generation (SSG) - Krishi Mandi API',
  description: 'Next.js Server Component prerendered at build time to demonstrate SSG.',
};

/**
 * Requires the complete route to be prerendered during `next build`.
 *
 * On Next.js 16 with Cache Components this replaces the old
 * `dynamic = 'force-static'` route config. Next.js validates this requirement at
 * build time, so if request-time work were ever added here the build would fail
 * instead of silently becoming dynamic.
 */
export const ensureStatic = 'navigation';

const PROJECT_FACTS = [
  { term: 'Product', value: 'Krishi Mandi Price Prediction and Crop Suggestion Platform' },
  { term: 'Frontend', value: 'React + Vite + TypeScript (separate standalone app)' },
  { term: 'Backend', value: 'Next.js App Router + TypeScript (this app)' },
  { term: 'Database', value: 'PostgreSQL with Prisma, added in a later phase' },
  { term: 'Mandi data', value: 'No live provider connected yet; demo data only' },
];

/**
 * Static Generation (SSG) demonstration.
 *
 * This file has no `use client` directive, so it is a React Server Component: it
 * runs only on the server and ships no component JavaScript to the browser. The
 * HTML you are reading was produced once, during `next build`.
 */
export default function StaticRenderingPage() {
  return (
    <main className="wrap">
      <span className="eyebrow">Next.js rendering demonstration</span>
      <h1>Static Generation (SSG)</h1>

      <p>
        <strong>This is a Server Component rendered at build time.</strong> React Server
        Components are the default in the App Router unless a file starts with{' '}
        <code>&quot;use client&quot;</code>. This page contains no client directive, so
        Next.js executed it once during <code>next build</code> and wrote the result to a
        static HTML file.
      </p>

      <p>
        The export <code>ensureStatic = &apos;navigation&apos;</code> states that the whole
        route must stay static. Next.js checks this during the build, so the page cannot
        silently turn into request-time rendering.
      </p>

      <h2>How to verify this during the presentation</h2>
      <ul>
        <li>
          Run <code>npm run build:backend</code> and look for{' '}
          <code>(Static)</code> next to this route in the output table.
        </li>
        <li>
          Restart the server and reload this page: the HTML is served from disk and the
          server does no work for it.
        </li>
        <li>
          The build also writes a static copy under{' '}
          <code>.next/server/app/rendering/ssg.html</code>.
        </li>
      </ul>

      <h2>Project information stored in the static file</h2>
      <div className="panel">
        <dl>
          {PROJECT_FACTS.map((fact) => (
            <div key={fact.term}>
              <dt>
                <strong>{fact.term}:</strong>
              </dt>
              <dd className="muted">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="note">
        This page deliberately shows no mandi prices. It contains only static project
        information, and it is not connected to any market data source.
      </p>

      <p>
        <Link href="/rendering/ssr">Next: the SSR page renders on every request</Link>
      </p>
    </main>
  );
}
