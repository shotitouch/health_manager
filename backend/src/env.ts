import dotenv from 'dotenv';

// Must be imported first in app.ts (before any feature module). ESM evaluates
// imports in source order, and feature modules like agent.service.ts construct
// SDK clients from process.env at module top-level — if dotenv.config() ran
// after those imports, the keys would still be undefined when the clients are built.
dotenv.config();

// .env.local holds per-developer secrets and overrides .env — but only in dev.
// A stray .env.local in a production build (e.g. an overly broad Docker COPY)
// must never override real deployment env vars like NODE_ENV or JWT_SECRET.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local', override: true });
}
