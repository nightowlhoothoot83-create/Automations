import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { buildDashboard, recordDecision } from './model.mjs';
import { exportHistory, importHistory, retainHistory } from './history.mjs';
import { loadWorkerRunDetails } from './workers.mjs';

const root = resolve('src/hub/public');
const port = Number(process.env.HUB_PORT || 4175);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
function send(response, status, body, type = 'application/json; charset=utf-8') { response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); response.end(body); }
async function readBody(request) { let body=''; for await (const chunk of request) { body+=chunk; if(body.length>1_048_576) throw new Error('Request too large'); } return JSON.parse(body||'{}'); }

createServer(async (request, response) => {
  try {
    if (request.url === '/api/dashboard' && request.method === 'GET') return send(response, 200, JSON.stringify(await buildDashboard()));
    if (request.url === '/api/history/export' && request.method === 'GET') return send(response,200,JSON.stringify(await exportHistory(),null,2),'application/json; charset=utf-8');
    if (request.url === '/api/history/import' && request.method === 'POST') return send(response,200,JSON.stringify(await importHistory(await readBody(request))));
    if (request.url === '/api/history/retention' && request.method === 'POST') { const input=await readBody(request); return send(response,200,JSON.stringify(await retainHistory(input.keep ?? 500))); }
    const workerMatch = request.url.match(/^\/api\/workers\/([a-z0-9-]+)\/runs$/); if (workerMatch && request.method === 'GET') return send(response,200,JSON.stringify(await loadWorkerRunDetails(workerMatch[1])));
    if (request.url === '/api/decisions' && request.method === 'POST') {
      const input = await readBody(request); return send(response, 200, JSON.stringify(await recordDecision(input.id, input.decision)));
    }
    if (request.method !== 'GET') return send(response, 405, JSON.stringify({ error: 'Method not allowed' }));
    const requested = request.url === '/' ? 'index.html' : request.url.slice(1);
    if (requested.includes('..')) return send(response, 400, JSON.stringify({ error: 'Invalid path' }));
    const path = resolve(root, requested); if (!path.startsWith(root)) return send(response, 400, JSON.stringify({ error: 'Invalid path' }));
    return send(response, 200, await readFile(path), types[extname(path)] || 'application/octet-stream');
  } catch (error) { return send(response, error.code === 'ENOENT' ? 404 : 500, JSON.stringify({ error: error.message })); }
}).listen(port, '127.0.0.1', () => console.log(`Ascension Hub: http://127.0.0.1:${port}`));
