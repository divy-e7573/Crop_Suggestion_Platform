# AGENTS.md — Coding Agent Instructions

These instructions apply to any coding agent (Codex, Claude Code, or another agent) working on the Krishi Mandi Price Prediction & Crop Suggestion Platform.

## 1. Read Before Coding

1. Read `PRD.md` completely.
2. Read `TRACER.md` and identify the first unchecked phase. Work on that phase only unless the user explicitly asks for a different scope.
3. Inspect the existing repository, package files, and git status before changing anything. Do not overwrite user work or regenerate existing apps blindly.
4. If repository contents conflict with this document, explain the conflict and prefer preserving working user changes. Ask only when a decision truly blocks safe progress; otherwise choose the smallest reversible option and document it.

## 2. Product and Architecture Rules

- Build a monorepo with two applications:
  - `frontend/`: React + Vite + TypeScript.
  - `backend/`: Next.js App Router + TypeScript, used as an API/backend service.
- Use PostgreSQL + Prisma for persistence unless the existing repository or explicit user instruction specifies another database.
- React communicates with Next.js using HTTP/JSON requests through `VITE_API_BASE_URL`.
- The frontend must never import Prisma code, open a database connection, or receive private provider/AI keys.
- Implement APIs using Next.js Route Handlers. Keep route handlers small: parse/validate input, call a service, and return a consistent response.
- Keep domain logic in testable modules (for example, `services/`, `lib/`, or `domain/`) rather than mixing it into React components or route handlers.
- Do not add Next.js pages or a second UI unless the user or course rubric requires it. The intended primary UI is the standalone React app.

## 3. Truthful Market Data and Recommendations

- Never fabricate current mandi prices, market names, source citations, dates, distances, or API responses.
- Clearly distinguish provider-backed observations from seeded/demo records in the database and UI.
- Do not label seeded data as live or real-time. Include an explicit data-status/source field in provider responses and visible UI indicators.
- Before integrating a live data source, verify that its API/documentation is actually available, which fields it returns, its access requirements, and whether credentials are needed. Do not assume an undocumented endpoint exists.
- Keep external mandi integrations behind a provider interface. If credentials/provider access are absent, use deterministic seed data and keep the application fully usable in `Demo data` mode.
- Crop suitability suggestions must provide understandable reasons based on explicit rules and user inputs. Do not claim certainty or guaranteed yield/profit.
- Price forecasting must be explainable and tested. Only produce an estimate when a documented minimum-data rule is satisfied; otherwise return `insufficient_data` instead of a made-up number.
- AI output may explain structured results but must not invent figures. Keep a deterministic rule-based fallback so the product runs without an AI API key.
- Keep a clear informational disclaimer in the UI and API documentation.

## 4. Code Quality Rules

- Use TypeScript and strict types. Avoid `any`; if it is unavoidable, isolate it and explain why.
- Follow the conventions already present in the repository. Prefer simple, readable implementations over unnecessary abstractions.
- Do not add dependencies without a clear need. Use maintained, compatible packages and check their current APIs before relying on them.
- Do not put secrets or private environment variables in source code, client-side variables, logs, or committed files.
- Add `.env.example` files with variable names and safe placeholders only. Never overwrite a real `.env` file.
- Validate all client-supplied data on the backend. Use a schema validator such as Zod if the project does not already have one.
- Use consistent API responses and meaningful HTTP status codes. Do not return internal stack traces or database errors to the client.
- Handle loading, empty, error, retry, and fallback states in the UI. Do not leave inert buttons or fake success messages.
- Keep accessibility in mind: labels, semantic HTML, keyboard support, visible focus, readable contrast, and clear chart axes/units.
- Keep code comments minimal and useful; prefer self-explanatory names.

## 5. Security and Configuration

- Store PostgreSQL URLs and data-provider/AI credentials only in backend environment variables.
- Configure CORS from an explicit environment-based allowlist; do not use unrestricted wildcard origins with credentials.
- Do not trust frontend validation alone.
- Avoid collecting precise location; state/district input must be sufficient for the MVP.
- Do not log unnecessary farmer profile data.
- Set safe request limits and query pagination/maximum result counts where relevant.

## 6. Database and Data Integrity

- All schema changes must include Prisma migrations.
- Include repeatable seed scripts for local demo data; seeds must be deterministic and marked as demo data.
- Do not delete or reset a database with potentially valuable data unless the user explicitly authorizes it.
- Store numeric prices and units in an unambiguous way; avoid mixing rupees/quintals with other units without explicit conversion metadata.
- Add indexes for common filters once schema/query needs are clear.

## 7. Testing and Verification

For each phase, run the relevant checks available in the repository, such as:
- package install verification when needed;
- lint;
- TypeScript/type check;
- unit tests;
- production build;
- database migration/seed validation;
- API smoke tests.

Do not claim a check passed unless it actually ran and passed. If a check cannot run because credentials, database service, or network access are missing, report the exact blocker and run all other useful checks.

For core logic, prioritize tests for:
- farmer input validation;
- crop suitability rules;
- forecast eligibility and calculation;
- provider mapping and demo/live status;
- API error paths.

## 8. Phase Workflow (Must Follow)

1. Work only on the first unchecked phase in `TRACER.md` by default.
2. Before edits, state a short plan in the agent response.
3. Make a small coherent change, not a giant all-at-once implementation.
4. Run relevant verification and inspect the resulting diff.
5. Fix failures caused by your changes before considering the phase complete.
6. Update `TRACER.md` after verification: tick only items that are genuinely complete, note tests run, and add a brief blocker if something remains unfinished.
7. Never tick an item simply because files were created. Completion means the behavior is implemented and checked.
8. If a phase is partially complete, leave its checkbox unchecked and record its remaining work.
9. Summarize files changed, commands run, results, and the next phase. Do not state that the entire project is complete when only one phase was completed.
10. Do not skip phases or silently change scope. If a dependency forces a different order, explain it and record the reason in `TRACER.md`.

## 9. Git and File Safety

- Inspect `git status` before editing when Git is initialized.
- Do not run destructive commands such as `git reset --hard`, bulk deletes, or database resets.
- Do not remove configuration or documentation merely because it looks unused; first confirm it is generated and safe to replace.
- Keep changes focused on the active phase.
- Do not commit, push, deploy, or create paid resources unless the user asks.

## 10. Definition of Done for Any Phase

A phase is done only when:
- all checkboxes under that phase are satisfied;
- implementation matches `PRD.md` and existing project conventions;
- applicable tests/lint/type-check/build have run, with blockers recorded honestly;
- no known regression introduced by the phase remains unresolved;
- `TRACER.md` accurately reflects the state.
