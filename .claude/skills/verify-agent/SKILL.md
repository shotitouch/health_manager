---
name: verify-agent
description: Test POST /api/v1/agent and assert a valid feToolCalls response
---

Verify the agent endpoint is working correctly.

Run a test against `POST /api/v1/agent` and confirm the LLM returns a valid tool_use block.

Steps:

1. Check if the backend is running:

```
$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/health 2>&1)
```

If not running (connection refused or non-200), print "Backend not running — start it with /start-dev" and stop.

2. Send a test message:

```bash
curl -s -X POST http://localhost:3001/api/v1/agent \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "show me my dashboard"}], "userId": "test-user"}'
```

3. Assert the response contains:
   - A `feToolCalls` array with at least one item
   - The tool name is one of the registered FE tools (e.g. `show_dashboard`)

4. Print PASS or FAIL with the actual response for debugging.
