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

## File layout

- `agent.service.ts` — thin orchestrator: `runAgentLoop` (Router → Worker → Presenter) + `AgentResult` type. No LLM calls directly — delegates to the tier modules.
- `agent-runtime.ts` — shared LLM infrastructure: Anthropic client, model/token constants, `mapContentBlock` helper. Leaf module (imports only the SDK).
- `intent-router.ts` — Router tier: `classify_intent` tool schema, `RouterResult` type + Zod validation, `runRouter`, `routingContextTurn`.
- `worker-loop.ts` — Worker tier: `runWorkerLoop` — MCP tool loop with iteration cap and stop-reason guard.
- `presenter-loop.ts` — Presenter tier: `runPresenterLoop` — single FE-tool call with tool_result acks.
- `prompts.ts` — the three static system-prompt blocks (`ROUTER_/WORKER_/PRESENTER_PROMPT_BLOCK`) + `WORKER_TO_PRESENTER_HANDOFF`.
- `mcp-executor.ts` — `executeMcpTool` + the private `McpInputSchemas` (MCP input validation + external integrations).
- `tool-registry.ts` — the master FE/MCP tool lists.

## 3-Tier Pipeline

`runAgentLoop` (in `agent.service.ts`) = Router → (optional) Worker → Presenter. Each tier lives in its own module and has its own static system prompt block with `cache_control: { type: 'ephemeral' }` (5-min TTL); no user health context is injected yet. Prompt texts live in `prompts.ts`.

```
1. Router (Haiku, max_tokens=256): forced classify_intent tool call → { intentSummary, domains[], hasImage }
   - Result Zod-validated (snake_case input → camelCase); malformed/missing output falls back to { intentSummary: '', domains: ['general'], hasImage: false }
   - intentSummary + domains are injected into the Worker AND Presenter as a trailing <routing_context> user turn (routingContextTurn) — message stream, not the cached system prompt
2. skipWorker is DERIVED: domains === ['navigation'] only. Pure navigation → straight to Presenter; everything else (incl. general Q&A) runs the Worker
3. Worker (Sonnet, MCP_TOOLS only): loop — execute tool_use blocks via executeMcpTool,
   append tool_results, repeat until stop_reason !== 'tool_use' (max 10 iterations, then 500).
   A non-end_turn terminal stop_reason (max_tokens/refusal) throws 502 — only a clean end_turn turn reaches the Presenter.
   Ends by appending the synthetic WORKER_TO_PRESENTER_HANDOFF user turn (API requires the
   conversation to end with a user message before the next call).
4. Presenter (Sonnet, FE_TOOLS only, tool_choice: 'any'): one call, must return ≥1 FE tool_use
   (else 500). FE calls are NOT executed server-side — returned as feToolCalls, plus synthetic
   tool_result acks so the returned history stays valid for the next turn.
   NOTE: Presenter receives only [original messages + Worker's final text synthesis + HANDOFF] —
   intermediate tool_use/tool_result turns from the Worker loop are stripped before handoff.
```

Every Anthropic call includes `metadata: { user_id: userId }` for per-user cost tracking.

## MCP tool execution (`executeMcpTool`, in `mcp-executor.ts`)

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
2. Add its input Zod schema to `McpInputSchemas` in `mcp-executor.ts`
3. Add the handler case in `executeMcpTool` (call external source, sanitize, return result)
