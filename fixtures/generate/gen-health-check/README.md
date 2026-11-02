# Health check endpoint

In `starter/server.ts`, make `createApp()` return a Node `http.Server` that answers:

- `GET /health` with status 200 and the JSON body `{ "status": "ok" }`.
- Anything else with status 404 and `{ "error": "not found" }`.
