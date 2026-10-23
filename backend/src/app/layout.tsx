import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

/**
 * Minimal root layout for an API-only Next.js app.
 *
 * The product UI lives in the separate React app under `frontend/`.
 * This layout intentionally renders no branding, fonts, or styling so the
 * backend does not become a second frontend (see AGENTS.md section 2).
 */
export const metadata: Metadata = {
  title: 'Krishi Mandi API',
  description: 'HTTP API for the Krishi Mandi platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
