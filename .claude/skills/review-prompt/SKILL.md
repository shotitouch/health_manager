---
name: review-prompt
description: Review LLM prompt quality for a given contact point — system prompt, tool descriptions, and input schemas
argument-hint: <feature-name>
---

Review the prompt quality for the LLM contact point in $ARGUMENTS (default: `agent`).

Spawn the `prompt-engineer` subagent with the following task:

- Read `backend/src/features/$ARGUMENTS/CLAUDE.md` first — it defines what the LLM is supposed to do and is the ground truth for judging gaps.
- Evaluate:
  - **System prompt** — does it explain the LLM's job and when to call a tool vs. respond in plain text? Is user context injected per-request (not static)?
  - **Tool descriptions** — does each description state what it renders AND the triggering user intent? Can the LLM distinguish similar tools?
  - **Input schemas** — are required fields marked? Are useful parameters absent that would let the LLM pass context it already has?
  - **Tool coverage** — is there a tool for every key user action? Is any tool being misused as a fallback for a missing one?
- Report each finding as: **location** → **LLM behavior it causes** → **concrete fix**
- Severity: **P0** wrong or no response | **P1** degrades quality | **P2** minor ambiguity
