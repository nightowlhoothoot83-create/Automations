export function evaluateVisualMatrix(matrix, { now = Date.now() } = {}) {
  if (matrix?.schemaVersion !== '1.0.0' || !Array.isArray(matrix.pages)) throw new Error('Unsupported visual verification matrix');
  if (!['test-fixture', 'live-site'].includes(matrix.evidenceClass)) throw new Error('Visual matrix requires an explicit evidenceClass');
  if (!Number.isInteger(matrix.maxEvidenceAgeHours) || matrix.maxEvidenceAgeHours < 1 || matrix.maxEvidenceAgeHours > 168) throw new Error('Visual matrix requires maxEvidenceAgeHours between 1 and 168');
  if (matrix.baselineUpdatesEnabled !== false) throw new Error('Baseline updates must remain disabled in the verification matrix');
  const results = []; const ids = new Set();
  for (const page of matrix.pages) {
    if (!page.pageId || !page.url || !Array.isArray(page.items) || page.items.length === 0) throw new Error(`Invalid visual page: ${page?.pageId ?? 'missing'}`);
    for (const item of page.items) {
      const key = `${page.pageId}:${item.id}`; if (!item.id || ids.has(key)) throw new Error(`Missing or duplicate visual item: ${key}`); ids.add(key);
      for (const field of ['expectedApprovedState', 'actualState', 'result', 'screenshotReference', 'retestResult']) if (!item[field]) throw new Error(`${key} requires ${field}`);
      if (!['pass', 'fail'].includes(item.result) || !['pass', 'fail', 'not-run'].includes(item.retestResult)) throw new Error(`${key} has invalid result`);
      const knownFailure = item.result === 'fail' || item.retestResult === 'fail' || Boolean(item.issue);
      const captureTime = Date.parse(item.capturedAt); const evidenceAgeMs = now - captureTime;
      const currentEvidence = !Number.isNaN(captureTime) && evidenceAgeMs >= 0 && evidenceAgeMs <= matrix.maxEvidenceAgeHours * 3600000;
      const hasLiveEvidence = matrix.evidenceClass === 'live-site' && Boolean(item.screenshotReference) && currentEvidence;
      const verifiedPass = item.result === 'pass' && item.retestResult === 'pass' && !item.issue;
      results.push({ pageId: page.pageId, itemId: item.id, required: item.required, verifiedPass, knownFailure, hasLiveEvidence, currentEvidence });
    }
  }
  const required = results.filter((item) => item.required);
  const knownFailures = results.filter((item) => item.knownFailure);
  const liveEvidenceCount = required.filter((item) => item.hasLiveEvidence).length;
  const eligibleForBaselineApproval = matrix.evidenceClass === 'live-site' && required.length > 0 && required.every((item) => item.verifiedPass && item.hasLiveEvidence) && knownFailures.length === 0;
  return { evidenceClass: matrix.evidenceClass, eligibleForBaselineApproval, requiredCount: required.length, verifiedPassCount: required.filter((item) => item.verifiedPass).length, liveEvidenceCount, knownFailureCount: knownFailures.length, results };
}

export function createBaselineApproval(matrix, evaluation, sourcePath) {
  if (!evaluation.eligibleForBaselineApproval) return null;
  return {
    id: `visual-baseline-${matrix.pages.map((page) => page.pageId).join('-')}`,
    actionClass: 'visual-baseline-update', status: 'pending', risk: 'medium',
    action: 'Create or update the current visual baseline',
    reason: 'Every required visual item is a verified pass and no known visual failure remains.',
    evidence: { sourcePath, requiredCount: evaluation.requiredCount, verifiedPassCount: evaluation.verifiedPassCount }
  };
}
