import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const VERSION = '1.0.0';
function validateReport(report) {
  if (!report || report.schemaVersion !== VERSION || !Array.isArray(report.results) || !Array.isArray(report.approvals) || !report.summary) throw new Error('Unsupported report-v1 result');
  return report;
}
async function json(path) { return JSON.parse(await readFile(resolve(path), 'utf8')); }
async function registry(configPath) { const config = await json(configPath); if (config.schemaVersion !== VERSION || !Array.isArray(config.workers)) throw new Error('Unsupported worker registry'); return config; }
function workerPath(worker){const key=`HUB_${worker.id.toUpperCase().replace(/-/g,'_')}_REPORT_PATH`;return process.env[key]||worker.path;}

export async function loadWorkerReports(configPath = process.env.HUB_WORKERS_CONFIG || 'config/hub-workers.example.json') {
  let config;
  try { config = await json(configPath); } catch (error) {
    if (error.code === 'ENOENT') return { reports: [], warnings: [`Worker registry not found: ${configPath}`] };
    throw error;
  }
  if (config.schemaVersion !== VERSION || !Array.isArray(config.workers)) throw new Error('Unsupported worker registry');
  const reports = [], warnings = [];
  for (const worker of config.workers.filter((item) => item.enabled)) {
    try {
      if (worker.contract !== 'automation-6/report-v1@1.0.0' || !['live', 'fixture'].includes(worker.mode)) throw new Error('Unsupported worker contract');
      let report;
      if (worker.adapter === 'report-file') report = validateReport(await json(workerPath(worker)));
      else if (worker.adapter === 'hub-index') {
        const index = await json(worker.path); if (index.schemaVersion !== VERSION || !index.runs?.length) throw new Error('No indexed runs available');
        const latest = index.runs.find((run) => run.runId === index.latestRunId) || index.runs[0]; report = validateReport(await json(latest.reportPath));
      } else throw new Error('Unsupported worker adapter');
      reports.push({ workerId: worker.id, label: worker.label, mode: worker.mode, contract: worker.contract, report });
    } catch (error) { warnings.push(`${worker.id}: ${error.code === 'ENOENT' ? 'configured result artifact is not available' : error.message}`); }
  }
  return { reports, warnings };
}

export async function loadWorkerRunDetails(workerId, configPath = process.env.HUB_WORKERS_CONFIG || 'config/hub-workers.example.json') {
  const config = await registry(configPath); const worker = config.workers.find((item)=>item.enabled && item.id===workerId);
  if (!worker) return { workerId, state:'degraded', mode:'unknown', contract:null, runs:[], warning:'Worker is not configured or enabled' };
  if (worker.contract !== 'automation-6/report-v1@1.0.0') return { workerId, state:'degraded', mode:worker.mode, contract:worker.contract, runs:[], warning:'Unsupported worker contract' };
  try {
    let reports;
    if (worker.adapter === 'report-file') reports = [validateReport(await json(workerPath(worker)))];
    else if (worker.adapter === 'hub-index') { const index=await json(worker.path); if(index.schemaVersion!==VERSION||!index.runs?.length) throw new Error('No indexed runs available'); reports=await Promise.all(index.runs.map(async(run)=>validateReport(await json(run.reportPath)))); }
    else throw new Error('Unsupported worker adapter');
    return { workerId,label:worker.label,state:'available',mode:worker.mode,contract:worker.contract,runs:reports.map((report)=>({runId:report.runId,status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,summary:report.summary,results:report.results,approvals:report.approvals})) };
  } catch (error) { return { workerId,label:worker.label,state:'degraded',mode:worker.mode,contract:worker.contract,runs:[],warning:error.code==='ENOENT'?'Configured result artifact is not available':error.message }; }
}
