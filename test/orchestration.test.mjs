import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises';

test('orchestration registry shares the production permission contract', async () => {
  const registry = JSON.parse(await readFile('config/orchestration.json', 'utf8'));
  const policy = JSON.parse(await readFile('config/permission-policy.json', 'utf8'));
  assert.deepEqual(registry.automations.map((item) => item.id), policy.appliesTo);
  assert.ok(policy.approvalRequired.includes('live-cloudflare-deployment'));
  assert.equal(registry.automations.find((item) => item.id === 'automation-6').enabled, true);
});
