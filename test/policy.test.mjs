import test from 'node:test'; import assert from 'node:assert/strict'; import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import path from 'node:path';
import { validateTargetSelection, validateSchedules, validateAutomationRecovery, validateIntegrationReconciliation, validateAdsenseProductionAuthority, validateSaasVerificationContract, planRetention, applyRetention, routeApproval } from '../src/policy.mjs';

test('discovered candidates cannot be silently selected', () => {
  const inventory = { schemaVersion: '1.0.0', targets: [{ id: 'candidate', selection: 'candidate' }, { id: 'approved', selection: 'approved' }] };
  assert.throws(() => validateTargetSelection(inventory, ['candidate']), /explicit approval/); assert.equal(validateTargetSelection(inventory, ['approved']).length, 1);
});

test('schedule manifest validates workers and target references', () => {
  const inventory = { targets: [{ id: 'x' }] }; const manifest = { schemaVersion: '1.0.0', schedules: [{ id: 's', cron: '0 * * * *', workerId: 'automation-6', targetSelectors: ['x'], mode: 'read-only' }] };
  assert.equal(validateSchedules(manifest, inventory, new Set(['automation-6'])), manifest);
});

test('POD monitoring schedule stays disabled and its local evidence has bounded retention', async () => {
  const schedules = JSON.parse(await readFile('config/schedules.json', 'utf8'));
  const pod = schedules.schedules.find((item) => item.id === 'pod-preflight-drift-template');
  assert.equal(pod.enabled, false); assert.equal(pod.mode, 'read-only'); assert.equal(pod.workerId, 'automation-6');
  const retention = JSON.parse(await readFile('config/retention-policy.json', 'utf8'));
  assert.equal(retention.artifacts.podPreflights.path, 'artifacts/pod-preflights'); assert.equal(retention.artifacts.podPreflights.maxAgeDays, 90); assert.equal(retention.deletionMode, 'local-generated-only');
});

test('Automation 2 stays frozen and unknown Automations 3 and 4 cannot be invented or activated', async () => {
  const recovery = JSON.parse(await readFile('config/automation-recovery.json', 'utf8'));
  assert.equal(validateAutomationRecovery(recovery), recovery);
  assert.equal(recovery.automations.find((item) => item.id === 'automation-2').status, 'production-authority-guarded');
  for (const id of ['automation-3', 'automation-4']) {
    const item = recovery.automations.find((candidate) => candidate.id === id);
    assert.equal(item.enabled, false); assert.equal(item.verifiedLocalBranch, null);
  }
  const unsafe = structuredClone(recovery); unsafe.automations.find((item) => item.id === 'automation-3').command = ['node', 'invented.mjs'];
  assert.throws(() => validateAutomationRecovery(unsafe), /cannot define execution details/);
});

test('current AdSense mains and hardened ADG monitor supersede stale Automation 2 repairs', async () => {
  const authority = JSON.parse(await readFile('config/adsense-production-authority.json', 'utf8'));
  assert.equal(validateAdsenseProductionAuthority(authority), authority);
  assert.equal(authority.baselineMutationAllowed, false);
  assert.equal(authority.sites.find((item) => item.id === 'wheelnamepicker').minimumKnownRepairCommit, 'e3e99b193223c402b86b871a9af1966b54927386');
  assert.equal(authority.monitor.minimumKnownFixCommit, 'bcbf694cd43eecad529751e1f378c9bbbc4476d6');
  const unsafe = structuredClone(authority); unsafe.baselineMutationAllowed = true;
  assert.throws(() => validateAdsenseProductionAuthority(unsafe), /must remain forbidden/);
});

