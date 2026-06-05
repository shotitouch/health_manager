# CLAUDE.md — Agent Feature (Frontend)

The agentic shell — not a domain feature. Other features are rendered inside it by `ToolExecutor`; they don't run alongside it. Every user interaction starts here.

## Files

```
features/agent/
  AgentChat.tsx     # Input bar + conversation history; sends to POST /api/v1/agent
  ToolExecutor.tsx  # Receives feToolCalls array, maps each to a component and renders it
  useAgent.ts       # Conversation state, calls api.ts, exposes { messages, send, loading }
  api.ts            # fetch wrapper for POST /api/v1/agent
```

## ToolExecutor — TOOL_MAP

`TOOL_MAP` is the single authoritative mapping of tool name → React component. It is a plain static object — no dynamic imports or eval.

This snapshot will drift — the code is the source of truth.

```ts
const TOOL_MAP = {
  show_dashboard: Dashboard,
  show_profile_form: ProfileForm,
  show_food_input: FoodInput,
  show_food_log: FoodLog,
  show_exercise_input: ExerciseInput,
  show_exercise_log: ExerciseLog,
  show_health_summary: HealthSummary,
  display_message: MessageDisplay,
};
```

Unknown tool names are logged with `console.warn` and skipped — never throw or crash.

## Adding a New Tool

Use the `/add-fe-tool` skill — the string key in `TOOL_MAP` must exactly match the `name` field in `tool-registry.ts`.

## useAgent Hook

```ts
const { messages, send, loading } = useAgent();
// send(text: string) → appends user message, calls api.ts, updates messages with response
```

Conversation state lives in `useAgent` — `AgentChat` and `ToolExecutor` both read from it. Do not duplicate state in either component.
