import path from 'node:path';
import { checkTarget, runCommand, writeRun, updateHubIndex, REPORT_SCHEMA_VERSION } from '../core.mjs';

let activeRecheck;

export function runHubRecheck(origin) {
  if (activeRecheck) return activeRecheck;
  activeRecheck = performRecheck(origin).finally(() => { activeRecheck = undefined; });
  return activeRecheck;
}

async function performRecheck(origin) {
  const url = new URL(origin);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Recheck is restricted to the local Hub');
  const startedAt = new Date().toISOString();
  const runId = `${startedAt.replace(/[:.]/g, '-')}-${process.pid}`;
  const results = await checkTarget({ id:'management-hub', url:`${url.origin}/`, checks:['health','seo'] }, { timeoutMs:10000, maxBodyBytes:1000000 });
  results.push(await runCommand({ id:'management-hub-tests', kind:'regression', executable:process.execPath, args:['--test'], timeoutMs:300000 }, process.cwd()));
  const summary = { passed:0, warning:0, failed:0, skipped:0 };
  for (const item of results) summary[item.status]++;
  const status = summary.failed ? 'failed' : summary.warning ? 'warning' : 'passed';
  const finishedAt = new Date().toISOString();
  const approvals = [{
    id:`deploy-management-hub-${runId}`,
    action:'Approve Management Hub deployment handoff',
    reason:'Local Hub health, metadata, and the complete automated test suite were rechecked. Approval authorizes a separate deployment step; it does not deploy automatically.',
    risk:'medium', status:'pending', capturedAt:finishedAt, evidenceStatus:status,
    knownFailures:summary.failed,
    evidenceRefs:[{label:'Recheck evidence',url:'/#activity'},{label:'Worker run details',url:'/#worker-evidence'}]
  }];
  const report = { schemaVersion:REPORT_SCHEMA_VERSION, runId, startedAt, finishedAt, status, summary, results, approvals, source:{kind:'manual-local-recheck',target:`${url.origin}/`,gitSha:null} };
  const directory = await writeRun(path.resolve('artifacts/runs'), report);
  const configuredIndex = path.resolve(process.env.HUB_RUN_INDEX_PATH || 'artifacts/hub/runs-v1.json');
  await updateHubIndex(path.dirname(configuredIndex), report, path.join(directory,'report.json'));
  return { runId, status, summary, approvalReady:status==='passed', note:status==='passed'?'Recheck passed. Deployment handoff is ready for owner review.':'Recheck completed with issues. Review evidence before approval.' };
}
