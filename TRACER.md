# TRACER.md — Project Phase Checklist

**Project:** Krishi Mandi Price Prediction & Crop Suggestion Platform  
**Purpose:** Source-of-truth checklist for implementation progress. The coding agent must tick a box only after the item is implemented and verified.  
**Stack:** React + Vite + TypeScript frontend; Next.js App Router + TypeScript backend; PostgreSQL + Prisma.

## How to Use This File

- Start with **Phase 0** and proceed in order.
- The coding agent should normally work on the first phase that is not complete.
- `[ ]` means not verified complete; `[x]` means implementation and verification are complete.
- Do not tick a whole phase while any required item within it remains unfinished.
- At the end of each coding session, update this file with completed items, verification commands/results, and blockers.
- If the project is opened in a new coding-agent session, read `PRD.md`, `AGENTS.md`, and this file before making changes.

## Phase 0 — Repository Inspection and Plan

- [x] Read `PRD.md` and `AGENTS.md` fully.
- [x] Inspect the repository tree and existing files before changing anything.
- [x] Check Git status and preserve pre-existing user changes.
- [x] Confirm the two-app architecture (`frontend/` and `backend/`) and identify any course-rubric conflict.
- [x] Record assumptions/blockers and give the user a short implementation plan.
- [x] Confirm the data-provider plan; do not assume live API credentials exist.

**Verification / notes:** _Phase 0 completed 2026-10-23. Documentation/inspection only — no application code was written._

- **Repository state (confirmed):** greenfield. The tree contains exactly three files: `PRD.md`, `AGENTS.md`, `TRACER.md`. There is no `frontend/`, `backend/`, `docs/`, `README.md`, `package.json`, lockfile, `.gitignore`, `.env`, or `.env.example`. There was no existing application or user code to preserve or overwrite.
- **Git (confirmed):** `git status` returns `fatal: not a git repository (or any of the parent directories): .git`. Git is **not** initialized, and per instruction it was **not** initialized automatically. There are no uncommitted changes because there is no repository. Enabling version control is an open decision for the user.
- **File encoding (confirmed):** all three Markdown files are valid UTF-8 without BOM, and symbols such as `§` and `—` were verified to be stored correctly. If the rupee sign or em-dash appears garbled when reading these files with `Get-Content` in PowerShell, that is only a console code-page rendering artifact, **not** file corruption — do not "fix" it by re-saving.
- **Toolchain (confirmed on this machine):** Node `v24.13.0`; npm `11.6.2`; pnpm `10.33.0`; git `2.52.0.windows.1`. `yarn` and `docker` are **not** installed. PowerShell execution policy blocks the `.ps1` shims, so package commands must be run as `npm.cmd` / `pnpm.cmd` (or from `cmd`). `psql` is not on `PATH` but exists at `C:\Program Files\PostgreSQL\18\bin\psql.exe`.
- **PostgreSQL (confirmed):** Windows service `postgresql-x64-18` is **Running** and `localhost:5432` accepts TCP connections. Database credentials are still unknown. No database was created, connected to, or modified during Phase 0.
- **Network (BLOCKER for Phase 1):** DNS resolves `registry.npmjs.org` to `104.16.2.34`, but outbound TCP is refused by the sandbox (`An attempt was made to access a socket in a way forbidden by its access permissions`), and `npm ping` did not return within 30s. `npm install` is therefore expected to fail unless it is run outside the sandbox or with explicit approval. This must be resolved before scaffolding.
- **Architecture validation:** `PRD.md` §8, `AGENTS.md` §2, and the Stack line in this file agree — React + Vite + TypeScript in `frontend/`, Next.js App Router + TypeScript used as an API-only service in `backend/`, PostgreSQL + Prisma. **No conflict exists between the project documents.** The one unresolved risk is external: `PRD.md` §16 asks whether the Next.js rubric requires frontend features (Server Components / SSR / SSG) or accepts an API-focused app. This cannot be confirmed from the repository and is recorded as **unconfirmed — the user must verify with the instructor.** If Server Components turn out to be required, the backend shape must be revisited before Phase 3.
- **Architecture notes (non-blocking):** an API-only Next.js app is the user-approved stack and is deliberately not changed here, but it is unusual for Next.js and means no second UI ships, per `AGENTS.md` §2. Because the two apps run on different origins, the Phase 3 CORS allowlist is mandatory rather than optional. Node 24 compatibility with the selected Next.js major must be confirmed at Phase 1.
- **Data provider (confirmed plan):** no `.env`, credentials, or provider configuration exist anywhere in the repository, and network access needed to verify provider documentation is currently unavailable. Per `PRD.md` FR-11 and `AGENTS.md` §3, the plan is a **deterministic seeded demo provider behind a provider interface**, with every record and view labelled `Demo data`. No live provider access, credentials, prices, or successful external connections are claimed. Official-source verification (fields, rate limits, licensing, key requirements) remains a **Phase 5** task and is unconfirmed.

