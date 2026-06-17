# CLAUDE.md — Shared Ports

## What a port is

A port (`<feature>.port.ts`) is a **pure re-export** of an existing feature service's read
functions and types — zero new logic. It exists only so that another feature can call into a
feature's read logic without violating the root `CLAUDE.md` "never import across features" rule.

```ts
export type {
  FoodEntry,
  GetEntriesInput,
  GetEntriesResult,
} from '../../features/food/food.service.js';
export { getFoodEntries } from '../../features/food/food.service.js';
```

## Rules

- **Re-exports only — no logic.** Don't add computation, validation, or new types here. The
  `Map` store, business rules, and the functions themselves stay owned by the feature in
  `features/<feature>/<feature>.service.ts`. A function having 2+ consumers is not, by itself,
  grounds to move it into `shared/` — see the architecture.md addendum to "Never import across
  features" for the modular-monolith "shared kernel" reasoning.
- **One-way dependency.** `shared/ports/*` imports from `features/<feature>/*.service.ts`. The
  owning feature never imports its own port (no cycle). Consumers (e.g. `dashboard`, `summary`)
  import only from `shared/ports/*`, never directly from another feature.
- **Only add a port when 2+ features need it.** If only the owning feature uses a function, it
  doesn't need a port.
- **Naming**: `<feature>.port.ts`, one per feature that exposes read logic to others.

## Current ports

- `food.port.ts` — re-exports `getFoodEntries` (+ `FoodEntry`, `GetEntriesInput`,
  `GetEntriesResult`) from `features/food/food.service.ts`. Consumed by `dashboard` and `summary`.
- `exercise.port.ts` — re-exports `getExerciseEntries` (+ `ExerciseEntry`, `GetEntriesInput`,
  `GetEntriesResult`) from `features/exercise/exercise.service.ts`. Consumed by `dashboard` and
  `summary`.
- `profile.port.ts` — re-exports `getProfile` (+ `ProfileResult`) from
  `features/profile/profile.service.ts`. Consumed by `dashboard` and `summary`.
