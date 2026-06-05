---
name: run-tests
description: Run the backend test suite and emit a structured JSON report the main agent can act on
argument-hint: feature-name
---

Run the backend Vitest suite, parse the JSON output, and emit a machine-readable report. Optionally filter to a single feature.

## Steps

### 1. Determine scope

If an argument was provided (e.g. `/run-tests agent`), the test pattern is:

```
src/features/<argument>
```

Otherwise run the full suite.

**TDD guard (feature runs only):** Before running, enforce both halves of the red-green cycle:

1. Check whether any `.test.ts` files exist under `backend/src/features/<argument>/__tests__/`. If none exist, print:

   ```
   ⚠ No tests found for '<argument>' — write backend/src/features/<argument>/__tests__/<argument>.test.ts first.
   TDD: tests must fail (red) before you implement.
   ```

   Then stop — do not run the suite.

2. If test files exist, run them now (the filtered command from Step 2). If all tests pass (`failed === 0`), print:

   ```
   ⚠ All tests for '<argument>' are currently passing.
   TDD: at least one test must be failing (red) before you implement.
   Add a failing test that captures the behaviour you are about to implement.
   ```

   Then stop — do not continue to Step 2.

### 2. Run the tests

```bash
cd backend && npm test 2>&1
```

For a filtered run:

```bash
cd backend && npx vitest run src/features/<argument> 2>&1
```

Vitest writes `backend/test-results.json` automatically (configured in `vitest.config.ts`).

### 3. Parse the report

Read `backend/test-results.json`. Map it to this canonical report shape:

```json
{
  "status": "pass" | "fail" | "error",
  "summary": {
    "total": <number>,
    "passed": <number>,
    "failed": <number>,
    "skipped": <number>
  },
  "duration_ms": <number>,
  "failures": [
    {
      "file": "<relative path>",
      "test": "<full test name>",
      "error": "<error message, first line only>"
    }
  ]
}
```

- `status` is `"pass"` if `failed === 0`, `"fail"` if `failed > 0`, `"error"` if the test runner itself crashed.
- `failures` is an empty array when all tests pass.
- `coverage` is **omitted entirely** unless `--coverage` was passed (see Step 6). Omitting the field (rather than setting it to `null`) lets consumers use a simple presence check.

### 4. Emit the report

If `status === "fail"`, spawn the `test-runner` agent (Step 5) before assembling the final response.

**Final response layout — always in this order:**

1. One-line summary:
   ```
   Test run complete — <passed>/<total> passed in <duration_ms>ms
   ```
2. Fenced JSON block (the canonical report shape from Step 3).
3. _(Only when failures exist)_ Plain-text list of failing tests for quick human scanning.
4. _(Only when `status === "fail"`)_ The `test-runner` agent's structured Markdown report.

### 5. On failure — invoke the test-runner agent

If `status === "fail"`, spawn the `test-runner` agent with the following prompt for each failing test file:

> Audit `<file>` against its source. The following tests are currently failing: <list>. Identify root cause and surface any coverage gaps.

Collect all agent reports and include them as region 4 of the final response (see Step 4).

### 6. Coverage (optional)

If the user passed `--coverage`, run:

```bash
cd backend && npm run test:coverage 2>&1
```

Read `backend/coverage/coverage-summary.json` and add the `coverage` field to the report:

```json
"coverage": {
  "lines": "<pct>%",
  "branches": "<pct>%",
  "functions": "<pct>%"
}
```

Omit this field entirely when `--coverage` was not passed.

## Report contract

The JSON report is designed to be consumed as a `tool_result` block by the main `runAgentLoop`. The main agent uses it to:

- Show the user a `display_message` with pass/fail summary
- Decide whether to invoke further tools (e.g. re-run after a fix)
- Surface gap recommendations from the test-runner agent audit
