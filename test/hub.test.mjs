import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDashboard, recordDecision } from '../src/hub/model.mjs';

test('hub builds a safe demonstration dashboard without run artifacts', { concurrency:false }, async () => {
  const cwd = process.cwd(); const directory = await mkdtemp(join(tmpdir(), 'ascension-hub-'));
  try { process.chdir(directory); const dashboard = await buildDashboard(); assert.equal(dashboard.mode, 'demonstration'); assert.equal(dashboard.schemaVersion, '1.0.0'); assert.ok(dashboard.nextApproval); assert.equal(dashboard.nextTask, null); assert.ok(dashboard.overview.attention > 0); }
  finally { process.chdir(cwd); }
});

test('hub ingests Automation 6 report-v1 and preserves evidence', { concurrency:false }, async () => {
  const cwd = process.cwd(); const directory = await mkdtemp(join(tmpdir(), 'ascension-hub-'));
  try {
    process.chdir(directory); await mkdir('artifacts/hub', { recursive: true }); await mkdir('artifacts/runs/real', { recursive: true });
    const report = { schemaVersion:'1.0.0',runId:'real',startedAt:'2026-08-22T00:00:00.000Z',finishedAt:'2026-08-22T00:01:00.000Z',status:'failed',summary:{passed:0,warning:0,failed:1,skipped:0},results:[{id:'real-test',kind:'test',status:'failed',startedAt:'2026-08-22T00:00:00.000Z',durationMs:3,evidence:{exitCode:9}}],approvals:[],reviewPackage:{capturedAt:'2026-08-22T00:01:00.000Z',evidenceStatus:'failed',knownFailures:1,evidenceRefs:[{label:'Run evidence',url:'/#worker-evidence'}],provenance:'local-run',approvalRequested:false} };
    await writeFile('artifacts/runs/real/report.json', JSON.stringify(report)); await writeFile('artifacts/hub/runs-v1.json', JSON.stringify({schemaVersion:'1.0.0',updatedAt:report.finishedAt,latestRunId:'real',runs:[{runId:'real',reportPath:'artifacts/runs/real/report.json'}]}));
    const dashboard = await buildDashboard(); assert.equal(dashboard.mode, 'live'); assert.equal(dashboard.activity[0].evidence.exitCode, 9); assert.equal(dashboard.nextTask.id, 'real-test'); assert.equal(dashboard.runReviews[0].knownFailures,1);
  } finally { process.chdir(cwd); }
});

test('owner review blocks fixture approval and permits a local changes request', { concurrency:false }, async () => {
  const cwd = process.cwd(); const directory = await mkdtemp(join(tmpdir(), 'ascension-hub-review-'));
  try {
    process.chdir(directory); const dashboard = await buildDashboard();
    assert.equal(dashboard.nextApproval.approvalEligible, false);
    await assert.rejects(recordDecision(dashboard.nextApproval.id, 'approved'), /Approval blocked/);
    const result = await recordDecision(dashboard.nextApproval.id, 'changes-requested');
    assert.equal(result.decision, 'changes-requested');
  } finally { process.chdir(cwd); }
});

test('hub can read an Automation 6 index from another worktree', { concurrency:false }, async () => {
  const cwd = process.cwd(); const directory = await mkdtemp(join(tmpdir(), 'ascension-hub-index-')); const previous = process.env.HUB_RUN_INDEX_PATH;
  try {
    await mkdir(join(directory,'runs','linked'),{recursive:true});
    const report={schemaVersion:'1.0.0',runId:'linked',startedAt:'2026-08-22T00:00:00.000Z',finishedAt:'2026-08-22T00:01:00.000Z',status:'passed',summary:{passed:1,warning:0,failed:0,skipped:0},results:[],approvals:[]};
    const reportPath=join(directory,'runs','linked','report.json'); const index=join(directory,'runs-v1.json');
    await writeFile(reportPath,JSON.stringify(report)); await writeFile(index,JSON.stringify({schemaVersion:'1.0.0',latestRunId:'linked',runs:[{runId:'linked',reportPath}]}));
    process.env.HUB_RUN_INDEX_PATH=index; process.chdir(directory);
    assert.equal((await buildDashboard()).runs[0].id,'linked');
  } finally { process.chdir(cwd); if(previous===undefined)delete process.env.HUB_RUN_INDEX_PATH;else process.env.HUB_RUN_INDEX_PATH=previous; }
});
