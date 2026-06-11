# CLAUDE.md — Summary Feature (Backend)

## Route

`GET /api/v1/summary` — protected by `authMiddleware`. Query: `from`, `to` (both optional,
`YYYY-MM-DD`).

Defaults:

- Neither given: trailing 7-day window ending today (`to = today`, `from = today - 6 days`).
- Only `to` given: `from = to - 6 days`.
- Only `from` given: `to = today`.
- Both given and `from > to`: 400 (Zod `.refine()` in the controller).

## Aggregation pattern (internal HTTP, not cross-feature imports)

Like `dashboard`, `summary.service.ts` aggregates data owned by `profile`, `food`, and `exercise`
by calling their existing `/api/v1/...` endpoints over `fetch` with the caller's `Authorization`
header re-forwarded — never via direct service imports, per the root `CLAUDE.md` rule. See
`dashboard/CLAUDE.md` for the full rationale on header forwarding and `getBaseUrl()` (server
config only, no SSRF surface).

## Range filtering happens client-side, not via new endpoints

`food`/`exercise` `GET /entries` only support an exact-match `date` filter, not a `from`/`to`
range. Rather than fan out one HTTP call per day in the range (N+1) or extend those features'
query schemas, `summary.service.ts` calls `/api/v1/food/entries` and `/api/v1/exercise/entries`
**without** a `date` param — both already return the user's full unfiltered `entries` array — and
filters those entries to `[from, to]` itself by `logged_at.slice(0, 10)`. Totals/averages are
computed from that filtered set, not from the `total_*` fields in those responses (which cover
all-time, not the requested range).

## Duplicated helpers

`getBaseUrl()` and `fetchProfile()` are intentionally duplicated from `dashboard.service.ts`
(small, ~10 lines each) rather than extracted to `shared/`, to keep this feature's diff isolated.
If a third feature needs the same helpers, promote them to `shared/utils/` then.

## Output rounding

All numeric fields in the response are rounded to 1 decimal place (`round1()`) to avoid float
artifacts from summing user-entered decimals (e.g. `1800 / 7`).
