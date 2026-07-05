# Auth Decisions

## Access token in response body (15 min) + refresh token in httpOnly cookie (7 days)

**Why:** access tokens in memory (not localStorage) reduces XSS exposure; httpOnly cookies prevent JavaScript from reading the refresh token, making CSRF the only attack surface, which is mitigated by `sameSite: strict`.

---

## Token rotation on every refresh

Each call to `/api/v1/auth/refresh` issues a new refresh token and invalidates the old one.

**Why:** limits the window of a stolen refresh token — once used, the old token is dead.

---

## `isAccessPayload` / `isRefreshPayload` type guards (not just TypeScript casting)

**Why:** `jwt.verify` returns `unknown` at runtime; a plain `as AccessPayload` cast would trust the token's shape without actually checking it — an attacker could craft a token with a missing `userId` field.

---

## Refresh token contains both `userId` and `email`; access token contains only `userId`

**Why:** the refresh endpoint needs to re-sign both tokens, which requires `email`; the access token only needs `userId` to pass to downstream services — carrying email in every request would leak PII unnecessarily.
