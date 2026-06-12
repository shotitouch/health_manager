# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Health Manager — a personal health tracking app (calorie intake, calorie burn, protein, BMR/TDEE) built with an **agentic frontend**: the LLM decides what UI to show the user by calling a constrained set of frontend tools. The frontend is a dumb executor — it renders whatever components the LLM instructs via tool calls.

- **Frontend**: React (Vite) in `frontend/` — http://localhost:5173
- **Backend**: Node.js/TypeScript (Express) in `backend/` — http://localhost:3001

Setup and run commands live in `frontend/CLAUDE.md` and `backend/CLAUDE.md`.

## Agentic Architecture

```
User message
  → POST /api/v1/agent
    → agent.service.ts 3-tier pipeline:
        Router (Haiku, classify intent) → Worker (Sonnet, MCP tools — skipped for pure navigation)
        → Presenter (Sonnet, FE tools — must call ≥1)
    → Response { messages, feToolCalls } sent to frontend
      → ToolExecutor maps tool name → React component → renders it
```

**Security model:** The LLM is only ever given tools from `tool-registry.ts`; the frontend `ToolExecutor` only renders components in its static `TOOL_MAP` — unknown tool names are silently ignored.

**Two tool namespaces:** FE tools (`show_*`, `display_*`) instruct the frontend to render a component; MCP tools call external data sources, with results injected into context, not rendered. Details in `backend/src/features/agent/CLAUDE.md`.

## Features

`auth`, `agent`, `profile`, `food`, `exercise`, `dashboard`, `summary`

All backend features are implemented with in-memory storage (no DB yet). The frontend is not yet initialized (no `package.json`) — only a partial `agent` scaffold exists.

**Shared code** lives in `src/shared/` on both sides — only put something there if used by two or more features.

## Rules

- Never add entries to `FE_TOOLS` or `MCP_TOOLS` at runtime or from user input — only in `tool-registry.ts`
- Never import across features — cross-feature code belongs in `src/shared/` only
- Stay within the locked feature set: `auth`, `agent`, `profile`, `food`, `exercise`, `dashboard`, `summary`

## Workflow Rules

- **Adding a new FE tool**: always use the `/add-fe-tool` skill — it scaffolds tool-registry, component, ToolExecutor TOOL_MAP, and barrel export in one step. Never add FE tools manually.
- **Implementing a new feature**: open a fresh session, then use `/implement-feature <name>` — it walks the full TDD cycle (plan → red → implement → green → `/code-review` → `/security-review`).
- **After any implementation**: run `/code-review` before considering the task done.
- **After any changes to `agent/`, `auth/`, or request validation code**: run `/security-review`.
- **Model selection**: before entering plan mode, run `/model opus` (the built-in Plan subagent inherits the main session's model). After a plan is approved, run `/model sonnet` for the implementation phase. The custom review/audit subagents (`code-reviewer`, `security-auditor`, `prompt-engineer`, `test-runner`) have their models pinned in their definitions and are unaffected by `/model`.

## HTML Review Docs

Plans and explanation docs are presented as self-contained HTML files in `.claude/tmp/` (gitignored — local review only). Whenever plan mode or a skill calls for one:

- Inline `style` attributes only — no external stylesheets/scripts
- `<h2>`/`<h3>` sections mirroring the doc's structure
- `<table>` for structured lists (files to change, routes, fields, comparisons)
- Inline `<svg>` for any flow/architecture diagrams
- `<details><summary>Alternatives considered</summary>...</details>` for anything weighed and rejected
- Open it for review: `Start-Process (Resolve-Path ".claude/tmp/<file>.html").Path`

**Plan mode:** before calling `ExitPlanMode`, write the plan to `.claude/tmp/<slug>-plan.html` per the above and open it. Note in the markdown plan file (read by the `ExitPlanMode` approval UI) that the HTML version was opened in the browser.

## CLAUDE.md Hierarchy

Root (this file) covers whole-repo architecture and cross-feature rules. `frontend/CLAUDE.md` and `backend/CLAUDE.md` own their side's commands, structure, and conventions. Feature folders (`src/features/<name>/CLAUDE.md` on either side) hold feature-specific context — add one once a feature has non-obvious rules (complex state, special auth, MCP wiring, etc.).
