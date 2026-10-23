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

- [ ] Establish a consistent design system: typography, spacing, colors, buttons, form fields, cards, and status labels.
- [ ] Build the main dashboard shell and navigation for prices, crop suggestions, and data sources/about.
- [ ] Make the layout responsive for mobile, tablet, and desktop.
- [ ] Add accessible labels, visible focus states, and semantic structure.
- [ ] Add reusable loading, empty, error, and retry UI states.
- [ ] Add an always-visible or clearly accessible informational disclaimer.
- [ ] Verify the app builds and the main pages render without console-breaking errors.

**Verification / notes:** _Add commands, results, and decisions here._

## Phase 3 — Backend API Foundation

- [ ] Add `GET /api/health` with a safe, predictable JSON response.
- [ ] Establish a consistent API response/error format.
- [ ] Configure environment loading and backend-only secrets.
- [ ] Configure CORS from an explicit environment-based allowlist.
- [ ] Add request validation for the first endpoint(s).
- [ ] Add API smoke tests or equivalent verified request checks.
- [ ] Verify error responses do not expose stack traces or secrets.

**Verification / notes:** _Add commands, results, and decisions here._

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

## Session Handoff

At the end of every coding-agent session, replace this note with a short update:

- **Last completed phase:** Phase 1 — Monorepo Scaffold and Developer Setup (2026-10-23)
- **Current phase:** Phase 2 — UI Foundation and Responsive Layout (not started)
- **Checks run and results:** `npm install` (exit 0, 363 packages); `npm run typecheck` (exit 0, both apps); `npm run lint` (exit 0, both apps, confirmed to inspect real files); `npm run build` (exit 0, Next.js compiled + type-checked, Vite emitted `dist/`); `npm run dev:backend` served on :3000 with `X-Powered-By: Next.js` and a correct 404 for `/api/health`; `npm run dev:frontend` served on :5173 with HTTP 200; Vite env injection confirmed with a temporary `.env`, then deleted; `.gitignore` semantics confirmed via `git ls-files`.
- **Known blockers:** unexplained root `.git` awaiting a user decision; Git index not writable from this environment (permission denied); 5 dev-only npm advisories with no upstream fix; PostgreSQL credentials still unknown; Next.js rubric requirement still unconfirmed.
- **Next action:** Start Phase 2 by establishing the design system and responsive dashboard shell in `frontend/`. No backend change is required for Phase 2. Do not start Phase 3 (`/api/health`) until Phase 2 is verified.
