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
FARM_PROFILE_RETENTION_DAYS=90
```

`CORS_ALLOWED_ORIGINS` is required for the browser to reach the API.
`MANDI_DATA_PROVIDER_MODE` selects the price data source (see
[Mandi data providers](#mandi-data-providers)). `AI_API_KEY` and `AI_MODEL`
are declared ahead of the phase that uses them.
`FARM_PROFILE_RETENTION_DAYS` sets how long a saved farmer profile is kept
(see [Privacy and retention](#privacy-and-retention)).

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
| `FarmProfile`             | A saved farmer profile: location, soil, season, land area       |

Authentication and forecasts are later phases and have no tables yet.

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

## Mandi data providers

The API never talks to a data source directly. It asks a **provider**, and the
provider normalises the answer into one internal shape: crop, market,
observation date, min/max/modal price, unit, source, and a data status. The
mode is chosen by `MANDI_DATA_PROVIDER_MODE`:

| Mode     | Source                                                        | Credentials                     | Records are labelled |
| -------- | ------------------------------------------------------------- | ------------------------------- | -------------------- |
| `demo`   | The seeded rows already in PostgreSQL                          | none                            | `DEMO`               |
| `live`   | `data.gov.in` daily mandi prices (Ministry of Agriculture)      | `MANDI_PROVIDER_API_KEY`         | `LIVE` / `RECENT`    |

- `demo` is the default. It reads the Phase 4 seed data. Nothing is generated
  at request time, so the same request always returns the same rows and the
  API never writes to the database.
- `live` reads the official resource
  [`9ef84268-d588-465a-a308-a864a43d0070`](https://www.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070)
  (*Current Daily Price of Various Commodities from Various Markets (Mandi)*,
  Ministry of Agriculture and Farmers Welfare, published under the Government
  Open Data Licence - India). Request an API key at
  [data.gov.in](https://data.gov.in) and put it in `MANDI_PROVIDER_API_KEY`.
- Any other mode value is rejected with a clear error. It never silently
  falls back to demo data.

**The live provider never invents data.** If the upstream is unreachable,
refuses the request, or answers with something unusable, the API returns a
`503` (or `502`) with a `PROVIDER_*` error code. It does **not** quietly
return seeded rows in place of real prices.

**Everything is labelled.** Every price observation carries its own
`dataStatus` (`LIVE`, `RECENT`, `DEMO`, `UNAVAILABLE`) and `source`, and every
response carries a `dataSource` block naming the provider. Demo records are
never presented as live, and the price unit is always stated explicitly
(`INR per quintal`) rather than assumed.

### Verified upstream behaviour

The live provider is built against behaviour that was confirmed with real
requests, not assumptions:

- The endpoint needs an `api-key`. A request without one is rejected with
  HTTP `400`, and a request with an unknown key with HTTP `403`.
- `filters[state]`, `filters[district]`, `filters[market]` and
  `filters[commodity]` are honoured and match case-insensitively. There is
  **no** usable date filter, so dates are applied to the fetched page.
- Every response is capped at **10 records**, whatever `limit` asks for, so the
  provider pages through the resource itself.
- The service advertises no request budget in its headers
  (`X-Ratelimit-Limit: -1`), but under a burst it still answers `429`, and it
  sometimes drops a connection. The provider therefore retries a failed page a
  few times, keeps a small page budget, and caches pages for a minute.
- The resource publishes no coordinates, so the API never reports a distance
  for a live market.

## API endpoints

| Method | Path                 | Purpose                                                  |
| ------ | -------------------- | -------------------------------------------------------- |
| `GET`  | `/api/health`        | Liveness of the API process only                          |
| `GET`  | `/api/mandi-prices`  | Price observations, with filters and pagination            |
| `GET`  | `/api/markets`       | Markets and their latest available price                  |
| `GET`  | `/api/data-sources`  | Which provider is configured, and whether it answered      |
| `POST` | `/api/farm-profile/analyze` | Validate and store a farmer profile              |

### `GET /api/mandi-prices`

Query parameters (all optional):

| Parameter | Meaning                                                      | Notes                                              |
| --------- | ------------------------------------------------------------ | -------------------------------------------------- |
| `crop`    | Crop slug, name, or alias (`wheat`, `Wheat`, `Gehun`)        | Case-insensitive                                    |
| `market`  | Market slug or name                                          | Case-insensitive                                    |
| `state`   | State name, for example `Maharashtra`                        | Case-insensitive                                    |
| `district`| District name                                                | Case-insensitive                                    |
| `from`    | Start of the observation date range, `yyyy-mm-dd`             | Inclusive                                           |
| `to`      | End of the observation date range, `yyyy-mm-dd`               | Inclusive                                           |
| `limit`   | Page size, 1-100                                             | Default `25`                                        |
| `offset`  | Rows to skip, 0-10000                                        | Default `0`                                         |

```bash
curl "http://localhost:3000/api/mandi-prices?crop=wheat&state=Maharashtra&limit=5"
```

```jsonc
{
  "success": true,
  "data": {
    "observations": [
      {
        "crop": { "slug": "wheat", "name": "Wheat", "variety": null, "grade": null },
        "market": {
          "slug": "nashik-apmc-maharashtra",
          "name": "Nashik APMC",
          "state": "Maharashtra",
          "district": "Nashik",
          "locality": "Pimpalgaon"
        },
        "observedAt": "2026-01-05",
        "minPrice": 2000,
        "maxPrice": 2400,
        "modalPrice": 2200,
        "unit": "RUPEES_PER_QUINTAL",
        "unitLabel": "INR per quintal",
        "currency": "INR",
        "source": "demo-seed",
        "dataStatus": "DEMO",
        "isLive": false,
        "fetchedAt": null
      }
    ],
    "pagination": { "limit": 5, "offset": 0, "returned": 1, "total": 42, "truncated": false },
    "dataSource": {
      "providerId": "demo-seed",
      "providerName": "Seeded demonstration data",
      "mode": "demo",
      "dataStatus": "DEMO",
      "isDemoData": true,
      "isLiveData": false,
      "label": "Demo data",
      "notice": "These are seeded demonstration records. They are not real mandi prices.",
      "source": { "id": "demo-seed", "url": null, "attribution": "..." }
    }
  }
}
```

### `GET /api/markets`

Query parameters: `market`, `state`, `district`, `limit`, `offset`. Each
market reports `hasVerifiedCoordinates` and its `latestPrice`. A distance is
only ever shown when the source published real coordinates; the seeded demo
markets deliberately have none.

### `GET /api/data-sources`

Reports the configured provider, whether it is serving demo records or a
verified source, and the source attribution. In `live` mode the endpoint
performs **one real request** to the upstream and reports whether it
answered, so the endpoint never claims a source is healthy without checking.

### Provider errors

| Code                     | Status | Meaning                                             |
| ------------------------ | ------ | --------------------------------------------------- |
| `PROVIDER_NOT_CONFIGURED`| `503`  | The live provider is selected but has no API key     |
| `PROVIDER_UNAVAILABLE`   | `503`  | The upstream could not be reached or failed          |
| `PROVIDER_UNAVAILABLE`   | `502`  | The upstream answered with an unusable payload       |
| `PROVIDER_RATE_LIMITED`  | `503`  | The upstream refused the request because of a budget |

These responses never contain demo rows, stack traces, or the API key.

### `POST /api/farm-profile/analyze`

Validates a farmer profile, stores it, and reports what the active data source
could resolve for that location. It is the endpoint behind the profile form on
the dashboard.

Request body:

| Field            | Required | Meaning                                                        |
| ---------------- | -------- | -------------------------------------------------------------- |
| `state`         | yes      | State name, for example `Maharashtra`                           |
| `district`      | yes      | District name, for example `Nashik`                            |
| `soilType`      | yes      | `ALLUVIAL`, `BLACK`, `RED`, `LATERITE`, `SANDY`, `OTHER`    |
| `season`        | yes      | `KHARIF`, `RABI`, `ZAID`, `WHOLE_YEAR`, `OTHER`             |
| `landArea`      | yes      | Positive number, at most 1000 acres worth of land               |
| `landAreaUnit`  | yes      | `ACRE` or `HECTARE`                                           |
| `villageOrPin`  | no       | Village name, or a PIN code with exactly 6 digits                |
| `irrigationType`| no       | `RAINFED`, `DRIP`, `SPRINKLER`, `FLOOD`, `CANAL`, `WELL`, `OTHER` |
| `currentCrop`   | no       | Current or intended crop                                        |

```bash
curl -X POST http://localhost:3000/api/farm-profile/analyze \
  -H "Content-Type: application/json" \
  -d '{"state":"Maharashtra","district":"Nashik","soilType":"BLACK","season":"KHARIF","landArea":2.5,"landAreaUnit":"ACRE"}'
