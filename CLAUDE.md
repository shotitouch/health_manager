# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Health Manager — a personal health tracking app (calorie intake, calorie burn, protein, BMR/TDEE) built with an **agentic frontend**: the LLM decides what UI to show the user by calling a constrained set of frontend tools. The frontend is a dumb executor — it renders whatever components the LLM instructs via tool calls.

- **Frontend**: React (Vite) in `frontend/`
- **Backend**: Node.js/TypeScript (Express) in `backend/`

## Commands

```bash
# Frontend
cd frontend && npm install
cd frontend && npm run dev       # http://localhost:5173

# Backend
cd backend && npm install
cd backend && npm run dev        # http://localhost:3001
```

## Agentic Architecture

```
User message
  → POST /api/v1/agent
    → agent.service.ts builds prompt + injects tool-registry tools
    → Claude LLM responds with tool_use blocks
    → Response sent to frontend
      → ToolExecutor maps tool name → React component → renders it
```

**Security model:** The LLM is only ever given tools from `tool-registry.ts`. It cannot call arbitrary tools. The frontend `ToolExecutor` only renders components in its static `TOOL_MAP` — unknown tool names are silently ignored.

**Two tool namespaces:**

- **FE tools** (`show_*`, `display_*`) — instruct the frontend to render a component
- **MCP tools** — call external data sources (nutrition DB, exercise data); results are injected into context, not rendered directly

## Features

`auth`, `agent`, `profile`, `food`, `exercise`, `dashboard`, `summary`

Only `agent` is fully implemented. All others are empty scaffolds waiting to be built.

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

## CLAUDE.md Hierarchy

| File                                     | Scope                                                             |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `CLAUDE.md` (this file)                  | Whole repo — commands, architecture, cross-feature rules          |
| `frontend/CLAUDE.md`                     | FE structure, patterns, component contract, auth conventions      |
| `backend/CLAUDE.md`                      | API conventions, agent conventions                                |
| `frontend/src/features/<name>/CLAUDE.md` | Feature-specific frontend context (files, constraints, wiring)    |
| `backend/src/features/<name>/CLAUDE.md`  | Feature-specific backend context (files, constraints, MCP wiring) |

Add a local CLAUDE.md to a feature folder once it has non-obvious rules (complex state, special auth, MCP wiring, etc.).
