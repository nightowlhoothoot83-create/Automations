import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildDashboard, recordDecision } from './model.mjs';
import { exportHistory, importHistory, retainHistory } from './history.mjs';
import { loadWorkerRunDetails } from './workers.mjs';

const root = resolve('src/hub/public');
const port = Number(process.env.HUB_PORT || 4175);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const securityHeaders = { 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'", 'referrer-policy':'no-referrer', 'x-frame-options':'DENY', 'permissions-policy':'camera=(), microphone=(), geolocation=()' };
function send(response, status, body, type = 'application/json; charset=utf-8') { response.writeHead(status, { ...securityHeaders, 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); response.end(body); }
async function readBody(request) { let body=''; for await (const chunk of request) { body+=chunk; if(body.length>1_048_576) { const error=new Error('Request too large'); error.statusCode=413; throw error; } } try{return JSON.parse(body||'{}');}catch{const error=new Error('Invalid JSON request body');error.statusCode=400;throw error;} }

export async function handleRequest(request,response){
  try {
    const url=new URL(request.url,'http://127.0.0.1'); const pathname=url.pathname;
    if (pathname === '/api/dashboard' && request.method === 'GET') return send(response, 200, JSON.stringify(await buildDashboard()));
    if (pathname === '/api/history/export' && request.method === 'GET') return send(response,200,JSON.stringify(await exportHistory(),null,2),'application/json; charset=utf-8');
    if (pathname === '/api/history/import' && request.method === 'POST') return send(response,200,JSON.stringify(await importHistory(await readBody(request))));
    if (pathname === '/api/history/retention' && request.method === 'POST') { const input=await readBody(request); return send(response,200,JSON.stringify(await retainHistory(input.keep ?? 500))); }
    const workerMatch = pathname.match(/^\/api\/workers\/([a-z0-9-]+)\/runs$/); if (workerMatch && request.method === 'GET') return send(response,200,JSON.stringify(await loadWorkerRunDetails(workerMatch[1])));
    if (pathname === '/api/decisions' && request.method === 'POST') {
      const input = await readBody(request); return send(response, 200, JSON.stringify(await recordDecision(input.id, input.decision)));
    }
    if (request.method !== 'GET') return send(response, 405, JSON.stringify({ error: 'Method not allowed' }));
    const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    if (requested.includes('..')) return send(response, 400, JSON.stringify({ error: 'Invalid path' }));
    const path = resolve(root, requested); if (!path.startsWith(root)) return send(response, 400, JSON.stringify({ error: 'Invalid path' }));
    return send(response, 200, await readFile(path), types[extname(path)] || 'application/octet-stream');
  } catch (error) { const clientError=/^(Invalid|Unsupported|Retention)/.test(error.message); const status=error.statusCode||((error instanceof URIError||error instanceof SyntaxError||clientError)?400:error.code==='ENOENT'?404:500); return send(response,status,JSON.stringify({error:status===500?'Internal hub error':error.message})); }
}
export function createHubServer(){return createServer(handleRequest);}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)createHubServer().listen(port,'127.0.0.1',()=>console.log(`Ascension Hub: http://127.0.0.1:${port}`));
