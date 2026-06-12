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

2. `/agent` is protected by `authMiddleware`, which reads `req.userId` from a Bearer JWT — not from the request body. Get an access token first (the login stub accepts any well-formed credentials and returns a signed JWT):

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

Extract `data.accessToken` from the response and use it as `$TOKEN` below.

3. Send a test message, authenticated with the token (do **not** include `userId` in the body — it's ignored):

```bash
curl -s -X POST http://localhost:3001/api/v1/agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"messages": [{"role": "user", "content": "show me my dashboard"}]}'
```

4. Assert the response contains:
   - A `feToolCalls` array with at least one item
   - The tool name is one of the registered FE tools (e.g. `show_dashboard`)

5. Print PASS or FAIL with the actual response for debugging.
