import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestPost as recordDecision } from '../functions/api/decisions.js';
import { onRequestPost as recordRepair, onRequestGet as getRepairs } from '../functions/api/repairs.js';
import { onRequestPost as updateRepairStatus } from '../functions/api/repairs/[id]/status.js';
import { onRequestGet as getDashboard } from '../functions/api/dashboard.js';
import { onRequestPost as recheckSaas } from '../functions/api/recheck.js';

function fakeDb(rows = []) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) { calls.push({ sql, values }); return this; },
        async all() { return { results: rows }; },
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

test('Pages repair intake covers AdSense and websites with the deployment gate locked',async()=>{
  const db=fakeDb();
  const request=new Request('https://hub.test/api/repairs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({target:'mycalendartools',kind:'repair',summary:'Check new mobile layout regression',details:'Record a regression against the approved AdSense baseline without changing production.'})});
  const response=await recordRepair({request,env:{HUB_DB:db}});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.request.deploymentGate,'blocked-until-all-tests-pass');
  assert.match(db.calls[0].sql,/history_events/);
  const listing=await getRepairs({env:{HUB_DB:fakeDb([])}});
  assert.equal(listing.status,200);
  const listBody=await listing.json();
  assert.ok(listBody.managedProperties.some((item)=>item.id==='mycalctools'&&item.baselineApproved));
  assert.ok(listBody.managedProperties.some((item)=>item.id==='mystical-moments'));
  assert.ok(listBody.managedProperties.some((item)=>item.id==='adg-monitor'));
});

test('Pages repair listing overlays append-only status history',async()=>{
  const repair={target:'image-optimiser',kind:'repair',summary:'Verify background removal routing',details:'Retest the live processing path after the frontend repair.',status:'awaiting-branch-work',deploymentGate:'blocked-until-all-tests-pass'};
  const rows=[
    {event_id:'status-1',type:'repair-status-changed',recorded_at:'2026-09-09T08:00:00.000Z',payload_json:JSON.stringify({repairEventId:'repair-1',action:'retest',status:'retest-requested'})},
    {event_id:'repair-1',type:'repair-requested',recorded_at:'2026-09-09T07:00:00.000Z',payload_json:JSON.stringify(repair)}
  ];
  const response=await getRepairs({env:{HUB_DB:fakeDb(rows)}});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.requests[0].status,'retest-requested');
  assert.equal(body.requests[0].lastAction,'retest');
  assert.equal(body.requests[0].lastChangedAt,'2026-09-09T08:00:00.000Z');
});

test('Pages repair status actions preserve history and never execute production',async()=>{
  const repairRow={event_id:'repair-1',type:'repair-requested',recorded_at:'2026-09-09T07:00:00.000Z',payload_json:JSON.stringify({summary:'Verify background removal routing'})};
  const db=fakeDb([repairRow]);
  const response=await updateRepairStatus({request:new Request('https://hub.test/api/repairs/repair-1/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'already-fixed'})}),env:{HUB_DB:db},params:{id:'repair-1'}});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.status,'resolved-awaiting-retest');
  assert.match(db.calls.at(-1).sql,/INSERT INTO history_events/);
  assert.ok(db.calls.every((call)=>!/deploy|publish|delete/i.test(call.sql)));
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
