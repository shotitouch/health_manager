# UX Baseline — Health Manager

Defines the non-negotiable shell structure, layout, and states for the agentic frontend. All feature components must be built to this contract.

---

## App Shell Layout

```
┌──────────┬──────────────────────────┬──────────────────────────┐
│          │  Header strip            │                          │
│ Side nav ├──────────────────────────┤  Tool panel              │
│          │  Chat pane               │                          │
│ Dashboard│                          │  [Rendered component]    │
│ Food     │  User: ...               │                          │
│ Exercise │  Agent: ...              │                          │
│ Summary  │                          │                          │
│          │  [input bar]             │                          │
│ ──────── │                          │                          │
│ [avatar] │                          │                          │
└──────────┴──────────────────────────┴──────────────────────────┘
```

### Side nav

- Collapsible (icon-only when collapsed, icon + label when expanded)
- Links: Dashboard, Food, Exercise, Summary
- Clicking a link sends a pre-set message to the agent (e.g. "Show my dashboard") — it is a chat shortcut, not a router
- User avatar + logout button pinned to the bottom

### Header strip

- App name: "Health Manager"
- Current date (formatted, e.g. "Wednesday, 4 Jun 2026")
- No other controls

### Chat pane (left of tool panel)

- Scrollable conversation history
- Fixed input bar at the bottom (textarea + send button)
- Chat pane and tool panel share the remaining width after the side nav

### Tool panel (right of chat pane)

- Hidden/empty until the agent returns `feToolCalls`
- Renders only the **latest** `feToolCalls` result — not the full history
- Subtle header showing the active tool label (e.g. "Dashboard", "Log Food")
- If the agent responds with text only (no `feToolCalls`), the panel keeps showing the previous component

---

## Route Structure

```
/login       → LoginPage      (public)
/register    → RegisterPage   (public)
/            → AppShell       (PrivateRoute — redirects to /login if no token)
```

`AppShell` renders side nav + `AgentChat` + tool panel. No sub-routes — the LLM drives content within the shell.

---

## Auth Screens

Both screens are non-agentic — traditional forms, no side nav, no chat.

**`/login`**

- Full-screen centered card
- Fields: email, password
- Primary CTA: "Sign in"
- Link: "Don't have an account? Register"
- On success → redirect to `/`

**`/register`**

- Full-screen centered card
- Fields: name, email, password
- Primary CTA: "Create account"
- Link: "Already have an account? Sign in"
- On success → redirect to `/`

---

## States

| State               | Chat pane                                             | Tool panel                              |
| ------------------- | ----------------------------------------------------- | --------------------------------------- |
| **Initial (empty)** | Greeting + suggestion chips                           | Hidden (no component yet)               |
| **Loading**         | Typing indicator (3-dot animation) below last message | Previous component stays visible        |
| **Error**           | Inline error message in chat thread                   | Previous component stays visible        |
| **Text response**   | Agent message appended                                | No change                               |
| **Tool response**   | Agent message (if any) appended                       | Latest `feToolCalls` component rendered |

### Suggestion chips (initial empty state)

Shown below the greeting message before the user sends their first message:

- "Show my dashboard"
- "Log food"
- "Log exercise"
- "Show health summary"

Clicking a chip fires it as a user message and hides the chips.

---

## Component Panel Contract

Every component rendered in the tool panel receives:

```ts
{
  input: object;               // Exact `input` from the LLM tool_use block
  onResult?: (data: unknown) => void;  // Call to inject user data back into agent context
}
```

The panel wraps each component in a card with a tool-name header. Components are responsible only for their own content — not for the card chrome around them.
