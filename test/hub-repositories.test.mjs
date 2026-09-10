import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryStatus } from '../functions/_github.js';

test('repository adapter covers the managed portfolio and distinguishes live/degraded provenance', async () => {
  const fetcher = async (url) => {
    if (url.includes('ascension-automation-hub')) return new Response('{}', { status: 404 });
    if (url.includes('/actions/runs')) return Response.json({ workflow_runs: [{ name: 'Checks', status: 'completed', conclusion: 'success', event: 'workflow_dispatch', head_branch: 'main', created_at: '2026-09-04T00:00:00Z', html_url: 'https://github.com/run' }] });
    return Response.json({ default_branch: url.includes('/Automations') ? 'codex/automation-6-infrastructure' : 'main', updated_at: '2026-09-04T00:00:00Z' });
  };
  const repositories = await repositoryStatus(undefined, fetcher);
  assert.equal(repositories.length,21);
  assert.equal(repositories[0].provenance,'degraded');
  assert.match(repositories[0].warning,/read-only token/i);
  assert.equal(repositories[1].provenance,'live');
  assert.equal(repositories[1].latestWorkflow.conclusion,'success');
  assert.equal(repositories[1].branchMatches,true);
  assert.ok(repositories.some((repo)=>repo.name==='Mycalctools'));
  assert.ok(repositories.some((repo)=>repo.name==='Raven-Sharp-POD-Automation'));
  assert.ok(repositories.some((repo)=>repo.name==='Natures-Sacred-Synergy'));
});
