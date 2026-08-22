import test from 'node:test'; import assert from 'node:assert/strict'; import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import path from 'node:path';
import { validateTargetSelection, validateSchedules, planRetention, applyRetention, routeApproval } from '../src/policy.mjs';

test('discovered candidates cannot be silently selected', () => {
  const inventory = { schemaVersion: '1.0.0', targets: [{ id: 'candidate', selection: 'candidate' }, { id: 'approved', selection: 'approved' }] };
  assert.throws(() => validateTargetSelection(inventory, ['candidate']), /explicit approval/); assert.equal(validateTargetSelection(inventory, ['approved']).length, 1);
});

test('schedule manifest validates workers and target references', () => {
  const inventory = { targets: [{ id: 'x' }] }; const manifest = { schemaVersion: '1.0.0', schedules: [{ id: 's', cron: '0 * * * *', workerId: 'automation-6', targetSelectors: ['x'], mode: 'read-only' }] };
  assert.equal(validateSchedules(manifest, inventory, new Set(['automation-6'])), manifest);
});

test('retention defaults to dry-run and is confined to artifact roots', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'retention-')); await mkdir(path.join(cwd, 'artifacts', 'runs'), { recursive: true }); await writeFile(path.join(cwd, 'artifacts', 'runs', 'old'), 'x');
  const policy = { deletionMode: 'local-generated-only', artifacts: { runs: { path: 'artifacts/runs', maxAgeDays: 0, maxItems: 0 } } };
  const actions = await planRetention(policy, cwd, Date.now() + 1000); assert.equal((await applyRetention(actions)).mode, 'dry-run'); assert.equal(actions.length, 1);
  await assert.rejects(() => planRetention({ deletionMode: 'local-generated-only', artifacts: { bad: { path: '../outside', maxAgeDays: 1, maxItems: 1 } } }, cwd), /Unsafe/);
});

test('production approval items route to local Hub storage', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'approvals-')); const routes = { routes: [{ destination: 'artifacts/hub/approvals-v1.json', actionClasses: ['live-cloudflare-deployment'] }] };
  const item = { id: 'approval-1', actionClass: 'live-cloudflare-deployment', status: 'pending' }; const destination = await routeApproval(item, routes, cwd);
  assert.equal(JSON.parse(await readFile(destination, 'utf8')).items[0].id, 'approval-1');
});
