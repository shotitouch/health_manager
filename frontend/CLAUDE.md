# CLAUDE.md — Frontend

## Setup

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Production build to dist/
npm run preview   # Serve production build locally
```

The frontend package.json is not yet initialized. When creating it, the expected stack is React + Vite + TypeScript + React Router + shadcn/ui + Tailwind CSS.

## Agentic UI Pattern

`AgentChat` sends the user message to `POST /api/v1/agent`. The response contains a `feToolCalls` array (e.g., `[{ name: "show_dashboard", input: { ... } }]`). The chat pane and the rendered component live side-by-side.

See `docs/ux-baseline.md` (repo root) for layout, shell, route structure, auth screens, and state definitions.

## Structure

```
src/
  features/
    agent/              # Core agentic shell (AgentChat, ToolExecutor, useAgent)
    profile/            # show_profile_form
    food/               # show_food_input, show_food_log
    exercise/           # show_exercise_input, show_exercise_log
    dashboard/          # show_dashboard
    summary/            # show_health_summary
    auth/               # Login / register
  shared/
    components/         # Generic UI only — shadcn/ui components live here
    hooks/              # useDebounce, useLocalStorage, etc.
    utils/              # Pure helpers
  App.tsx               # Route definitions
  main.tsx              # React root, providers
```

## Patterns

- Each feature exports its renderable component as default from its folder's `index.ts`.
- `ToolExecutor` imports from these barrels — it is the only file that knows the full component set.
- Feature components receive `input` props and an optional `onResult` callback — see Component Contract below.
- `shared/components/` must not import from any feature folder.
- All API calls live in a feature's `api.ts` file, not inside components.
- UI: shadcn/ui components (added via `npx shadcn@latest add <component>`) + Tailwind CSS for styling.

## Component Contract

Every component rendered by `ToolExecutor` receives:

```ts
{
  input: object;       // The exact `input` object from the LLM tool_use block
  onResult?: (data: unknown) => void; // Call to inject data back into agent context as a tool_result
}
```

`onResult` is optional — only wire it up if the component collects user data that the LLM needs to continue (e.g., a form submission). The agent loop will re-send the conversation with the tool result appended.

Call `onResult` only in response to a user action (e.g. form submit) — never in render or in a `useEffect` without a stable guard. Calling it unconditionally causes infinite agent re-invocations.

`useAgent()` must only be called in `AgentChat` — feature components must use `onResult` to communicate back, never call `useAgent()` directly.

## Auth

- JWT access token stored in `localStorage` under key `access_token`
- Every `api.ts` reads the token and sets `Authorization: Bearer <token>` on all requests
- Protected routes use a `<PrivateRoute>` wrapper in `App.tsx` that redirects to `/login` if no token
- Only the `auth` feature writes to `localStorage` — no other feature touches auth state
- A shared `http()` utility in `shared/utils/http.ts` handles token injection — all feature `api.ts` files call it instead of raw `fetch`
