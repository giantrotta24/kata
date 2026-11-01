import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

const DEFAULT_LIMIT = 10;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function toNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return value !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function createApp(seed: Todo[] = []) {
  const todos = [...seed];
  let nextId = todos.reduce((max, todo) => Math.max(max, todo.id), 0) + 1;

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/todos') {
      const limit = toNumber(url.searchParams.get('limit'), DEFAULT_LIMIT);
      const offset = toNumber(url.searchParams.get('offset'), 0);
      const items = todos.slice(offset, offset + limit);
      return sendJson(res, 200, { items, total: todos.length });
    }

    if (req.method === 'POST' && url.pathname === '/todos') {
      let body: unknown;
      try {
        body = await readJson(req);
      } catch {
        return sendJson(res, 400, { error: 'invalid JSON' });
      }
      const title = (body as { title?: unknown }).title;
      if (typeof title !== 'string' || title.trim() === '') {
        return sendJson(res, 400, { error: 'title is required' });
      }
      const todo: Todo = { id: nextId++, title: title.trim(), done: false };
      todos.push(todo);
      return sendJson(res, 201, todo);
    }

    sendJson(res, 404, { error: 'not found' });
  });
}
