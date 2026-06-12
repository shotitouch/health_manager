---
name: implement-feature
description: Full TDD delivery cycle for a new backend feature — plan, test, implement, review, done
argument-hint: feature-name
---

Run the full TDD cycle for a new backend feature. Each step gates the next — do not skip ahead.

> **Start a fresh Claude Code session before invoking this skill.** Feature implementation accumulates significant context (plan, tests, code, reviews). A dedicated session keeps the context clean and prevents interference with other work.

## Steps

### 1. Plan

Enter plan mode. Explore:

- `backend/src/features/<name>/` — what scaffolding already exists
- A sibling feature (`agent/`) — for patterns to follow (router, controller, service, Zod validation)
- `backend/CLAUDE.md` — API conventions and structure rules
- The feature's own `CLAUDE.md` if it exists

Define and get approval on:

- Route path and HTTP method
- Request body shape and required/optional fields
- Response shape (`{ data, message, error }`)
- Zod validation rules
- Service behavior and any external calls

Write the markdown plan file as normal GFM (headings + tables) with sections for Route, Request, Response, Validation, Service, Files. The HTML version required before `ExitPlanMode` (see root `CLAUDE.md` → HTML Review Docs) covers the same topics; its flow diagram is Router → Controller → Service [→ external].

---

### 2. Write tests

Create test files **before any implementation exists**:

- `backend/src/features/<name>/__tests__/<name>.controller.test.ts` — HTTP layer: valid body → 200, each required field missing → 400, service error → 500; assert responses match the planned `{ data, message, error }` shape
- `backend/src/features/<name>/__tests__/<name>.service.test.ts` — only if the service has branching logic worth testing independently; otherwise controller tests alone are sufficient

Mock the service in controller tests with `vi.mock('../<name>.service.js')`. Follow the patterns in `backend/src/features/agent/__tests__/` (class mock for SDK, `vi.hoisted` for shared mock functions, `beforeEach` resets).

Service stubs return empty/stub data (no DB layer yet) — test behaviour and error paths, not data content.

---

### 3. Confirm red

Run `/run-tests <name>`.

The report **must** show failures. Import errors (module not found) count as red — the test file references source files that don't exist yet.

If tests pass without implementation, the test contract is wrong — revisit step 2 before continuing.

---

### 4. Implement

Create the feature's router/controller/service files and register the router in `app.ts`, following `backend/CLAUDE.md` ("Adding a New Feature" + conventions: controller/service split, Zod boundary, error handling).

---

### 5. Confirm green

Run `/run-tests <name>`.

Must report `status: "pass"` with 0 failures. If not, fix the implementation and rerun. Do not proceed to review until this is green.

---

### 6. Code review

Run `/code-review`.

Apply all findings. If any code changes result, go to step 8.

---

### 7. Security review

Run `/security-review`.

Apply all Critical and High findings. If any code changes result, go to step 8.

---

### 8. Re-test and typecheck after fixes

Run `/run-tests <name>`, then `npm run typecheck` (from `backend/`).

Both must pass. If not, fix and repeat this step. Once green with no review findings outstanding, the feature is done.
