# CLAUDE.md — Backend

TypeScript/Express backend. All source files are `.ts`; run via `tsx` in dev, compiled to `dist/` for production.

## Commands

```bash
npm run dev      # tsx watch, restarts on change — http://localhost:3001
npm run build    # tsc → dist/
npm start        # node dist/app.js (production)
npm run typecheck  # tsc --noEmit — run before committing
```

## Environment

Copy `.env.example` to `.env.local` and fill in values before running:

```
PORT=3001
FRONTEND_URL=http://localhost:5173
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
```

## Structure

```
src/
  features/
    agent/              # LLM orchestration — the core of the system (see its CLAUDE.md)
      agent.router.ts
      agent.controller.ts
      agent.service.ts  # Calls Anthropic SDK, enforces tool-registry
      tool-registry.ts  # MASTER LIST of allowed tools (FE + MCP)
    auth/               # JWT register/login/refresh/logout — scaffold only
    profile/            # BMR, TDEE calculations — scaffold only
    food/               # Food log, nutrition data — scaffold only
    exercise/           # Exercise log, calorie burn — scaffold only
    summary/            # Aggregate stats — scaffold only
    dashboard/          # Daily rollup — scaffold only
  shared/
    middleware/         # errorHandler.ts, auth.ts (JWT guard), logger.ts
    utils/              # Pure helpers shared across features
  app.ts                # Express setup, mounts all routers
```

## API Conventions

- Base path: `/api/v1`
- Each feature mounts at `/api/v1/<feature>`
- All responses: `{ data, message, error }`
- Controllers handle HTTP only — no business logic
- Services are framework-agnostic (no `req`/`res`)

## Middleware

- **Auth guard**: import `authMiddleware` from `shared/middleware/auth.ts` and apply it to any route that requires a logged-in user. It validates the JWT and attaches `req.userId`.
- **Error handler**: `shared/middleware/errorHandler.ts` is registered last in `app.ts` and catches all unhandled errors — throw or call `next(err)` from controllers/services; do not write ad-hoc error responses.

## Database

Relational (PostgreSQL). Not yet implemented.

Tables: `users`, `food_entries`, `exercise_entries`, `daily_log`.

Service functions return stub/empty data until the DB layer exists — do not implement persistence yet.

## Adding a New Feature

1. Create `src/features/<name>/` with three standard files: `<name>.router.ts`, `<name>.controller.ts`, `<name>.service.ts`.
2. Register its router in `src/app.ts`.
3. If it adds FE tools, add them to `tool-registry.ts` `FE_TOOLS`. If it needs to fetch external data, add MCP tools to `MCP_TOOLS`.
4. Add a local `CLAUDE.md` if it has non-obvious auth rules, MCP wiring, or external calls.
