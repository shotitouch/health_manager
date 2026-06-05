---
name: write-md
description: Create or review any .md file in .claude/ (agents, skills, CLAUDE.md) following the context injection model
argument-hint: <file-path>
---

Create or review the .md file at $ARGUMENTS following this concept.

## Core principle

Every file in this project is a **context injection mechanism**. The only question when deciding where content belongs is: **when does this context need to be active?**

If content doesn't need to be active at a given injection point, it doesn't belong in that file — no matter how important it is.

## The injection points

| When it needs to be active                     | File                                |
| ---------------------------------------------- | ----------------------------------- |
| Always, everywhere                             | Root `CLAUDE.md`                    |
| Always, everywhere (overflow)                  | `.claude/rules/` without `paths:`   |
| Only when a matching file is accessed          | `.claude/rules/` with `paths:` glob |
| Always, within this folder                     | Local `CLAUDE.md`                   |
| Every time this agent runs, regardless of task | `agents/<name>.md`                  |
| Only when this specific task is invoked        | `skills/<name>.md`                  |

**Rules without `paths:`** behave identically to root CLAUDE.md — use only to split a root CLAUDE.md that has grown too long, not as a separate concept.

**Rules with `paths:`** are more granular than a local CLAUDE.md: context loads only when a matching file is accessed, not for the whole session within a folder. Use for content irrelevant unless working on a specific file type (e.g. testing conventions scoped to `**/*.test.ts`).

**Skill exception:** A skill can also exist purely to make something user-invocable via `/`, even with minimal procedure.

## Rules that follow

**No duplication** — if a parent file already injects this context, don't repeat it in a child. The child only adds what the parent doesn't cover.

**Scope ownership** — content belongs in the narrowest file whose entire audience needs it:

- All FE features need it, but not BE → `frontend/CLAUDE.md`, not root
- Only one feature needs it → that feature's `CLAUDE.md`
- Both FE and BE need it → root `CLAUDE.md`

If content is broader than its audience, move it down. If narrower, move it up.

**Agent vs skill** — an agent file is who the agent always is; a skill file is what it does right now. Output format, task steps, and criteria belong in the skill, not the agent.

**Meaningful content** — content must be true to its injection point:

- Root / rules without paths: applies everywhere, to everyone
- Rules with paths: applies only when working on matching files
- Local CLAUDE.md: describes what exists in this folder (patterns, conventions, file locations) — not tasks, not persona
- Agent file: concrete persona and stable review lens — not one-off instructions
- Skill file: actionable steps and explicit output format — not persona

## How to review

1. Read the target file
2. Read the relevant sibling layers to check for duplication:
   - Reviewing an agent file → read root `CLAUDE.md` and any local `CLAUDE.md` in scope
   - Reviewing a skill file → read the agent file it invokes (if any)
   - Reviewing a `CLAUDE.md` → read the layer above it and any child `CLAUDE.md` files below it: catch content in children that leaked down when it should live here, and catch content in the parent layer whose audience is limited to this folder (it should move here instead)
3. Identify violations: duplication across layers, content in the wrong layer, agent files containing task steps or output format instructions, skill files containing persona
4. Check that content is meaningful and true to its file type:
   - Agent file: persona is concrete (not generic), checklist items are stable review criteria the agent always applies — not one-off instructions
   - Skill file: procedure steps are actionable and specific, output format is explicit, nothing reads like "who I am"
   - CLAUDE.md: content describes what exists in this folder (patterns, file locations, conventions) — not tasks, not persona, not repo-wide rules
5. Edit the file to fix each violation
6. If reviewing an agent file, check that a companion skill exists — agents without one are not user-invocable via `/`
7. Report what was changed and why — one line per fix
8. After fixes, suggest improvements: content that is missing, could be more specific, or would make the file more useful to a developer working in that scope — ask before applying
