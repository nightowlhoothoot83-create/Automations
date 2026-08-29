import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { planMasterArtwork, calculateProductionCredits, validateDraftEligibility, buildPodHubRun } from './pod-production.mjs';

const args = process.argv.slice(2);
const value = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const scenarioPath = value('--scenario', 'fixtures/pod/preflight-scenario.json');
const capabilitiesPath = value('--capabilities', 'fixtures/pod/provider-capabilities.json');
const contractPath = value('--contract', 'config/pod-production-contract.json');
const outputPath = value('--output', null);

const [scenario, capabilities, contract] = await Promise.all([scenarioPath, capabilitiesPath, contractPath].map(async (file) => JSON.parse(await readFile(file, 'utf8'))));
if (scenario.schemaVersion !== '1.0.0' || scenario.fixtureOnly !== true) throw new Error('POD preflight CLI accepts fixture-only scenarios');
if (capabilities.schemaVersion !== '1.0.0' || capabilities.fixtureOnly !== true) throw new Error('POD preflight CLI accepts fixture-only capabilities');
if (contract.mode !== 'branch-only-dry-run') throw new Error('POD production contract must remain branch-only dry-run');

const provider = capabilities.providers.find((item) => item.id === scenario.providerId);
if (!provider) throw new Error(`Unknown fixture provider: ${scenario.providerId}`);
const products = scenario.selections.map((selection) => {
  const product = provider.products.find((item) => item.id === selection.productId && item.variant === selection.variant);
  if (!product) throw new Error(`Unknown fixture product: ${selection.productId}:${selection.variant}`);
  return product;
});
const masterPlan = planMasterArtwork(products);
const creditPlan = calculateProductionCredits(scenario.expectedCosts, contract.creditMeter, contract.targetGrossMargin);
const draftResult = validateDraftEligibility(scenario.evidence, contract.draftGate.requiredEvidence);
const now = new Date().toISOString();
const report = buildPodHubRun({ runId: scenario.runId, startedAt: now, finishedAt: now, products, masterPlan, creditPlan, draftResult, evidence: { fixtureOnly: true, providerId: provider.id, capabilityVersion: provider.capabilityVersion, details: scenario.evidence } });
if (outputPath) { await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify(report, null, 2));
