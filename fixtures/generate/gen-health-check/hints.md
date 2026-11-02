## Hint 1

`createServer` from `node:http` takes a request handler. Look at `req.method` and `req.url`.

## Hint 2

Set the status and content type with `res.writeHead`, then send the body with `res.end(JSON.stringify(...))`.

## Hint 3

`if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ status: 'ok' })); }` then the same shape with 404.
