# CLAUDE.md — Summary Feature (Backend)

## Route

`GET /api/v1/summary` — protected by `authMiddleware`. Query: `from`, `to` (both optional,
`YYYY-MM-DD`).

Defaults:

- Neither given: trailing 7-day window ending today (`to = today`, `from = today - 6 days`).
- Only `to` given: `from = to - 6 days`.
- Only `from` given: `to = today`.
- Both given and `from > to`: 400 (Zod `.refine()` in the controller).

## Aggregation pattern (ports, not cross-feature imports)

Like `dashboard`, `summary.service.ts` aggregates data owned by `profile`, `food`, and `exercise`
via the thin re-export modules in `shared/ports/{profile,food,exercise}.port.ts` — never via
direct service imports, per the root `CLAUDE.md` rule. `getSummary(userId, input)` takes
`req.userId` directly (set by `authMiddleware`); see `dashboard/CLAUDE.md` and
`shared/ports/CLAUDE.md` for the shared rationale.

## Range filtering happens in-process, not via new endpoints

`food`/`exercise` `getFoodEntries`/`getExerciseEntries` only support an exact-match `date` filter,
not a `from`/`to` range. Rather than fan out one call per day in the range (N+1) or extend those
features' input types, `summary.service.ts` calls `getFoodEntries(userId, {})` and
`getExerciseEntries(userId, {})` — both already return the user's full unfiltered `entries` array
via the ports — and filters those entries to `[from, to]` itself by `logged_at.slice(0, 10)`.
Totals/averages are computed from that filtered set, not from the `total_*` fields on those
results (which cover all-time, not the requested range).

## Output rounding

All numeric fields in the response are rounded to 1 decimal place (`round1()`) to avoid float
artifacts from summing user-entered decimals (e.g. `1800 / 7`).
