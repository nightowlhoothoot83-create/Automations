import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { requiredPixels, planMasterArtwork, calculateProductionCredits, validateDeterministicMockup, validateDraftEligibility, buildPodHubRun } from '../src/pod-production.mjs';
const execFileAsync = promisify(execFile);

test('POD dimensions come from the selected provider product rather than DPI metadata', async () => {
  const fixtures = JSON.parse(await readFile('fixtures/pod/provider-capabilities.json', 'utf8'));
  const products = fixtures.providers.flatMap((provider) => provider.products);
  assert.deepEqual(requiredPixels(products.find((item) => item.id === 'shirt')), { width: 4500, height: 5400, targetDpi: 300 });
  const master = planMasterArtwork(products);
  assert.equal(master.width, 7200); assert.equal(master.height, 10800); assert.equal(master.outputs.length, 3);
});

test('unified POD credits reserve configured gross margin and reject invalid cost data', async () => {
  const contract = JSON.parse(await readFile('config/pod-production-contract.json', 'utf8'));
  const result = calculateProductionCredits([{ id: 'generation', usd: 0.06 }, { id: 'upscale', usd: 0.02 }, { id: 'storage', usd: 0.005 }], contract.creditMeter, contract.targetGrossMargin);
  assert.equal(result.totalExpectedCostUsd, 0.085); assert.equal(result.credits, 25);
  assert.throws(() => calculateProductionCredits([{ usd: -1 }], contract.creditMeter, contract.targetGrossMargin), /non-negative/);
});

test('mockup fidelity requires binary-identical artwork and deterministic placement evidence', () => {
  const evidence = { sourceArtworkSha256: 'abc', mockupArtworkSha256: 'abc', redrawn: false, restyled: false, templateId: 'shirt-front', placementBox: [0, 0, 100, 120], scale: 1, background: '#fff' };
  assert.equal(validateDeterministicMockup(evidence), evidence);
  assert.throws(() => validateDeterministicMockup({ ...evidence, mockupArtworkSha256: 'changed' }), /binary-identical/);
  assert.throws(() => validateDeterministicMockup({ ...evidence, redrawn: true }), /redrawn/);
});

test('complete POD draft evidence remains pending owner approval and can never auto-approve', async () => {
  const contract = JSON.parse(await readFile('config/pod-production-contract.json', 'utf8'));
  const complete = Object.fromEntries(contract.draftGate.requiredEvidence.map((key) => [key, 'evidence']));
  assert.deepEqual(validateDraftEligibility(complete, contract.draftGate.requiredEvidence), { eligible: false, status: 'pending-owner-approval', missing: [] });
  const blocked = validateDraftEligibility({ ...complete, 'provider-upload-acceptance': false }, contract.draftGate.requiredEvidence);
  assert.equal(blocked.status, 'blocked'); assert.deepEqual(blocked.missing, ['provider-upload-acceptance']);
});

test('POD preflight produces a versioned Management Hub run without auto-approval', async () => {
  const fixtures = JSON.parse(await readFile('fixtures/pod/provider-capabilities.json', 'utf8'));
  const products = fixtures.providers[0].products; const masterPlan = planMasterArtwork(products);
  const draftResult = { eligible: false, status: 'pending-owner-approval', missing: [] };
  const run = buildPodHubRun({ runId: 'pod-fixture-1', startedAt: '2026-08-25T00:00:00.000Z', finishedAt: '2026-08-25T00:00:01.000Z', products, masterPlan, creditPlan: { credits: 25 }, draftResult, evidence: { fixtureOnly: true } });
  assert.equal(run.schemaVersion, '1.0.0'); assert.equal(run.automationId, 'automation-6-pod-production'); assert.equal(run.status, 'pending-owner-approval');
  assert.equal(run.approval.required, true); assert.equal(run.approval.status, 'pending'); assert.equal(run.summary.selectedProducts.length, 2);
  assert.throws(() => buildPodHubRun({ runId: 'bad', startedAt: 'x', finishedAt: 'y', products, masterPlan, creditPlan: { credits: 1 }, draftResult: { status: 'approved', missing: [] } }), /cannot auto-approve/);
});

test('fixture-only POD preflight CLI emits blocked Hub evidence without network or credentials', async () => {
  const { stdout } = await execFileAsync(process.execPath, ['src/pod-preflight-cli.mjs'], { cwd: process.cwd() });
  const report = JSON.parse(stdout);
  assert.equal(report.status, 'blocked'); assert.equal(report.evidence.fixtureOnly, true);
  assert.equal(report.summary.masterWidthPx, 4500); assert.equal(report.summary.masterHeightPx, 5400);
  assert.ok(report.summary.estimatedCredits > 0); assert.equal(report.summary.missingEvidenceCount, 2);
  assert.equal(report.approval.status, 'pending');
});
