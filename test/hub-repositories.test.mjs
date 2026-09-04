import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryStatus } from '../functions/_github.js';

test('repository adapter distinguishes live and degraded GitHub provenance', async () => {
  const fetcher = async (url) => {
    if (url.includes('ascension-automation-hub')) return new Response('{}', { status: 404 });
    if (url.includes('/actions/runs')) return Response.json({ workflow_runs: [{ name: 'Checks', status: 'completed', conclusion: 'success', event: 'workflow_dispatch', head_branch: 'main', created_at: '2026-09-04T00:00:00Z', html_url: 'https://github.com/run' }] });
    return Response.json({ default_branch: 'main', updated_at: '2026-09-04T00:00:00Z' });
  };
  const repositories = await repositoryStatus(undefined, fetcher);
  assert.equal(repositories[0].provenance, 'degraded');
  assert.match(repositories[0].warning, /read-only token/i);
  assert.equal(repositories[1].provenance, 'live');
  assert.equal(repositories[1].latestWorkflow.conclusion, 'success');
});
