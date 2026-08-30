import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeApprovedHubDeploy, DEPLOY_CONFIRMATION } from '../src/hub/execution.mjs';
import { runHubRecheck } from '../src/hub/recheck.mjs';

async function withIsolatedHub(run) {
  const directory = await mkdtemp(join(tmpdir(), 'ascension-hub-safety-'));
  const previous = {
    cwd: process.cwd(),
    index: process.env.HUB_RUN_INDEX_PATH,
    history: process.env.HUB_HISTORY_PATH
  };
  const reportPath = join(directory, 'report.json');
  const indexPath = join(directory, 'runs-v1.json');
  const historyPath = join(directory, 'activity-v1.jsonl');
  process.chdir(directory);
  process.env.HUB_RUN_INDEX_PATH = indexPath;
  process.env.HUB_HISTORY_PATH = historyPath;
  try {
    await run({ directory, reportPath, indexPath, historyPath });
  } finally {
    process.chdir(previous.cwd);
    if (previous.index === undefined) delete process.env.HUB_RUN_INDEX_PATH;
    else process.env.HUB_RUN_INDEX_PATH = previous.index;
    if (previous.history === undefined) delete process.env.HUB_HISTORY_PATH;
    else process.env.HUB_HISTORY_PATH = previous.history;
    await rm(directory, { recursive:true, force:true });
  }
}

function passedRecheckReport(approvalId) {
  const capturedAt = '2026-08-30T01:00:00.000Z';
  return {
    schemaVersion:'1.0.0',
    runId:'safe-local-recheck',
    startedAt:'2026-08-30T00:59:00.000Z',
    finishedAt:capturedAt,
    status:'passed',
    summary:{ passed:2, warning:0, failed:0, skipped:0 },
    results:[],
    approvals:[{
      id:approvalId,
      action:'Approve Management Hub deployment handoff',
      reason:'Validated local recheck',
      risk:'medium',
      status:'pending',
      capturedAt,
      evidenceStatus:'passed',
      knownFailures:0,
      evidenceRefs:[{ label:'Local evidence', url:'/#activity' }]
    }],
    source:{ kind:'manual-local-recheck', target:'http://127.0.0.1:4175/' }
  };
}

async function installReport({ directory, reportPath, indexPath }, approvalId, decision) {
  await writeFile(reportPath, JSON.stringify(passedRecheckReport(approvalId)));
  await writeFile(indexPath, JSON.stringify({
    schemaVersion:'1.0.0',
    latestRunId:'safe-local-recheck',
    runs:[{ runId:'safe-local-recheck', reportPath }]
  }));
  if (decision) {
    await mkdir(join(directory, 'data', 'hub'), { recursive:true });
    await writeFile(join(directory, 'data', 'hub', 'decisions.json'), JSON.stringify({ [approvalId]:decision }));
  }
}

test('manual recheck rejects non-local origins before checks or artifact writes', { concurrency:false }, async () => {
  await withIsolatedHub(async ({ directory }) => {
    await assert.rejects(runHubRecheck('https://example.com'), /restricted to the local Hub/);
    await assert.rejects(readFile(join(directory, 'artifacts', 'hub', 'runs-v1.json')), { code:'ENOENT' });
  });
});

test('deployment runner is never called for invalid confirmation or missing owner approval', { concurrency:false }, async () => {
  await withIsolatedHub(async (paths) => {
    const approvalId = 'deploy-management-hub-safe-local-recheck';
    await installReport(paths, approvalId);
    let calls = 0;
    const runner = async () => { calls += 1; return { code:0, stage:'mock' }; };

    await assert.rejects(
      executeApprovedHubDeploy({ approvalId, confirmation:'yes' }, { runner }),
      /Second confirmation must exactly match/
    );
    await assert.rejects(
      executeApprovedHubDeploy({ approvalId, confirmation:DEPLOY_CONFIRMATION }, { runner }),
      /recorded owner approval/
    );
    assert.equal(calls, 0);
  });
});

test('approved execution uses injected runner once and blocks duplicate successful deploys', { concurrency:false }, async () => {
  await withIsolatedHub(async (paths) => {
    const approvalId = 'deploy-management-hub-safe-local-recheck';
    await installReport(paths, approvalId, 'approved');
    let calls = 0;
    const runner = async () => { calls += 1; return { code:0, stage:'mock-deploy' }; };

    const first = await executeApprovedHubDeploy({ approvalId, confirmation:DEPLOY_CONFIRMATION }, { runner });
    assert.equal(first.status, 'succeeded');
    assert.equal(first.approvalId, approvalId);
    assert.equal(calls, 1);

    await assert.rejects(
      executeApprovedHubDeploy({ approvalId, confirmation:DEPLOY_CONFIRMATION }, { runner }),
      /already executed successfully/
    );
    assert.equal(calls, 1);

    const history = (await readFile(paths.historyPath, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
    assert.deepEqual(history.map((event) => event.type), [
      'deployment-execution-started',
      'deployment-execution-succeeded'
    ]);
    assert.ok(history.every((event) => event.approvalId === approvalId));
  });
});
