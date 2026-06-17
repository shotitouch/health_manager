# Food Feature Decisions

> Original decisions dated 2026-06-05 unless noted otherwise.

## No `meal_type` field (breakfast/lunch/dinner/snack)

Removed from scope before implementation.

**Why:** user decision — simplifies the initial data model; can be added later without breaking anything.

---

## `logged_at` validated as ISO 8601 datetime (not free string)

Uses `z.string().datetime()` in the controller schema.

**Why:** the service date filter uses `.slice(0, 10) === date`; an arbitrary string like `"banana"` would silently never match any date, corrupting the log without any error.

---

## Date filter uses `.slice(0, 10) === date` not `.startsWith(date)`

**Why:** `startsWith` is fragile if a `logged_at` value has a non-UTC timezone offset (e.g. `+07:00`); slicing to exactly 10 characters is an exact comparison and survives format variations.

---

## `crypto.randomUUID()` for entry IDs, not a sequential counter

Replaced the initial `nextId++` stub after security review.

**Why:** sequential IDs create an IDOR precondition — a future `GET /food/entries/:id` endpoint that forgets to check `entry.userId === req.userId` would be trivially enumerable by incrementing the integer. UUIDs make enumeration infeasible.

---

## Max caps on all numeric nutrition fields

`calories: max 10000`, `protein_g / fat_g: max 1000`, `carbs_g: max 2000`.

**Why:** without `.max()`, `Number.MAX_VALUE` is valid input; aggregating entries with extreme values causes `total_calories` to overflow to `Infinity`, silently corrupting daily summaries.

---

## `validationError` helper stays duplicated per controller (not moved to `src/shared/`)

Code review flagged the duplication across auth, profile, food controllers.

**Why:** deferred — moving it would touch auth and profile which are already shipped; the duplication is three identical 2-line functions, not worth a cross-feature refactor in the same PR as the food implementation.

**Superseded (2026-06-10):** once dashboard added a 3rd fresh copy, it crossed CLAUDE.md's "shared if used by 2+ features" threshold — extracted to `backend/src/shared/utils/validation.ts` as `zodValidationError`, and food/exercise/dashboard controllers now import it. `auth`/`profile` controllers were not touched (out of scope, not revisited).
