# Krishi Mandi Price Prediction & Crop Suggestion Platform

Farmer-facing decision-support web application for Indian mandi markets. A farmer
submits a simple profile (state, district, soil type, season, land area) and receives
mandi prices, historical trends, crop suitability suggestions, and selling-period
insights.

> **Disclaimer:** These estimates are informational, depend on available data, and are
> not guaranteed outcomes. Verify local conditions and official market information
> before making decisions.

## Architecture

This is a monorepo containing **two independently runnable applications**:

| Directory    | Stack                                    | Role                                                        |
| ------------ | ---------------------------------------- | ----------------------------------------------------------- |
| `frontend/`  | React + Vite + TypeScript                | All presentation and interaction (the only user-facing UI)  |
| `backend/`   | Next.js App Router + TypeScript          | HTTP API only: validation, business logic, providers, data   |
| _(root)_     | npm workspaces                           | Installs, builds, and runs both apps together                |

The frontend talks to the backend over plain HTTP/JSON through `VITE_API_BASE_URL`.
The frontend never imports Prisma, never opens a database connection, and never
receives a private provider or AI key.

## Prerequisites

- **Node.js 20.19+** (developed and verified on `v24.13.0`)
- **npm 10+** (developed and verified on `11.6.2`)
- **PostgreSQL** is required from Phase 4 onward for migrations and seeds. The
  API itself still starts fine without it.

> **Windows / PowerShell:** if script execution is disabled, PowerShell blocks the
> `npm.ps1` shim. Use `npm.cmd` instead of `npm` (for example `npm.cmd install`), or
> run the commands from `cmd.exe`.

## Setup

From the repository root:

```bash
npm install
```

This installs both workspaces and creates a single `package-lock.json` at the root.

### Environment configuration

Copy the example files and edit them locally. **`.env.example` files are committed;
real `.env` files are git-ignored and must never be committed.**

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env.local
```

`frontend/.env`

```ini
VITE_API_BASE_URL=http://localhost:3000
```

`backend/.env.local` (server-side only)

```ini
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/krishi_mandi?schema=public"
CORS_ALLOWED_ORIGINS="http://localhost:5173"
MANDI_DATA_PROVIDER_MODE=demo
MANDI_PROVIDER_API_KEY=
AI_API_KEY=
AI_MODEL=
```

Only `CORS_ALLOWED_ORIGINS` is needed for Phase 3; the other variables are
declared ahead of the phases that use them.

## Database (Prisma + PostgreSQL)

Phase 4 adds the schema, migrations, and demo seeds. The Prisma CLI reads
`DATABASE_URL` from `backend/.env.local` (or `.env`); nothing else in the app
reads it, and it never reaches the browser.

### 1. Create the database (once)

If `krishi_mandi` does not exist yet, create it as the PostgreSQL superuser:

```bash
psql -U postgres -c "CREATE DATABASE krishi_mandi OWNER postgres;"
```

Then put your superuser password into `backend/.env.local`:

```ini
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/krishi_mandi?schema=public"
```

Using a dedicated least-privilege role instead of `postgres` is better practice.
Create one with `psql -U postgres -c "CREATE ROLE krishi LOGIN PASSWORD '...' PASSWORD'";`,
create the database with `OWNER krishi`, and use that role in the URL. The steps
above keep it simple for local development only.

> `backend/.env.local` holds your real password. It is git-ignored, so it is
> never committed. Only `backend/.env.example` is tracked, and it contains a
> `CHANGE_ME` placeholder.

### 2. Create the tables

```bash
npm run db:generate   # build the typed Prisma client
npm run db:validate   # check the schema is valid
npm run db:migrate    # create the tables (asks for a migration name)
```

`db:migrate` uses `prisma migrate dev`, which may prompt to create a migration.
To apply existing migrations without prompts (for example in setup scripts), use
`npm run db:deploy`.

### 3. Load the demo data

```bash
npm run db:seed
```

The seed is **idempotent**: it upserts on natural keys, so running it twice does
not create duplicates.

### 4. Verify what was written

```bash
npm run db:verify
```

This queries the live database through the same Prisma client the app uses and
prints a PASS/FAIL line for row counts, relations, filters, and demo labelling.

### 5. Inspect the data (optional)

```bash
npm run db:studio     # opens Prisma Studio in your browser
```

> **Every seeded row is demo data.** Observations are stored with
> `dataStatus = 'DEMO'` and `source = 'demo-seed'`. Prices are illustrative
> values in INR per quintal, never real mandi prices. Demo markets intentionally
> have no coordinates, so the app can never show an invented distance.

### Schema summary

| Model                     | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `Market`                  | Mandi name, state, district, optional verified coordinates     |
| `Crop`                    | Canonical crop name, slug, aliases, category                   |
| `MandiPriceObservation`   | One crop/market/day price range, unit, source, and data status  |
| `CropSuitabilityRule`     | Versioned soil/season/irrigation guidance for crop suggestions  |

Farmer profiles, authentication, live provider data, and forecasts are later
phases and have no tables yet.

Only variables prefixed with `VITE_` are exposed to the browser bundle. Never put a
database URL or a secret in the frontend environment file.

## Running the applications

Each application starts independently. Run one terminal per app.

```bash
# Terminal 1 - Next.js API on http://localhost:3000
npm run dev:backend