test('integration reconciliation preserves live-vs-snapshot provenance and blocks the stale integrated branch', async () => {
  const reconciliation = JSON.parse(await readFile('config/integration-reconciliation.json', 'utf8'));
  assert.equal(validateIntegrationReconciliation(reconciliation), reconciliation);
  assert.equal(reconciliation.mergeEligible, false);
  assert.equal(reconciliation.sources.find((item) => item.id === 'automation-1').deterministicTests.passed, 4);
  const unsafe = structuredClone(reconciliation); unsafe.mergeEligible = true;
  assert.throws(() => validateIntegrationReconciliation(unsafe), /cannot silently authorize/);
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

test('six-product SaaS contract requires visual, functional, legal, backend and safe billing surfaces', async () => {
  const contract = JSON.parse(await readFile('config/saas-verification-contract.json', 'utf8'));
  assert.equal(validateSaasVerificationContract(contract).products.length, 6); assert.equal(contract.mode, 'read-only');
});

test('POD provider benchmark is disabled and uses matched blind analysis', async () => {
  const benchmark = JSON.parse(await readFile('config/pod-provider-ab-test.example.json', 'utf8'));
  assert.equal(benchmark.enabled, false); assert.equal(benchmark.providers.length, 2); assert.equal(benchmark.analysis.blindProviderLabels, true);
  assert.ok(benchmark.providers.some((provider) => provider.credentialEnv === 'FAL_KEY')); assert.equal(benchmark.ownerReviewPresentation.createSideBySideImage, true); assert.equal(benchmark.ownerReviewPresentation.showRawRunwareOutput, true); assert.equal(benchmark.ownerReviewPresentation.showRawFluxOutput, true); assert.match(benchmark.selectionRule, /owner review/);
  assert.equal(benchmark.promptStrategy.primary, 'trend-informed-original-concept'); assert.equal(benchmark.promptStrategy.includeEvergreenControl, true); assert.equal(benchmark.promptStrategy.rejectCopiedOrProtectedContent, true);
  assert.equal(benchmark.stageBenchmarks.length, 2); assert.equal(benchmark.providerSelection.selectPerStage, true); assert.equal(benchmark.providerSelection.allowDifferentProvidersForArtworkAndPreview, true);
  const preview = benchmark.stageBenchmarks.find((stage) => stage.id === 'product-preview-generation'); assert.match(preview.input, /binary-identical/); assert.equal(preview.preferredMethod, 'deterministic-provider-mockup-api-or-template-compositing'); assert.ok(preview.automaticFailure.includes('source-artwork-redrawn'));
});

test('POD trend intelligence is current, attributable and originality gated', async () => {
  const contract = JSON.parse(await readFile('config/saas-verification-contract.json', 'utf8'));
  assert.equal(contract.podTrendIntelligence.enabledByDefault, true); assert.equal(contract.podTrendIntelligence.firstGenerationChoice, 'trend-informed-original-concept');
  assert.ok(contract.podTrendIntelligence.requiredEvidence.includes('captured-at')); assert.ok(contract.podTrendIntelligence.rules.some((rule) => /protected/.test(rule)));
});

test('Image Optimiser protects large fine-art jobs with physical-size and cost preflight', async () => {
  const contract = JSON.parse(await readFile('config/saas-verification-contract.json', 'utf8')); const sizing = contract.imageOptimiserPrintSizing;
  const metre = sizing.referenceCases.find((item) => item.widthMm === 1000 && item.heightMm === 1000 && item.targetDpi === 300);
  assert.equal(metre.requiredWidthPx, 11811); assert.equal(metre.requiredHeightPx, 11811); assert.ok(metre.approxMegapixels > 139);
  assert.equal(sizing.defaultMode, 'estimate-and-preview-only'); assert.equal(sizing.productionExecution, 'approval-gated'); assert.ok(sizing.preflight.includes('estimated-provider-cost')); assert.ok(sizing.preflight.includes('tier-quota-impact'));
  const economics = contract.imageOptimiserUnitEconomics; assert.equal(economics.status, 'requires-tier-remediation-and-owner-review'); assert.equal(economics.verifiedProviderPricing.usdPerSuccessfulOutput, 0.002); assert.equal(economics.proposedMeter.unit, 'weighted-output-megapixel-credit'); assert.ok(economics.requiredAudit.includes('worst-case-usage'));
});