## Phase 1 — Monorepo Scaffold and Developer Setup

- [x] Create or validate the `frontend/` React + Vite + TypeScript app.
- [x] Create or validate the `backend/` Next.js App Router + TypeScript app configured for API use.
- [x] Keep frontend and backend package/configuration boundaries clear.
- [x] Add root-level setup instructions and convenient scripts if appropriate.
- [x] Add `.gitignore` rules for dependencies, builds, local databases, and environment files.
- [x] Add safe `.env.example` files for each app without real secrets.
- [x] Configure the frontend API base URL using `VITE_API_BASE_URL`.
- [x] Verify both apps start independently with documented commands.

**Verification / notes:** _Phase 1 completed 2026-10-23. No product features were built; no API route, database model, or dashboard UI was added._

- **Workspace:** root `package.json` declares npm workspaces `[frontend, backend]` and exposes `dev:*`, `build`, `lint`, and `typecheck` scripts per app. A single `package-lock.json` covers both.
- **Versions installed and verified against Node:** Node `v24.13.0`, npm `11.6.2`. Vite `8.3.5` (requires `^20.19.0 || >=22.12.0`) and Next.js `16.4.2` (requires `>=20.9.0`) both accept Node 24.13.0. React `19.3.1`, TypeScript `5.9.3`, oxlint `1.89.0` (frontend), ESLint `9.39.5` (backend).
- **Decision - one TypeScript version:** the Vite template generated `typescript ~6.0.3` while `create-next-app` generated `^5`, so npm would have installed two copies. Both were aligned to `^5.9.3`, the line Next.js 16.4.2 ships with. The TypeScript `latest` tag is now `7.0.2`; `5.9.3` was chosen because it is what the Next.js template is verified against, not because 7.x is unusable. React was aligned to `^19.3.1` in both apps so React and TypeScript deduplicate.
- **No second frontend (AGENTS.md section 2):** deleted the scaffolded Next.js `page.tsx`, `page.module.css`, `globals.css`, `favicon.ico`, and the `public/` SVG assets. `src/app/layout.tsx` was replaced with a bare layout with no fonts, branding, or styling. The `next build` output confirms no product page ships.
- **Git:** `create-next-app` auto-created a nested `backend/.git`, which was removed so both apps stay in one repository. A root `.git` also appeared during the session that this agent did not create - see Blockers. No commit was made.
- **Strict mode:** the Vite template does not enable TypeScript `strict`, so `"strict": true` was added to `frontend/tsconfig.app.json` and `frontend/tsconfig.node.json` per AGENTS.md section 4. `backend/tsconfig.json` already had it.
- **Bug found and fixed:** `backend/src/app/layout.tsx` initially used the Next-generated global type `LayoutProps`, which does not exist until `next build` has run, so `npm run typecheck` failed with `TS2304: Cannot find name LayoutProps`. Replaced with an explicit `children: ReactNode` signature; type-check now passes before any build.
- **`VITE_API_BASE_URL` verified end to end:** `src/lib/apiConfig.ts` reads `import.meta.env.VITE_API_BASE_URL`, typed via `src/vite-env.d.ts`. A temporary `frontend/.env` was created and the module served by Vite was confirmed to contain the injected value `http://localhost:3999`; the temporary file was then deleted.
- **Commands actually run, all exit code 0:** `npm install` (363 packages), `npm run typecheck`, `npm run lint`, `npm run build`. Next.js compiled successfully including TypeScript; Vite produced `dist/` (219.95 kB JS, 68.81 kB gzip). Lint scripts were tightened to `eslint src` and `oxlint src` and confirmed to inspect real files rather than silently matching zero files.
- **Startup verified:** `npm run dev:backend` served on port 3000 and answered `GET /api/health` with the `X-Powered-By: Next.js` header and HTTP 404, which is correct because no routes exist until Phase 3. `npm run dev:frontend` served on port 5173 with HTTP 200 and the correct document title. Both dev servers were stopped afterwards and ports 3000 and 5173 are free.
- **`.gitignore` behaviour verified:** `git ls-files --others --exclude-standard` lists `frontend/.env.example` and `backend/.env.example` as trackable, while `git ls-files --others --ignored --exclude-standard` lists `backend/next-env.d.ts` and `node_modules/` as ignored. Real `.env` files are ignored, and `!.env.example` was added to both the root and `backend/.gitignore`.
- **Known advisory (not fixed):** `npm audit` reports 5 high-severity advisories, all a single chain: `eslint-config-next` -> `@next/eslint-plugin-next` -> `fast-glob` -> `micromatch` -> `braces` (GHSA-vfj7-8cjw-p6xm). `npm ls braces --omit=dev` is empty, so this is lint-time tooling only and never ships. No patched version exists yet, so no fix was applied.

