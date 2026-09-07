import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createHubServer } from '../src/hub/server.mjs';

async function withServer(run){const server=createHubServer();server.listen(0,'127.0.0.1');await once(server,'listening');const {port}=server.address();try{await run(`http://127.0.0.1:${port}`);}finally{server.close();await once(server,'close');}}

test('hub serves static files with restrictive local security headers and query strings',async()=>withServer(async(base)=>{const response=await fetch(`${base}/?preview=1`);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(response.headers.get('x-frame-options'),'DENY');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(await response.text(),/Skip to dashboard/);}));

test('hub returns actionable client errors without mutating state',async()=>withServer(async(base)=>{const malformed=await fetch(`${base}/api/history/import`,{method:'POST',headers:{'content-type':'application/json'},body:'{nope'});assert.equal(malformed.status,400);assert.deepEqual(await malformed.json(),{error:'Invalid JSON request body'});const invalidDecision=await fetch(`${base}/api/decisions`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'x',decision:'ship-it'})});assert.equal(invalidDecision.status,400);assert.deepEqual(await invalidDecision.json(),{error:'Invalid approval decision'});const method=await fetch(`${base}/styles.css`,{method:'POST'});assert.equal(method.status,405);}));

test('latest run UI labels pass rate and evidence provenance explicitly', async () => {const app = await readFile(new URL('../src/hub/public/app.js', import.meta.url), 'utf8');assert.match(app, /Pass rate/);assert.match(app, /run\.provenance/);assert.match(app, /passed \/ executed/);assert.doesNotMatch(app, /passed \+ run\.summary\.skipped/);});

test('manual recheck is prominent and restricted to the local Hub', async () => {const app = await readFile(new URL('../src/hub/public/app.js', import.meta.url), 'utf8');const page = await readFile(new URL('../src/hub/public/index.html', import.meta.url), 'utf8');assert.match(page, /id="recheck">Recheck now/);assert.match(app, /fetch\('\/api\/recheck'/);const response = await fetch('http://example.invalid/api/recheck', { method:'POST' }).catch(() => null);assert.equal(response, null);});

test('guarded repair requests cover SaaS, websites and AdSense without executing code',async()=>withServer(async(base)=>{
  const invalid=await fetch(`${base}/api/repairs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({target:'unknown-property',kind:'repair',summary:'Unknown property repair',details:'This target must not be accepted by the Hub.'})}); assert.equal(invalid.status,400);
  const response=await fetch(`${base}/api/repairs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({target:'mycalendartools',kind:'edit',summary:'Check a new visual regression',details:'Record the new issue against the approved AdSense baseline.'})}); assert.equal(response.status,200);
  const body=await response.json(); assert.equal(body.request.deploymentGate,'blocked-until-all-tests-pass');
  const list=await fetch(`${base}/api/repairs`).then((item)=>item.json()); assert.ok(list.managedProperties.some((item)=>item.id==='mycalctools'&&item.baselineApproved)); assert.ok(list.managedProperties.some((item)=>item.id==='mystical-moments')); assert.ok(list.managedProperties.some((item)=>item.id==='qa-agent'));
  const status=await fetch(`${base}/api/repairs/${body.eventId}/status`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'dismiss'})}); assert.equal(status.status,200); assert.equal((await status.json()).status,'dismissed');
  const after=await fetch(`${base}/api/repairs`).then((item)=>item.json()); const repair=after.requests.find((item)=>item.eventId===body.eventId); assert.equal(repair.status,'dismissed'); assert.equal(repair.lastAction,'dismiss');
}));

test('already-fixed and retest actions preserve repair history',async()=>withServer(async(base)=>{
  const created=await fetch(`${base}/api/repairs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({target:'image-optimiser',kind:'repair',summary:'Verify background removal routing',details:'Retest the live processing path after the frontend repair.'})}).then((item)=>item.json());
  const fixed=await fetch(`${base}/api/repairs/${created.eventId}/status`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'already-fixed'})}).then((item)=>item.json()); assert.equal(fixed.status,'resolved-awaiting-retest');
  const retest=await fetch(`${base}/api/repairs/${created.eventId}/status`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'retest'})}).then((item)=>item.json()); assert.equal(retest.status,'retest-requested');
  const list=await fetch(`${base}/api/repairs`).then((item)=>item.json()); const repair=list.requests.find((item)=>item.eventId===created.eventId); assert.equal(repair.status,'retest-requested'); assert.equal(repair.lastAction,'retest');
}));
