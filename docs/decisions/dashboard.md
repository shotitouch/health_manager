# Dashboard Feature Decisions

> Original decisions dated 2026-06-10 unless noted otherwise.

## Internal HTTP aggregation — `dashboard.service.ts` calls its own `/api/v1/profile`, `/api/v1/food/entries`, `/api/v1/exercise/entries` via `fetch`, forwarding the caller's `Authorization` header

User-approved choice (via AskUserQuestion) over a shared-service-layer refactor.

**Why:** dashboard inherently needs cross-feature data, but CLAUDE.md forbids cross-feature TS imports. Internal HTTP calls (mirroring `agent.service.ts`'s USDA fetch pattern) avoid imports entirely, require zero changes to food/exercise/profile, and re-use each endpoint's existing `authMiddleware` for auth instead of re-deriving trust from `req.userId`.

**How to apply:** this is the precedent for `summary` (the other feature requiring cross-feature aggregation) — same pattern: `getBaseUrl()` from `API_BASE_URL`/`PORT` env (server-config only, never request-derived → no SSRF), forward `Authorization` header verbatim to each internal call, treat non-2xx/non-404 upstream responses as `502`. See `backend/src/features/dashboard/CLAUDE.md` for the full rationale.

**Superseded (2026-06-14):** replaced by in-process calls through `shared/ports/{food,exercise,profile}.port.ts` — thin, zero-logic re-export modules. `dashboard.service.ts`/`summary.service.ts` now call `getProfile(userId)`, `getFoodEntries(userId, input)`, `getExerciseEntries(userId, input)` directly (via the ports) instead of `fetch`-ing their own HTTP endpoints, and take `userId` (from `req.userId`, set by `authMiddleware`) instead of forwarding the `Authorization` header. Motivated by modular-monolith research: in-process module calls are preferred over same-process HTTP self-calls (network round-trip, JSON (de)serialization, opaque 502-on-upstream-failure indirection, header-forwarding fragility — all for zero real isolation benefit). The "never import across features" rule is preserved because `dashboard`/`summary` import only from `shared/ports/*`, never directly from `food`/`exercise`/`profile`; see the architecture.md addendum and `backend/src/shared/ports/CLAUDE.md`. `getBaseUrl()`/`API_BASE_URL` are removed (dead).

---

## `fetchProfile` returns `null` on 404 (graceful "no profile yet"), `502` on any other non-ok status

`bmr`/`tdee`/`calories.target`/`calories.remaining` are all `null` when profile is missing.

**Why:** a new user who hasn't completed onboarding shouldn't get a 502 from the dashboard — calorie/protein totals are still useful without BMR/TDEE.