## Phase 2 — UI Foundation and Responsive Layout

- [x] Establish a consistent design system: typography, spacing, colors, buttons, form fields, cards, and status labels.
- [x] Build the main dashboard shell and navigation for prices, crop suggestions, and data sources/about.
- [x] Make the layout responsive for mobile, tablet, and desktop.
- [x] Add accessible labels, visible focus states, and semantic structure.
- [x] Add reusable loading, empty, error, and retry UI states.
- [x] Add an always-visible or clearly accessible informational disclaimer.
- [x] Verify the app builds and the main pages render without console-breaking errors.

**Verification / notes:** _Phase 2 completed 2026-10-23. No API route, database model, provider, or price/suggestion calculation was added; those remain Phase 3 and later._

- **Design system (`frontend/src/styles/`, `frontend/src/components/ui/`):** `tokens.css` holds every colour, type size, spacing step, radius, shadow, and the shared focus ring; `global.css` imports it plus a reset, base element styles, `.visually-hidden`, the `.skip-link`, and a `prefers-reduced-motion` block. Primitives: `Button`/`LinkButton` (primary, secondary, ghost; sm/md; block), `Card`, `FormField` with `TextField`/`SelectField`, `StatusBadge` (`live`/`recent`/`demo`/`unavailable`, each with a text label plus a shape so status is never colour-only), `StateMessage` (`loading`/`empty`/`error` with retry), and `Disclaimer`.
- **Shell and routes:** `AppShell` renders a skip link, header, `NavLink` navigation, `<main id="main-content">`, and a footer. React Router (`react-router-dom` `^7.18.4`, added to `frontend/package.json`) maps `/`, `/mandi-prices`, `/crop-suggestions`, `/data-sources`, and a `*` 404 page. The nav wraps instead of hiding behind a JavaScript toggle, so every link is always visible and keyboard reachable.
- **Responsive layout verified at 375 / 768 / 1280 px** against the production build in a real browser: the dashboard and crop-suggestion card grids compute **1 / 2 / 3 columns** respectively, and **no route produced horizontal overflow** at any width. Card and page gutters switch from `--space-4` to `--space-6` at `min-width: 48rem`.
- **Accessibility verified through the Chrome accessibility tree, not by eye:** exactly one `banner`, one `main`, one `navigation`, one `contentinfo`, and one level-1 heading on the dashboard (page-level `<header>` elements sit inside `<main>` and are therefore not landmarks). Every `input`/`select` has an associated `<label>`; required fields add a visually-hidden "(required)"; hints and errors are linked through `aria-describedby`; the first `Tab` press lands on the skip link with a `3px solid` outline and moves it on-screen; loading and empty states use `role="status"` and errors use `role="alert"`.
- **Runtime browser check (production build served by `vite preview`, headless Chrome driven over the DevTools Protocol):** all 5 routes rendered at all 3 widths with **0 console errors and 0 warnings**, no hydration mismatch, a correct active nav item per route, correct 404 content on an unknown route, and client-side navigation that changes the route **without a page reload**. The `Try again` and `Reset retry counter` buttons were clicked and the attempt counter incremented (2 to 3) and reset (3 to 1), so no control on the page is inert.
- **Next.js rendering, verified from build output plus runtime checks:** `next build` prints `/`, `/_not-found`, and `/rendering/ssg` as Static and `/rendering/ssr` as Dynamic. Against `next start`, `GET /rendering/ssg` returned HTTP 200, was **byte-identical across two requests**, and was **identical to the on-disk `.next/server/app/rendering/ssg.html`** artifact, proving it is served from disk rather than re-rendered. `GET /rendering/ssr` returned HTTP 200 with a timestamp that **changed on every request** (`06:45:53.134Z`, then `06:45:54.520Z`, then `06:45:55.897Z`). All three pages load in a browser with 0 console errors and `lang="en"`.
- **Server/Client boundary verified in the build output:** the counter chunk is the only client chunk containing `ClientCounter`/`Clicked` strings and is referenced **only** by `/`; neither rendering page references it, and no client chunk contains SSG or SSR page markup. The `ClientCounter` Client Component was clicked in the browser and advanced from `Clicked 0 times` to `Clicked 2 times`, proving the Server Component pages and the one Client Component both work.
- **Bugs found and fixed this phase:** (1) backend ESLint failed with `@next/next/no-html-link-for-pages` on three internal `<a href>` links; replaced with `next/link`. (2) `FormField.module.css` declared an `.invalid` style that was never applied, so the error state was invisible; the render-prop now passes an `invalid` flag and the control composes the class, with the flag destructured off before spreading so it never reaches the DOM. (3) `ClientCounter` used `setCount(count + 1)`, which loses an update on two clicks in the same task; changed to the functional `setCount((current) => current + 1)`.
- **Checks actually run, all exit code 0:** `npm run typecheck` (both apps), `npm run lint` (oxlint and ESLint, both confirmed to inspect real files), `npm run build` (Next.js compiled and type-checked; Vite emitted `dist/` at 274.88 kB JS / 87.14 kB gzip and 10.82 kB CSS), plus the browser and rendering checks listed above. Verification read console output, the accessibility tree, and layout metrics over the DevTools Protocol; **no image inspection was used**, so the previous session's `input_image is not supported by this backend` failure does not recur.
- **Cleanup:** removed the previous session's leftover inspection artifacts `dump-home.html`, `dump-MandiPrices.html`, `dump-CropSuggestions.html`, `dump-DataSources.html`, `dump-NotFound.html`, `shot-desktop.png`, `shot-tablet.png`, and `shot-mobile.png` from the repository root, after confirming they were unreferenced dev-server HTML dumps and screenshots. Nothing tracked was lost.
- **Honest limits:** the pages deliberately show **no** prices, forecasts, or crop rankings yet, and each affected card names the phase that will supply them. The crop-suggestion card holds a design-system preview only: it has **no submit button** so nothing pretends to work, and its one error field is a labelled style sample rather than a real validation rule. Real validation is Phase 6.
- **Note on the Next.js rubric question (still open from Phase 0):** this phase added `/`, `/rendering/ssg`, and `/rendering/ssr` Server Component pages to demonstrate SSG and SSR for the course requirement. They contain framework-demonstration content only, are not linked from the React app, and the React app remains the sole product UI, so `AGENTS.md` section 2 still holds. **The user should still confirm with the instructor whether these pages are acceptable**, because they are a second UI surface in a strict sense.

