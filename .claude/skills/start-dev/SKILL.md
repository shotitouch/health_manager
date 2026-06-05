---
name: start-dev
description: Start both the backend (port 3001) and frontend (port 5173) dev servers
---

Start both the frontend and backend development servers.

Current directory status:

```
$( Get-Location )
```

Steps:

1. Start the backend first: run `npm run dev` inside the `backend/` folder (port 3001)
2. Start the frontend: run `npm run dev` inside the `frontend/` folder (port 5173)
3. Run both as background processes so the terminal stays usable
4. Print the URLs when both are up:
   - Backend: http://localhost:3001
   - Frontend: http://localhost:5173

If node_modules is missing in either folder, run `npm install` there first before starting.
