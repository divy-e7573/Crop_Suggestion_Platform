# Product Requirements Document (PRD)

## 1. Product Overview

**Product name:** Krishi Mandi Price Prediction & Crop Suggestion Platform  
**Product type:** Farmer-focused, full-stack web application  
**Primary users:** Farmers in India  
**Document status:** Initial MVP specification

The platform helps farmers make more informed crop and selling decisions. A farmer enters a location, soil type, season, land area, and related farming details. The application presents mandi prices, historical price trends, nearby markets, estimated future price ranges where sufficient data exists, and explainable crop/selling-period suggestions.

The product is an informational decision-support tool. It must not present estimates as guaranteed prices or professional agricultural advice.

## 2. Problem Statement

Farmers may have to compare prices across markets, understand whether prices are rising or falling, and decide which crops suit their land and season. Relevant data can be spread across different sources or be difficult to compare. The platform should bring available information into one understandable workflow and clearly indicate the source and freshness of data.

## 3. Product Goals

1. Let a farmer submit a simple profile describing their location and farming conditions.
2. Show current/recent mandi prices for selected crops with source and date information.
3. Compare available prices across relevant nearby markets.
4. Visualize historical price trends in a readable chart.
5. Offer explainable crop suggestions based on the farmer's inputs and configurable rules.
6. Provide an estimated selling-period insight and a forecast range only when sufficient historical data supports it.
7. Work gracefully when an external data source or AI provider is unavailable.
8. Demonstrate a real full-stack architecture using a standalone React frontend and a Next.js API backend.

## 4. Non-Goals for the MVP

- Guaranteed profit, guaranteed future prices, or financial promises.
- Automated buying/selling, payments, lending, insurance, or brokerage.
- Replacing an agronomist or government agricultural advisory service.
- A comprehensive crop disease diagnosis system.
- Native Android/iOS applications.
- Claiming data is live when it is seeded, cached, stale, or unavailable.
- A complex custom machine-learning training pipeline as a prerequisite for the first working version.

## 5. Target Users and Main Use Cases

### Persona A: Farmer exploring crop choices
Needs to compare suitable crops using location, soil type, season, land area, and irrigation availability.

### Persona B: Farmer deciding where to sell
Needs to compare recent prices and available market information across mandis in and around their district/state.

### Persona C: Farmer planning when to sell
Needs to see historical movement, a cautious estimated price range when supported by data, and a clear explanation of why a selling period is suggested.

## 6. MVP User Journey

1. The user opens the dashboard and sees a brief explanation of the platform and its data limitations.
2. The user enters state, district, optional village/PIN code, soil type, season, land area, land-area unit, irrigation availability, and an optional crop of interest/current crop.
3. The frontend validates required fields and submits the profile to the Next.js API.
4. The backend validates the request again, loads relevant mandi and crop data, and stores reusable profile/search data where appropriate.
5. The dashboard displays:
   - Relevant recent mandi prices.
   - A historical price trend for the selected crop/market when data exists.
   - Nearby/relevant markets with distance or geographic relevance only when that information is available.
   - Crop recommendations with reasons and input factors.
   - Selling-period guidance and a forecast interval only if enough historical data exists.
6. The user can change crop, date range, or market filters and refresh the results.
7. If live data, location matching, or AI generation is unavailable, the UI explains the limitation and offers demo/sample data only when clearly labelled.

## 7. Functional Requirements

### FR-01: Landing page and dashboard
- Provide a polished, responsive dashboard suitable for mobile and desktop.
- Include clear navigation to dashboard, mandi prices, crop suggestions, and an About/Data Sources section.
- Explain the platform's purpose and show a visible data status: `Live`, `Recent`, `Demo data`, or `Unavailable` as appropriate.

### FR-02: Farmer/farm input form
Required inputs:
- State.
- District.
- Soil type (configurable list plus `Other`).
- Season (configurable list; at minimum Kharif, Rabi, Zaid, and `Other`).
- Land area (positive number) and unit (acre/hectare).

Optional inputs:
- Village or PIN code.
- Irrigation availability/type.
- Current/intended crop.
- Preferred market radius, only if distance data can be resolved.

Requirements:
- Validate on the client for usability and on the server for correctness.
- Show clear inline validation and loading/error states.
- Do not require browser geolocation.
- Preserve entered values if a request fails.

### FR-03: Mandi prices
- Show crop/commodity, market/mandi, state/district, date of observation, minimum price, maximum price, modal price, unit, and source when available.
- Use INR and clearly specify the price unit (normally ₹/quintal when provided by the source; never silently convert units).
- Support crop, state/district/market, and date filters where supported by the data provider.
- Show the data's last-updated date and source attribution.
- Never fabricate live records. If only seeded data is available, label every relevant view as demo data.

