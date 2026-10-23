# Frontend

React + Vite + TypeScript. This is the **only** user-facing UI in the project.

## Commands

Run from the repository root, or from this directory:

```bash
npm run dev:frontend        # from the repository root
npm run dev                 # from frontend/
npm run build
npm run lint
npm run typecheck
```

## Configuration

Copy `.env.example` to `.env` and set the backend API base URL:

```ini
VITE_API_BASE_URL=http://localhost:3000
```

Vite only exposes variables prefixed with `VITE_` to the browser, so this file must
never contain a database URL, an API key, or any other secret. The value is read in
`src/lib/apiConfig.ts` and falls back to `http://localhost:3000` when unset.

## Boundary rules

- Do not import from `backend/`, Prisma, or any database code.
- Do not read server-only environment variables.
- Talk to the backend only through `apiUrl()` from `src/lib/apiConfig.ts`.

See the root `README.md` for full setup instructions.
