# CLAUDE.md — Agent Feature (Backend)

The heart of the app. All user interactions flow through here.

## Route

`POST /api/v1/agent` — protected by `authMiddleware`; request: `{ messages }`, response: `{ data: { messages, feToolCalls } }`

Request body (Zod-validated in controller):

- `messages` — `{ role: 'user' | 'assistant', content: string | object[] }[]`, min 1 item

`userId` is **not** read from the body — it comes from `req.userId`, set by `authMiddleware` from the verified JWT.

## tool-registry.ts

Four exports:

```ts
FE_TOOLS; // Anthropic.Tool[] — given to the Presenter; instructs frontend to render a view
MCP_TOOLS; // Anthropic.Tool[] — given to the Worker; executed server-side
FE_TOOL_NAMES; // Set<string> — not used by the 3-tier loop (each tier gets only its own tools); kept for tests/lookups
MCP_TOOL_NAMES; // Set<string> — same
```

Tool lists and descriptions live in `tool-registry.ts` — read them there.

## agent.service.ts — 3-Tier Pipeline

`runAgentLoop` = Router → (optional) Worker → Presenter. Each tier has its own static system prompt block with `cache_control: { type: 'ephemeral' }` (5-min TTL); no user health context is injected yet. Prompt texts live in `agent.service.ts`.

```
1. Router (Haiku, max_tokens=256): forced classify_intent tool call → { intent, hasImage, skipWorker }
   - Result Zod-validated; any malformed output falls back to { intent: 'conversation', skipWorker: false }
2. If skipWorker (pure navigation) → straight to Presenter
3. Worker (Sonnet, MCP_TOOLS only): loop — execute tool_use blocks via executeMcpTool,
   append tool_results, repeat until stop_reason !== 'tool_use' (max 10 iterations, then 500).
   Ends by appending the synthetic WORKER_TO_PRESENTER_HANDOFF user turn (API requires the
   conversation to end with a user message before the next call).
4. Presenter (Sonnet, FE_TOOLS only, tool_choice: 'any'): one call, must return ≥1 FE tool_use
   (else 500). FE calls are NOT executed server-side — returned as feToolCalls, plus synthetic
   tool_result acks so the returned history stays valid for the next turn.
```

Every Anthropic call includes `metadata: { user_id: userId }` for per-user cost tracking.

## MCP tool execution (`executeMcpTool`)

- Every tool's input is validated against its Zod schema in `McpInputSchemas` before execution — unknown tool → 500, invalid input → 400 (returned to the LLM as an `is_error` tool_result, not thrown to the user)
- `search_nutrition_usda` is live (USDA FoodData Central); results are sanitized — names stripped to printable ASCII and clamped to 200 chars to prevent prompt injection from external data
- `search_nutrition_thai` and `web_search` return "not yet integrated" notes; the user-data tools (`get_user_log`, `save_food_entry`, …) return stubs until the DB layer exists

## Security (current state)

- Route requires `authMiddleware`; `userId` comes from `req.userId` (verified JWT), never from the request body
- Request body validated with Zod in the controller (`messages` array); Router output and all MCP tool inputs also Zod-validated
- External (USDA) results sanitized before injection into LLM context
- No rate limiting implemented yet

## Adding an MCP Tool

1. Add the `Anthropic.Tool` definition to `MCP_TOOLS` in `tool-registry.ts`
2. Add its input Zod schema to `McpInputSchemas` in `agent.service.ts`
3. Add the handler case in `executeMcpTool` (call external source, sanitize, return result)