## Phase 3 — Backend API Foundation

- [x] Add `GET /api/health` with a safe, predictable JSON response.
- [x] Establish a consistent API response/error format.
- [x] Configure environment loading and backend-only secrets.
- [x] Configure CORS from an explicit environment-based allowlist.
- [x] Add request validation for the first endpoint(s).
- [x] Add API smoke tests or equivalent verified request checks.
- [x] Verify error responses do not expose stack traces or secrets.

**Verification / notes:** _Phase 3 completed 2026-10-23. No database, Prisma, authentication, mandi provider, AI call, or business endpoint was added. `/api/health` is the only real endpoint; no prices, forecasts, or crop suggestions are computed anywhere yet._

- **Files added:** `backend/src/lib/api/errors.ts` (error types), `response.ts` (success/failure envelope), `env.ts` (server-only env access and origin allowlist), `cors.ts` (header building and allow/reject decision), `validation.ts` (Zod request parsing), `backend/src/app/api/health/route.ts`, `backend/src/app/api/[...path]/route.ts`, `backend/src/proxy.ts`, plus `*.test.ts` beside the modules they cover. Modified: `backend/package.json`, `backend/tsconfig.json`, `package.json`, `backend/.env.example`, `README.md`.
- **Response envelope:** every `/api` response is `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message", "details?" } }`, so clients branch on `success` rather than guessing from the status. Codes: `VALIDATION_ERROR`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `FORBIDDEN`, `INTERNAL_ERROR`.
- **`GET /api/health` verified over HTTP** (port 3100, `next start`): returned `200`, `content-type: application/json`, and `{"success":true,"data":{"status":"ok","service":"krishi-mandi-backend","apiVersion":"v1","checkedAt":"2026-10-23T08:00:28.763Z","uptimeSeconds":16.813,"scope":"api-process-only","notConnected":["database","mandiDataProvider","aiProvider"]}}`. `checkedAt` differs between two consecutive requests, proving per-request rendering. `scope` and `notConnected` exist specifically so the endpoint cannot be read as claiming database or provider health.
- **CORS implemented in `backend/src/proxy.ts`,** using the Next.js 16 filename for middleware. `next build` prints a `Proxy (Middleware)` entry, confirming it registered. The matcher is `/api/:path*` only, so the Phase 2 SSG/SSR demonstration pages are untouched. Verified over HTTP: allowed origin `http://localhost:5173` gets `200` with `Access-Control-Allow-Origin: http://localhost:5173`, `Allow-Credentials: true`, methods including `OPTIONS`, and `Vary: Origin`; unapproved origin `http://evil.example.com` gets `403` with no CORS grant; allowed `OPTIONS` preflight gets `204` with the CORS headers and `Max-Age: 600`; unapproved preflight gets `403`. No response ever contained a wildcard origin.
- **Fail-closed decision (important for revision):** `resolveCorsConfig` treats a missing or empty `CORS_ALLOWED_ORIGINS` as an **empty allowlist under `next start`**, so all cross-origin requests are rejected with `403`. Only `next dev` falls back to `http://localhost:5173`. This was observed live, not assumed: with `backend/.env.local` temporarily moved aside, a request carrying `Origin: http://localhost:5173` returned `403`, while the same request without an `Origin` header still returned `200` JSON. Both branches were then re-checked directly against `loadCorsConfig()` in development and production modes (5 checks, 0 failures). The trade-off is deliberate: a misconfigured production deployment denies browser access rather than silently opening it. Both `README.md` and `backend/.env.example` document it.
- **No secret leakage verified:** a unit test throws an `Error` carrying a fake connection string and a stack frame, then asserts the 500 body contains neither, that `success` is `false`, and that the raw error was logged server-side exactly once. Live checks confirmed the `403` rejection body contains no `CORS_ALLOWED_ORIGINS=` value, no `postgres`, and no file/line reference.
- **Consistent 404 fixed during this phase:** an unknown `/api/*` path originally returned Next.js's default **HTML** 404 page, which broke the JSON envelope. Added `backend/src/app/api/[...path]/route.ts`; `/api/does-not-exist` now returns `404` with `content-type: application/json` and the standard `NOT_FOUND` envelope. `/api/health` still wins over the catch-all, and `POST /api/health` still returns `405`.
- **Request validation:** `validation.ts` provides `parseValue`, `parseQuery`, `parseJsonBody`, and a reusable `boundedIntQuery` helper that caps list endpoints, which Phase 5 needs. A repeated query key is rejected rather than silently taking the first value, and bodies over 64 kB are refused. No farmer-profile, price, or suggestion endpoint was built.
- **Dependency decision:** added `zod@^4.6.7` to `backend/package.json`. Zod was already present transitively via `eslint-plugin-react-hooks`, but relying on an undeclared transitive package is fragile, and `PRD.md` section 8 plus `AGENTS.md` section 4 both require a schema validator. No other dependency was added; the npm registry is unreachable inside the sandbox, so the install required explicit approval.
- **Zero-dependency tests:** 18 unit tests via Node's built-in test runner (`npm run test` -> `node --test`), run directly on TypeScript thanks to Node 24's type stripping. This added no test framework. Enabling `allowImportingTsExtensions` lets the API modules use explicit `.ts` relative imports, which Node resolves and the Next build accepts. `response.ts` deliberately uses the standard `Response` instead of `NextResponse` so the error logic is testable without the Next runtime.
- **Checks actually run, all exit code 0:** `npm run typecheck`, `npm run lint`, `npm run test` (18 passed, 0 failed), `npm run build`, and a 35-assertion HTTP smoke script against the production build (0 failures). The build route table confirms `ƒ /api/health`, `ƒ /api/[...path]`, `ƒ /rendering/ssr`, `ƒ Proxy (Middleware)`, with `/` and `/rendering/ssg` still static, so Phase 2 is unregressed; the same script re-confirmed all three demonstration pages return `200`, SSG is byte-identical, and SSR still renders per request.
- **Local config created:** `backend/.env.local` containing only `CORS_ALLOWED_ORIGINS=http://localhost:5173`. It holds no secret, is ignored by git (confirmed with `git check-ignore`), and is what makes `next start` usable locally. Delete or edit it freely.
- **Port note:** port 3000 is held by a pre-existing `next dev` server (PID 15460, started before this phase) for this same directory. Next.js refuses to start a second dev server for one directory, so all verification ran on ports 3100 and 3200. The unknown process was left running, as required.

