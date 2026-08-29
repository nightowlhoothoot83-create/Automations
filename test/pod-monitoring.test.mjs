import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluatePodPreflightMonitoring } from '../src/pod-monitoring.mjs';

const load = async (file) => JSON.parse(await readFile(file, 'utf8'));

test('current unchanged POD evidence remains pending owner approval rather than passing silently', async () => {
  const [policy, snapshot] = await Promise.all([load('config/pod-monitoring-policy.json'), load('fixtures/pod/monitoring-healthy.json')]);
  const result = evaluatePodPreflightMonitoring(snapshot, policy, Date.parse('2026-08-29T12:00:00.000Z'));
  assert.equal(result.status, 'pending-owner-approval'); assert.deepEqual(result.alerts, []); assert.equal(result.mode, 'read-only');
});

test('POD monitoring blocks stale evidence, capability changes, cost drift, credit drift, upload rejection and redrawn mockups', async () => {
  const [policy, snapshot] = await Promise.all([load('config/pod-monitoring-policy.json'), load('fixtures/pod/monitoring-blocked.json')]);
  const result = evaluatePodPreflightMonitoring(snapshot, policy, Date.parse('2026-08-29T12:00:00.000Z'));
  const ids = new Set(result.alerts.map((item) => item.id));
  for (const id of ['stale-or-invalid-evidence', 'provider-capability-changed', 'provider-cost-drift', 'credit-estimate-drift', 'provider-upload-not-accepted', 'mockup-artwork-identity-mismatch']) assert.ok(ids.has(id));
  assert.equal(result.status, 'blocked');
});
