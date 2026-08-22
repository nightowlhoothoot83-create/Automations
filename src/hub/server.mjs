import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { buildDashboard, recordDecision } from './model.mjs';

const root = resolve('src/hub/public');
const port = Number(process.env.HUB_PORT || 4175);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
function send(response, status, body, type = 'application/json; charset=utf-8') { response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); response.end(body); }

createServer(async (request, response) => {
  try {
    if (request.url === '/api/dashboard' && request.method === 'GET') return send(response, 200, JSON.stringify(await buildDashboard()));
    if (request.url === '/api/decisions' && request.method === 'POST') {
      let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 16_384) throw new Error('Request too large'); }
      const input = JSON.parse(body); return send(response, 200, JSON.stringify(await recordDecision(input.id, input.decision)));
    }
    if (request.method !== 'GET') return send(response, 405, JSON.stringify({ error: 'Method not allowed' }));
    const requested = request.url === '/' ? 'index.html' : request.url.slice(1);
    if (requested.includes('..')) return send(response, 400, JSON.stringify({ error: 'Invalid path' }));
    const path = resolve(root, requested); if (!path.startsWith(root)) return send(response, 400, JSON.stringify({ error: 'Invalid path' }));
    return send(response, 200, await readFile(path), types[extname(path)] || 'application/octet-stream');
  } catch (error) { return send(response, error.code === 'ENOENT' ? 404 : 500, JSON.stringify({ error: error.message })); }
}).listen(port, '127.0.0.1', () => console.log(`Ascension Hub: http://127.0.0.1:${port}`));
