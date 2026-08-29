import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHubServer } from '../src/hub/server.mjs';

async function withServer(run){const server=createHubServer();server.listen(0,'127.0.0.1');await once(server,'listening');const {port}=server.address();try{await run(`http://127.0.0.1:${port}`);}finally{server.close();await once(server,'close');}}

test('hub serves static files with restrictive local security headers and query strings',async()=>withServer(async(base)=>{
  const response=await fetch(`${base}/?preview=1`);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(response.headers.get('x-frame-options'),'DENY');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(await response.text(),/Skip to dashboard/);
}));

test('hub returns actionable client errors without mutating state',async()=>withServer(async(base)=>{
  const malformed=await fetch(`${base}/api/history/import`,{method:'POST',headers:{'content-type':'application/json'},body:'{nope'});assert.equal(malformed.status,400);assert.deepEqual(await malformed.json(),{error:'Invalid JSON request body'});
  const invalidDecision=await fetch(`${base}/api/decisions`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'x',decision:'ship-it'})});assert.equal(invalidDecision.status,400);assert.deepEqual(await invalidDecision.json(),{error:'Invalid approval decision'});
  const method=await fetch(`${base}/styles.css`,{method:'POST'});assert.equal(method.status,405);
}));
