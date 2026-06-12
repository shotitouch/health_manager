---
name: review-skill-agent-md
description: Validate that every section in a skill or agent .md file lives in the right layer — skill, agent, or CLAUDE.md
argument-hint: <file-path> [<file-path>...]
---

Audit the layer placement of every section in $ARGUMENTS.

If `$ARGUMENTS` contains multiple files, run Steps 1–6 for each file independently. Group the output under a heading per file.

## Steps

1. Read the target file. Determine its type:
   - Path contains `.claude/skills/` → **skill file**
   - Path contains `.claude/agents/` → **agent file**
2. Read the sibling layer: if the target is a skill file, read the agent file it invokes (if any); if the target is an agent file, read any companion skill files.
3. Read the relevant CLAUDE.md layers. For files under `.claude/`, only the root `CLAUDE.md` is in scope — there are no feature-level CLAUDE.md files to consider.
4. For each section or named block of content in the target file, answer two questions:
   - **When does this need to be active?** Map it to a layer: only when this task is invoked → skill file (task steps, output format); every agent run regardless of task → agent file (persona, stable criteria); always, everywhere → root `CLAUDE.md` or a rule without `paths:`.
   - **Is it duplicated from a layer that already injects it?** If yes, the copy here is redundant and should be removed.
5. For each misplaced section, record: the section name, where it currently lives, where it should live, and why (one sentence).
6. Apply the moves: edit the target file to remove misplaced content, and add it to the correct file.
7. If the target is an agent file, check that at least one companion skill file exists that invokes it. An agent with no companion skill is not user-invocable via `/` — flag this as a finding if missing.

## Output format

Always report the assessment table first — one row per section:

| Section | Active when? | Wrong layer? |
| ------- | ------------ | ------------ |

Then, if any sections were moved, follow with the changes table:

| Section | Was in | Moved to | Why |
| ------- | ------ | -------- | --- |

If nothing was misplaced, omit the changes table and end with a one-sentence statement that all sections are correctly placed.

After the placement audit, add a **Suggestions** section with up to three concrete improvements — content that is missing, could be more specific, or would make the file more useful. Things that are correct layer-wise but could be written better also qualify. Rank by impact. If there is nothing worth suggesting, omit the section.
