import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createApp, type Todo } from '../src/server';

function makeTodos(count: number): Todo[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, title: `Todo ${i + 1}`, done: i % 3 === 0 }));
}

let server: Server;
let base: string;

beforeEach(async () => {
  server = createApp(makeTodos(25));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

async function getIds(query: string) {
  const res = await fetch(`${base}/todos${query}`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as { items: Todo[]; total: number };
  return { ids: body.items.map((todo) => todo.id), total: body.total };
}

it('returns a full first page with the default limit', async () => {
  const { ids, total } = await getIds('');
  expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(total).toBe(25);
});

it('returns every todo exactly once when paging through', async () => {
  const seen: number[] = [];
  for (let offset = 0; offset < 25; offset += 7) seen.push(...(await getIds(`?limit=7&offset=${offset}`)).ids);
  expect(seen).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
});

it('returns a short last page', async () => {
  expect((await getIds('?limit=10&offset=20')).ids).toEqual([21, 22, 23, 24, 25]);
});

it('creates a todo that then appears in the list', async () => {
  const res = await fetch(`${base}/todos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '  Water the plants ' }),
  });
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ id: 26, title: 'Water the plants', done: false });
  expect((await getIds('?limit=1&offset=25')).ids).toEqual([26]);
});

it('rejects a todo without a title', async () => {
  const res = await fetch(`${base}/todos`, { method: 'POST', body: JSON.stringify({ title: ' ' }) });
  expect(res.status).toBe(400);
});
