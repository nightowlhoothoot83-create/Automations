import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises';
import { evaluateVisualMatrix, createBaselineApproval } from '../src/visual-gate.mjs';
const fixture = async (name) => JSON.parse(await readFile(`fixtures/visual/${name}.json`, 'utf8'));

test('baseline approval is offered only when every required item passes and no failure remains', async () => {
  const matrix = await fixture('all-pass'); const evaluation = evaluateVisualMatrix(matrix);
  assert.equal(evaluation.eligibleForBaselineApproval, true); assert.equal(evaluation.knownFailureCount, 0);
  assert.equal(createBaselineApproval(matrix, evaluation, 'fixture').status, 'pending');
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
