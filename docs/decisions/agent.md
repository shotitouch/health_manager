# Agent / LLM Decisions

## 3-tier routing: Router (Haiku) → Worker (Sonnet) → Presenter (Sonnet)

- Router: cheap Haiku classifies intent and sets `skipWorker` flag
- Worker: Sonnet fetches/processes data using MCP tools; loops up to 10 iterations
- Presenter: Sonnet calls exactly one FE tool to render UI

**Why:** cost optimisation — routing is a simple classification task that doesn't need Sonnet; separating data-fetch from rendering prevents the LLM from mixing concerns.

---

## `skipWorker` flag — skip Worker for pure navigation intents

If the Router classifies intent as `navigate`, the Worker is skipped entirely (2 SDK calls instead of 3).

**Why:** pure navigation (e.g. "show dashboard") needs no data fetching — the Worker step adds latency and cost for no value.

---

## Worker loop hard cap at 10 iterations → 500 error

If the Worker hasn't resolved tool calls after 10 iterations, the request fails with 500.

**Why:** prevents infinite loops from consuming unbounded API credits; 10 is enough for any realistic multi-step data fetch.

---

## Prompt caching on system prompts (5-min ephemeral TTL)

All three system prompt blocks use `cache_control: { type: 'ephemeral' }`.

**Why:** system prompts are static per request — caching them avoids re-tokenising the same text on every call, reducing latency and cost.

---

## `metadata: { user_id: userId }` on every Anthropic call

**Why:** enables per-user cost tracking on the Anthropic dashboard without storing any PII in our own DB.

---

## MCP argument validation and result sanitization — implemented (was "planned for Phase 6")

Every MCP tool input is Zod-validated against `McpInputSchemas` before execution (unknown tool → 500, invalid input → 400 returned to the LLM as an `is_error` tool_result). `search_nutrition_usda` is live; its results are sanitized (names stripped to printable ASCII, clamped to 200 chars) to prevent prompt injection from external data. Thai DB / web search return "not yet integrated" notes; user-data tools return stubs until the DB layer exists.

**Why:** MCP tools are now actually wired up in the 3-tier loop's Worker, so the deferred validation became mandatory — LLM tool arguments and external API responses are both untrusted input.

---

## `backend/src/env.ts` must be the first import in `app.ts` (2026-06-11)

Loads `.env` then `.env.local` (override, non-production only).

**Why:** ESM evaluates imports in source order — `agent.service.ts` constructs `new Anthropic({apiKey: process.env.ANTHROPIC_API_KEY})` at module top-level, which runs before any later code in `app.ts`. The old inline `dotenv.config()` in `app.ts` ran _after_ that construction, so `ANTHROPIC_API_KEY` was always `undefined` and every real agent call failed with "Could not resolve authentication method" — the agent loop was real code but never actually reached the API. `.env.local` override is gated to `NODE_ENV !== 'production'` so a stray local file can't downgrade `NODE_ENV`/`JWT_SECRET` in prod (security review finding).

**How to apply:** any new top-level `new Anthropic(...)` / SDK client construction in a feature module relies on this ordering. Don't move feature-router imports above `import './env.js'` in `app.ts`, and don't let an import-sorter reorder it.

---

## Presenter receives only Worker's final synthesis, not full intermediate history (2026-06-17)

`runAgentLoop` strips the Worker's intermediate `tool_use`/`tool_result` turns before passing messages to the Presenter. The Presenter receives `[original messages, Worker's final text response, WORKER_TO_PRESENTER_HANDOFF]` only.

**Why:** intermediate turns (raw USDA JSON in `tool_result` blocks, mid-loop `tool_use` calls) inflate the Presenter's input token count without providing additional value — the Worker has already distilled those into its final text synthesis. The Presenter's job is "given what the Worker found, pick a UI component" — not "re-examine every API response the Worker inspected."

**How to apply:** `at(-2)` in the Worker's returned array is always the final text-only assistant response (the iteration where `stop_reason !== 'tool_use'`); `at(-1)` is always `WORKER_TO_PRESENTER_HANDOFF`. Both are pushed unconditionally by `runWorkerLoop` so these indices are safe.

---

## `WORKER_TO_PRESENTER_HANDOFF` synthetic message at end of `runWorkerLoop` (2026-06-11)

A static `{role: 'user', content: [{type: 'text', text: 'Worker findings are above. Render the appropriate view for the user now.'}]}` is appended before returning from the Worker loop.

**Why:** when the Worker ends via `stop_reason !== 'tool_use'` (plain text reply), `currentMessages` ends in `role: 'assistant'`. The real Anthropic API (unlike the mocked tests) rejects a Presenter call whose input ends in `assistant` ("conversation must end with a user message" — no assistant-message prefill on this model). This was only caught by manual E2E testing against the real API, not by the existing mocked unit tests.

**How to apply:** this synthetic turn (plus the Presenter's `tool_result` ack) ends up in `result.messages` returned to the frontend and gets round-tripped as history on the next turn. Verified empirically that the Router still classifies correctly despite this — but if the Router prompt is ever changed to be sensitive to "last N user turns", account for these synthetic turns.
