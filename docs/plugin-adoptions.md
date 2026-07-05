# Plugin Adoptions

Rules and patterns cherry-picked from Claude Code plugins (or similar agent tools) into this project's own configuration — without installing the plugin. Each entry records what was taken, what was skipped, and the source version for traceability.

## Why manual over plugin install

Plugins inject their full ruleset into every response via hooks, with no way to scope or filter. When a plugin's opinions conflict with project conventions (comment style, test approach, output format), cherry-picking the useful parts into CLAUDE.md or agent definitions gives full control.

---

## ponytail v4.7.0

**Source:** [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) — "Makes your AI agent think like the laziest senior dev in the room."

**Date adopted:** 2026-06-18

### Adopted

| What                                                                                                         | Where it lives                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 6-rung laziness ladder (YAGNI → stdlib → native → installed dep → one-liner → minimum)                       | `CLAUDE.md` → `## Code Minimalism`                                             |
| "No unrequested abstractions" (no single-impl interface, no single-product factory, no config for constants) | `CLAUDE.md` → `## Code Minimalism`                                             |
| "Deletion over addition, shortest working diff wins"                                                         | `CLAUDE.md` → `## Code Minimalism`                                             |
| Over-engineering detection tags (`stdlib:`, `native:`, `yagni:`, `shrink:`)                                  | `.claude/agents/code-reviewer.md` → `## Over-engineering` (pending)            |
| Repo-wide bloat audit concept                                                                                | `.claude/skills/lean-audit/SKILL.md` (pending, renamed from `/ponytail-audit`) |

### Excluded

| Feature                                                                | Why                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Output brevity ("3 lines max, delete explanation if longer than code") | Conflicts with HTML review doc workflow                |
| `ponytail:` comment convention                                         | Conflicts with project "no comments" rule              |
| Test minimalism ("one assert, no frameworks")                          | Conflicts with Jest/TDD workflow                       |
| Intensity levels (lite/full/ultra) and mode-switching hooks            | No hook infrastructure; unnecessary without the plugin |
| Web-specific rung 3 (modern-web CLI lookup)                            | Not relevant to this project's stack                   |
| Statusline badge                                                       | Not needed — no plugin state to display                |

### How it's wired

- **CLAUDE.md** `## Code Minimalism` — always injected, scoped to code only (explicit boundary: "explanations, plans, and review docs follow their own rules above")
- **No hooks, no flag files, no Node.js scripts** — zero moving parts vs the plugin's `SessionStart` + `UserPromptSubmit` hook pair
- **No plugin dependency** — if ponytail changes or disappears, the rules are ours

### Updating

If a new ponytail version changes the ladder or adds rules worth adopting, compare against this entry and update in place. The version tag (v4.7.0) marks what was last reviewed.
