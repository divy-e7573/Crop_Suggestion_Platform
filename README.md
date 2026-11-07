# Krishi Mandi Price Prediction & Crop Suggestion Platform

Farmer-facing decision-support web application for Indian mandi markets. A farmer
submits a simple profile (state, district, soil type, season, land area) and receives
mandi prices, historical trends, crop suitability suggestions, and selling-period
insights.

> **Disclaimer:** These estimates are informational, depend on available data, and are
> not guaranteed outcomes. Verify local conditions and official market information
> before making decisions.

## The problem

An Indian farmer deciding what to plant and when to sell works from whatever they
are told: a trader's number, a rumour, or a visit to the market. Official mandi
prices are published every day, but they are spread across hundreds of markets
and are hard to read. Two practical questions follow from that:

1. **Which crops suit my land this season?** The answer depends on the soil, the
   season, the irrigation, and the size of the plot, and it is usually given by
   opinion rather than by a rule.
2. **Is now a good time to sell?** That needs the recent price history of *my*
   crop at *my* market, which nobody has time to assemble by hand.

## The solution

A small web application that turns a short farm profile into an explanation:

- the **mandi prices** for the crops, states, districts, and markets that were
  actually recorded, each row labelled with its source and its freshness;
- **crop suitability suggestions**, ranked by a documented rule set, where every
  suggestion says which of the farmer's inputs matched and which were missing;
- **selling-period insights**, built only from the prices that were really
  observed, with an estimate shown only when there is enough history and an
  honest "not enough data" when there is not.

The guiding rule is that the app never invents a price. If the data source
cannot be read, the app says so instead of showing something plausible.

## Main features

| Feature | What the farmer gets |
| ------- | -------------------- |
| Farmer profile | State, district, soil type, season, land area and unit, optional irrigation, optional current crop |
| Mandi price dashboard | Filter by crop, state, district, market, and date; compare markets; see the price trend |
| Crop suggestions | Ranked crops with the matched and missing criteria, and the crops that were left out with their reasons |
| Selling-period insights | The observed direction, a baseline estimate with its evidence, and plain-language guidance |
| Data-source status | Every screen says whether it is showing seeded demo records or live government data |
| Next.js demonstrations | Server Component, SSG, and SSR pages that show the framework features the course asks for |

## Technology stack

