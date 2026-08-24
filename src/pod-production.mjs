export function requiredPixels(product) {
  for (const field of ['printWidthIn', 'printHeightIn', 'targetDpi']) if (!(Number(product?.[field]) > 0)) throw new Error(`Invalid product ${field}`);
  return {
    width: Math.ceil(product.printWidthIn * product.targetDpi),
    height: Math.ceil(product.printHeightIn * product.targetDpi),
    targetDpi: product.targetDpi
  };
}

export function planMasterArtwork(products) {
  if (!Array.isArray(products) || products.length === 0) throw new Error('At least one selected product is required');
  const requirements = products.map((product) => ({ product, pixels: requiredPixels(product) }));
  return {
    width: Math.max(...requirements.map(({ pixels }) => pixels.width)),
    height: Math.max(...requirements.map(({ pixels }) => pixels.height)),
    outputs: requirements.map(({ product, pixels }) => ({ id: `${product.id}:${product.variant}`, ...pixels }))
  };
}

export function calculateProductionCredits(costs, meter, targetGrossMargin) {
  if (!Array.isArray(costs) || costs.some((item) => !(Number(item.usd) >= 0))) throw new Error('Every cost must be a non-negative USD value');
  if (!(meter?.costUsdPerCredit > 0) || !(targetGrossMargin >= 0 && targetGrossMargin < 1)) throw new Error('Invalid credit economics');
  const totalExpectedCostUsd = costs.reduce((sum, item) => sum + item.usd, 0);
  const recoverableCostPerCredit = meter.costUsdPerCredit * (1 - targetGrossMargin);
  const credits = Math.max(meter.minimumCreditsPerOperation ?? 1, Math.ceil(totalExpectedCostUsd / recoverableCostPerCredit));
  return { totalExpectedCostUsd: Number(totalExpectedCostUsd.toFixed(6)), credits, recoverableCostPerCredit };
}

export function validateDeterministicMockup(evidence) {
  if (!evidence?.sourceArtworkSha256 || evidence.sourceArtworkSha256 !== evidence.mockupArtworkSha256) throw new Error('Mockup must use binary-identical final artwork');
  if (evidence.redrawn || evidence.restyled) throw new Error('Mockup artwork was redrawn or restyled');
  for (const key of ['templateId', 'placementBox', 'scale', 'background']) if (evidence[key] === undefined || evidence[key] === null) throw new Error(`Missing mockup evidence: ${key}`);
  return evidence;
}

export function validateDraftEligibility(evidence, requiredEvidence) {
  const missing = requiredEvidence.filter((key) => evidence?.[key] === undefined || evidence[key] === null || evidence[key] === false);
  if (missing.length) return { eligible: false, status: 'blocked', missing };
  return { eligible: false, status: 'pending-owner-approval', missing: [] };
}
