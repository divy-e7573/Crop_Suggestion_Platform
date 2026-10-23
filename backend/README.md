# Backend

Next.js App Router + TypeScript, used **as an API service only**. The user interface
lives in the separate React app under `frontend/`; this app deliberately renders no
product UI, so no second frontend is built here.

## Commands

Run from the repository root, or from this directory:

```bash
npm run dev:backend         # from the repository root
npm run dev                 # from backend/
npm run build
npm run start               # serve the production build
npm run lint
npm run typecheck
```

## Configuration

Copy `.env.example` to `.env.local` and fill in real values. `.env.local` is
git-ignored. Never commit real credentials and never expose these values to the
browser.

| Variable                  | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `DATABASE_URL`            | PostgreSQL connection string (needed from Phase 4) |
| `CORS_ALLOWED_ORIGINS`    | Comma-separated allowlist of allowed browser origins |
| `MANDI_DATA_PROVIDER_MODE`| `demo` (default) or `live` once a provider is verified |
| `MANDI_PROVIDER_API_KEY`  | Optional; unused while in demo mode                 |
| `AI_API_KEY`, `AI_MODEL`  | Optional; the MVP uses the deterministic fallback   |

## Planned structure

```text
src/app/api/       Route handlers (thin: validate -> call service -> respond)
src/services/      Domain logic: crop rules, forecast eligibility, trend summary
src/lib/           Validation schemas, config, error formatting
src/providers/     Mandi data provider interface + demo implementation
src/db/            Prisma client (added in Phase 4)
```

The first route (`GET /api/health`) is added in Phase 3. Until then every path
returns `404`.

## Note on `AGENTS.md` in this folder

Next.js regenerates `backend/AGENTS.md` on `next dev`. Do not edit it by hand; it is
framework tooling, and the project rules live in the root `AGENTS.md`.

See the root `README.md` for full setup instructions.