## Phase 4 — PostgreSQL, Prisma, Schema, and Demo Seeds

- [ ] Configure Prisma and PostgreSQL using backend environment variables.
- [ ] Define and review the Market, Crop, MandiPriceObservation, CropSuitabilityRule, and analysis-related models as needed.
- [ ] Create initial Prisma migration(s).
- [ ] Add deterministic seed data for crops, markets, and mandi observations.
- [ ] Mark seeded records with an explicit demo/sample data status.
- [ ] Document database setup, migration, and seed commands.
- [ ] Run migrations and seeds successfully against a development database, or record the exact blocker if PostgreSQL is unavailable.
- [ ] Add tests or checks for model/provider mappings and required fields.

**Verification / notes:** _Add commands, results, and decisions here._

## Phase 5 — Mandi Data Provider and Prices API

- [ ] Inspect and document candidate official/public mandi data sources, access requirements, and returned fields.
- [ ] Implement a provider interface so data-source implementation can be swapped independently.
- [ ] Implement a deterministic demo provider that works without credentials.
- [ ] Integrate an official provider only if its access and behavior are verified.
- [ ] Normalize price, date, crop, market, source, unit, and live/demo status fields.
- [ ] Implement `GET /api/markets` and `GET /api/mandi-prices` with validated filters and bounded result sizes.
- [ ] Ensure the API never describes demo records as live records.
- [ ] Test provider mapping, provider failure, empty data, and demo/live status.

**Verification / notes:** _Add commands, results, and decisions here._

## Phase 6 — Farmer Profile Form and Analysis Request