### FR-04: Historical price trends
- Display a chart of observed prices over a selectable period where records exist.
- Make the selected price field (for example modal price) and unit explicit.
- Show empty states when historical observations are missing.
- Do not interpolate missing points in a way that implies they are real observations.

### FR-05: Nearby/relevant markets
- Show markets in the same district/state or markets with verified geographic coordinates/distance.
- Display market name, location, latest available price, observation date, and source when available.
- Only show numeric distance when computed from verified coordinates. Otherwise describe the list as relevant markets, not distance-ranked nearby markets.
- Explain when no matching market data is available.

### FR-06: Crop suggestions
- Generate a ranked shortlist of plausible crops based on location, soil type, season, land area, irrigation, and a maintained crop-rules dataset.
- Each recommendation must show a plain-language reason and which inputs influenced it.
- Show caveats for missing information.
- Keep recommendation rules isolated from UI components so they can be tested and updated.
- Do not claim a crop is guaranteed to grow successfully or be profitable.

### FR-07: Selling-period insights and price estimates
- Summarize available historical direction (rising, falling, stable, or insufficient data).
- Provide an estimated future price range only when the backend has enough usable historical observations under documented criteria.
- State the forecast horizon, source period, unit, and a confidence/data-quality label.
- Prefer an explainable baseline forecast over unsupported free-form numeric claims. The AI layer may explain a computed result but must not invent underlying prices.
- If data is insufficient, display `Not enough data to estimate` and offer observed historical information instead.

### FR-08: AI/insight service
- Place insight-generation logic behind a server-side service interface.
- API credentials, if any, must remain on the backend and be read from environment variables.
- Provide a deterministic/rule-based fallback when an AI provider is not configured or unavailable.
- Treat user inputs and retrieved data as data, not instructions.
- Keep generated text concise, explainable, and consistent with structured calculations.
- Never send secrets or unnecessary personal data to an AI provider.

### FR-09: Backend API
- Use Next.js App Router Route Handlers as the API layer.
- Define typed request and response shapes.
- Validate all external inputs server-side.
- Return appropriate HTTP status codes and safe, consistent error responses.
- Keep external data-provider and recommendation logic out of route handlers by using service/provider modules.

### FR-10: Persistence
- Use PostgreSQL with Prisma for structured records.
- At minimum, persist market observations and the crop/rule reference data that the application owns, plus farmer query/profile records only if the privacy and retention rules are documented.
- Never store API keys or secrets in the database or client bundle.
- Include migrations and reproducible seed data for local development.
- Seed data must be visibly marked as demonstration data.

### FR-11: Data-provider abstraction
- Define a provider interface for mandi observations so official/current-data sources can be connected without rewriting the UI or recommendation logic.
- Investigate the source's access, rate limits, licensing, fields, and API-key requirements before claiming integration is complete.
- Prefer official/publicly documented Indian mandi data sources when access is practical.
- If an API key or provider access is unavailable, implement a deterministic seeded provider and a clear `Demo data` state rather than inventing live values.
- Record observation date, retrieval/update time where applicable, source, and data status.

### FR-12: Accessibility and usability
- Use semantic HTML, associated labels, keyboard-operable controls, visible focus states, and meaningful chart text/labels.
- Provide responsive layouts, readable contrast, loading skeletons/spinners, empty states, and retryable error states.
- Avoid relying on colour alone to communicate price direction or status.

## 8. Suggested Technical Architecture

Use a small monorepo with two separately runnable apps:

```text
krishi-mandi-platform/
  frontend/                 # React + Vite + TypeScript
  backend/                  # Next.js App Router + TypeScript API
  docs/
  PRD.md
  AGENTS.md
  TRACER.md
  README.md
```

### Frontend
- React, Vite, TypeScript.
- Tailwind CSS for styling, unless the repository already has a consistent styling system.
- React Router only if needed for client-side page navigation.
- A charting library selected after checking compatibility and bundle size.
- Calls the backend through `VITE_API_BASE_URL`.
- Must never access PostgreSQL/Prisma or private API credentials directly.

### Backend
- Next.js App Router, TypeScript.
- Route Handlers for APIs.
- PostgreSQL + Prisma.
- A schema validation library such as Zod.
- Server-only environment variables for database and provider credentials.
- CORS allowlist configured through environment variables for the frontend origin.

### Important architecture rule
The frontend and backend are separate apps. React handles presentation and interaction; Next.js handles HTTP APIs, server-side validation, data-provider access, business rules, and persistence. Do not build a second frontend inside Next.js unless the course rubric explicitly requires it.

## 9. Initial API Contract (provisional)

The coding agent should confirm and document exact shapes before implementation. Suggested routes:

