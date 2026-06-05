---
name: review-claude-md
description: Validate that every section in a CLAUDE.md lives in the narrowest file whose entire audience needs it
argument-hint: <file-path>
---

Audit the scope placement of every section in $ARGUMENTS.

## Steps

1. Read the target file.
2. Read its parent CLAUDE.md (the layer above) and any child CLAUDE.md files directly below it.
3. For each section or named block of content in the target file, answer two questions:
   - **Who needs this?** Name the concrete audience — e.g. "anyone touching agent.service.ts", "all backend feature developers", "anyone on the repo."
   - **Is there a narrower file where that entire audience still gets it?** If yes, the content is misplaced — it should move down to that file.
   - **Is the audience broader than this file's scope?** If yes, the content should move up to the parent layer.
4. For each misplaced section, record: the section name, where it currently lives, where it should live, and why (one sentence).
5. Apply the moves: edit the target file to remove misplaced content, and add it to the correct file.

## Output format

Always report the assessment table first — one row per section:

| Section | Audience | Narrower file? | Broader than scope? |
| ------- | -------- | -------------- | ------------------- |

Then, if any sections were moved, follow with the changes table:

| Section | Was in | Moved to | Why |
| ------- | ------ | -------- | --- |

If nothing was misplaced, omit the changes table and end with a one-sentence statement that all sections are correctly placed.

After the placement audit, add a **Suggestions** section with up to three concrete improvements — content that is missing, could be more specific, or would make the file more useful to a developer working in that scope. Things that are correct scope-wise but could be written better also qualify. Rank by impact. If there is nothing worth suggesting, omit the section.
