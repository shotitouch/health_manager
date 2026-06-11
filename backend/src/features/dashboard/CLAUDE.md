# CLAUDE.md — Dashboard Feature (Backend)

## Route

`GET /api/v1/dashboard` — protected by `authMiddleware`. Query: `date` (optional, `YYYY-MM-DD`, defaults to today).

## Aggregation pattern (internal HTTP, not cross-feature imports)

`dashboard.service.ts` aggregates data owned by `profile`, `food`, and `exercise` by calling their existing
`/api/v1/...` endpoints over `fetch`, instead of importing those features' services directly — per the root
`CLAUDE.md` rule against cross-feature imports.

**Why the `Authorization` header is re-forwarded instead of trusting `req.userId`:** the downstream endpoints
(`/api/v1/profile`, `/api/v1/food/entries`, `/api/v1/exercise/entries`) each run their own `authMiddleware` and
derive `userId` from the JWT themselves. The dashboard controller forwards the caller's raw `Authorization`
header (`getDashboard(authHeader, ...)`) so those calls authenticate identically to a direct request — there's
no shared-service path to pass `req.userId` through without violating the cross-feature import rule. If this
forwarding is ever dropped, all three internal calls will 401 silently (surfaced as a 502 from the dashboard,
since `errorHandler` collapses 5xx messages).

`getBaseUrl()` is server-config only (`API_BASE_URL` / `PORT` env vars) — never derived from request data, so
there's no SSRF surface here. The `date` query param is regex-validated (`^\d{4}-\d{2}-\d{2}$`) before being
interpolated into the food/exercise fetch URLs.
