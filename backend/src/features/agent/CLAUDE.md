# CLAUDE.md — Agent Feature (Backend)

The heart of the app. All user interactions flow through here.

## Route

`POST /api/v1/agent` — request: `{ messages, userId }`, response: `{ data: { messages, feToolCalls } }`

Request body (Zod-validated in controller):

- `messages` — `{ role: 'user' | 'assistant', content: string | object[] }[]`, min 1 item
- `userId` — non-empty string

## tool-registry.ts

Three exports — never add entries at runtime or from user input; `tool-registry.ts` is the only place tools are defined:

```ts
FE_TOOLS; // Anthropic.Tool[] — passed to LLM; instructs frontend to render a view
MCP_TOOLS; // Anthropic.Tool[] — passed to LLM; executed server-side (empty until Phase 6)
FE_TOOL_NAMES; // Set<string> — O(1) lookup used in the service loop to split FE vs MCP blocks
```

### FE Tools

Keep this table in sync with `FE_TOOLS` in `tool-registry.ts`.

| Tool name             | What it renders                  |
| --------------------- | -------------------------------- |
| `show_dashboard`      | Daily calorie/macro overview     |
| `show_profile_form`   | Onboarding / edit basic info     |
| `show_food_input`     | Log a food entry (text or image) |
| `show_food_log`       | History of food entries          |
| `show_exercise_input` | Log an exercise session          |
| `show_exercise_log`   | History of exercise entries      |
| `show_health_summary` | LLM-generated health narrative   |
| `display_message`     | Plain text/info message to user  |

## agent.service.ts — Loop Pattern

The system prompt is **static** — a module-level `TextBlockParam` with `cache_control: { type: 'ephemeral' }` (Anthropic prompt cache, 5-min TTL). No user health context is injected yet.

Current prompt text:

> You are a personal health assistant. Help the user track their nutrition, exercise, and overall health.
> Use the available tools to navigate the user to the appropriate view or display information.
> When the user wants to see their data, log food, log exercise, or view summaries, call the appropriate frontend tool.
> Always respond with a tool call — if nothing else fits, use display_message to reply in plain text.

```
1. Call Claude (claude-sonnet-4-6, max_tokens=4096) with system + messages + all tools
2. Append assistant response to message history
3. If stop_reason !== "tool_use" → break
4. Split tool_use blocks: FE (in FE_TOOL_NAMES) vs MCP (everything else)
5. Accumulate FE blocks into feToolCalls
6. If no MCP blocks → break (FE-only turn; nothing to resolve server-side)
7. Execute MCP blocks via executeMcpTool, append tool_result messages
8. Loop → step 1 (max 10 iterations, then hard 500 error)
```

FE tool calls are **not** executed server-side — collected across all loop iterations and returned as `feToolCalls`.

The Anthropic call includes `metadata: { user_id: userId }` for per-user cost tracking on the Anthropic dashboard.

## Security (current state)

- Request body validated with Zod in the controller (`messages` array, `userId` string)
- MCP argument validation and result sanitization: **planned for Phase 6** (see `executeMcpTool` stub)
- No rate limiting implemented yet

## Phase 6 — Adding MCP Tools

`executeMcpTool` currently throws 500 for any call. To wire up an MCP tool:

1. Add the `Anthropic.Tool` definition to `MCP_TOOLS` in `tool-registry.ts`
2. Add a Zod schema for its input arguments
3. Implement the handler branch in `executeMcpTool` (validate with Zod, call external source, return result)
