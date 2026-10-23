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
- PostgreSQL is **not** required yet. It is first needed in Phase 4.

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
DATABASE_URL="postgresql://postgres:CHANGE_ME@localhost:5432/krishi_mandi?schema=public"
CORS_ALLOWED_ORIGINS="http://localhost:5173"
MANDI_DATA_PROVIDER_MODE=demo
MANDI_PROVIDER_API_KEY=
AI_API_KEY=
AI_MODEL=
```

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

The backend currently returns `404` for every path because no API route exists yet;
the first route (`GET /api/health`) arrives in Phase 3.

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

Phase 1 (monorepo scaffold) is complete. The dashboard, API endpoints, database
schema, and demo data are built in later phases. See `TRACER.md` for progress and
`PRD.md` for requirements.
