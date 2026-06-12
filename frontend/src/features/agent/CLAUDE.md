# CLAUDE.md — Agent Feature (Frontend)

The agentic shell — not a domain feature. Other features are rendered inside it by `ToolExecutor`; they don't run alongside it. Every user interaction starts here.

## Files

Exists today:

```
features/agent/
  ToolExecutor.tsx      # Receives feToolCalls array, maps each to a component and renders it
  AskClarification.tsx  # ask_clarification tool component
  index.ts              # Barrel export
```

Planned (not yet written):

```
  AgentChat.tsx     # Input bar + conversation history; sends to POST /api/v1/agent
  useAgent.ts       # Conversation state, calls api.ts, exposes { messages, send, loading }
  api.ts            # fetch wrapper for POST /api/v1/agent
```

## ToolExecutor — TOOL_MAP

`TOOL_MAP` in `ToolExecutor.tsx` is the single authoritative mapping of tool name → React component (the code is the source of truth for its entries):

- Plain static object — no dynamic imports or eval
- Each string key must exactly match the `name` field in `tool-registry.ts`
- Unknown tool names are logged with `console.warn` and skipped — never throw or crash

## useAgent Hook (planned contract)

```ts
const { messages, send, loading } = useAgent();
// send(text: string) → appends user message, calls api.ts, updates messages with response
```

Conversation state lives in `useAgent` — `AgentChat` and `ToolExecutor` both read from it. Do not duplicate state in either component.
