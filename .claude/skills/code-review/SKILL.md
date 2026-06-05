---
name: code-review
description: Review code for correctness and maintainability using the code-reviewer agent
argument-hint: <file-path>
---

Spawn the `code-reviewer` agent to review $ARGUMENTS (or the current diff if no argument given).

## Procedure

1. If a file path is given, read that file; otherwise review the current diff
2. Apply the agent's lens across all review categories
3. Report all findings

## Output format

Every finding must include the file path, the problem, and a concrete fix.
