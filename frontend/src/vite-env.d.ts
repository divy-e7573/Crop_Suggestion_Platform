/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the Next.js backend API, for example http://localhost:3000.
   * Injected at build time from `frontend/.env` (see `.env.example`).
   * The VITE_ prefix is what makes a variable safe to expose to the browser,
   * so only non-secret configuration may use it.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
