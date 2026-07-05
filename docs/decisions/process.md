# Process / Workflow Decisions

## One pass of code review + one pass of security review per feature — no re-review loop

After applying findings, re-run tests and typecheck. Do not re-run the reviews.

**Why:** a second review pass always surfaces something — style preferences, marginal type improvements. Diminishing returns kick in immediately after one honest pass; continuing creates improvement hell with no correctness benefit.

---

## Only re-run security review if a fix introduces a new security boundary

New auth mechanism, new tool registry entry, new external call = re-review. Zod `.max()` cap, UUID swap, date filter fix = no re-review.

**Why:** scopes the rule — prevents over-triggering while still catching genuine regressions.

---

## Stub-first development — no DB until all features are scaffolded

All services use in-memory Map stubs. DB layer (PostgreSQL) is not yet implemented.

**Why:** lets the full HTTP stack (router → controller → service → response) be built and tested before the DB schema is finalised; avoids schema churn as features are added.

---

## TDD cycle is mandatory — tests must fail (red) before any implementation

`/run-tests` enforces this: if all tests pass before implementation, it stops and warns.

**Why:** tests written after implementation tend to mirror the code rather than the contract — they pass trivially and don't catch regressions.

---

## `/explain-feature` skill added (2026-06-05)

User-triggered skill that walks through a just-implemented feature from big picture to individual lines, covering every technique and design choice.

**Why:** the implementation cycle produces correct code but no mental model — the user wanted to learn the "why" behind each decision to be able to apply patterns independently in the future.

---

## Per-task Claude model assignments (2026-06-12)

Pinned `model: opus` in `code-reviewer`, `security-auditor`, `prompt-engineer`; `model: sonnet` in `test-runner` (all in `.claude/agents/*.md`). Added a "Model selection" bullet to `CLAUDE.md` Workflow Rules: run `/model opus` before entering plan mode, `/model sonnet` after plan approval. (Inline copies in `implement-feature/SKILL.md` were removed later the same day by the .md leaning pass — root CLAUDE.md is always injected, so the skill copies were double-paid duplication.)

**Why:** custom subagent `model:` frontmatter takes precedence over the main session's model and is the only durable way to pin review/audit agents; but the built-in **Plan** subagent (plan mode Phase 2) _inherits_ the main session's model, so "planning = opus, coding = sonnet" can only be achieved via manual `/model` switches — there's no frontmatter equivalent for built-in subagents. Explore (Phase 1) is hardcoded to Haiku, not reconfigurable. Fable was considered for planning but rejected for lack of signal on technical-planning quality.

**How to apply:** if the user reports `/code-review` or `/security-review` running on the "wrong" model, check the agent's frontmatter first — `/model` only affects the main session + built-in Plan/Explore subagents, not custom agents.

---

## .md leaning pass — no code snapshots in instruction files (2026-06-12)

User-approved policy from the token-footprint leaning: CLAUDE.md files must not contain code-snapshot blocks that mirror source (FE tools table, TOOL_MAP snippet, verbatim system prompt were all dropped for pointers to `tool-registry.ts` / `ToolExecutor.tsx` / `agent.service.ts`).

**Why:** snapshots drift (the old ones carried "keep this table in sync" instructions and were already wrong about the 3-tier loop); code is the source of truth. Dedup direction: invariants live in root `CLAUDE.md` (always injected) and children/skills never restate them; duplication between sibling skills is acceptable (never co-loaded).

**How to apply:** when writing or reviewing any .md, place content in the narrowest file whose entire audience needs it, and replace any code-mirroring block with a pointer to the source file.

---

## In-repo decision log added — `docs/decisions/` (2026-06-13)

This decision log was split out of Claude's per-session memory (`project_decision_log.md`) into `docs/decisions/` — one file per topic plus `docs/decisions/README.md` as an index — so decisions are visible to the whole repo and only the relevant topic file needs loading for a given change.

**Why:** a single accumulating file would force loading the entire history to check relevance to the current change; splitting by topic (mirroring the `MEMORY.md` index + per-topic-file pattern) keeps each file scoped to one area.

**How to apply:** when a change affects an existing entry in any `docs/decisions/<topic>.md`, update that entry in place with a dated `Superseded`/`Resolved`/`Merged into` annotation rather than leaving it stale (see `docs/decisions/README.md` for the format and root `CLAUDE.md` → Workflow Rules for the trigger).
