---
name: add-fe-tool
description: Scaffold a new FE tool across tool-registry, component, ToolExecutor TOOL_MAP, and barrel export
argument-hint: <tool-name>
---

Scaffold a new frontend tool for the health manager agent.

Tool name to add: $ARGUMENTS

Follow these steps in order:

1. **tool-registry.ts** — add a new entry to `FE_TOOLS` in `backend/src/features/agent/tool-registry.ts`:
   - `name`: the tool name from $ARGUMENTS
   - `description`: what this tool renders and when the LLM should call it
   - `input_schema`: JSON Schema for the props the component expects

2. **Component** — create the React component in the matching feature folder under `frontend/src/features/`:
   - Component receives `input` (the LLM tool call input) and optional `onResult` callback
   - Use placeholder UI for now if the feature isn't built yet

3. **ToolExecutor** — register the component in `frontend/src/features/agent/ToolExecutor.tsx` TOOL_MAP:
   - Key = tool name string, Value = the imported component

4. **Barrel export** — export the component from the feature's `index.ts`

After each step, confirm the change is consistent with the existing patterns in those files.
