# Architecture Decisions

## Agentic frontend — LLM decides what UI to render

The frontend is a dumb executor. The LLM calls FE tools (`show_*`, `display_*`) and the frontend renders whatever components the tool calls specify. The frontend has no routing or conditional logic of its own.

**Why:** keeps the UI flexible — the LLM can decide to show a food input, a clarification prompt, or a dashboard without any frontend code changes. New views are just new FE tools.

---

## Locked feature set: auth, agent, profile, food, exercise, dashboard, summary

No features outside this set will be added.

**Why:** scope control — this is a personal health tracking app with a defined domain; open-ended expansion would fragment the agent prompt and tool registry.

---

## Two tool namespaces: FE tools vs MCP tools

FE tools (`show_*`, `display_*`) are returned to the frontend for rendering. MCP tools are executed server-side and their results are injected back into the LLM context.

**Why:** clean separation — the frontend never executes data-fetching logic; the LLM never sends raw API responses to the browser.

---

## Tool registry (`tool-registry.ts`) is the single source of truth — never add tools at runtime

All tools are defined statically. The LLM can only call tools from this list. The frontend `ToolExecutor` only renders components in its static `TOOL_MAP`.

**Why:** security — prevents prompt injection attacks from adding arbitrary tools dynamically.

---

## Never import across features — shared code belongs in `src/shared/` only

**Why:** prevents circular dependencies and keeps features independently deployable/testable.

**Addendum (2026-06-14):** when a feature needs to call into another feature's read logic (e.g. `dashboard`/`summary` aggregating `profile`/`food`/`exercise` data), the sanctioned mechanism is a thin **port** in `shared/ports/<feature>.port.ts` — a pure re-export (types + functions) of that feature's existing service exports, added only once 2+ features need it. Dependency direction is one-way: `shared/ports/*` → `features/<feature>/*.service.ts`; the owning feature never imports its own port (no cycle), and consumers import only from `shared/ports/*`, never directly from another feature. Per "shared kernel" modular-monolith research, `shared/ports/*` must stay **zero business logic** — a function having 2+ consumers is not, by itself, grounds to move it into `shared/`; the `Map` store, validation, and computation stay owned by the feature. See `backend/src/shared/ports/CLAUDE.md` and the dashboard.md "Internal HTTP aggregation" entry (superseded by this mechanism).