- [ ] Build the farmer form for state, district, soil type, season, land area, and unit.
- [ ] Add optional village/PIN, irrigation, and current/intended crop fields as scoped in the PRD.
- [ ] Add client-side validation and understandable inline errors.
- [ ] Add matching server-side schema validation.
- [ ] Preserve form values after API errors and show clear pending/success/error states.
- [ ] Implement `POST /api/farm-profile/analyze` request/response contracts.
- [ ] Verify valid and invalid submission flows end to end.

**Verification / notes:** _Add commands, results, and decisions here._

## Phase 7 — Prices Dashboard, Market Comparison, and Historical Charts

- [ ] Connect React UI to the backend price and market endpoints.
- [ ] Show crop, market, location, observation date, min/max/modal price, unit, source, and data-status where available.
- [ ] Add relevant crop/market/location filters supported by the dataset.
- [ ] Add historical price endpoint and chart for available observations.
- [ ] Clearly label chart metric, date range, and units.
- [ ] Add useful empty/error/loading states and a visible demo-data indicator.
- [ ] Show nearby markets only when geographic relevance/distance can be supported; otherwise use an honest `relevant markets` label.
- [ ] Test the complete frontend-to-backend market-price flow.

**Verification / notes:** _Add commands, results, and decisions here._

## Phase 8 — Crop Suitability and Selling-Period Insights

- [ ] Implement isolated, testable crop suitability rules based on inputs and documented assumptions.
- [ ] Return ranked crop suggestions with plain-language reasons and missing-data caveats.
- [ ] Implement observed trend summaries (rising/falling/stable/insufficient data) using actual observations.
- [ ] Define and document an eligibility threshold for forecasts before returning numeric estimates.
- [ ] Implement a simple explainable baseline forecast with tests, or return `insufficient_data` when the threshold is not met.
- [ ] Return forecast horizon, unit, evidence period, and data-quality/confidence label where appropriate.
- [ ] Add server-side AI-provider interface only if useful and configured; keep credentials server-side.
- [ ] Verify that the deterministic fallback works without an AI API key and AI text cannot override structured values.
- [ ] Show recommendations, evidence, and disclaimers in the React UI.

**Verification / notes:** _Add commands, results, and decisions here._

## Phase 9 — Integration, Security, Accessibility, and Quality Checks

- [ ] Test the full path from farmer inputs through Next.js, data/services, database, and back to the UI.
- [ ] Add/complete unit tests for validation, crop rules, forecast eligibility/calculation, and provider mapping.
- [ ] Verify all API inputs are validated server-side.
- [ ] Verify no secret is exposed in client bundles, responses, screenshots, or committed files.
- [ ] Verify CORS is constrained to configured origins.
- [ ] Verify the UI is keyboard-operable and basic accessibility checks pass.
- [ ] Run available lint, type-check, tests, and production builds for both apps.
- [ ] Fix regressions caused by the work or document remaining blockers accurately.

**Verification / notes:** _Add commands, results, and decisions here._

## Phase 10 — Final Polish, Documentation, and Demo Readiness

- [ ] Complete the README with prerequisites, setup, environment variables, database setup, seeds, run commands, tests, and troubleshooting.
- [ ] Explain the architecture and data flow so the project can be presented to both React and Next.js instructors.
- [ ] Document the API endpoints and example request/response shapes.
- [ ] Document the active data provider, source attribution, freshness limits, and demo-data behavior.
- [ ] Prepare sample demo inputs and a repeatable presentation workflow.
- [ ] Confirm no misleading live-data, forecast-certainty, or profitability claims remain.
- [ ] Run a clean setup/build smoke test as far as environment access allows.
- [ ] Summarize completed features, test results, known limitations, and any follow-up work.

**Verification / notes:** _Add commands, results, and decisions here._

## Blockers and Decisions Log

