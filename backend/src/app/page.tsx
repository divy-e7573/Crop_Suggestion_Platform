import type { Metadata } from 'next';
import Link from 'next/link';

import { ClientCounter } from '../components/ClientCounter';

export const metadata: Metadata = {
  title: 'Krishi Mandi API',
  description: 'HTTP API service and Next.js rendering demonstration.',
};

const DEMOS = [
  {
    href: '/rendering/ssg',
    label: 'Static Generation (SSG)',
    summary:
      'A Server Component prerendered once during next build with ensureStatic = navigation.',
    proof: 'Build output marks this route (Static). The HTML never changes per request.',
  },
  {
    href: '/rendering/ssr',
    label: 'Server-Side Rendering (SSR)',
    summary:
      'A Server Component rendered on every request using await connection() from next/server.',
    proof: 'Build output marks this route (Dynamic). The timestamp changes on reload.',
  },
];

/**
 * Index for the Next.js framework demonstration.
 *
 * This application is the platform's API service. These pages exist only to
 * demonstrate Server Components, SSG, and SSR for the course requirement and are
 * deliberately separate from the React frontend in frontend/, which remains the
 * only product UI.
 */
export default function HomePage() {
  return (
    <main className="wrap">
      <span className="eyebrow">Next.js App Router</span>
      <h1>Krishi Mandi API service</h1>

      <p>
        This app is mainly the backend for the Krishi Mandi platform. It will serve the
        HTTP API for the React app in <code>frontend/</code>. The product interface
        lives there, not here.
      </p>

      <h2>Rendering demonstrations</h2>
      <p className="muted">
        Two small Server Component pages demonstrate the rendering modes required for
        the course. Neither page shows market data.
      </p>

      {DEMOS.map((demo) => (
        <div key={demo.href} className="panel">
          <h3>
            <Link href={demo.href}>{demo.label}</Link>
          </h3>
          <p>{demo.summary}</p>
          <p className="muted">{demo.proof}</p>
        </div>
      ))}

      <h2>Server Components versus Client Components</h2>
      <p>
        App Router components are <strong>Server Components</strong> by default. They
        run on the server and ship no JavaScript to the browser. A component becomes a{' '}
        <strong>Client Component</strong> only when it starts with{' '}
        <code>&quot;use client&quot;</code>. The three pages above are Server Components;
        the counter below is the one Client Component.
      </p>

      <div className="panel">
        <ClientCounter />
      </div>

      <p className="note">
        No API route, database connection, or market data source exists yet. API routes
        are added in Phase 3 of the project plan.
      </p>
    </main>
  );
}
