import pixelmatch from 'pixelmatch'; import { PNG } from 'pngjs';

export function validateComparisonConfig(config) {
  if (config?.schemaVersion !== '1.0.0' || !Array.isArray(config.pages) || !Array.isArray(config.viewports)) throw new Error('Unsupported deployed/branch comparison config');
  const pageIds = new Set(); const viewportIds = new Set();
  if (!Number.isInteger(config.reviewBatchSize) || config.reviewBatchSize < 1 || config.reviewBatchSize > 25) throw new Error('reviewBatchSize must be between 1 and 25');
  for (const viewport of config.viewports) {
    if (!viewport.id || viewportIds.has(viewport.id) || !Number.isInteger(viewport.width) || !Number.isInteger(viewport.height)) throw new Error(`Invalid viewport: ${viewport.id}`); viewportIds.add(viewport.id);
  }
  for (const page of config.pages) {
    if (!page.id || pageIds.has(page.id)) throw new Error(`Invalid page id: ${page.id}`); pageIds.add(page.id);
    for (const key of ['productionUrl', 'branchPreviewUrl']) if (!['http:', 'https:'].includes(new URL(page[key]).protocol)) throw new Error(`${page.id}.${key} must use HTTP(S)`);
    if (page.approved !== true && config.enabled) throw new Error(`Page ${page.id} is not approved for live comparison`);
  }
  return config;
}

export function batchChanges(changes, size) {
  const batches = []; for (let index = 0; index < changes.length; index += size) batches.push({ batch: batches.length + 1, items: changes.slice(index, index + size) }); return batches;
}

export function extractPageStructure(document) {
  const text = document.body?.innerText?.replace(/\s+/g, ' ').trim() ?? '';
  const normalize = (value) => value?.replace(/\s+/g, ' ').trim() ?? '';
  const texts = (selector) => [...document.querySelectorAll(selector)].map((node) => normalize(node.textContent)).filter(Boolean);
  const internalLinks = [...document.querySelectorAll('a[href]')].map((node) => new URL(node.getAttribute('href'), document.location.href)).filter((url) => url.origin === document.location.origin).map((url) => url.pathname).filter((value, index, values) => values.indexOf(value) === index);
  return {
    title: document.title, headings: texts('h1,h2,h3'), wordCount: text ? text.split(/\s+/).length : 0,
    imageCount: document.querySelectorAll('img').length,
    faqCount: document.querySelectorAll('[class*="faq" i],[id*="faq" i],details').length,
    exampleCount: document.querySelectorAll('[class*="example" i],[id*="example" i]').length,
    useCaseCount: document.querySelectorAll('[class*="use-case" i],[id*="use-case" i]').length,
    informationalSectionCount: document.querySelectorAll('main section,article section').length,
    internalLinks, majorComponents: texts('header,main>section,article,footer').map((value) => value.slice(0, 160))
  };
}

export function compareStructures(production, branch) {
  const changed = {};
  for (const key of Object.keys(production)) if (JSON.stringify(production[key]) !== JSON.stringify(branch[key])) changed[key] = { production: production[key], branch: branch[key] };
  return changed;
}

export function comparePngBuffers(productionBuffer, branchBuffer, threshold = 0.1) {
  const production = PNG.sync.read(productionBuffer); const branch = PNG.sync.read(branchBuffer);
  const width = Math.max(production.width, branch.width); const height = Math.max(production.height, branch.height);
  const padded = (source) => { const target = new PNG({ width, height, fill: true }); PNG.bitblt(source, target, 0, 0, source.width, source.height, 0, 0); return target; };
  const left = padded(production); const right = padded(branch); const diff = new PNG({ width, height });
  const differentPixels = pixelmatch(left.data, right.data, diff.data, width, height, { threshold, includeAA: false });
  const sideBySide = new PNG({ width: width * 2, height }); PNG.bitblt(left, sideBySide, 0, 0, width, height, 0, 0); PNG.bitblt(right, sideBySide, 0, 0, width, height, width, 0);
  return { differentPixels, differenceRatio: differentPixels / (width * height), diff: PNG.sync.write(diff), sideBySide: PNG.sync.write(sideBySide), dimensions: { width, height } };
}
