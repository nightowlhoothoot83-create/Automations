import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateProviderCapabilities, planProviderPrepublication } from '../src/pod-providers.mjs';

const load = async () => JSON.parse(await readFile('config/pod-provider-capabilities.json', 'utf8'));

test('five-provider contract preserves real ingestion differences and explicit user selection', async () => {
  const contract = await load(); assert.equal(validateProviderCapabilities(contract), contract);
  assert.throws(() => planProviderPrepublication(contract), /Explicit provider selection/);
  assert.equal(contract.providers.length, 5);
  assert.equal(contract.providers.find((item) => item.id === 'printify').ingestionMechanism, 'direct-api-product-creation');
  assert.equal(contract.providers.find((item) => item.id === 'redbubble').ingestionMechanism, 'bulk-upload-or-import');
  assert.equal(contract.providers.find((item) => item.id === 'merch-by-amazon').ingestionMechanism, 'feed-or-export');
});

test('Gelato blocks without a real validated template and never confuses order drafts with products', async () => {
  const contract = await load();
  const blocked = planProviderPrepublication(contract, { providerId: 'gelato', availablePrerequisites: ['api-access', 'store-connection'] });
  assert.equal(blocked.status, 'blocked'); assert.ok(blocked.missingPrerequisites.includes('validated-existing-template-id')); assert.equal(blocked.publishAllowed, false);
  const ready = planProviderPrepublication(contract, { providerId: 'gelato', availablePrerequisites: ['api-access', 'store-connection', 'validated-existing-template-id', 'template-provenance'] });
  assert.equal(ready.status, 'ready-for-non-production-adapter-test'); assert.equal(ready.safePrepublicationState, 'non-visible-product'); assert.equal(ready.accountMutationAllowed, false);
});

test('unverified provider contracts remain blocked even when placeholder prerequisites are supplied', async () => {
  const contract = await load();
  for (const providerId of ['printful', 'redbubble', 'merch-by-amazon']) {
    const provider = contract.providers.find((item) => item.id === providerId);
    const plan = planProviderPrepublication(contract, { providerId, availablePrerequisites: provider.prerequisites });
    assert.equal(plan.status, 'blocked'); assert.equal(plan.requiresOfficialContractVerification, true); assert.equal(plan.publishAllowed, false);
  }
});
