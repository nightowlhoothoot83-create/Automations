import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises';
import { evaluateVisualMatrix, createBaselineApproval } from '../src/visual-gate.mjs';
const fixture = async (name) => JSON.parse(await readFile(`fixtures/visual/${name}.json`, 'utf8'));

test('passing test fixtures validate the mechanism but never permit a baseline approval', async () => {
  const matrix = await fixture('all-pass'); const evaluation = evaluateVisualMatrix(matrix);
  assert.equal(evaluation.verifiedPassCount, 2); assert.equal(evaluation.eligibleForBaselineApproval, false);
  assert.equal(evaluation.liveEvidenceCount, 0); assert.equal(createBaselineApproval(matrix, evaluation, 'fixture'), null);
});

test('complete live evidence can only create a pending approval, never update a baseline', async () => {
  const matrix = await fixture('all-pass'); matrix.evidenceClass = 'live-site';
  for (const page of matrix.pages) for (const item of page.items) item.capturedAt = '2026-08-22T00:00:00.000Z';
  const evaluation = evaluateVisualMatrix(matrix); assert.equal(evaluation.eligibleForBaselineApproval, true); assert.equal(evaluation.liveEvidenceCount, 2);
  assert.equal(createBaselineApproval(matrix, evaluation, 'simulated-live-evidence').status, 'pending');
});

test('live pass without captured evidence remains baseline-ineligible', async () => {
  const matrix = await fixture('all-pass'); matrix.evidenceClass = 'live-site';
  const evaluation = evaluateVisualMatrix(matrix); assert.equal(evaluation.eligibleForBaselineApproval, false); assert.equal(evaluation.liveEvidenceCount, 0);
});

test('known failure blocks baseline approval', async () => {
  const matrix = await fixture('known-failure'); const evaluation = evaluateVisualMatrix(matrix);
  assert.equal(evaluation.eligibleForBaselineApproval, false); assert.equal(evaluation.knownFailureCount, 1);
  assert.equal(createBaselineApproval(matrix, evaluation, 'fixture'), null);
});

test('baseline update switch cannot be enabled through matrix input', async () => {
  const matrix = await fixture('all-pass'); matrix.baselineUpdatesEnabled = true;
  assert.throws(() => evaluateVisualMatrix(matrix), /must remain disabled/);
});
