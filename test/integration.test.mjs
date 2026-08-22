import test from 'node:test'; import assert from 'node:assert/strict';
import { createServer } from 'node:http'; import { mkdtemp, readFile } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import path from 'node:path';
import { checkTarget, updateHubIndex } from '../src/core.mjs';

test('health, SEO and broken-link checks work against a local site', async (t) => {
  const server = createServer((request, response) => {
    if (request.url === '/missing') { response.writeHead(404).end(); return; }
    response.setHeader('content-type', 'text/html');
    response.end('<title>Local</title><meta content="A local site" name="description"><link href="/" rel="canonical"><a href="/missing">bad</a>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const { port } = server.address();
  const results = await checkTarget({ id: 'local', url: `http://127.0.0.1:${port}/`, checks: ['health', 'seo', 'links'] }, { timeoutMs: 2000, maxBodyBytes: 10000 });
  assert.deepEqual(results.map((item) => item.status), ['passed', 'passed', 'warning']);
  assert.equal(results[2].evidence.broken[0].statusCode, 404);
});

test('Management Hub index is atomically updated and deduplicated', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'automation-6-')); const now = new Date().toISOString();
  const report = { runId: 'run-1', status: 'passed', startedAt: now, finishedAt: now, summary: { passed: 1, warning: 0, failed: 0, skipped: 0 } };
  const indexPath = await updateHubIndex(root, report, '/runs/run-1/report.json'); await updateHubIndex(root, report, '/runs/run-1/report.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8')); assert.equal(index.runs.length, 1); assert.equal(index.latestRunId, 'run-1');
});
