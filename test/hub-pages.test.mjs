import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestPost as recordDecision } from '../functions/api/decisions.js';
import { onRequestPost as recordRepair, onRequestGet as getRepairs } from '../functions/api/repairs.js';
import { onRequestGet as getDashboard } from '../functions/api/dashboard.js';
import { onRequestPost as recheckSaas } from '../functions/api/recheck.js';

function fakeDb(decisions = []) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) { calls.push({ sql, values }); return this; },
        async all() { return { results: decisions }; },
        async run() { return { meta: { changes: 1 } }; }
      };
    },
    async batch(statements) { assert.equal(statements.length, 2); return statements.map(() => ({ success: true })); }
  };
}

test('Pages dashboard requires D1 and preserves snapshot provenance', async () => {
  const missing = await getDashboard({ env: {} });
  assert.equal(missing.status, 503);
  const response = await getDashboard({ env: { HUB_DB: fakeDb() }, fetcher: async()=>{ throw new Error('offline'); } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.storage.mode, 'cloudflare-d1');
  assert.match(body.source, /fixture|configured|automation/i);
});

test('Pages decision endpoint validates input and writes decision plus history atomically', async () => {
  const invalid = await recordDecision({ request: new Request('https://hub.test/api/decisions', { method: 'POST', body: '{"decision":"approved"}' }), env: { HUB_DB: fakeDb() } });
  assert.equal(invalid.status, 400);
  const db = fakeDb();
  const response = await recordDecision({ request: new Request('https://hub.test/api/decisions', { method: 'POST', body: '{"id":"deploy-safe-fix","decision":"deferred"}' }), env: { HUB_DB: db } });
  assert.equal(response.status, 200);
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[0].sql, /ON CONFLICT/);
});

test('Pages repair intake records branch-only work with a locked deployment gate',async()=>{
  const db=fakeDb(); const request=new Request('https://hub.test/api/repairs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({target:'pod-suite',kind:'repair',summary:'Preserve artwork in previews',details:'Use the exact approved source artwork in every product mockup.'})});
  const response=await recordRepair({request,env:{HUB_DB:db}}); assert.equal(response.status,200); const body=await response.json(); assert.equal(body.request.deploymentGate,'blocked-until-all-tests-pass'); assert.match(db.calls[0].sql,/history_events/);
  const listing=await getRepairs({env:{HUB_DB:fakeDb([])}}); assert.equal(listing.status,200);
});

test('Pages recheck starts only a current reviewed SaaS target',async()=>{
  const calls=[];
  const fetcher=async(url,options={})=>{
    calls.push({url,options});
    if(url.endsWith('/report.json'))return Response.json({apps:[{id:'pod',name:'Raven Sharp POD',status:'review'}]});
    return new Response(null,{status:303,headers:{location:'/'}});
  };
  const response=await recheckSaas({fetcher});
  const body=await response.json();
  assert.equal(response.status,202);
  assert.equal(body.target,'pod');
  assert.match(calls[1].url,/\/run\?site=pod$/);
  assert.equal(calls[1].options.redirect,'manual');
});
