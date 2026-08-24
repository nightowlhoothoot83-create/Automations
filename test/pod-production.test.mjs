import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requiredPixels, planMasterArtwork, calculateProductionCredits, validateDeterministicMockup, validateDraftEligibility } from '../src/pod-production.mjs';

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
