---
name: explain-feature
description: Deep, ground-up explanation of a feature, module, or file — dynamically discovers what to read, then explains the architecture and every notable technique (general concept -> how it's used here -> what breaks without it), big picture to small details. Works for any language, framework, or project.
argument-hint: <path, feature name, or area to explain>
---

Teach the user how `$ARGUMENTS` works, from the widest view down to specifics. For every notable technique or design choice, explain it **in general** (the underlying concept, why it's used) and **specifically** (how/where it appears here, file:line, and what would break or be unsafe without it).

## Step 1: Discover what to read

Don't assume a fixed file layout — figure it out for this project and this argument.

- If `$ARGUMENTS` is a file path: read it, grep for what imports it / what it imports, and find its test file (`__tests__/`, `*.test.*`, `*.spec.*`, nearby or in a parallel tree).
- If it's a feature/module name or directory: Glob multiple plausible layouts (`src/features/<name>/`, `src/<name>/`, `<name>/`, `**/<name>*`) — don't give up after one pattern.
- Read every implementation file for the feature, plus its tests.
- Read convention docs (`CLAUDE.md`, `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, …) at the feature level and upward to the repo root.
- Read one structurally similar sibling module — to separate "how the project always does it" from "a choice specific to this feature".
- Identify the "shape" of the thing (HTTP API feature, UI component, CLI command, library module, data pipeline, config, …) and let it guide which sections below apply.

## Step 2: Identify what's worth explaining

Scan for these categories; only write sections for what's actually present — don't pad:

- **Architecture / layering** — why this file split, what each file owns
- **Validation / type safety** — what each check prevents (bugs or attacks)
- **Error handling** — how failures propagate and get reported
- **Auth / security-sensitive logic** — identity, permissions, trust boundaries
- **State / persistence** — storage, caching, data kept across calls
- **Notable algorithms or non-obvious logic** — where "why this approach" isn't self-evident
- **Tests** — coverage, dependency isolation, what the structure reveals about the design
- **Wiring** — how the module gets registered/connected (routers, DI, registries, entry points)

## Step 3: Write the explanation

Write a self-contained HTML file following the root `CLAUDE.md` "HTML Review Docs" convention — tables and an SVG diagram make the structure scannable instead of forcing a top-to-bottom read of prose.

1. Derive a filesystem-safe slug from `$ARGUMENTS` (lowercase; `/`, `.`, spaces → `-`).
2. Write to `.claude/tmp/<slug>-explanation.html` and open it per the convention.
3. In the chat, give a short plain-text recap (5-10 lines): what the feature does, the file layout, and the transferable patterns checklist.

Generate each section's content from what you actually found — there is no fixed list of patterns or checklist items to fill in.

### 1. Big Picture

- What problem does this solve, in plain language? — short `<p>` fragments
- Where does it sit in the system? Trace one request/call/data flow from entry point to result as an inline `<svg>` (boxes + arrows, ~700x150 viewBox, each box labeled `file:line`)
- How is it triggered, and how does the result wire back into the app?

### 2. Layout

- `<table>`, one row per file/module — columns: File, Owns, Why separate
- If there's a layering pattern (router/controller/service, component/hook/store, …), name it in a `<p>` above and explain the separation of concerns it gives you

### 3. Walkthrough by pattern

For each item from Step 2, a `<section>` with an `<h3>` title and a `<dl>`:

- **In general**: the concept from scratch — assume the reader knows the language but maybe not this pattern
- **In this code (`file:line`)**: quote the actual code in `<pre><code>`, explain the specific choices (why these values, why this structure)
- **Without this**: one or two sentences on what would break, leak, or rot if skipped or done naively

Order from most architecturally significant to most local.

### 4. Tests

- `<table>` grouping coverage by outcome (happy path / invalid input / error propagation, or the grouping the tests use) — columns: Case, File, Outcome
- How are dependencies isolated (mocks, fakes, in-memory stand-ins) and why does that matter here? — short `<p>`
- Anything the test structure reveals about the design (tests-first, contracts the implementation must satisfy)

### 5. Wiring

- Quote the registration point in `<pre><code>`
- If order/placement matters (middleware order, plugin registration), explain why in a `<p>`

### 6. Transferable Patterns — Checklist

A `<ul>` of the Step 3 patterns that generalize beyond this feature, phrased as reusable advice ("Do X when Y").

## Tone

Senior engineer explaining to a capable junior. Direct, short sentences, real code with file:line references. Don't hedge ("you might want to") — state why each choice is correct or what tradeoff it makes. The goal is for the reader to recognize these patterns unprompted in future code, not to memorize this feature.
