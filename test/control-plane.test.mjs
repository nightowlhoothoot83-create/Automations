import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTOMATIONS, automationById, dispatchAutomation, nextRunAt } from '../functions/_automation-control.js';
import { requireOwner, requireScheduler } from '../functions/_owner-auth.js';

test('automation catalog keeps production-changing actions out of generic Run now', () => {
  assert.ok(AUTOMATIONS.some((item) => item.safeRun));
  assert.ok(AUTOMATIONS.filter((item) => item.gated).every((item) => item.safeRun === false));
  assert.equal(automationById('adg-worker-deploy').safeRun, false);
  assert.equal(automationById('site-contract-integrity').safeRun, true);
});

test('friendly schedule calculations are deterministic', () => {
  const from = new Date('2026-09-05T00:00:00.000Z');
  assert.equal(nextRunAt('6h', from), '2026-09-05T06:00:00.000Z');
  assert.equal(nextRunAt('daily', from), '2026-09-06T00:00:00.000Z');
  assert.equal(nextRunAt('weekly', from), '2026-09-12T00:00:00.000Z');
  assert.equal(nextRunAt('manual', from), null);
});

test('owner controls require configured authorization', () => {
  assert.throws(() => requireOwner(new Request('https://hub.test'), {}), /not configured/i);
  const keyRequest = new Request('https://hub.test', { headers: { 'x-ascension-owner-key': 'owl-key' } });
  assert.equal(requireOwner(keyRequest, { HUB_OWNER_CONTROL_KEY: 'owl-key' }), 'owner-key');
  const accessRequest = new Request('https://hub.test', { headers: { 'cf-access-authenticated-user-email': 'owner@example.test' } });
  assert.equal(requireOwner(accessRequest, { HUB_OWNER_EMAIL: 'OWNER@example.test' }), 'cloudflare-access');
});

test('scheduler requires the private bearer key', () => {
  assert.throws(() => requireScheduler(new Request('https://hub.test'), { HUB_SCHEDULER_KEY: 'secret' }), /authorization/i);
  const request = new Request('https://hub.test', { headers: { authorization: 'Bearer secret' } });
  assert.equal(requireScheduler(request, { HUB_SCHEDULER_KEY: 'secret' }), true);
});

test('generic dispatch refuses gated deployment actions before touching GitHub', async () => {
  await assert.rejects(() => dispatchAutomation(automationById('adg-worker-deploy'), 'token'), /gated review path/i);
});

test('safe dispatch uses workflow_dispatch with the configured ref', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => { captured = { url, options }; return new Response(null, { status: 204 }); };
  try {
    const result = await dispatchAutomation(automationById('site-contract-integrity'), 'token');
    assert.equal(result.requested, true);
    assert.match(captured.url, /site-contract-integrity\.yml\/dispatches$/);
    assert.equal(captured.options.method, 'POST');
    assert.equal(JSON.parse(captured.options.body).ref, 'main');
  } finally { globalThis.fetch = originalFetch; }
});