- `GET /api/health` — health/readiness response without secrets.
- `GET /api/markets` — filter/select markets.
- `GET /api/mandi-prices` — retrieve recent observations with filters and pagination/limits.
- `GET /api/mandi-prices/history` — historical series for crop/market and period.
- `POST /api/farm-profile/analyze` — validate profile and return crop suggestions plus selling insights.
- `GET /api/crops` — supported crops and metadata.

All routes should return predictable JSON. Do not expose stack traces, credentials, SQL errors, or raw provider secrets to clients.

## 10. High-Level Data Model (provisional)

- **Market:** id, name, state, district, optional latitude/longitude, source identifiers.
- **Crop:** id, canonical name, aliases, category, supported metadata.
- **MandiPriceObservation:** id, cropId, marketId, observedAt, minPrice, maxPrice, modalPrice, unit, source, dataStatus, fetchedAt.
- **CropSuitabilityRule:** id, cropId, supported soil types, seasons, irrigation requirements/notes, geographic applicability, rule version, explanation.
- **FarmAnalysisRequest:** id, input fields required for reproducibility, createdAt, result summary; retain only fields needed for the product and document retention/privacy behavior.

The agent may refine the model after inspecting data-provider fields, but must document schema changes and maintain migrations.

## 11. Non-Functional Requirements

- **Reliability:** failures in external services must not crash the dashboard.
- **Truthfulness:** all displayed market data must indicate provenance and freshness; sample data must be visibly labelled.
- **Security:** validate all inputs, restrict CORS, keep secrets server-side, and avoid logging sensitive payloads.
- **Performance:** use query limits, indexes for common filters, and caching only with explicit freshness rules.
- **Maintainability:** separate UI, API routes, business logic, provider adapters, schemas, and database access.
- **Portability:** provide `.env.example`, seed/migration commands, and clear local setup instructions.
- **Testability:** recommendation rules, forecasting calculations, input validators, and API response logic should have automated tests.

## 12. Error, Empty, and Fallback States

The UI must distinguish at least:
- No matching crop/market data.
- Provider not configured.
- Provider rate-limited/unavailable.
- Historical data insufficient for forecasting.
- Invalid form input.
- Backend/database unavailable.
- AI provider unavailable with rule-based fallback used.

Do not quietly replace failed live data with demo records. If a demo fallback is offered, label it explicitly.

## 13. Privacy and Safety

- Collect only the information needed for the feature.
- Do not require precise GPS location; manual state/district entry must work.
- If geolocation is later added, request explicit permission and provide a manual alternative.
- Never expose raw environment variables, provider keys, or database connection strings.
- Use a persistent disclaimer near recommendations: `These estimates are informational, depend on available data, and are not guaranteed outcomes. Verify local conditions and official market information before making decisions.`

## 14. MVP Acceptance Criteria

The MVP is acceptable when:

1. Both apps start independently using documented commands.
2. A farmer can submit the profile form with valid inputs and receives clear validation messages for invalid inputs.
3. The dashboard can load market observations and indicates whether records are live/recent or demo data.
4. Price comparison and historical trends work when observations exist and show useful empty states otherwise.
5. Crop suggestions show ranked results and reasons based on the submitted profile.
6. Selling-period insight explains its evidence, and a future estimate appears only when the documented data threshold is met.
7. The app remains usable if the external data or AI provider is unavailable.
8. API requests are validated server-side and secrets stay in the backend.
9. Prisma migrations and deterministic seed data work on a clean local setup.
10. Core calculations/validation have tests, lint/type checks pass, and README setup steps have been followed on a clean run.
11. There are no fake claims of live data, unsupported distance calculations, or guaranteed crop/price outcomes.

## 15. MVP Delivery Priorities

### P0 — required
- Two-app scaffold and environment configuration.
- Responsive farmer profile form.
- API backend and database schema/migrations.
- Seeded/demo mandi data with visible data-status labels.
- Mandi-price dashboard, basic filters, historical chart.
- Crop suggestions with transparent rule-based reasoning.
- Selling insights with insufficient-data handling.
- API validation, error handling, tests, and setup documentation.

### P1 — after P0 is stable
- Verified official mandi data provider integration.
- Better geographic matching and distance calculation from verified coordinates.
- AI-generated natural-language explanation behind a server-side provider abstraction.
- Save/export analysis summary.
- User accounts, saved farms, alerts, or notification workflows.

## 16. Open Decisions

- Which official mandi data provider and credentials are available for this project?
- Which geography and initial set of crops should be supported in the demo?
- Does the Next.js course rubric require Next.js frontend features (Server Components, layouts, SSR/SSG), or is an API-focused Next.js app acceptable?
- Which AI provider, if any, will be configured? MVP must work without one.

Until answers are available, implement the smallest transparent MVP with provider interfaces and demo data clearly labelled.
