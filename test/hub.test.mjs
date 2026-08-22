import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDashboard } from '../src/hub/model.mjs';

test('hub builds a safe demonstration dashboard without run artifacts', async () => {
  const cwd = process.cwd(); const directory = await mkdtemp(join(tmpdir(), 'ascension-hub-'));
  try { process.chdir(directory); const dashboard = await buildDashboard(); assert.equal(dashboard.mode, 'demonstration'); assert.equal(dashboard.schemaVersion, '1.0.0'); assert.ok(dashboard.nextApproval); assert.ok(dashboard.nextTask); }
  finally { process.chdir(cwd); }
});

test('hub ingests Automation 6 report-v1 and preserves evidence', async () => {
  const cwd = process.cwd(); const directory = await mkdtemp(join(tmpdir(), 'ascension-hub-'));
  try {
    process.chdir(directory); await mkdir('artifacts/hub', { recursive: true }); await mkdir('artifacts/runs/real', { recursive: true });
    const report = { schemaVersion:'1.0.0',runId:'real',startedAt:'2026-08-22T00:00:00.000Z',finishedAt:'2026-08-22T00:01:00.000Z',status:'failed',summary:{passed:0,warning:0,failed:1,skipped:0},results:[{id:'real-test',kind:'test',status:'failed',startedAt:'2026-08-22T00:00:00.000Z',durationMs:3,evidence:{exitCode:9}}],approvals:[] };
    await writeFile('artifacts/runs/real/report.json', JSON.stringify(report)); await writeFile('artifacts/hub/runs-v1.json', JSON.stringify({schemaVersion:'1.0.0',updatedAt:report.finishedAt,latestRunId:'real',runs:[{runId:'real',reportPath:'artifacts/runs/real/report.json'}]}));
    const dashboard = await buildDashboard(); assert.equal(dashboard.mode, 'live'); assert.equal(dashboard.activity[0].evidence.exitCode, 9); assert.equal(dashboard.nextTask.id, 'real-test');
  } finally { process.chdir(cwd); }
});
