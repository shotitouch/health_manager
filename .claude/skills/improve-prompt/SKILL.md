---
name: improve-prompt
description: Improve LLM prompt quality for a given contact point based on review findings
argument-hint: <feature-name>
---

Improve the prompts for the LLM contact point in $ARGUMENTS (default: `agent`).

Spawn the `prompt-engineer` subagent with the following task:

- Read `backend/src/features/$ARGUMENTS/CLAUDE.md` first — it defines what the LLM is supposed to do and is the ground truth for what good looks like.
- If a `/review-prompt` was just run, use those findings as the starting point. Otherwise run a review first before making changes.
- For each P0 and P1 finding, apply the fix directly to the source files (`tool-registry.ts`, `agent.service.ts`, or whichever files define the prompts).
- P2 findings: apply only if the fix is unambiguous. Otherwise list them for the user to decide.
- Do not change behavior, add tools, or restructure code — only edit prompt text, descriptions, and schema fields.