```

```jsonc
{
  "success": true,
  "data": {
    "profileId": "cmvuzkodr0002ysvbaob092cy",
    "savedAt": "2026-10-30T08:06:39.087Z",
    "profile": {
      "id": "cmvuzkodr0002ysvbaob092cy",
      "state": "Maharashtra",
      "district": "Nashik",
      "soilType": "BLACK",
      "season": "KHARIF",
      "landArea": 2.5,
      "landAreaUnit": "ACRE",
      "landAreaInAcres": 2.5,
      "villageOrPin": "Pimpalgaon",
      "irrigationType": "DRIP",
      "currentCrop": "Soybean",
      "createdAt": "2026-10-30T08:06:39.087Z"
    },
    "matchingData": {
      "priceObservations": 84,
      "markets": 2,
      "isComplete": true,
      "dataStatus": "DEMO",
      "source": "demo-seed",
      "notice": "These are seeded demonstration records. They are not real mandi prices."
    },
    "analysis": {
      "status": "not_computed",
      "cropSuggestions": null,
      "sellingInsights": null,
      "message": "Your profile was validated and saved. Crop suggestions and selling-period insights are added in a later phase, so no ranking is shown yet."
    },
    "notice": "Your details were checked and stored so the app can find matching markets. Nothing here is a promise about yield, price, or profit."
  }
}
```

**What this endpoint does not do.** It does not rank crops and it does not
produce a forecast. Those belong to the Phase 8 rule engine, so the response
says `"status": "not_computed"` instead of returning an empty list that would
look like "no crop suits this farm".

**A failed data source does not lose the profile.** If the provider cannot be
read, the profile is still stored and the response reports
`dataStatus: "UNAVAILABLE"` with the provider's message. It never falls back
to demo rows.

Invalid input returns `400` with `VALIDATION_ERROR` and a `details` array
that names the field, so the form can show the message next to the input that
caused it:

```jsonc
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The body is invalid. Check the highlighted fields and try again.",
    "details": [{ "field": "landArea", "message": "Enter a land area greater than zero.", "code": "custom" }]
  }
}
```

## Privacy and retention

The profile form collects only what the product needs:

- **No name, no phone number, no email, no GPS.** The database check in
  `npm run db:verify` confirms the `FarmProfile` table has no column for a
  name, a contact detail, or a coordinate.
- **District-level location.** The optional village or PIN field is stored
  because the PRD asks for it, but it is never used to calculate a distance,
  because no verified coordinates exist for it.
- **Retention: 90 days by default.** A profile is a reusable search record, so
  it is kept for `FARM_PROFILE_RETENTION_DAYS` days and then removed:

  ```bash
  npm run db:prune-profiles                # dry run: lists what would go
  npm run db:prune-profiles -- --confirm   # actually removes them
  ```

  The script never deletes anything without `--confirm`.

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
| `npm run db:prune-profiles` | Remove profiles older than the retention window |

Per-app commands are also available with `npm run <script> --workspace frontend`
or `--workspace backend`. Each app defines `dev`, `build`, `lint`, `typecheck`,
and (backend) `start`.

## Project layout

```text
frontend/                 React + Vite + TypeScript UI
  src/App.tsx             Root component
  src/lib/apiConfig.ts    Reads VITE_API_BASE_URL for API calls
  src/lib/apiClient.ts    JSON envelope client used by the app
  src/lib/farmProfileValidation.ts  Shared form rules (no React, no imports)
  src/lib/farmProfileApi.ts Client for POST /api/farm-profile/analyze
  src/components/farm-profile/  The farmer profile form
  src/components/dashboard/ The live data-status strip
  src/vite-env.d.ts       Typed import.meta.env declarations
