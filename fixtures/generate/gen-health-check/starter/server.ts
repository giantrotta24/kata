import { createServer } from 'node:http';

export function createApp() {
  return createServer((_req, res) => {
    res.end();
  });
}