| Layer | Choice | Why |
| ----- | ------ | --- |
| Frontend | React 19 + Vite + TypeScript | The product UI. Fast local server, small bundle, strict types |
| Backend | Next.js 16 (App Router) + TypeScript | Route Handlers give the HTTP/JSON API; the same app demonstrates Server Components, SSG, and SSR |
| Database | PostgreSQL 18 | Stores the reference data, the demo records, and the saved farmer profiles |
| ORM | Prisma 7 | Typed models, versioned migrations, and a generated client that never leaves the backend |
| Validation | Zod 4 | One schema per request, on the server, so the browser is never trusted |
| Charts | uPlot 1.6 | About 50 kB with no dependencies, next to a charting framework that ships its own state manager |
| Data source | data.gov.in | The official daily mandi price resource published by the Ministry of Agriculture |
| Tests | `node --test` | No extra test framework; the plain Node runner is used on both sides |

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
[Mandi data providers](#mandi-data-providers)). `AI_API_KEY`, `AI_MODEL`,
`AI_BASE_URL`, and `AI_ENABLE_NARRATIVE` control the optional server-side
narrative; the last two are commented out in `.env.example` because their
defaults are already correct. The app needs none of them: its deterministic
explanations work without an AI key.
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

Forecasts are calculated from observed prices when the documented threshold is
met; they are not stored as separate database records. Authentication remains
a later phase and has no table yet.

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
`notConnected` list is intentional: this lightweight endpoint does not test
the database, the mandi provider, or the optional AI provider. The list means
"not checked by this request", not "not integrated".

## Demonstration workflow

This is the sequence to follow in a college demonstration. It works entirely
with the **seeded demo data**, so it does not need an internet connection, a
provider key, or a live market feed.

**Before you start**

1. `npm install`
2. Copy `backend/.env.example` to `backend/.env.local`, put your own
   `DATABASE_URL` in it, and leave `MANDI_DATA_PROVIDER_MODE=demo`.
3. `npm run db:deploy` then `npm run db:seed`
4. `npm run dev:backend` in one terminal and `npm run dev:frontend` in
   another.

**The walkthrough**

| # | Do this | What to say |
| - | ------- | ----------- |
| 1 | Open `http://localhost:5173` | "This is the React app; the Next.js service behind it holds the data." |
| 2 | Read the strip at the top of the dashboard | It says **Demo data** and names the seeded source. Every later screen carries the same badge. |
| 3 | Open **Mandi Prices** | 252 seeded observations, each with its market, day, unit, and source. |
| 4 | Type `Wheat`, choose **Punjab**, then a district, then a market | The filters cascade: a market only appears when it belongs to the chosen district, and the market list is never filtered by the state it is built from. |
| 5 | Look at the price trend and the market comparison | Seven real seeded days for that crop at that market. The chart also has a table alternative for screen readers. |
| 6 | Back to **Dashboard**, fill the profile form (Maharashtra, Nashik, black soil, kharif, 2 acres, drip) and save | The form is validated in the browser and again on the server. The saved summary appears with the data-source badge. |
| 7 | Open **Crop Suggestions** | The ranked crops with the rule that matched, the criteria that were missing, and the crops that were left out with their reasons. |
| 8 | Scroll to the price insight panel | The observed direction, then the estimate: **not enough data** or a number with its evidence period, its unit, and a weak/fair/good evidence label. |
| 9 | Open **Data Sources & About** | The provider, its attribution, the demo-versus-live rule, and the limits of the live feed. |
| 10 | Open `http://localhost:3000/rendering/ssg` and then `/rendering/ssr` | Two separate Next.js demonstrations: the SSG page is byte-identical on every request, the SSR page changes on every request. |

**The honest answer to "why is the estimate sometimes missing?"**

The forecast needs at least 7 observations on at least 5 different dates
covering at least 7 calendar days, of one crop at one market in one unit. The
seeded demo series has exactly 7 days, so it clears the rule and produces an
estimate labelled **weak evidence**. The live data.gov.in feed publishes only
the current day for a given market, so a live series usually holds a single
observation, does not clear the rule, and the app shows **not enough data**
instead of a number. That is the correct behaviour, and it is worth
demonstrating on purpose: change `MANDI_DATA_PROVIDER_MODE` to `live` and
show that the estimate disappears rather than being invented.

**Sample profile to type in**

| Field | Value |
| ----- | ----- |
| State | `Maharashtra` |
| District | `Nashik` |
| Village or PIN code | `Pimpalgaon` (optional, any value) |
| Soil type | `BLACK` |
| Season | `KHARIF` |
| Irrigation | `DRIP` (optional) |
| Current or intended crop | `Soybean` (optional) |
| Land area | `2.5` |
| Land area unit | `ACRE` |

## Mandi price dashboard

The React app has one dashboard route, `/mandi-prices`. It is a real dashboard,
not a placeholder: every figure on it comes from the API, and every section
has its own loading, empty, and error state.

| Section               | What it shows                                                             |
| --------------------- | ------------------------------------------------------------------------- |
| Data source           | The active provider, its DEMO/LIVE status, attribution, and freshness       |
| Filters               | Crop, state, district, market, and observation date range, with a reset    |
| Price overview        | Minimum, maximum, and average modal price of the records on screen         |
| Market comparison     | The newest price of the selected crop in every matching market             |
| Price trend           | The recorded observations of one crop at one market, over time              |
| Price observations    | Every matching record: crop, market, date, min/max/modal price, unit, source |
| Relevant markets      | The markets that match the location, with their latest price                |

### How it stays honest

- **Nothing is invented.** The summary, the comparison, and the chart are all
  calculated from the records the API returned. The chart is only drawn when
  the source returned more than one observation; with a single point the page
  says there is not enough data for a trend.
- **One series is one crop at one market.** The chart refuses to draw a series
  whose crop or market does not match the selection, so two commodities can
  never be joined into one line.
- **A provider failure is not an empty result.** When the upstream fails the
  page shows the provider error and a retry button; it never falls back to
  demo rows.
- **Every record is labelled.** The status badge on each row comes from the
  record's own `dataStatus`, and the dashboard shows the provider's status
  from `/api/data-sources`.
  The same rule applies to the Phase 8 analysis: the freshness label of a
  trend or a forecast is worked out from every observation that was used, so
  a series the live provider answered partly from its page cache is reported
  as `Recent` rather than `Live`.
- **Distances are not invented.** The market list is called *relevant markets*,
  not *nearby markets*, because no source in this project publishes verified
  coordinates.

### How the filters behave

- **The crop field is free text.** A data source may publish a commodity this
  project does not know yet, so the crop filter accepts any text. The values
  in the list under it come from `GET /api/crops`, which is reference data.
- **The dropdowns cascade.** The district list follows the chosen state, and
  the market list follows the chosen state and district. Changing the state
  clears the district and the market, because a market in another district
  would match nothing.
- **Every state stays selectable.** The market list is fetched once, without
  a state filter, so the state dropdown always offers every state the data
  has. Filtering to one state never traps the farmer on that state.
- **One request per finished value.** The crop field is applied when the
  farmer presses Enter or leaves the field, and the dropdowns apply as soon
  as they change, so a request is never sent for every keystroke.

### The charting library

The trend chart uses [uPlot](https://github.com/leeoniya/uPlot) (`uplot`
`^1.6.32`, MIT). It was chosen over Recharts and visx because it is about
50 kB minified with **no dependencies**, while the alternatives pull in a
state manager and several packages for one line chart. The chart is
decorative for a screen reader: the same numbers are repeated in a visually
hidden table, and the chart image carries a label naming the crop, the market,
the number of observations, and the unit.

### Known limitations

- **The live provider cannot supply a trend.** The data.gov.in resource has no
  usable date filter and caps every response at 10 records, so a live series
  usually holds a single observation. In live mode the trend card explains
  that there is not enough data rather than drawing a line.
- **The seeded demo data covers 7 days** (2026-01-05 to 2026-01-11) for six
  crops in six markets. The trend chart therefore shows seven points.
- **No distance ranking.** See above: the source publishes no coordinates.

## Crop suggestions and selling insights

The farmer profile is turned into a ranked crop shortlist, an observed price
trend, and a selling-period explanation. Each part lives in its own module
under `backend/src/lib/services/`, so each can be tested on its own:

| Module                       | What it does                                        |
| ---------------------------- | --------------------------------------------------- |
| `cropSuitabilityService.ts`  | Matches the profile against the rules and ranks them  |
| `trendAnalysisService.ts`    | Works out the direction of the observed prices        |
| `forecastService.ts`         | Decides whether an estimate is allowed, and makes it  |
| `sellingInsightService.ts`   | Turns both into plain language                        |
| `aiNarrativeProvider.ts`     | Optional extra wording from an AI provider           |
| `profileAnalysisService.ts`  | Puts the pieces together for one profile             |

### The suitability rules

The rules are the seeded `CropSuitabilityRule` rows. Each rule names the soil
types, seasons, irrigation types, states, and land-area range it applies to.
An empty list means "no restriction on this factor".

For every factor the profile can contradict:

- **A contradiction removes the crop** from the shortlist, and the reason is
  reported. The crops that were left out are listed with their reasons, so an
  empty shortlist is never a mystery.
- **A factor that could not be checked keeps the crop.** Only irrigation is
  optional in the product, so this happens when the farmer left it blank (or
  chose "other"). Missing information is never counted as a confirmed match:
  it lowers the score and the confidence, and it is listed under the
  suggestion.
- **The land area is converted to acres** before it is compared, because the
  rule limits are stored in acres while the farmer may enter hectares. Both
  ends of the range are inclusive.

### The ranking

- **Score** - the share of the rule's restricted factors the profile
  confirmed, as a percentage. A factor the rule does not restrict is reported
  but does not raise the score.
- **Confidence** - `high` when every factor was checked and at least three
  matched, `medium` when something could not be checked but at least three
  matched, `low` otherwise.
- **Order** - score, then confidence, then the crop name. The same profile
  always produces the same list.

### The observed trend

Only observations of **one crop at one market in one price unit** are used.
Observations of another crop, market, or unit are dropped rather than mixed
in, prices that are not real numbers are dropped, and observations recorded
on the same date are averaged into one point. The daily points are sorted
oldest first and a straight line is fitted to them by least squares. The
change of that line across the observed period is compared with the average
price: a change of less than 2 percent is reported as `stable`, otherwise
the direction of the line is reported as `rising` or `falling`. Fewer than
three observations on three different dates is reported as
`insufficient_data`.

### The forecast threshold

A number is only produced when the observations clear all of these:

| Requirement                    | Value                              |
| ------------------------------ | ---------------------------------- |
| Observations                   | at least 7                          |
| Different observation dates    | at least 5                          |
| Calendar days of history       | at least 7                          |
| Crop, market, and price unit   | exactly one of each                 |

When they do not, the response carries `"status": "insufficient_data"` with
the reason and **no number at all**.

When they do, the estimate is a straight line fitted by least squares and read
7 days beyond the last observation. The range around it is the estimate plus
or minus 1.28 times the standard error of the fit. That range shows how far
the observed prices normally sat from the fitted line. It is **not** a
calibrated prediction interval: it leaves out the uncertainty of the fitted
line itself, and it does not widen the further the line is read beyond the
last observation, so it is a rough guide rather than a bound. The
data-quality label is `low` with fewer than 14 observations, fewer than 7
days of history, or a fit that explains under 30 percent of the variation;
`medium` with fewer than 30 observations or a fit under 60 percent; `high`
otherwise. The label describes how much and how good the evidence is, not how
certain the estimate is, and the UI words it as `Good evidence`, `Fair
evidence`, or `Weak evidence` for that reason.

The seeded demo series (7 days) clears the threshold and is labelled `low`
quality. The live provider usually returns a single observation for a market,
so it does not clear it and no estimate is shown.

### The AI provider

The AI provider is **optional and off by default**. The ranking, the trend,
and the forecast are calculated by the deterministic engine, and the plain
language around them is written by that same engine. With no `AI_API_KEY`
the product behaves exactly the same.

When a key is configured, the provider may only add one extra sentence of
wording. Three rules keep it safe:

- The key is read on the server and never reaches the browser.
- The text is rejected if it contains a digit, so it can never state a price,
  a percentage, or a count, and it never replaces the structured values.
- Only the crop name, the market name, the observed direction, and the data
  status are sent. No state, district, land area, village, or PIN code.

### What the guidance never says

The selling-period text never names a date as a good day to sell, never
promises a price or a profit, and never tells a farmer to delay a sale on the
strength of a short history.

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
| `GET`  | `/api/mandi-prices/history` | The price series for one crop at one market         |
| `GET`  | `/api/crops`         | The crops the platform supports (reference data)          |
| `GET`  | `/api/markets`       | Markets and their latest available price                  |
| `GET`  | `/api/data-sources`  | Which provider is configured, and whether it answered      |
| `POST` | `/api/farm-profile/analyze` | Validate and store a farmer profile              |
| `GET`  | `/api/farm-profile/analysis` | Read one saved profile back (needs `X-Analysis-Token`) |

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

### `GET /api/mandi-prices/history`

The price series the trend chart draws. **Both `crop` and `market` are
required**, because a series only means something for one commodity at one
market; a request without one of them is rejected with `400`.
`from` and `to` are optional and filter the series by observation date.

| Parameter | Required | Meaning                                                |
| --------- | -------- | ------------------------------------------------------ |
| `crop`    | yes      | Crop slug, name, or alias                              |
| `market`  | yes      | Market slug or name                                    |
| `from`    | no       | Start of the observation date range, `yyyy-mm-dd`      |
| `to`      | no       | End of the observation date range, `yyyy-mm-dd`        |

```bash
curl "http://localhost:3000/api/mandi-prices/history?crop=wheat&market=nashik-apmc-maharashtra"
```

```jsonc
{
  "success": true,
  "data": {
    "series": {
      "crop": { "slug": "wheat", "name": "Wheat" },
      "market": { "slug": "nashik-apmc-maharashtra", "name": "Nashik APMC", "state": "Maharashtra", "district": "Nashik" },
      "metric": "MODAL_PRICE",
      "unit": "RUPEES_PER_QUINTAL",
      "unitLabel": "INR per quintal",
      "currency": "INR",
      "points": [
        { "observedAt": "2026-01-05", "minPrice": 2093, "maxPrice": 2457, "modalPrice": 2275, "dataStatus": "DEMO", "source": "demo-seed" }
      ],
      "isComplete": true
    },
    "dataSource": { "providerId": "demo-seed", "mode": "demo", "dataStatus": "DEMO", "isDemoData": true, "isLiveData": false, "label": "Demo data", "notice": "..." }
  }
}
```

**The series can never mix two things.** The service drops any row whose crop,
market, or unit differs from the first row, so a chart can never join two
commodities or two markets into one line (PRD FR-04).

### `GET /api/crops`

The catalogue of crops the platform supports, read from the `Crop` table. It
exists because the price list can only return the crops that happen to match
a filter. The response says clearly that it is **reference data**, not a price
feed:

```jsonc
{
  "success": true,
  "data": {
    "crops": [
      { "slug": "wheat", "name": "Wheat", "aliases": ["Gehun"], "category": "CEREAL", "dataStatus": "DEMO" }
    ],
    "catalogue": {
      "isReferenceData": true,
      "available": true,
      "dataStatus": "DEMO",
      "notice": "These are the crops this platform supports..."
    },
    "provider": { "id": "demo-seed", "displayName": "Seeded demonstration data", "mode": "demo", "configured": true }
  }
}
```

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
      "status": "computed",
      "message": "Your profile was matched against the crop rules and the price observations for your area.",
      "cropSuggestions": {
        "suggestions": [
          {
            "rank": 1,
            "crop": { "slug": "cotton", "name": "Cotton", "category": "CASH" },
            "score": 100,
            "confidence": "high",
            "matchedCriteria": ["Your soil type (black) is one this rule allows."],
            "missingInformation": [],
            "explanation": "It matches your profile because your soil type (black) is one this rule allows.",
            "guidance": "Cotton is a kharif cash crop on black or red soil in much of central and western India.",
            "rule": { "version": "demo-v1", "source": "demo-seed", "dataStatus": "DEMO" },
            "isCurrentCrop": false
          }
        ],
        "notRecommended": [],
        "ruleVersion": "demo-v1",
        "method": "Each crop is scored by the share of its rule that the profile confirmed.",
        "missingInformation": [],
        "landAreaInAcres": 2.5,
        "ruleDataStatus": "DEMO",
        "ruleSource": "demo-seed"
      },
      "sellingInsights": {
        "status": "available",
        "summary": "The observed prices for Cotton at Nashik APMC were rising over the period that was observed.",
        "points": ["The observed modal price at Nashik APMC went up, from 2000 to 2300 INR per quintal."],
        "caveats": ["This is observed market information, not advice on when to sell."],
        "observedTrend": { "direction": "rising", "observationCount": 7 },
        "forecast": { "status": "ok", "pointEstimate": 2400, "horizonDays": 7, "dataQuality": "low" },
        "narrative": null,
        "dataStatus": "DEMO",
        "isDemoData": true,
        "method": "The insights are built from two calculations and nothing else."
      }
    },
    "notice": "Your details were checked and stored so the app can find matching markets. Nothing here is a promise about yield, price, or profit."
  }
}
```

**What the analysis block contains.** The ranked crop suggestions and the
selling-period insights, both calculated by the rule engine described below.
`analysis.status` is `computed` when everything was read, `partial` when the
price records could not be read but the crop rules could, and `unavailable`
when the rules themselves could not be read.

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

### `GET /api/farm-profile/analysis`

Reads one saved profile back and recomputes its analysis from the current
data, so a stale price is never shown as if it were current. The
crop-suggestions page uses it, so the page still works after a reload.

The caller must present the access token that was handed out when the profile
was created, in the `X-Analysis-Token` request header:

```bash
curl http://localhost:3000/api/farm-profile/analysis \
  -H "X-Analysis-Token: THE_TOKEN_FROM_THE_POST_RESPONSE"