| Date | Phase | Blocker / decision | Resolution / next action |
|---|---|---|---|
| 2026-10-23 | Phase 0 | Repository is greenfield: only the three Markdown docs exist; no `frontend/`, `backend/`, `package.json`, `.gitignore`, or `.env.example` | Nothing to preserve. Phase 1 scaffolds both apps from scratch. |
| 2026-10-23 | Phase 0 | Git is not initialized; `git status` fails | Reported only; Git was **not** initialized automatically. User to decide whether to `git init` and make an initial commit. |
| 2026-10-23 | Phase 0 | **BLOCKER:** outbound network is blocked in the agent sandbox — DNS resolves but TCP to `registry.npmjs.org` is denied; `npm ping` timed out | Resolve before Phase 1 by running installs outside the sandbox or with explicit approval. No package install was attempted in Phase 0. |
| 2026-10-23 | Phase 0 | PowerShell execution policy blocks the `.ps1` shims for npm and pnpm | Document all commands as `npm.cmd` / `pnpm.cmd` for this machine, or run them from `cmd`. |
| 2026-10-23 | Phase 0 | **UNCONFIRMED:** does the Next.js course rubric require Server Components/SSR, or is an API-focused backend acceptable? (`PRD.md` §16) | Cannot be verified from the repository. User to confirm with the instructor before Phase 3. Does not block Phase 1. |
| 2026-10-23 | Phase 0 | No mandi data-provider access, credentials, or provider docs found; live-source verification impossible while the network is blocked | Ship a deterministic, clearly labelled demo provider behind a provider interface. Verify real sources in Phase 5 with working network access. |
| 2026-10-23 | Phase 0 | PostgreSQL 18 is running on `localhost:5432` but the database/user credentials are unknown | Phase 4 must confirm or create a dev database and role before `prisma migrate`. No database was touched in Phase 0. |
| 2026-10-23 | Phase 0 | Demo geography/crop scope and AI provider choice remain open (`PRD.md` §16) | MVP proceeds with a minimal documented set; the AI layer stays optional behind a deterministic rule-based fallback. |
| 2026-10-23 | Phase 1 | Sandbox blocks npm registry access (`EACCES` on `registry.npmjs.org`) | Resolved by requesting explicit user approval for outbound npm access. The approval was granted, installs ran for real, and all results below are from actual command output. |
| 2026-10-23 | Phase 1 | `create-next-app` auto-created a nested `backend/.git` repository | Deleted the nested `.git` so both apps live in one repository. Verified it contained only the fresh scaffold commit and no user work. |
| 2026-10-23 | Phase 1 | **NEEDS USER DECISION:** a root `.git` directory appeared during the session, with branch `main` and **zero commits** | This agent never ran `git init` at the root, so its origin is unexplained (possibly sandbox tooling). It was **left untouched** rather than deleted, because deleting a directory of uncertain origin is destructive. No commit was made. User should decide whether to keep it or remove it. |
| 2026-10-23 | Phase 1 | Cannot write to the Git index: `git add --dry-run` fails with `Unable to create .git/index.lock: Permission denied` | Read-only Git inspection still worked, and `.gitignore` behaviour was verified with `git ls-files`. No staging or committing is possible from this environment until ownership is fixed. |
| 2026-10-23 | Phase 1 | Two different linters by design: oxlint `1.89.0` in frontend, ESLint `9.39.5` in backend | Kept because `eslint-config-next` supplies the Next-specific rules, while oxlint is what the Vite 8 template ships. Both are configured and passing. Consolidating later would mean changing the framework's own lint setup, which is out of Phase 1 scope. |
| 2026-10-23 | Phase 1 | 5 high-severity npm advisories via `braces` (GHSA-vfj7-8cjw-p6xm) | Dev-only: `--omit=dev` shows an empty tree. No patched version exists. Re-run `npm audit` in later phases and upgrade when a fix ships. |
| 2026-10-23 | Phase 1 | `backend/AGENTS.md` is regenerated automatically by `next dev` | Left in place (the file itself says removing it just recreates it). Documented in `backend/README.md`; project rules remain in the root `AGENTS.md`. |
| 2026-10-23 | Phase 1 | **STILL UNCONFIRMED from Phase 0:** does the Next.js rubric require Server Components/SSR? | Still unresolved. Does not block Phase 3 work, but confirm with the instructor before the backend shape hardens. |
| 2026-10-23 | Phase 2 | Previous session stopped mid-verification on `input_image is not supported by this backend` when inspecting rendered screenshots at three widths | Image inspection abandoned as instructed. Replaced with a headless Chrome DevTools Protocol harness reading console output, the accessibility tree, and computed layout metrics. It is source/terminal based, needs no extra packages, and produced the responsive and accessibility evidence above. Left no files in the repository. |
| 2026-10-23 | Phase 2 | Headless Chrome aborted with `FATAL: GPU process isn't usable` under the sandbox with only `--disable-gpu` | Resolved by adding `--no-sandbox --disable-software-rasterizer --disable-gpu-compositing --disable-dev-shm-usage --disable-features=VizDisplayCompositor`. Chrome then ran normally. Recorded for future browser-based verification. |
| 2026-10-23 | Phase 2 | `npm run start --workspace backend` on the documented port 3000 failed with `EADDRINUSE`; a pre-existing Node process (PID 15460, started 11:07, before this session) holds that port | Not killed, because it was not started by this session. All verification used port 3100 via `next start -p 3100` instead. If that leftover process is stale, the user can stop it to free port 3000. |
| 2026-10-23 | Phase 2 | Two consecutive `npm run build` runs collided with `Another next build process is already running` | Not a code defect. The second invocation started while the first was still finishing. Re-ran once `backend/.next/lock` cleared (15 s later) and the full build then passed with exit code 0. Avoid chaining two builds back to back. |
| 2026-10-23 | Phase 2 | Root `.git` still cannot be written to (`index.lock: Permission denied`, carried over from Phase 1) | Unchanged. All work remains unstaged; nothing was committed or pushed, per `AGENTS.md` section 9. |
| 2026-10-23 | Phase 3 | npm registry is unreachable inside the sandbox (same blocker as Phase 0), so `npm install zod` silently hung and returned nothing | Resolved by rerunning the install with explicit user approval for network access; `zod@4.6.7` was added to `backend/package.json` and `package-lock.json`. Worth remembering that a failed sandboxed `npm install` can exit without any output. |
| 2026-10-23 | Phase 3 | `npm run dev --workspace backend` fails with `Another next dev server is already running` | Not a defect. Port 3000 is held by a pre-existing `next dev` (PID 15460) for this same `backend/` directory, and Next.js allows only one dev server per directory. The unknown process was left running and verification used ports 3100/3200. The user can stop it if it is orphaned. |
| 2026-10-23 | Phase 3 | Unknown `/api/*` paths returned Next.js's default HTML 404, which broke the single JSON envelope | Fixed during the phase by adding `backend/src/app/api/[...path]/route.ts`. Verified: `/api/does-not-exist` now returns JSON with the standard `NOT_FOUND` shape while `/api/health` still resolves to the real handler. |
| 2026-10-23 | Phase 3 | Under `next start` the CORS allowlist is empty unless `CORS_ALLOWED_ORIGINS` is set, so every browser request returned `403` | **Working as designed, not a bug.** Verified live by moving `.env.local` aside: `Origin: http://localhost:5173` gave `403`, no-`Origin` gave `200`. Only `next dev` falls back to `localhost:5173`. Documented in `README.md` and `backend/.env.example`; local `backend/.env.local` was created. |
| 2026-10-23 | Phase 3 | Node prints a `MODULE_TYPELESS_PACKAGE_JSON` warning when running the `.ts` tests directly | Cosmetic only. Fixing it would mean adding `"type": "module"` to `backend/package.json`, which risks changing how Next.js loads its config, so it was deliberately left alone. Tests still pass. |

