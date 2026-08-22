import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'; import path from 'node:path';
import { validateComparisonConfig, extractPageStructure, compareStructures, comparePngBuffers, batchChanges } from './deployed-branch-compare.mjs';

const args = process.argv.slice(2); const configPath = args[args.indexOf('--config') + 1] || 'config/deployed-branch-comparison.example.json'; const capture = args.includes('--capture');
const config = validateComparisonConfig(JSON.parse(await readFile(configPath, 'utf8')));
if (!capture) { console.log(JSON.stringify({ mode: 'dry-run', enabled: config.enabled, pages: config.pages.map(({ id, approved }) => ({ id, approved })), viewports: config.viewports }, null, 2)); process.exit(0); }
if (!config.enabled) throw new Error('Comparison capture is disabled in config');
const { chromium } = await import('playwright'); const browser = await chromium.launch({ headless: true }); const runId = new Date().toISOString().replace(/[:.]/g, '-'); const runRoot = path.resolve(config.outputRoot, runId); await mkdir(runRoot, { recursive: true });
const changes = [];
try {
  for (const pageConfig of config.pages) for (const viewport of config.viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } }); const page = await context.newPage();
    await page.goto(pageConfig.productionUrl, { waitUntil: 'networkidle' }); const productionStructure = await page.evaluate(extractPageStructure); const productionPng = await page.screenshot({ fullPage: true });
    await page.goto(pageConfig.branchPreviewUrl, { waitUntil: 'networkidle' }); const branchStructure = await page.evaluate(extractPageStructure); const branchPng = await page.screenshot({ fullPage: true });
    const structureChanges = compareStructures(productionStructure, branchStructure); const pixels = comparePngBuffers(productionPng, branchPng, config.thresholds.pixelColorDelta);
    const changed = pixels.differenceRatio > config.thresholds.pixelDifferenceRatio || Object.keys(structureChanges).length > 0;
    if (changed) {
      const prefix = `${pageConfig.id}-${viewport.id}`; const sideBySide = path.join(runRoot, `${prefix}-side-by-side.png`); const overlay = path.join(runRoot, `${prefix}-diff.png`);
      await writeFile(sideBySide, pixels.sideBySide); await writeFile(overlay, pixels.diff);
      changes.push({ pageId: pageConfig.id, viewport, productionUrl: pageConfig.productionUrl, branchPreviewUrl: pageConfig.branchPreviewUrl, differenceRatio: pixels.differenceRatio, structureChanges, sideBySide, overlay });
    }
    await context.close();
  }
} finally { await browser.close(); }
const report = { schemaVersion: '1.0.0', runId, generatedAt: new Date().toISOString(), unchangedPagesSuppressed: true, reviewBatchSize: config.reviewBatchSize, batches: batchChanges(changes, config.reviewBatchSize) };
await writeFile(path.join(runRoot, 'changes-only-report.json'), `${JSON.stringify(report, null, 2)}\n`);
if (!changes.length) await rm(runRoot, { recursive: true });
console.log(JSON.stringify({ changedComparisons: changes.length, report: changes.length ? path.join(runRoot, 'changes-only-report.json') : null }, null, 2));
