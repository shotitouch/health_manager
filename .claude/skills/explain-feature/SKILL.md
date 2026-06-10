---
name: explain-feature
description: Deep, ground-up explanation of a feature, module, or file — dynamically discovers what to read, then explains the architecture and every notable technique (general concept -> how it's used here -> what breaks without it), big picture to small details. Works for any language, framework, or project.
argument-hint: <path, feature name, or area to explain>
---

Teach the user how `$ARGUMENTS` works, starting from the widest view and drilling into specifics. For every notable technique or design choice, explain it **in general** (the underlying concept, why it's used) and **specifically** (how/where it appears here, file:line, and what would break or be unsafe without it).

## Step 1: Discover what to read

Don't assume a fixed file layout — figure it out for this project and this argument.

- If `$ARGUMENTS` looks like a file path, read it first. Then:
  - Grep for what imports it / what it imports, to find direct collaborators
  - Look for a matching test file (common patterns: `__tests__/`, `*.test.*`, `*.spec.*`, near the file or in a parallel test tree)
- If `$ARGUMENTS` is a feature/module name or directory, Glob broadly to find where it actually lives — try multiple plausible layouts (e.g. `src/features/<name>/`, `src/<name>/`, `<name>/`, `**/<name>*`). Don't give up after one pattern.
- Read every implementation file you find for this feature/module, plus its tests.
- Look for project-convention docs (`CLAUDE.md`, `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, etc.) at the feature level, then walk upward through parent directories to the repo root, reading any that exist — these describe the conventions this code is following.
- Find one sibling module for comparison: Glob the parent directory for other items at the same level, pick one that looks structurally similar, and read it. This separates "this is how the project always does it" from "this is a choice specific to this feature."
- Identify the "shape" of what you're explaining — an HTTP API feature, a UI component, a CLI command, a utility/library module, a data pipeline, a config file, etc. — and let that shape guide which sections below actually apply.

## Step 2: Identify what's worth explaining

Scan what you read for these categories. Only write sections for what's actually present — don't pad with categories that don't apply.

- **Architecture / layering** — why the code is split into the files/modules it's split into, and what each one owns
- **Validation / type safety** — how input is checked or typed, and what specific bugs or attacks each check prevents
- **Error handling** — how failures propagate and get reported
- **Auth / security-sensitive logic** — anything that checks identity, permissions, or trust boundaries
- **State / persistence** — how data is stored, cached, or kept across calls
- **Notable algorithms or non-obvious logic** — anywhere "why this approach" isn't self-evident from the code
- **Tests** — what's covered, how dependencies are isolated (mocking/stubbing), what the test structure reveals about the design
- **Wiring** — how this module gets registered/connected into the rest of the app (routers, DI containers, plugin registries, entry points, etc.)

## Step 3: Write the explanation

Use this structure. Generate the content of each section from what you actually found — there is no fixed list of patterns or checklist items to fill in.

### 1. Big Picture

- What problem does this solve, in plain language?
- Where does it sit in the system? Trace one request/call/data flow from entry point to result.
- How is it triggered/invoked, and how is the result wired back to the rest of the app?

### 2. Layout

- One line per file/module: what it owns and why it's separate from the others.
- If there's a layering pattern (e.g. router/controller/service, component/hook/store), name it and explain the separation of concerns it gives you.

### 3. Walkthrough by pattern

For each item identified in Step 2, write a block:

- **In general:** explain the underlying concept from scratch — assume the reader knows the language but maybe not this pattern
- **In this code (`file:line`):** quote the actual code and explain the specific choices (why these values, why this structure)
- **Without this:** one or two sentences on what would break, leak, or become unmaintainable if this were skipped or done naively

Order these from most architecturally significant to most local/detail-level.

### 4. Tests

- What's covered, grouped by outcome (happy path / invalid input / error propagation, or whatever grouping the actual tests use)
- How are dependencies isolated (mocks, fakes, in-memory stand-ins)? Why does that matter for what's being tested?
- Anything the test structure reveals about the design (e.g. tests written before implementation, contracts the implementation must satisfy)

### 5. Wiring

- How does this module get connected to the rest of the system? Quote the registration point.
- If order/placement matters (e.g. middleware order, plugin registration order), explain why.

### 6. Transferable Patterns — Checklist

A bullet list of the patterns from Step 3 that generalize beyond this specific feature, phrased as reusable advice ("Do X when Y") — generated from what was actually found, not copied from a template.

## Tone

Write as a senior engineer explaining to a capable junior. Be direct, use short sentences, quote real code with file:line references. Don't hedge ("you might want to") — state why each choice is correct or what tradeoff it makes. The goal is for the reader to recognize these patterns unprompted in future code, not to memorize this specific feature.
