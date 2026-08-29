export function evaluatePodPreflightMonitoring(snapshot, policy, now = Date.now()) {
  if (policy?.schemaVersion !== '1.0.0' || policy.mode !== 'read-only') throw new Error('Unsupported POD monitoring policy');
  const alerts = [];
  const add = (id, severity, evidence) => alerts.push({ id, severity, status: 'open', evidence });
  for (const signal of policy.requiredSignals) if (snapshot?.[signal] === undefined || snapshot[signal] === null) add(`missing-${signal}`, 'blocking', { signal });
  if (snapshot?.evidenceCapturedAt) {
    const ageHours = (now - Date.parse(snapshot.evidenceCapturedAt)) / 3600000;
    if (!Number.isFinite(ageHours) || ageHours < 0 || ageHours > policy.thresholds.maximumEvidenceAgeHours) add('stale-or-invalid-evidence', 'blocking', { ageHours });
  } else add('missing-evidence-captured-at', 'blocking', {});
  if (snapshot?.providerCapabilityVersion !== snapshot?.acceptedProviderCapabilityVersion) add('provider-capability-changed', 'blocking', { current: snapshot?.providerCapabilityVersion, accepted: snapshot?.acceptedProviderCapabilityVersion });
  const costIncrease = percentageIncrease(snapshot?.baselineProviderCostUsd, snapshot?.estimatedProviderCostUsd);
  if (costIncrease > policy.thresholds.maximumCostIncreasePercent) add('provider-cost-drift', 'blocking', { increasePercent: costIncrease });
  const creditIncrease = percentageIncrease(snapshot?.baselineCredits, snapshot?.estimatedCredits);
  if (creditIncrease > policy.thresholds.maximumCreditEstimateIncreasePercent) add('credit-estimate-drift', 'blocking', { increasePercent: creditIncrease });
  if (snapshot?.providerUploadAcceptance !== true) add('provider-upload-not-accepted', 'blocking', {});
  if (!snapshot?.mockupSourceArtworkSha256 || snapshot.mockupSourceArtworkSha256 !== snapshot?.finalArtworkSha256) add('mockup-artwork-identity-mismatch', 'blocking', {});
  return { schemaVersion: '1.0.0', mode: 'read-only', status: alerts.some((item) => item.severity === 'blocking') ? 'blocked' : 'pending-owner-approval', alerts };
}

function percentageIncrease(baseline, current) {
  if (!(baseline > 0) || !(current >= 0)) return 0;
  return Number((((current - baseline) / baseline) * 100).toFixed(3));
}
