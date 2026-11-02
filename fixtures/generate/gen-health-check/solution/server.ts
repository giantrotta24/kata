import { createServer } from 'node:http';

export function createApp() {
  return createServer((req, res) => {
    const found = req.method === 'GET' && req.url === '/health';
    res.writeHead(found ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify(found ? { status: 'ok' } : { error: 'not found' }));
  });
}