## Session Handoff

At the end of every coding-agent session, replace this note with a short update:

- **Last completed phase:** Phase 3 - Backend API Foundation (2026-10-23)
- **Current phase:** Phase 4 - PostgreSQL, Prisma, Schema, and Demo Seeds (not started)
- **Checks run and results (Phase 2):** `npm run typecheck` (exit 0, both apps); `npm run lint` (exit 0, both linters, after fixing the `next/link` violation); `npm run build` (exit 0; Next.js route table shows `/`, `/_not-found`, and `/rendering/ssg` as Static and `/rendering/ssr` as Dynamic; Vite emitted `dist/`); a headless-Chrome DevTools Protocol run against the production build (23 checks, 0 problems) covering all 5 routes at 375/768/1280 px, 1/2/3 column grids, zero horizontal overflow, 0 console errors and warnings, accessibility-tree landmarks, a keyboard skip link with a 3px focus ring, in-app navigation without a page reload, and live retry/reset buttons; and `next start` runtime checks confirming SSG is byte-identical and equal to its on-disk artifact while the SSR timestamp changes per request, and that the Client Component chunk is referenced only by `/`.
- **Known blockers:** root `.git` still not writable from this environment (permission denied), so nothing is staged or committed; a stale Node process (PID 15460) still holds port 3000 and was deliberately left alone; 5 dev-only npm advisories with no upstream fix; PostgreSQL credentials still unknown; the Next.js rubric question is still unconfirmed, and Phase 2 added three framework-demonstration Server Component pages that the user may want to confirm with the instructor.
- **Checks run and results (Phase 3):** `npm run typecheck` (exit 0); `npm run lint` (exit 0); `npm run test` (18 unit tests passed, 0 failed); `npm run build` (exit 0, route table shows `ƒ /api/health` and `ƒ /api/[...path]` alongside the unchanged `○ /rendering/ssg` and `ƒ /rendering/ssr`, plus `ƒ Proxy (Middleware)`); and a 35-assertion HTTP smoke run against `next start` with 0 failures covering the health shape, per-request timestamps, allowed/unallowed origins, allowed/rejected preflights, wildcard safety, the JSON 404, `405` on the wrong method, and the Phase 2 rendering pages.
- **Known blockers:** port 3000 is still held by a pre-existing `next dev` server (PID 15460) for this same directory, left running on purpose; the npm registry needs approval from inside the agent sandbox; PostgreSQL credentials are still unknown, which is the first real dependency for Phase 4; the Next.js rubric question and the root `.git` write permission are both still open from earlier phases.
- **Next action:** Start Phase 4 by configuring Prisma against PostgreSQL using the existing `DATABASE_URL` backend variable, defining the Market, Crop, MandiPriceObservation, and CropSuitabilityRule models from `PRD.md` section 10, and generating the first migration plus deterministic demo seeds marked with an explicit demo data status. PostgreSQL 18 is running on `localhost:5432`, but the database role and password are unknown and must be confirmed or created first.