backend/                  Next.js App Router API service
  src/app/layout.tsx      Minimal root layout (no UI)
  src/app/api/health/     GET /api/health route handler
  src/app/api/markets/    GET /api/markets route handler
  src/app/api/mandi-prices/ GET /api/mandi-prices route handler
  src/app/api/data-sources/ GET /api/data-sources route handler
  src/app/api/farm-profile/analyze/ POST /api/farm-profile/analyze route handler
  src/app/api/[...path]/  JSON 404 for unknown API paths
  src/lib/api/            Response envelope, errors, validation, CORS, env
  src/lib/db/             Prisma client, driver adapter, repositories
  src/lib/providers/      Provider contract, demo provider, data.gov.in provider
  src/lib/services/       Mandi price service and the farmer profile service
  src/proxy.ts            CORS gate and preflight handling for /api/*
  prisma/schema.prisma    Database models and enums
  prisma/migrations/      Generated SQL migrations
  prisma/seed-data.ts     Pure, deterministic demo data
  prisma/seed.ts          Idempotent upsert seed script
  prisma/verify-seed.ts   Live-database verification (npm run db:verify)
  prisma/prune-profiles.ts Retention script (npm run db:prune-profiles)
  generated/prisma/       Generated client (git-ignored)
package.json              npm workspaces root
docs/                     (planned)
PRD.md  AGENTS.md  TRACER.md
```

## Data honesty

Two data sources exist behind one provider interface:

- the **demo provider**, which serves the seeded PostgreSQL rows and labels every
  record `DEMO` / `demo-seed`, and
- the **data.gov.in provider**, which serves the official daily mandi price
  resource and labels its records `LIVE` or `RECENT` with the source `data-gov-in`.

Which one is active depends on `MANDI_DATA_PROVIDER_MODE`. Seeded records are
never presented as live or real-time, the live provider never substitutes demo
rows when the upstream fails, and forecasts are only returned when a documented
minimum-data rule is met (`insufficient_data` otherwise).

## Current status

Phases 1 (scaffold), 2 (UI foundation), 3 (API foundation), 4 (database), and 5
(mandi provider and prices API) are complete. Phase 6 adds the farmer profile
form on the dashboard, the `POST /api/farm-profile/analyze` endpoint, and the
`FarmProfile` table.

The price dashboard, the crop-suitability rules, and the selling-period
insights are later phases and are not built yet, so the UI never shows a price,
a forecast, or a crop ranking it cannot back with real data. See `TRACER.md`
for progress and `PRD.md` for requirements.
