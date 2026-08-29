export function validateProviderCapabilities(contract) {
  if (contract?.schemaVersion !== '1.0.0' || contract.mode !== 'local-contract-only' || contract.selectionRule !== 'explicit-user-selection-required') throw new Error('Unsupported POD provider contract');
  const ids = new Set();
  for (const provider of contract.providers ?? []) {
    if (!provider.id || ids.has(provider.id)) throw new Error(`Invalid provider: ${provider.id}`); ids.add(provider.id);
    if (!provider.ingestionMechanism || !Array.isArray(provider.prerequisites) || !provider.evidenceClass || !provider.activationStatus) throw new Error(`Incomplete provider: ${provider.id}`);
  }
  for (const id of ['printify', 'gelato', 'printful', 'redbubble', 'merch-by-amazon']) if (!ids.has(id)) throw new Error(`Missing provider: ${id}`);
  const gelato = contract.providers.find((item) => item.id === 'gelato');
  if (gelato.directFromArtwork !== 'no' || gelato.existingProductTemplateRequired !== true || !gelato.prerequisites.includes('validated-existing-template-id') || gelato.draftOrderIsNotProductDraft !== true) throw new Error('Gelato template contract is incomplete');
  for (const rule of ['Never silently select or hard-code a provider', 'Never fake a common capability that a provider does not offer', 'Safe product creation and publishing are separate operations']) if (!contract.rules.includes(rule)) throw new Error(`Missing provider safety rule: ${rule}`);
  return contract;
}

export function planProviderPrepublication(contract, { providerId, availablePrerequisites = [] } = {}) {
  validateProviderCapabilities(contract);
  if (!providerId) throw new Error('Explicit provider selection is required');
  const provider = contract.providers.find((item) => item.id === providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  const available = new Set(availablePrerequisites); const missing = provider.prerequisites.filter((item) => !available.has(item));
  const contractBlocked = provider.activationStatus.startsWith('blocked-until');
  return {
    providerId,
    ingestionMechanism: provider.ingestionMechanism,
    safePrepublicationState: provider.safePrepublicationState,
    status: missing.length || contractBlocked ? 'blocked' : 'ready-for-non-production-adapter-test',
    missingPrerequisites: missing,
    requiresOfficialContractVerification: contractBlocked,
    publishAllowed: false,
    accountMutationAllowed: false
  };
}