```

| Case                        | Status | Body                                              |
| --------------------------- | ------ | ------------------------------------------------- |
| The token matches a profile | `200`  | `{ success: true, data: { profileId, savedAt, profile, analysis } }` |
| The token is missing or malformed | `400` | `VALIDATION_ERROR` naming the `x-analysis-token` field |
| The token is well formed but unknown | `404` | `NOT_FOUND`      |

The optional village or PIN detail is deliberately **not** repeated in this
response. The analysis does not use it and the page does not need it.

The response is sent with `Cache-Control: no-store`, so a shared cache or a
browser cache cannot keep a farmer's details.

> **There is no "give me the latest profile" endpoint any more.** An earlier
> build had `GET /api/farm-profile/latest`, which returned the most recently
> saved profile to anybody who asked. On a shared or deployed backend that
> would have shown one farmer's state, district, soil type, and land area to
> every other visitor. CORS is not authentication, so the route was replaced
> by the per-profile access token described above. See
> [Privacy and retention](#privacy-and-retention).

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

- **One browser cannot read another farmer's profile.** When a profile is
  saved, the API hands back one unguessable **access token** (43 random
  characters) and stores only its SHA-256 hash. The browser keeps the token
  in **session storage**, so it belongs to one tab and disappears when the
  tab is closed. Reading the profile back needs that token in the
  `X-Analysis-Token` header. A copy of the database therefore cannot be
  turned back into a working token, and there is no route that returns
  "the most recent profile" to whoever asks.

  There is still **no account system**. The token is a capability for one
  profile, not a login: it cannot be used for anything else, it is not
  transferable, and it grants no access to any other farmer's data. If the
  farmer clears the browser data or closes the tab, the analysis has to be
  produced again by saving the profile again.

- **The profile responses are not cached.** They carry
  `Cache-Control: no-store`, so no shared cache keeps a farmer's details.

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
| `npm run test`           | Run the backend and frontend unit tests          |
| `npm run db:generate`    | Build the Prisma client                        |
| `npm run db:validate`    | Validate the Prisma schema                     |
| `npm run db:migrate`     | Apply/create migrations (dev database)         |
| `npm run db:deploy`      | Apply migrations without prompting             |
| `npm run db:seed`        | Load deterministic demo data                   |
| `npm run db:verify`      | Query the database and check demo labelling    |
| `npm run db:prune-profiles` | Remove profiles older than the retention window |

Two more root scripts are useful for a demo on a built app:

| Command                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `npm run build` then `npm run start:backend` | Serve the built Next.js app on port 3000 |
| `npm run build` then `npm run preview:frontend` | Serve the built React app on port 5173 |

Per-app commands are also available with `npm run <script> --workspace frontend`
or `--workspace backend`. Each app defines `dev`, `build`, `lint`, `typecheck`,
and (backend) `start`.

### Troubleshooting

| Symptom | Cause and fix |
| ------- | ------------- |
| `npm` is not recognised in PowerShell | Use `npm.cmd` instead of `npm`, or run the commands from `cmd.exe`. |
| The browser shows "The backend could not be reached" | The Next.js server is not running, or `VITE_API_BASE_URL` points somewhere else. Check `http://localhost:3000/api/health`. |
| The browser shows `403 Forbidden` on every API call | `CORS_ALLOWED_ORIGINS` does not list the origin the browser is using. It must be the full origin, for example `http://localhost:5173`, with no path. |
| `npm run db:seed` fails with a connection error | `DATABASE_URL` is wrong, or PostgreSQL is not running. Check `pg_isready`. |
| The prices all show `Demo data` | `MANDI_DATA_PROVIDER_MODE` is `demo`, which is the default and needs no key. |
| The live provider answers `503 PROVIDER_RATE_LIMITED` | The upstream throttles bursts. Wait a minute; the provider already retries with a backoff. |
| The forecast shows "Not enough data to estimate" | The observations did not clear the documented threshold. This is correct behaviour, not a bug. |

