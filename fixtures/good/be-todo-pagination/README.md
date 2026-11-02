# Todos API: the missing item

**Ticket TODO-412, reported by support**

> A few customers say their todo list "skips stuff". One of them swears a todo they created shows up in the app sometimes and not other times, depending on how far they've scrolled. Can't reproduce on my account, it only has 4 todos. Can someone take a look?

The API lives in `starter/server.ts`. `createApp(todos)` returns a Node `http.Server` with:

- `GET /todos?limit=&offset=` returns `{ items, total }`. `limit` defaults to 10 and `offset` to 0.
- `POST /todos` with a JSON body `{ "title": string }` creates a todo and returns it with status 201. A missing or blank title gets a 400.

Find and fix the bug. Keep the API's shape as it is.
