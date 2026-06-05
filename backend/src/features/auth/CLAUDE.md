# CLAUDE.md — Auth Feature (Backend)

Handles user registration, login, JWT issuance, and token refresh.

## Routes (mounted at `/api/v1/auth`)

| Method | Path        | Description                   |
| ------ | ----------- | ----------------------------- |
| POST   | `/register` | Create account                |
| POST   | `/login`    | Issue access + refresh tokens |
| POST   | `/refresh`  | Rotate refresh token          |
| POST   | `/logout`   | Invalidate refresh token      |

## Token Strategy

- **Access token**: short-lived (15 min), returned in response body
- **Refresh token**: long-lived (7 days), stored in `httpOnly` cookie

## Key Dependency

Auth middleware (`shared/middleware/auth.ts`) is used by all other features to protect routes — changes to the JWT payload shape will break all protected routes.
