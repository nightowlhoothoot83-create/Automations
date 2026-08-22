import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendHistory, readHistory, exportHistory, importHistory, retainHistory } from '../src/hub/history.mjs';
import { loadWorkerReports, loadWorkerRunDetails } from '../src/hub/workers.mjs';

test('append-only local history remains reviewable and skips corrupt lines', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hub-history-')); process.env.HUB_HISTORY_PATH = join(directory, 'activity.jsonl');
  try {
    const saved = await appendHistory({ type:'approval-decision',title:'Approval approved: one',approvalId:'one',decision:'approved',actor:'local-owner',provenance:'local' });
    await writeFile(process.env.HUB_HISTORY_PATH, `${JSON.stringify(saved)}\nnot-json\n`);
    const result = await readHistory(); assert.equal(result.events[0].approvalId, 'one'); assert.equal(result.warnings.length, 1); assert.match(result.warnings[0], /line 2/i);
  } finally { delete process.env.HUB_HISTORY_PATH; }
});

test('worker registry ingests report-v1 fixtures and degrades missing live indexes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hub-workers-')); await mkdir(join(directory,'fixtures'));
  const reportPath = join(directory,'fixtures','report.json'); const configPath = join(directory,'workers.json');
  const report = {schemaVersion:'1.0.0',runId:'a2',startedAt:'2026-08-22T00:00:00.000Z',finishedAt:'2026-08-22T00:01:00.000Z',status:'passed',summary:{passed:1,warning:0,failed:0,skipped:0},results:[],approvals:[]};
  await writeFile(reportPath,JSON.stringify(report)); await writeFile(configPath,JSON.stringify({schemaVersion:'1.0.0',workers:[{id:'automation-2',label:'Content',enabled:true,mode:'fixture',contract:'automation-6/report-v1@1.0.0',adapter:'report-file',path:reportPath},{id:'automation-6',label:'QA',enabled:true,mode:'live',contract:'automation-6/report-v1@1.0.0',adapter:'hub-index',path:join(directory,'missing.json')}]}));
  const result = await loadWorkerReports(configPath); assert.equal(result.reports[0].workerId,'automation-2'); assert.equal(result.reports[0].mode,'fixture'); assert.match(result.warnings[0],/automation-6/);
  const detail = await loadWorkerRunDetails('automation-2',configPath); assert.equal(detail.state,'available'); assert.equal(detail.runs[0].runId,'a2'); assert.equal(detail.mode,'fixture');
  const degraded = await loadWorkerRunDetails('automation-6',configPath); assert.equal(degraded.state,'degraded'); assert.match(degraded.warning,/not available/i);
});

test('history export, lossless retention archive, and idempotent import preserve event provenance', async () => {
  const directory=await mkdtemp(join(tmpdir(),'hub-lifecycle-')); process.env.HUB_HISTORY_PATH=join(directory,'activity.jsonl'); process.env.HUB_HISTORY_ARCHIVE_DIR=join(directory,'archives');
  try {
    await appendHistory({type:'approval-decision',title:'One',provenance:'local'}); await appendHistory({type:'approval-decision',title:'Two',provenance:'local'}); await appendHistory({type:'approval-decision',title:'Three',provenance:'local'});
    const bundle=await exportHistory(); assert.equal(bundle.eventCount,3); assert.ok(bundle.events.every((event)=>event.provenance==='local'));
    const retention=await retainHistory(2); assert.equal(retention.archived,1); assert.equal((await readdir(process.env.HUB_HISTORY_ARCHIVE_DIR)).length,1); assert.equal((await readHistory()).events.length,2);
    const imported=await importHistory(bundle); assert.equal(imported.imported,1); assert.equal(imported.duplicates,2); assert.equal((await readHistory()).events.length,3);
    const repeated=await importHistory(bundle); assert.equal(repeated.imported,0); assert.equal(repeated.duplicates,3);
  } finally { delete process.env.HUB_HISTORY_PATH; delete process.env.HUB_HISTORY_ARCHIVE_DIR; }
});
