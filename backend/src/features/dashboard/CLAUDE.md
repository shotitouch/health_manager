# CLAUDE.md — Dashboard Feature (Backend)

## Route

`GET /api/v1/dashboard` — protected by `authMiddleware`. Query: `date` (optional, `YYYY-MM-DD`, defaults to today).

## Aggregation pattern (ports, not cross-feature imports)

`dashboard.service.ts` aggregates data owned by `profile`, `food`, and `exercise` via the thin re-export
modules in `shared/ports/{profile,food,exercise}.port.ts`, instead of importing those features' services
directly — per the root `CLAUDE.md` rule against cross-feature imports. See `shared/ports/CLAUDE.md` for the
rules governing those modules.

`getDashboard(userId, input)` takes `req.userId` (set by `authMiddleware`) directly and calls
`getProfile(userId)`, `getFoodEntries(userId, { date })`, `getExerciseEntries(userId, { date })` in parallel via
`Promise.all` — in-process calls, no HTTP, no header forwarding. The `date` query param is regex-validated
(`^\d{4}-\d{2}-\d{2}$`) before being passed through.