# Terminal 2 - React UI on http://localhost:5173
npm run dev:frontend
```

The backend serves the JSON API described below under `/api`. The pages at `/`,
`/rendering/ssg`, and `/rendering/ssr` are framework demonstrations only and show
no market data.

### Verifying the API is running

With the backend running:

```bash
curl http://localhost:3000/api/health
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "krishi-mandi-backend",
    "apiVersion": "v1",
    "checkedAt": "2026-10-23T08:00:28.763Z",
    "uptimeSeconds": 16.813,
    "scope": "api-process-only",
    "notConnected": ["database", "mandiDataProvider", "aiProvider"]
  }
}
```

`status: "ok"` reports **only that the API process is alive**. The
`notConnected` list is intentional: no database or data provider is wired up
yet, so the endpoint never claims they are healthy.

## API conventions

Every `/api` response uses one of two shapes:

```jsonc
// success
{ "success": true, "data": { } }

// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

Clients can branch on `success` alone. Error codes are `VALIDATION_ERROR`,
`NOT_FOUND`, `METHOD_NOT_ALLOWED`, `FORBIDDEN`, and `INTERNAL_ERROR`. Unexpected
server faults return a generic 500; stack traces, SQL text, and environment
values are logged on the server only and are never sent to the client.

### CORS

The frontend and backend run on different ports, so the browser needs the
backend's permission before any call succeeds. `backend/src/proxy.ts` implements
that gate for `/api/*` only.

- Allowed origins come from `CORS_ALLOWED_ORIGINS` (comma-separated).
- The exact origin is echoed back, never `*`, because credentials are allowed.
- `OPTIONS` preflights are answered with `204` before any route handler runs.
- An unlisted origin is rejected with `403`, including preflights.
- Requests with **no** `Origin` header (curl, server-to-server, same-origin) are
  unaffected and always pass through.

If you run the frontend on a different port, add that origin to
`backend/.env.local` and restart the backend:

```ini
CORS_ALLOWED_ORIGINS="http://localhost:5173,http://localhost:4173"
```

**Important:** under `next start` (production mode) a missing or empty
`CORS_ALLOWED_ORIGINS` means the allowlist is empty and **every** cross-origin
request gets `403`. This fails closed deliberately. Only `next dev` falls back to
`http://localhost:5173` automatically.

## Commands

Run from the repository root:

| Command                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `npm install`            | Install both workspaces                         |
| `npm run dev:frontend`   | Start the React dev server (port 5173)          |
| `npm run dev:backend`    | Start the Next.js dev server (port 3000)        |
| `npm run build`          | Production build of both apps                   |
| `npm run lint`           | Lint both apps                                  |
| `npm run typecheck`      | Type-check both apps                            |
| `npm run test`           | Run backend API unit tests                     |
| `npm run db:generate`    | Build the Prisma client                        |
| `npm run db:validate`    | Validate the Prisma schema                     |
| `npm run db:migrate`     | Apply/create migrations (dev database)         |
| `npm run db:deploy`      | Apply migrations without prompting             |
| `npm run db:seed`        | Load deterministic demo data                   |
| `npm run db:verify`      | Query the database and check demo labelling    |

Per-app commands are also available with `npm run <script> --workspace frontend`
or `--workspace backend`. Each app defines `dev`, `build`, `lint`, `typecheck`,
and (backend) `start`.

## Project layout

```text
frontend/                 React + Vite + TypeScript UI
  src/App.tsx             Root component
  src/lib/apiConfig.ts    Reads VITE_API_BASE_URL for API calls
  src/vite-env.d.ts       Typed import.meta.env declarations
backend/                  Next.js App Router API service
  src/app/layout.tsx      Minimal root layout (no UI)
  src/app/api/health/     GET /api/health route handler
  src/app/api/[...path]/  JSON 404 for unknown API paths
  src/lib/api/            Response envelope, errors, validation, CORS, env
  src/lib/db/             Prisma client, driver adapter, repositories
  src/proxy.ts            CORS gate and preflight handling for /api/*
  prisma/schema.prisma    Database models and enums
  prisma/migrations/      Generated SQL migrations
  prisma/seed-data.ts     Pure, deterministic demo data
  prisma/seed.ts          Idempotent upsert seed script
  prisma/verify-seed.ts   Live-database verification (npm run db:verify)
  generated/prisma/       Generated client (git-ignored)
package.json              npm workspaces root
docs/                     (planned)
PRD.md  AGENTS.md  TRACER.md
```

## Data honesty

No live mandi data source is connected yet. When the data layer is built it will ship
a **deterministic demo provider** behind a provider interface, with every record and
view clearly labelled `Demo data`. Seeded records are never presented as live or
real-time, and forecasts are only returned when a documented minimum-data rule is
met (`insufficient_data` otherwise).

## Current status

Phases 1 (scaffold), 2 (UI foundation), and 3 (API foundation) are complete.
Phase 4 adds the PostgreSQL schema, migrations, and demo seeds. Price endpoints,
the real data provider, and crop recommendations are built in later phases. See
`TRACER.md` for progress and `PRD.md` for requirements.
