---
name: security-review
description: Audit tool registry integrity, JWT handling, and input validation for this project's agentic security model
argument-hint: '[<file-path>]'
---

Spawn the `security-auditor` agent to audit the pending changes on the current branch.

If `$ARGUMENTS` is provided, limit the audit scope to that file path only.

## Steps

1. Run `git diff main...HEAD` to get the changed files (or skip if a specific file was given)
2. For each file in scope, apply the agent's audit criteria — focus on what changed, not a full codebase scan
3. If a file in scope touches a security boundary (tool registry, ToolExecutor, agent service, auth middleware, any controller), also read the surrounding unchanged context to check for regressions

## Output format

Report findings grouped by severity:

- **Critical** — exploitable now (e.g. tool injected at runtime, refresh token in response body)
- **High** — likely exploitable with attacker control (e.g. raw `req.body` reaching service, missing auth middleware on a route)
- **Low** — defense-in-depth gaps (e.g. missing iteration cap, missing `console.warn` on unknown tool)

Each finding: **file path** → **specific risk** → **concrete fix**

If no findings, state that explicitly.
