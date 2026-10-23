import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: 'Server-Side Rendering (SSR) - Krishi Mandi API',
  description: 'Next.js Server Component rendered per request to demonstrate SSR.',
};

/**
 * Opts this route out of Instant Navigation validation.
 *
 * Cache Components normally requires request-time work to sit inside a
 * `<Suspense>` boundary so the page can stream a static shell first. A full SSR
 * page intentionally renders in one piece at request time instead, so this route
 * is explicitly allowed to block. Without this export `next build` fails with
 * "encountered uncached or runtime data during prerendering".
 */
export const instant = false;

/**
 * Server-Side Rendering (SSR) demonstration.
 *
 * This file has no `use client` directive, so it is a React Server Component.
 * `await connection()` tells Next.js to stop prerendering here and wait for a real
 * incoming request, so the code below runs on every request.
 *
 * In Next.js 16 with Cache Components this is the supported way to request
 * request-time rendering. The older `export const dynamic = 'force-dynamic'`
 * route config no longer exists in this version.
 */
export default async function DynamicRenderingPage() {
  // Everything below this line executes per request, never at build time.
  await connection();

  const renderedAt = new Date().toISOString();
  const userAgentNote = 'This value is generated on the server for each request.';

  return (
    <main className="wrap">
      <span className="eyebrow">Next.js rendering demonstration</span>
      <h1>Server-Side Rendering (SSR)</h1>

      <span className="tag tagRequestTime">Rendered at request time</span>

      <p>
        <strong>This is a Server Component rendered on every request.</strong> The call
        to <code>await connection()</code> from <code>next/server</code> stops static
        prerendering, so the timestamp below is produced when you load the page.
      </p>

      <h2>Proof that this page runs per request</h2>
      <p>
        Reload the page several times. This timestamp changes on every reload, which is
        only possible if the server rendered it during the request.
      </p>
      <code className="proof">Server render time: {renderedAt}</code>
      <p className="muted">{userAgentNote}</p>

      <h2>How to verify this during the presentation</h2>
      <ul>
        <li>
          Run <code>npm run build:backend</code> and look for{' '}
          <code>(Dynamic)</code> next to this route in the output table.
        </li>
        <li>
          Reload this page and watch the timestamp change, unlike the SSG page which is
          identical on every load.
        </li>
        <li>
          The Server Component itself ships no component JavaScript; only the page
          shell and framework runtime are sent to the browser.
        </li>
      </ul>

      <h2>SSG and SSR side by side</h2>
      <div className="panel">
        <ul>
          <li>
            <Link href="/rendering/ssg">SSG page</Link> - built once with{' '}
            <code>ensureStatic=&apos;navigation&apos;</code>, identical on every request.
          </li>
          <li>
            <a href="/rendering/ssr">SSR page</a> - this page, rendered on demand with{' '}
            <code>await connection()</code>.
          </li>
        </ul>
      </div>

      <p className="note">
        The timestamp is process time only. It is not market data and no mandi price is
        displayed anywhere in this demonstration.
      </p>

      <p>
        <Link href="/">Back to the demonstration index</Link>
      </p>
    </main>
  );
}
