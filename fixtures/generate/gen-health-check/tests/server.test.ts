import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createApp } from '../src/server';

let server: Server;
let base: string;

beforeEach(async () => {
  server = createApp();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

it('reports ok on GET /health', async () => {
  const res = await fetch(`${base}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});

it('answers 404 elsewhere', async () => {
  const res = await fetch(`${base}/nope`);
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'not found' });
});