## Project layout

```text
frontend/                 React + Vite + TypeScript UI
  src/App.tsx             Root component
  src/lib/apiConfig.ts    Reads VITE_API_BASE_URL for API calls
  src/lib/apiClient.ts    JSON envelope client used by the app
  src/lib/farmProfileValidation.ts  Shared form rules (no React, no imports)
  src/lib/farmProfileApi.ts Client for the farm-profile analysis endpoints
  src/lib/analysisTokenStorage.ts  Session storage for the profile access token
  src/lib/analysisPresentation.ts Wording for scores, confidence, trends, quality
  src/lib/mandiApi.ts     Client for the price, market, crop, and history APIs
  src/lib/priceAnalytics.ts  Price summaries, market comparison, chart points
  src/lib/useMandiDashboard.ts  The dashboard state and its requests
  src/lib/useSavedAnalysis.ts  Loads the analysis shown on the suggestions page
  src/components/farm-profile/  The farmer profile form
  src/components/analysis/ The ranked suggestions and the selling insights
  src/components/dashboard/ The live data-status strip
  src/components/mandi/   The price dashboard sections
  src/components/charts/  The uPlot chart wrapper
  src/vite-env.d.ts       Typed import.meta.env declarations
backend/                  Next.js App Router API service
  src/app/layout.tsx      Minimal root layout (no UI)
  src/app/api/health/     GET /api/health route handler
  src/app/api/markets/    GET /api/markets route handler
  src/app/api/mandi-prices/ GET /api/mandi-prices route handler
  src/app/api/mandi-prices/history/ GET /api/mandi-prices/history route handler
  src/app/api/crops/      GET /api/crops route handler
  src/app/api/data-sources/ GET /api/data-sources route handler
  src/app/api/farm-profile/analyze/ POST /api/farm-profile/analyze route handler
  src/app/api/farm-profile/analysis/ GET /api/farm-profile/analysis route handler
  src/app/api/[...path]/  JSON 404 for unknown API paths
  src/lib/api/            Response envelope, errors, validation, CORS, env
  src/lib/db/             Prisma client, driver adapter, repositories
  src/lib/providers/      Provider contract, demo provider, data.gov.in provider
  src/lib/services/       Mandi price, crop catalogue, and profile services
  src/lib/services/cropSuitabilityService.ts  The crop ranking rule engine
  src/lib/services/trendAnalysisService.ts    The observed price direction
  src/lib/services/forecastService.ts         The forecast threshold and baseline
  src/lib/services/sellingInsightService.ts   The plain-language guidance
  src/lib/services/aiNarrativeProvider.ts     The optional AI wording
  src/lib/services/profileAnalysisService.ts  Puts the pieces together
  src/lib/services/analysisToken.ts  The per-profile access token
  src/proxy.ts            CORS gate and preflight handling for /api/*
  prisma/schema.prisma    Database models and enums
  prisma/migrations/      Generated SQL migrations
  prisma/seed-data.ts     Pure, deterministic demo data
  prisma/seed.ts          Idempotent upsert seed script
  prisma/verify-seed.ts   Live-database verification (npm run db:verify)
  prisma/prune-profiles.ts Retention script (npm run db:prune-profiles)
  generated/prisma/       Generated client (git-ignored)
package.json              npm workspaces root
ARCHITECTURE.md           Diagrams of the system and its data flows
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

## Known limitations

These are real and are not worked around anywhere in the code.

- **The live feed rarely has enough history.** The data.gov.in resource has no
  usable date filter and caps every response at 10 records, so a live series
  usually holds a single observation. The trend and the forecast therefore
  report `insufficient_data` in live mode. The threshold was not lowered to
  make live data qualify.
- **The seeded data is seven days long.** It clears the forecast threshold
  exactly, and the result is labelled **weak evidence** for that reason.
- **The crop rules are demonstration rules.** They are seeded, they are
  labelled `DEMO` in the API and in the UI, and they are not validated
  agronomic research findings.
- **A market outside the farmer's district may be used.** It happens when the
  farmer's own district has no observations. A caveat then names the market
  and the district that were used.
- **The optional AI narrative has never run against a real provider.** No key
  is configured in this repository, and none is needed. What is verified is
  everything around it: the sanitiser, the disabled-without-a-key path, the
  failure paths, and the fact that no structured value can be overridden by
  text.
- **There is no account system.** A saved profile is read back with a
  per-profile access token held in one browser tab. Clearing the browser data
  or closing the tab means the analysis has to be produced again by saving
  the profile again. This is deliberate: the PRD does not ask for accounts,
  and adding them would mean collecting more personal data than the product
  needs.
- **The band around the forecast is not a prediction interval.** It is a
  standard-error band around a fitted line. It leaves out the uncertainty of
  the fitted line and does not widen with the distance the line is read
  beyond the last observation.
- **Distances are not shown.** No source in this project publishes verified
  coordinates, so the market list is called *relevant markets*, not *nearby
  markets*.
- **The seeded prices are not real prices.** They are deterministic
  demonstration records, and every screen that shows one says so.
- **The Next.js pages are demonstrations.** `/`, `/rendering/ssg`, and
  `/rendering/ssr` show no market data. The product UI is the React app.

## Current status

Phases 0 to 10 are complete: the scaffold, the UI foundation, the API
foundation, the database, the mandi provider and prices API, the farmer
profile form, the mandi price dashboard, the crop suitability and
selling-period insights, the integration and security audit, and the final
documentation pass.

The farmer profile produces a ranked crop shortlist, an observed price trend,
and a baseline estimate that is only shown when the observations clear the
documented threshold. A saved profile can only be read back with the access
token that was handed out when it was saved, so one farmer's details are
never shown to another visitor.

See `TRACER.md` for the phase-by-phase record and the checks that were run,
`ARCHITECTURE.md` for the diagrams, and `PRD.md` for the requirements.
