# Decisions

Why things are the way they are — architectural, design, and process decisions for Health Manager, split by topic so only the relevant file needs to be loaded for a given area of work.

## Topics

- [Architecture](architecture.md) — agentic frontend, locked feature set, FE/MCP tool namespaces, tool registry as source of truth, cross-feature import rules
- [Agent / LLM](agent.md) — 3-tier pipeline (Router/Worker/Presenter), routing shortcuts, caching, MCP validation, env loading order, Worker→Presenter handoff
- [Auth](auth.md) — token storage/rotation, payload type guards
- [Profile](profile.md) — BMR/TDEE formulas, server-side calculation
- [Food](food.md) — data model choices, validation, ID generation, numeric caps
- [Dashboard](dashboard.md) — cross-feature aggregation pattern, missing-profile handling
- [Process / Workflow](process.md) — review cadence, TDD cycle, model assignments, doc-leaning policy, this decision log itself

## Format

Each entry is a heading (the decision), a short description, and:

- **Why:** the reasoning behind the decision
- **How to apply:** (optional) when/where this matters for future work

## Updating entries

When a later change affects an existing entry, **update it in place** — add a dated annotation describing what changed and why, rather than deleting the entry or writing a new standalone one elsewhere:

- **`Superseded (YYYY-MM-DD):`** — the decision was replaced by a different approach
- **`Resolved (YYYY-MM-DD):`** — a deferred/open item was addressed
- **`Merged into <file> (YYYY-MM-DD):`** — this entry was consolidated with another

The "decided X, then changed to Y because Z" trail is usually more valuable than either decision alone — see the `validationError` entry in [food.md](food.md) for an example.
